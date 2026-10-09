import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Poster from '../components/Poster.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, getSessionId } from '../api/axiosClient.js';
import { useShowtimeSocket } from '../hooks/useSocket.js';
import SeatGrid from '../components/SeatGrid.jsx';
import TicketPanel from '../components/TicketPanel.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import Toasts from '../components/Toasts.jsx';
import { formatDay, formatTime } from '../utils/format.js';
import { calcTotals, inr } from '../utils/pricing.js';

const MAX_SEATS = 6;
const LIVE = {
  connected: ['bg-emerald-400', 'Live'],
  connecting: ['bg-mist', 'Connecting'],
  reconnecting: ['bg-brass animate-pulse', 'Reconnecting'],
  disconnected: ['bg-red-400', 'Offline'],
};

export default function ShowtimePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, registerBeforeLogout } = useAuth();
  const sessionId = getSessionId();

  const [showtimes, setShowtimes] = useState(null);
  const [showtime, setShowtime] = useState(null);
  const [seats, setSeats] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [pendingIds, setPendingIds] = useState(new Set()); // requests in flight
  const [flashIds, setFlashIds] = useState(new Set());     // seats that just changed remotely
  const [expiries, setExpiries] = useState({});            // seatId -> expiry (ms) for seats I hold
  const [showModal, setShowModal] = useState(false);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, kind = 'info') => {
    const tid = crypto.randomUUID();
    setToasts((t) => [...t, { id: tid, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 5000);
  }, []);

  /* ---------- data ---------- */
  const fetchSeats = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get(`/showtimes/${id}/seats`);
    setShowtime(data.showtime);
    setSeats(data.seats);
    setPricing(data.pricing);
  }, [id]);

  useEffect(() => {
    if (!id) api.get('/showtimes').then((r) => setShowtimes(r.data)).catch(() => { setShowtimes([]); toast('Cannot reach the server. Check that it is running.', 'error'); });
  }, [id, toast]);

  /* ---------- real-time: mutate local state directly, no refetch ---------- */
  const patch = useCallback((ids, changes) =>
    setSeats((prev) => prev.map((s) => (ids.includes(s._id) ? { ...s, ...changes } : s))), []);

  const pulse = useCallback((ids) => {
    setFlashIds((f) => new Set([...f, ...ids]));
    setTimeout(() => setFlashIds((f) => new Set([...f].filter((x) => !ids.includes(x)))), 900);
  }, []);

  const status = useShowtimeSocket(id, {
    onSync: fetchSeats, // initial load and resync after every reconnect
    onLocked: ({ seatIds, sessionId: owner }) => {
      patch(seatIds, { status: 'locked', lockedBy: owner });
      if (owner !== sessionId) pulse(seatIds);
    },
    onReleased: ({ seatIds }) => {
      patch(seatIds, { status: 'available', lockedBy: null });
      setExpiries((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !seatIds.includes(k))));
      pulse(seatIds);
    },
    onBooked: ({ seatIds }) => { patch(seatIds, { status: 'booked', lockedBy: null }); pulse(seatIds); },
  });

  /* ---------- lock / release ---------- */
  const mine = useMemo(() => seats.filter((s) => s.status === 'locked' && s.lockedBy === sessionId), [seats, sessionId]);
  // On sign-out, give back any seats this user is holding so others can book them right away.
  const heldRef = useRef([]);
  heldRef.current = mine.map((s) => s._id);
  useEffect(() => registerBeforeLogout(async () => {
    if (!id || !heldRef.current.length) return;
    await api.post('/checkout/release', { showtimeId: id, seatIds: heldRef.current, sessionId });
  }), [registerBeforeLogout, id, sessionId]);

  const inFlight = useRef(new Set()); // sync guard: state is async, so rapid double-clicks could slip past a state check

  const toggleSeat = async (seat) => {
    if (inFlight.current.has(seat._id)) return;
    if (!user) { toast('Sign in to pick your seats.'); return navigate('/login', { state: { from: location } }); }
    const iHoldIt = seat.status === 'locked' && seat.lockedBy === sessionId;
    if (!iHoldIt && mine.length >= MAX_SEATS) return toast(`You can hold up to ${MAX_SEATS} seats at a time.`);

    inFlight.current.add(seat._id);
    setPendingIds(new Set(inFlight.current));
    try {
      if (iHoldIt) {
        await api.post('/checkout/release', { showtimeId: id, seatIds: [seat._id], sessionId });
      } else {
        const { data } = await api.post('/checkout/lock', { showtimeId: id, seatIds: [seat._id], sessionId });
        setExpiries((e) => ({ ...e, [seat._id]: Date.now() + data.expiresIn * 1000 }));
        patch([seat._id], { status: 'locked', lockedBy: sessionId });
      }
    } catch (e) {
      if (e.response?.status === 409) { toast(`Seat ${seat.seatNumber} was just taken by someone else. Pick another.`, 'error'); fetchSeats(); }
      else if (e.response?.status === 401) navigate('/login', { state: { from: location } });
      else toast('Could not update that seat. Try again.', 'error');
    } finally {
      inFlight.current.delete(seat._id);
      setPendingIds(new Set(inFlight.current));
    }
  };

  /* ---------- hold expiry ---------- */
  const earliestExpiry = useMemo(() => {
    const t = mine.map((s) => expiries[s._id]).filter(Boolean);
    return t.length ? Math.min(...t) : null;
  }, [mine, expiries]);

  const handleExpire = useCallback(async () => {
    const ids = mine.map((s) => s._id);
    setShowModal(false);
    await api.post('/checkout/release', { showtimeId: id, seatIds: ids, sessionId }).catch(() => {});
    patch(ids, { status: 'available', lockedBy: null });
    setExpiries({});
    toast('Your hold expired and the seats were released. Pick them again to continue.', 'error');
  }, [mine, id, sessionId, patch, toast]);

  // Older seats saved before tiers existed have no price: fall back to the showtime's base price
  const mineWithPrice = useMemo(() => mine.map((s) => ({ ...s, price: s.price ?? showtime?.price, tier: s.tier ?? 'Standard' })), [mine, showtime]);
  const totals = useMemo(() => calcTotals(mineWithPrice, pricing), [mineWithPrice, pricing]);

  /* ---------- counts ---------- */
  const counts = useMemo(() => seats.reduce((c, s) => {
    c[s.status === 'locked' && s.lockedBy !== sessionId ? 'held' : s.status === 'booked' ? 'booked' : 'free']++;
    return c;
  }, { free: 0, held: 0, booked: 0 }), [seats, sessionId]);

  const [dot, liveLabel] = LIVE[status] || LIVE.connecting;

  /* ---------- showtime list ---------- */
  if (!id) {
    return (
      <Shell>
        <Header />
        <h1 className="mt-14 font-display text-6xl font-black leading-[.9] sm:text-8xl">Now showing</h1>
        <p className="mt-4 max-w-md text-mist">Choose a screening to see which seats are free right now.</p>
        <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {(showtimes || []).map((s) => (
            <li key={s._id}>
              <button onClick={() => navigate(`/showtime/${s._id}`)} className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-5 py-5 text-left">
                <Poster url={s.movie?.posterUrl} title={s.movieTitle} className="h-28 w-[4.5rem] rounded-lg ring-1 ring-white/10" />
                <div>
                  <p className="text-sm font-semibold text-brass">{formatTime(s.startTime)} <span className="font-normal text-mist">· {formatDay(s.startTime)}</span></p>
                  <p className="mt-1 font-display text-3xl font-extrabold leading-none transition group-hover:text-brass sm:text-4xl">{s.movieTitle}</p>
                  <p className="mt-1.5 text-sm text-mist">{[s.movie?.genre, s.movie?.durationMins && `${s.movie.durationMins} min`, s.movie?.language].filter(Boolean).join(', ')}{s.movie?.genre || s.movie?.durationMins ? ' — ' : ''}{s.venue}, {s.screen}</p>
                </div>
                <p className="text-right text-sm text-mist">from <span className="text-lg font-bold text-paper">{inr(s.price)}</span></p>
              </button>
            </li>
          ))}
        </ul>
        {showtimes && !showtimes.length && <p className="mt-6 text-mist">No screenings yet. Run <code className="rounded bg-velvet px-1.5 py-0.5">npm run seed</code> in the server folder.</p>}
        {!showtimes && <p className="mt-6 text-mist">Loading screenings…</p>}
        <Toasts toasts={toasts} onDismiss={(t) => setToasts((x) => x.filter((y) => y.id !== t))} />
      </Shell>
    );
  }

  /* ---------- seat selection ---------- */
  return (
    <Shell wide>
      <Header />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/movies')} className="text-sm text-mist transition hover:text-paper">← All screenings</button>
            <span className="flex items-center gap-2 rounded-full bg-velvet px-3 py-1.5 text-xs text-mist ring-1 ring-white/10" aria-live="polite">
              <i className={`h-2 w-2 rounded-full ${dot}`} /> {liveLabel}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-5">
            {showtime && <Poster url={showtime.movie?.posterUrl} title={showtime.movieTitle} className="hidden h-44 w-28 shrink-0 rounded-xl shadow-xl shadow-black/40 ring-1 ring-white/10 sm:block" />}
            <div className="min-w-0">
              <h1 className="font-display text-6xl font-black leading-[.9] sm:text-7xl">{showtime?.movieTitle}</h1>
              <p className="mt-3 text-mist">{showtime && `${formatDay(showtime.startTime)}, ${formatTime(showtime.startTime)} at ${showtime.venue}, ${showtime.screen}`}</p>
              {showtime?.movie && <p className="mt-1 text-sm text-mist">{[showtime.movie.genre, showtime.movie.durationMins && `${showtime.movie.durationMins} min`, showtime.movie.language].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>

          {!!showtime?.tiers?.length && (
            <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {showtime.tiers.map((t) => (
                <li key={t.name} className="flex items-baseline gap-2">
                  <span className="font-semibold">{t.name}</span><span className="text-mist">{inr(t.price)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 rounded-3xl bg-gradient-to-b from-velvet to-ink px-2 pb-8 pt-10 ring-1 ring-white/5 sm:px-6">
            <SeatGrid seats={seats} mySessionId={sessionId} pendingIds={pendingIds} flashIds={flashIds} onToggle={toggleSeat} />

            <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-mist">
              <Key state="available" label={`Available (${counts.free})`} />
              <Key state="mine" label="Yours" />
              <Key state="locked" label={`Held by others (${counts.held})`} />
              <Key state="booked" label={`Booked (${counts.booked})`} />
            </div>
          </div>
        </section>

        <div className="hidden lg:block">
          <div className="sticky top-6">
            <TicketPanel showtime={showtime} seats={mineWithPrice} totals={totals} expiresAt={earliestExpiry} maxSeats={MAX_SEATS}
              onRelease={toggleSeat} onExpire={handleExpire} onPay={() => setShowModal(true)} />
          </div>
        </div>
      </div>

      {/* Mobile: ticket sits below the map, plus a pinned pay bar once seats are held */}
      <div className="mt-10 lg:hidden">
        <TicketPanel showtime={showtime} seats={mineWithPrice} totals={totals} expiresAt={earliestExpiry} maxSeats={MAX_SEATS}
          onRelease={toggleSeat} onExpire={handleExpire} onPay={() => setShowModal(true)} />
      </div>
      {mine.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 p-3 backdrop-blur lg:hidden">
          <button onClick={() => setShowModal(true)} className="w-full rounded-xl bg-brass py-3.5 font-bold text-ink">
            Pay {inr(totals.total)} for {mine.length} seat{mine.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {showModal && showtime && (
        <CheckoutModal
          showtime={showtime}
          seats={mineWithPrice}
          totals={totals}
          onClose={() => setShowModal(false)}
          onSuccess={(ids) => { patch(ids, { status: 'booked', lockedBy: null }); setExpiries({}); }}
          onFailure={fetchSeats}
        />
      )}
      <Toasts toasts={toasts} onDismiss={(t) => setToasts((x) => x.filter((y) => y.id !== t))} />
    </Shell>
  );
}

const Shell = ({ children, wide }) => (
  <div className={`mx-auto px-5 py-8 pb-28 sm:px-8 lg:pb-12 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>
);

const Key = ({ state, label }) => (
  <span className="flex items-center gap-2">
    <i className="seat !h-5 !w-5 !rounded-md !text-[0px]" data-state={state} /> {label}
  </span>
);
