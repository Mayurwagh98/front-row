import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Upload from '../models/Upload.model.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => cb(ALLOWED.has(file.mimetype) ? null : new Error('BAD_TYPE'), ALLOWED.has(file.mimetype)),
});

// POST /api/uploads/poster  (admin only)
export const uploadRouter = Router();
uploadRouter.post('/poster', requireAuth, requireAdmin, upload.single('poster'), h(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
  const doc = await Upload.create({ data: req.file.buffer, contentType: req.file.mimetype });
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ success: true, url: `${base}/uploads/${doc._id}` });
}));

// GET /uploads/:id  (public: it's just a poster image)
export const imageRouter = Router();
imageRouter.get('/:id', h(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  const doc = await Upload.findById(req.params.id);
  if (!doc) return res.sendStatus(404);
  res.set({
    'Content-Type': doc.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin', // the app (another origin) embeds these images
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(doc.data);
}));
