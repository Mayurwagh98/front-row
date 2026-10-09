import Booking from '../models/Booking.model.js';

export async function myBookings(req, res) {
  const bookings = await Booking.find({ userId: req.user.id, status: 'confirmed' })
    .sort({ createdAt: -1 })
    .populate('showtime', 'movieTitle venue screen startTime')
    .populate('seats', 'seatNumber tier price');
  res.json(bookings);
}
