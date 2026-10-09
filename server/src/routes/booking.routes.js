import { Router } from 'express';
import { myBookings } from '../controllers/booking.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';

const router = Router();
router.get('/mine', requireAuth, h(myBookings));

export default router;
