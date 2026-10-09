import { Router } from 'express';
import { listShowtimes, getShowtimeSeats, createShowtime } from '../controllers/showtime.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';

const router = Router();
router.get('/', h(listShowtimes));
router.get('/:id/seats', h(getShowtimeSeats));
router.post('/', requireAuth, requireAdmin, h(createShowtime)); // admin only

export default router;
