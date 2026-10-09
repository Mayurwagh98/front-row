import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext({ socket: null, status: "connecting" });
export const useSocketContext = () => useContext(SocketContext);

/**
 * One socket per browser tab, created once and torn down on unmount.
 * socket.io handles reconnection with exponential backoff; we mirror its state
 * into React ('connecting' | 'connected' | 'reconnecting' | 'disconnected') so the UI can show it.
 */
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const s = io(import.meta.env.VITE_SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    setSocket(s);

    s.on("connect", () => setStatus("connected"));
    s.on("disconnect", () => setStatus("disconnected"));
    s.on("connect_error", () => setStatus("reconnecting"));
    s.io.on("reconnect_attempt", () => setStatus("reconnecting"));

    return () => s.disconnect();
  }, []);

  const value = useMemo(() => ({ socket, status }), [socket, status]);
  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
