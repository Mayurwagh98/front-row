import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    showtime: { type: mongoose.Schema.Types.ObjectId, ref: 'Showtime', required: true },
    seats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true }],
    userId: { type: String, required: true },
    subtotal: { type: Number, default: 0 },
    convenienceFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'failed', 'cancelled'], default: 'pending' },
    paymentRef: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Booking', bookingSchema);
