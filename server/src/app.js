import express from 'express';
import cors from 'cors';
import checkoutRoutes from './routes/checkout.routes.js';
import showtimeRoutes from './routes/showtime.routes.js';
import authRoutes from './routes/auth.routes.js';
import movieRoutes from './routes/movie.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import uploadRoutes, { UPLOAD_DIR } from './routes/upload.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/checkout', checkoutRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' })); // uploaded posters
app.use(errorHandler);

export default app;
