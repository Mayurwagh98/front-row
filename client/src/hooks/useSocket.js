import { useEffect, useRef } from "react";
import { useSocketContext } from "../context/SocketContext.jsx";

/**
 * Joins the showtime room and subscribes to seat events.
 * Handlers are kept in a ref so callers can pass inline functions without
 * re-subscribing on every render.
 *
 * `onSync` fires on every (re)connect: events missed while offline are gone,
 * so the caller should refetch the seat list from the REST API to resync.
 */
export function useShowtimeSocket(showtimeId, handlers) {
  const { socket, status } = useSocketContext();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!socket || !showtimeId) return;

    const join = () => {
      socket.emit("join-showtime", showtimeId); // rooms are lost on reconnect -> rejoin
      ref.current.onSync?.();
    };
    const locked = (p) => ref.current.onLocked?.(p);
    const released = (p) => ref.current.onReleased?.(p);
    const booked = (p) => ref.current.onBooked?.(p);
    const deleted = (p) => ref.current.onDeleted?.(p);

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("seat-locked", locked);
    socket.on("seat-released", released);
    socket.on("seat-booked", booked);
    socket.on("showtime-deleted", deleted);

    return () => {
      socket.emit("leave-showtime", showtimeId);
      socket.off("connect", join);
      socket.off("seat-locked", locked);
      socket.off("seat-released", released);
      socket.off("seat-booked", booked);
      socket.off("showtime-deleted", deleted);
    };
  }, [socket, showtimeId]);

  return status;
}
