import { useEffect, useState } from "react";

/**
 * Countdown strip. `expiresAt` is derived from the server's `expiresIn` (the Redis TTL),
 * so it mirrors the real lock lifetime. The strip shortens as time runs out.
 */
export default function CheckoutTimer({
  expiresAt,
  totalSeconds = 300,
  onExpire,
}) {
  const calc = () => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const [left, setLeft] = useState(calc);

  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => {
      const s = calc();
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const urgent = left <= 60;

  return (
    <div role="timer" aria-live="off">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-stub/70">Seats held for</span>
        <span
          className={`font-display text-3xl font-extrabold tabular-nums ${urgent ? "text-red-700" : "text-stub"}`}
        >
          {mm}:{ss}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stub/15">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-red-700" : "bg-stub"}`}
          style={{ width: `${Math.min(100, (left / totalSeconds) * 100)}%` }}
        />
      </div>
    </div>
  );
}
