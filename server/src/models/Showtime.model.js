import mongoose from "mongoose";

const showtimeSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie" },
    movieTitle: { type: String, required: true }, // denormalised so listings/tickets need no join
    venue: { type: String, required: true },
    screen: { type: String, required: true },
    startTime: { type: Date, required: true },
    totalSeats: { type: Number, required: true },
    price: { type: Number, required: true }, // "from" price = cheapest tier (shown in listings)
    tiers: [{ name: String, price: Number, _id: false }], // legend: Classic / Prime / Recliner
  },
  { timestamps: true },
);

export default mongoose.model("Showtime", showtimeSchema);
