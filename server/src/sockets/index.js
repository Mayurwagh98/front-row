import { Server } from 'socket.io';
import Seat from '../models/Seat.model.js';
import { releaseSeat } from '../utils/seatLock.js';

/**
 * Sockets only BROADCAST state. Who wins a seat is already decided atomically by
 * Redis SET NX before any event is emitted, so sockets can't introduce races.
 */
export function initSocket(httpServer, corsOrigin) {
  const io = new Server(httpServer, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] } });

  io.on('connection', (socket) => {
    socket.on('join-showtime', (showtimeId) => socket.join(`showtime:${showtimeId}`));
    socket.on('leave-showtime', (showtimeId) => socket.leave(`showtime:${showtimeId}`));

    // Client-initiated release (e.g. user deselects a seat). Ownership is verified
    // in Redis via the Lua compare-and-delete, so one user can't free another's hold.
    socket.on('seat-released', async ({ showtimeId, seatId, sessionId }) => {
      if (await releaseSeat(showtimeId, seatId, sessionId)) {
        await Seat.findByIdAndUpdate(seatId, { status: 'available', lockedBy: null });
        io.to(`showtime:${showtimeId}`).emit('seat-released', { seatIds: [seatId] });
      }
    });

    // No forced release on disconnect: the Redis TTL cleans up abandoned holds and
    // tolerates brief reconnects.
  });

  return io;
}
