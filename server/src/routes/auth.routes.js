import { Router } from 'express';
import { signup, login, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';

const router = Router();
router.post('/signup', h(signup));
router.post('/login', h(login));
router.get('/me', requireAuth, h(me));

export default router;
