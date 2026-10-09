import 'dotenv/config';
import mongoose from 'mongoose';
import Showtime from './models/Showtime.model.js';
import Seat from './models/Seat.model.js';
import Movie from './models/Movie.model.js';

await mongoose.connect(process.env.MONGO_URI);
await Promise.all([Showtime.deleteMany({}), Seat.deleteMany({}), Movie.deleteMany({})]); // users are kept

// Like a real multiplex: front rows are cheapest, middle rows are the sweet spot, back rows are recliners.
const TIERS = [
  { name: 'Classic', price: 180, rows: ['A', 'B'] },
  { name: 'Prime', price: 260, rows: ['C', 'D', 'E', 'F'] },
  { name: 'Recliner', price: 420, rows: ['G', 'H'] },
];
const SEATS_PER_ROW = 10;

const movie = await Movie.create({ title: 'Inception', genre: 'Sci-Fi', language: 'English', durationMins: 148, description: 'A thief who steals secrets through dreams is offered one last job.' });

const showtime = await Showtime.create({
  movie: movie._id, movieTitle: movie.title, venue: 'PVR Cinemas', screen: 'Screen 1',
  startTime: new Date(Date.now() + 3600 * 1000),
  totalSeats: TIERS.reduce((n, t) => n + t.rows.length * SEATS_PER_ROW, 0),
  price: Math.min(...TIERS.map((t) => t.price)),
  tiers: TIERS.map(({ name, price }) => ({ name, price })),
});

const seats = [];
for (const t of TIERS) {
  for (const row of t.rows) {
    for (let i = 1; i <= SEATS_PER_ROW; i++) {
      seats.push({ showtime: showtime._id, seatNumber: `${row}${i}`, row, tier: t.name, price: t.price });
    }
  }
}
await Seat.insertMany(seats);
console.log(`Seeded "${showtime.movieTitle}" with ${seats.length} seats. Showtime id: ${showtime._id}`);
process.exit(0);
