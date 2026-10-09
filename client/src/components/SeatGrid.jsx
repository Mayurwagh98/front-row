import { memo } from 'react';

/**
 * A curved auditorium: each row bows toward the screen (edge seats sit a few px lower),
 * with a centre aisle. State is shown by fill + pattern + icon so it's readable without colour.
 *  available  light velvet, clickable
 *  mine       brass, glowing, clickable (click again to release)
 *  locked     hatched + lock icon  (someone else's hold, live via socket)
 *  booked     dark + ×
 * `pending` = a lock/release request is in flight (UI guard only; the atomic Redis SET NX is the real protection).
 */
const Lock = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
    <path d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
  </svg>
);

const SeatButton = memo(function SeatButton({ seat, state, pending, flash, dy, onClick }) {
  const disabled = state === 'locked' || state === 'booked' || pending;
  const label = { available: 'available', mine: 'held by you', locked: 'held by someone else', booked: 'booked' }[state];
  return (
    <button
      type="button"
      className={`seat w-full ${flash ? 'animate-seat-pop' : ''}`}
      data-state={state}
      data-tier={seat.tier}
      data-pending={pending}
      disabled={disabled}
      aria-label={`Seat ${seat.seatNumber}, ${seat.tier} ₹${seat.price}, ${label}`}
      title={`${seat.seatNumber} · ${seat.tier} · ₹${seat.price}`}
      aria-pressed={state === 'mine'}
      style={{ marginTop: dy }}
      onClick={() => onClick(seat)}
    >
      {state === 'locked' ? <Lock /> : state === 'booked' ? '×' : seat.seatNumber}
    </button>
  );
});

export default function SeatGrid({ seats, mySessionId, pendingIds, flashIds, onToggle }) {
  const rows = seats.reduce((acc, s) => ((acc[s.row] ||= []).push(s), acc), {});
  const stateOf = (s) => {
    if (s.status === 'booked') return 'booked';
    if (s.status === 'locked') return s.lockedBy === mySessionId ? 'mine' : 'locked';
    return 'available';
  };

  return (
    <div className="relative overflow-x-auto pb-2">
      <div className="relative mx-auto w-full min-w-[30rem] max-w-[56rem] px-2">
        {/* Screen + projector beam */}
        <div className="pointer-events-none relative mx-auto mb-10 w-[88%] max-w-xl">
          <div className="h-8 rounded-t-[50%] border-t-[3px] border-brass/80 shadow-[0_-18px_40px_-8px_rgba(210,168,87,.45)]" />
          <div
            className="absolute inset-x-0 top-8 h-40 animate-beam bg-gradient-to-b from-brass/25 to-transparent"
            style={{ clipPath: 'polygon(6% 0, 94% 0, 100% 100%, 0 100%)' }}
          />
          <p className="mt-2 text-center text-xs text-mist">Screen</p>
        </div>

        <div className="relative space-y-2.5">
          {Object.entries(rows).map(([row, list]) => {
            const n = list.length;
            const mid = (n - 1) / 2;
            return (
              <div key={row} className="flex items-start justify-center gap-1 sm:gap-2">
                <span className="mt-2 w-4 shrink-0 text-right text-xs font-semibold text-mist">{row}</span>
                {list.map((s, i) => (
                  // Seats share the row width and shrink to fit (capped at their natural size; recliners are wider)
                  <div
                    key={s._id}
                    className={i === Math.floor(n / 2) ? 'ml-3 sm:ml-8' : ''}
                    style={{ flex: '1 1 0', minWidth: '1.5rem', maxWidth: s.tier === 'Recliner' ? '2.7rem' : '2.15rem' }}
                  >
                    <SeatButton
                      seat={s}
                      state={stateOf(s)}
                      pending={pendingIds.has(s._id)}
                      flash={flashIds.has(s._id)}
                      dy={Math.round(((i - mid) / (mid || 1)) ** 2 * 9)}
                      onClick={onToggle}
                    />
                  </div>
                ))}
                <span className="mt-2 w-4 shrink-0 text-xs font-semibold text-mist">{row}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
