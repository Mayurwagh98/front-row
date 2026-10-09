import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

// Extension comes from the verified mimetype, never from the client's filename.
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT[file.mimetype]),
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => cb(EXT[file.mimetype] ? null : new Error('BAD_TYPE'), !!EXT[file.mimetype]),
});

const router = Router();
// Admin only: posters are uploaded while creating a movie.
router.post('/poster', requireAuth, requireAdmin, upload.single('poster'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ success: true, url: `${base}/uploads/${req.file.filename}` });
});

export default router;
