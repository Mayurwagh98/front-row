import mongoose from "mongoose";

// Mongo = durable source of truth for "booked". Redis = temporary 5-min lock.
const seatSchema = new mongoose.Schema(
  {
    showtime: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
      index: true,
    },
    seatNumber: { type: String, required: true },
    row: { type: String, required: true },
    tier: { type: String, default: "Standard" },
    price: { type: Number }, // per-seat price; the server (not the client) uses this to compute totals
    status: {
      type: String,
      enum: ["available", "locked", "booked"],
      default: "available",
    },
    lockedBy: { type: String, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

seatSchema.index({ showtime: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model("Seat", seatSchema);
