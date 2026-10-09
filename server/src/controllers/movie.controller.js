import mongoose from "mongoose";
import Movie from "../models/Movie.model.js";
import Showtime from "../models/Showtime.model.js";
import Seat from "../models/Seat.model.js";
import Booking from "../models/Booking.model.js";
import Upload from "../models/Upload.model.js";
import { clearLocks } from "../utils/seatLock.js";

// A Google Images result link is a web page; the real image address is in its `imgurl` parameter.
function cleanPosterUrl(raw = "") {
  try {
    const u = new URL(raw.trim());
    if (
      /(^|\.)google\.[a-z.]+$/i.test(u.hostname) &&
      u.pathname === "/imgres" &&
      u.searchParams.get("imgurl")
    )
      return u.searchParams.get("imgurl");
    return u.href;
  } catch {
    return raw;
  }
}

export const listMovies = async (req, res) =>
  res.json(await Movie.find().sort({ createdAt: -1 }));

export async function createMovie(req, res) {
  const { title, description, genre, language, durationMins } = req.body;
  const posterUrl = cleanPosterUrl(req.body.posterUrl);
  if (!title?.trim() || !(Number(durationMins) > 0)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "A title and a duration in minutes are required.",
      });
  }
  if (posterUrl && !/^https?:\/\//i.test(posterUrl)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Poster URL must start with http:// or https://",
      });
  }
  const movie = await Movie.create({
    title,
    description,
    genre,
    language,
    durationMins: Number(durationMins),
    posterUrl,
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, movie });
}

/**
 * Delete a movie and everything hanging off it:
 *   Mongo (one transaction): bookings -> seats -> showtimes -> movie
 *   then Redis: the 5-minute seat holds for those showtimes
 *   then the uploaded poster, if no other movie uses it
 * Connected viewers get `showtime-deleted` so their seat map doesn't go stale.
 */
export async function deleteMovie(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid movie id." });
  }
  const movie = await Movie.findById(id);
  if (!movie) {
    return res.status(404).json({ success: false, message: "Movie not found." });
  }

  const showtimes = await Showtime.find({ movie: id }).select("_id");
  const showtimeIds = showtimes.map((s) => s._id);
  const seats = await Seat.find({ showtime: { $in: showtimeIds } }).select("_id showtime");

  const session = await mongoose.startSession();
  let bookingsDeleted = 0;
  try {
    await session.withTransaction(async () => {
      const b = await Booking.deleteMany({ showtime: { $in: showtimeIds } }, { session });
      bookingsDeleted = b.deletedCount;
      await Seat.deleteMany({ showtime: { $in: showtimeIds } }, { session });
      await Showtime.deleteMany({ movie: id }, { session });
      await Movie.deleteOne({ _id: id }, { session });
    });
  } finally {
    await session.endSession();
  }

  // Redis cleanup after Mongo commits. Failure here is harmless (keys expire in 5 min), so don't fail the request.
  const byShowtime = new Map();
  for (const s of seats) {
    const k = String(s.showtime);
    if (!byShowtime.has(k)) byShowtime.set(k, []);
    byShowtime.get(k).push(s._id);
  }
  let locksCleared = 0;
  await Promise.all(
    [...byShowtime].map(async ([sid, ids]) => {
      try {
        locksCleared += await clearLocks(sid, ids);
      } catch (err) {
        console.error("redis cleanup failed:", err.message);
      }
    }),
  );

  // Uploaded poster lives in Mongo (/uploads/<id>); remove it unless another movie still points at it.
  const m = /\/uploads\/([a-f0-9]{24})(?:[/?#]|$)/i.exec(movie.posterUrl || "");
  if (m && !(await Movie.exists({ posterUrl: movie.posterUrl }))) {
    await Upload.deleteOne({ _id: m[1] });
  }

  const io = req.app.get("io");
  for (const sid of showtimeIds) io.to(`showtime:${sid}`).emit("showtime-deleted", { showtimeId: String(sid) });

  res.json({
    success: true,
    deleted: { showtimes: showtimeIds.length, seats: seats.length, bookings: bookingsDeleted, locksCleared },
  });
}
