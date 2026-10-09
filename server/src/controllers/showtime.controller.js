import Showtime from '../models/Showtime.model.js';
import Movie from '../models/Movie.model.js';
import Seat from '../models/Seat.model.js';
import { PRICING } from '../utils/pricing.js';
import { redis } from '../config/redis.js';

export const listShowtimes = async (req, res) => {
  res.json(await Showtime.find().sort({ startTime: 1 }).populate('movie', 'genre language durationMins posterUrl'));
};

export const getShowtimeSeats = async (req, res) => {
  const { id } = req.params;
  const [showtime, seats] = await Promise.all([
    Showtime.findById(id).populate('movie', 'posterUrl genre durationMins language'),
    Seat.find({ showtime: id }).lean(),
  ]);
  if (!showtime) return res.status(404).json({ message: 'Showtime not found' });

  // Natural order (A1, A2 … A10). A DB string sort would put A10 right after A1.
  seats.sort((a, b) => a.row.localeCompare(b.row) || parseInt(a.seatNumber.slice(1)) - parseInt(b.seatNumber.slice(1)));

  // Self-heal: Mongo may still say "locked" after the Redis TTL expired.
  // Redis is authoritative for locks, so reconcile on read.
  const lockedSeats = seats.filter((s) => s.status === 'locked');
  if (lockedSeats.length) {
    const owners = await Promise.all(lockedSeats.map((s) => redis.get(`lock:seat:${id}:${s._id}`)));
    const expired = lockedSeats.filter((_, i) => !owners[i]);
    if (expired.length) {
      await Seat.updateMany({ _id: { $in: expired.map((s) => s._id) } }, { $set: { status: 'available', lockedBy: null } });
      expired.forEach((s) => { s.status = 'available'; s.lockedBy = null; });
    }
  }
  res.json({ showtime, seats, pricing: PRICING });
};

/**
 * Admin: schedule a movie. Tiers are listed front-to-back, e.g. [{name:'Classic',price:180,rows:2}, ...];
 * rows get letters A, B, C… in that order and seats are generated for each row.
 */
export const createShowtime = async (req, res) => {
  const { movieId, venue, screen, startTime, seatsPerRow = 10, tiers } = req.body;
  const perRow = Number(seatsPerRow);
  const start = new Date(startTime);
  const cleanTiers = (tiers || []).map((t) => ({ name: String(t.name || '').trim(), price: Number(t.price), rows: Number(t.rows) }));
  const totalRows = cleanTiers.reduce((n, t) => n + t.rows, 0);

  if (!venue?.trim() || !screen?.trim() || isNaN(start) || start < new Date()) {
    return res.status(400).json({ success: false, message: 'Venue, screen and a future start time are required.' });
  }
  if (!(perRow >= 4 && perRow <= 20)) return res.status(400).json({ success: false, message: 'Seats per row must be between 4 and 20.' });
  if (!cleanTiers.length || cleanTiers.some((t) => !t.name || !(t.price > 0) || !Number.isInteger(t.rows) || t.rows < 1) || totalRows > 26) {
    return res.status(400).json({ success: false, message: 'Add at least one tier with a name, a price above 0 and 1 or more rows (26 rows max in total).' });
  }
  const movie = await Movie.findById(movieId);
  if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });

  const showtime = await Showtime.create({
    movie: movie._id, movieTitle: movie.title, venue, screen, startTime: start,
    totalSeats: totalRows * perRow,
    price: Math.min(...cleanTiers.map((t) => t.price)),
    tiers: cleanTiers.map(({ name, price }) => ({ name, price })),
  });

  const docs = [];
  let rowIdx = 0;
  for (const t of cleanTiers) {
    for (let r = 0; r < t.rows; r++) {
      const row = String.fromCharCode(65 + rowIdx++);
      for (let i = 1; i <= perRow; i++) docs.push({ showtime: showtime._id, seatNumber: `${row}${i}`, row, tier: t.name, price: t.price });
    }
  }
  try {
    await Seat.insertMany(docs);
  } catch (err) {
    await Showtime.deleteOne({ _id: showtime._id }); // don't leave a showtime with no seats
    throw err;
  }
  res.status(201).json({ success: true, showtime });
};
