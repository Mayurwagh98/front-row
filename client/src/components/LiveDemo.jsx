import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SeatGrid from './SeatGrid.jsx';
import TicketPanel from './TicketPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { calcTotals } from '../utils/pricing.js';

/**
 * A fully local, no-account demo of the real seat map and ticket. Nothing here touches the server.
 * A tiny "other visitors" simulation locks, releases and books seats so the live behaviour is visible:
 * those seats flash, then turn hatched (held by someone else) or dark (booked).
 */
const ME = 'you';
const GHOST = 'someone-else';
const MAX = 6;
const PRICING = { feePerTicket: 30, gstRate: 0.18 };
const TIERS = [
  { row: 'A', tier: 'Classic', price: 180 },
  { row: 'B', tier: 'Classic', price: 180 },
  { row: 'C', tier: 'Prime', price: 260 },
  { row: 'D', tier: 'Prime', price: 260 },
  { row: 'E', tier: 'Recliner', price: 420 },
];
const PRE_BOOKED = new Set(['B4', 'B5', 'C7', 'C8', 'D2', 'D3', 'E9']);

const initialSeats = () =>
  TIERS.flatMap((t) =>
    Array.from({ length: 10 }, (_, i) => {
      const seatNumber = `${t.row}${i + 1}`;
      return { _id: seatNumber, seatNumber, row: t.row, tier: t.tier, price: t.price, status: PRE_BOOKED.has(seatNumber) ? 'booked' : 'available', lockedBy: null };
    })
  );

const DEMO_SHOWTIME = {
  _id: 'demo',
  movieTitle: 'Sample screening',
  venue: 'Front Row Cinemas',
  screen: 'Screen 1',
  startTime: new Date(new Date().setHours(19, 30, 0, 0)).toISOString(),
  price: 180,
};

export default function LiveDemo() {
  const { user } = useAuth();
  const [seats, setSeats] = useState(initialSeats);
  const [flashIds, setFlashIds] = useState(new Set());
  const [expiresAt, setExpiresAt] = useState(null);
  const [note, setNote] = useState('');
  const [showPay, setShowPay] = useState(false);
  const timers = useRef(new Set());
  const noPending = useMemo(() => new Set(), []);

  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  }, []);

  const patch = useCallback((ids, changes) => setSeats((s) => s.map((x) => (ids.includes(x._id) ? { ...x, ...changes } : x))), []);
  const pulse = useCallback((id) => {
    setFlashIds((f) => new Set(f).add(id));
    later(() => setFlashIds((f) => { const n = new Set(f); n.delete(id); return n; }), 900);
  }, [later]);

  // "Other visitors": every couple of seconds someone grabs a free seat, then either buys it or gives it up.
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  useEffect(() => {
    const tick = setInterval(() => {
      const free = seatsRef.current.filter((s) => s.status === 'available');
      if (free.length < 8) return; // keep the room from filling up completely
      const pick = free[Math.floor(Math.random() * free.length)];
      patch([pick._id], { status: 'locked', lockedBy: GHOST });
      pulse(pick._id);
      later(() => {
        const buys = Math.random() < 0.55;
        patch([pick._id], buys ? { status: 'booked', lockedBy: null } : { status: 'available', lockedBy: null });
        pulse(pick._id);
      }, 4000 + Math.random() * 3000);
    }, 2600);
    const pending = timers.current;
    return () => { clearInterval(tick); pending.forEach(clearTimeout); pending.clear(); };
  }, [later, patch, pulse]);

  const mine = useMemo(() => seats.filter((s) => s.status === 'locked' && s.lockedBy === ME), [seats]);
  const totals = useMemo(() => calcTotals(mine, PRICING), [mine]);

  // The hold clock starts with your first seat, like the real thing.
  useEffect(() => {
    if (mine.length && !expiresAt) setExpiresAt(Date.now() + 5 * 60 * 1000);
    if (!mine.length && expiresAt) setExpiresAt(null);
  }, [mine.length, expiresAt]);

  const toggle = (seat) => {
    setNote('');
    const iHoldIt = seat.status === 'locked' && seat.lockedBy === ME;
    if (iHoldIt) return patch([seat._id], { status: 'available', lockedBy: null });
    if (mine.length >= MAX) return setNote(`You can hold up to ${MAX} seats at a time.`);
    patch([seat._id], { status: 'locked', lockedBy: ME });
  };

  const expire = () => { patch(mine.map((s) => s._id), { status: 'available', lockedBy: null }); setNote('The hold ran out, so your seats were released. Pick them again.'); };

  return (
    <div className="rounded-3xl bg-gradient-to-b from-velvet to-ink p-4 ring-1 ring-white/10 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mist">Sample screening · no account needed</p>
        <span className="flex items-center gap-2 rounded-full bg-ink/60 px-3 py-1.5 text-xs text-mist ring-1 ring-white/10">
          <i className="h-2 w-2 animate-pulse rounded-full bg-brass" /> Demo
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <SeatGrid seats={seats} mySessionId={ME} pendingIds={noPending} flashIds={flashIds} onToggle={toggle} />
          <p className="mt-6 text-center text-sm text-mist">
            Click seats to hold them. The <span className="text-paper">hatched seats</span> are being held by other visitors right now.
          </p>
          {note && <p role="status" className="mt-3 text-center text-sm text-brass">{note}</p>}
        </div>

        <TicketPanel
          showtime={DEMO_SHOWTIME}
          seats={mine}
          totals={totals}
          expiresAt={expiresAt}
          maxSeats={MAX}
          onRelease={toggle}
          onExpire={expire}
          onPay={() => setShowPay(true)}
        />
      </div>

      {showPay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Demo checkout">
          <div className="w-full max-w-sm animate-sheet-in rounded-2xl bg-velvet p-6 text-center ring-1 ring-white/10">
            <h3 className="font-display text-3xl font-extrabold">That's the flow</h3>
            <p className="mt-2 text-sm text-mist">This was a demo, so nothing was booked. {user ? 'Pick a real screening to book seats.' : 'Create a free account to book real seats.'}</p>
            <div className="mt-6 flex flex-col gap-3">
              {user ? (
                <Link to="/movies" className="rounded-xl bg-brass py-3 font-bold text-ink hover:bg-[#e2bb6c]">Browse movies</Link>
              ) : (
                <>
                  <Link to="/signup" className="rounded-xl bg-brass py-3 font-bold text-ink hover:bg-[#e2bb6c]">Create an account</Link>
                  <Link to="/login" className="rounded-xl border border-white/15 py-3 font-semibold hover:bg-white/5">Sign in</Link>
                </>
              )}
              <button onClick={() => setShowPay(false)} className="py-1 text-sm text-mist hover:text-paper">Keep exploring the demo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
