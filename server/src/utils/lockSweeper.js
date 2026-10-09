import Seat from '../models/Seat.model.js';
import { getLockOwner } from './seatLock.js';

/**
 * Redis TTL expiry is silent (no event reaches Node), so Mongo/clients would keep showing
 * "locked" after a hold lapses. This sweeper reconciles: any seat Mongo calls "locked"
 * whose Redis key is gone is reset to "available" and a `seat-released` event is broadcast.
 * Redis stays the authority on locks; Mongo status is only a display mirror.
 */
export function startLockSweeper(io, intervalMs = 10_000) {
  setInterval(async () => {
    try {
      const locked = await Seat.find({ status: 'locked' }).select('_id showtime').lean();
      const byShowtime = new Map();
      await Promise.all(
        locked.map(async (s) => {
          if (await getLockOwner(s.showtime, s._id)) return; // still held
          const k = String(s.showtime);
          byShowtime.set(k, [...(byShowtime.get(k) || []), s._id]);
        })
      );
      for (const [showtimeId, ids] of byShowtime) {
        await Seat.updateMany({ _id: { $in: ids }, status: 'locked' }, { $set: { status: 'available', lockedBy: null } });
        io.to(`showtime:${showtimeId}`).emit('seat-released', { seatIds: ids });
      }
    } catch (err) {
      console.error('lock sweeper error:', err.message);
    }
  }, intervalMs);
}
