import mongoose from "mongoose";
import Seat from "../models/Seat.model.js";
import Booking from "../models/Booking.model.js";
import Showtime from "../models/Showtime.model.js";
import { computeTotals } from "../utils/pricing.js";
import {
  lockSeats,
  releaseSeat,
  getLockOwner,
  LOCK_TTL_SECONDS,
} from "../utils/seatLock.js";

const room = (showtimeId) => `showtime:${showtimeId}`;

/**
 * POST /api/checkout/lock
 * Layer 1 of race protection: Redis SET NX (atomic). Whoever wins the SET owns the seat.
 * Losers get 409 immediately without touching Mongo.
 */
export async function handleLockSeats(req, res) {
  const { showtimeId, seatIds, sessionId } = req.body;
  if (!showtimeId || !Array.isArray(seatIds) || !seatIds.length || !sessionId) {
    return res
      .status(400)
      .json({
        success: false,
        message: "showtimeId, seatIds[], sessionId required",
      });
  }

  // Don't even try to lock seats that are already permanently booked.
  const booked = await Seat.countDocuments({
    _id: { $in: seatIds },
    status: "booked",
  });
  if (booked)
    return res
      .status(409)
      .json({ success: false, message: "Seat already booked" });

  const { ok, failedSeatId } = await lockSeats(showtimeId, seatIds, sessionId);
  if (!ok) {
    return res
      .status(409)
      .json({
        success: false,
        message: `Seat ${failedSeatId} is held by another user`,
        seatId: failedSeatId,
      });
  }

  await Seat.updateMany(
    { _id: { $in: seatIds } },
    { $set: { status: "locked", lockedBy: sessionId } },
  );
  req.app
    .get("io")
    .to(room(showtimeId))
    .emit("seat-locked", { seatIds, sessionId });

  res.json({
    success: true,
    lockedSeatIds: seatIds,
    expiresIn: LOCK_TTL_SECONDS,
  });
}

/**
 * POST /api/checkout/release
 * Explicitly give up seats before the TTL runs out.
 */
export async function handleReleaseSeats(req, res) {
  const { showtimeId, seatIds, sessionId } = req.body;
  const released = [];
  for (const id of seatIds || []) {
    if (await releaseSeat(showtimeId, id, sessionId)) released.push(id);
  }
  if (released.length) {
    await Seat.updateMany(
      { _id: { $in: released }, status: "locked" },
      { $set: { status: "available", lockedBy: null } },
    );
    req.app
      .get("io")
      .to(room(showtimeId))
      .emit("seat-released", { seatIds: released });
  }
  res.json({ success: true, released });
}

/**
 * POST /api/checkout/confirm
 * Layer 2: verify Redis lock ownership, then a MongoDB transaction flips seats to
 * "booked" and creates the Booking atomically. The conditional update
 * (status != booked) inside the transaction guarantees no double booking even if
 * the lock expired mid-payment and someone else grabbed + booked the seat.
 */
export async function handleConfirmBooking(req, res) {
  const { showtimeId, seatIds, sessionId } = req.body;
  const userId = req.user.id; // from the verified JWT: a client can't book on someone else's behalf
  if (!showtimeId || !Array.isArray(seatIds) || !seatIds.length || !sessionId) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  // Lock ownership check (fails fast if the 5-min hold expired)
  for (const id of seatIds) {
    if ((await getLockOwner(showtimeId, id)) !== sessionId) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Your seat hold expired. Please reselect seats.",
        });
    }
  }

  const session = await mongoose.startSession();
  try {
    let booking;
    await session.withTransaction(async () => {
      // Atomic conditional write: only matches seats not yet booked.
      const result = await Seat.updateMany(
        {
          _id: { $in: seatIds },
          showtime: showtimeId,
          status: { $ne: "booked" },
        },
        {
          $set: { status: "booked", lockedBy: sessionId },
          $inc: { version: 1 },
        },
        { session },
      );
      if (result.modifiedCount !== seatIds.length)
        throw new Error("One or more seats were already booked");

      // Price is derived on the server from each seat's own tier price. Never trust a client-sent total.
      const showtime = await Showtime.findById(showtimeId).session(session);
      const seatDocs = await Seat.find({ _id: { $in: seatIds } }).session(
        session,
      );
      const { subtotal, convenienceFee, tax, total } = computeTotals(
        seatDocs,
        showtime.price,
      );
      [booking] = await Booking.create(
        [
          {
            showtime: showtimeId,
            seats: seatIds,
            userId,
            subtotal,
            convenienceFee,
            tax,
            totalAmount: total,
            status: "confirmed",
          },
        ],
        { session },
      );
    });

    // Durable state committed -> safe to drop the Redis holds.
    await Promise.all(
      seatIds.map((id) => releaseSeat(showtimeId, id, sessionId)),
    );
    req.app.get("io").to(room(showtimeId)).emit("seat-booked", { seatIds });
    res.status(201).json({ success: true, booking });
  } catch (err) {
    res.status(409).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
}
