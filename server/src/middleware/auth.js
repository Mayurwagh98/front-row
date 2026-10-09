import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

/** Verifies the Bearer token and attaches { id, role } to req.user. */
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Your session expired. Please sign in again.' });
  }
}

/**
 * Admin check reads the role from the DATABASE, not the token, so demoting an admin
 * takes effect immediately instead of when their old token expires.
 */
export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('role');
    if (user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only.' });
    next();
  } catch (err) { next(err); }
}
