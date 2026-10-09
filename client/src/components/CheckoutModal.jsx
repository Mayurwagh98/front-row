import { useEffect, useState } from 'react';
import { api, getSessionId } from '../api/axiosClient.js';
import { formatDay, formatTime } from '../utils/format.js';
import { inr } from '../utils/pricing.js';

/**
 * Finalises the booking via POST /api/checkout/confirm.
 * Server: verifies Redis lock ownership, then a MongoDB transaction flips the seats to
 * "booked" and writes the Booking atomically (all-or-nothing).
 */
export default function CheckoutModal({ showtime, seats: initialSeats, totals: initialTotals, onClose, onSuccess, onFailure }) {
  const [seats] = useState(initialSeats); // snapshot: live seat state flips to "booked" once confirmed
  const [totals, setTotals] = useState(initialTotals);
  const [phase, setPhase] = useState('review'); // review | paying | done | error
  const [message, setMessage] = useState('');
  const sessionId = getSessionId();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && phase !== 'paying' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const pay = async () => {
    setPhase('paying');
    try {
      // A payment gateway call would go here, right before confirming. 
      const { data } = await api.post('/checkout/confirm', {
        showtimeId: showtime._id,
        seatIds: seats.map((s) => s._id),
        sessionId, // lock owner (per tab); the buyer's identity comes from the JWT
      });
      const b = data.booking; // server-computed amounts are authoritative
      setTotals({ subtotal: b.subtotal, convenienceFee: b.convenienceFee, tax: b.tax, total: b.totalAmount });
      setMessage(b._id);
      setPhase('done');
      onSuccess(seats.map((s) => s._id));
    } catch (e) {
      setMessage(e.response?.data?.message || 'Booking failed. Your seats were not charged.');
      setPhase('error');
      onFailure?.();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="w-full max-w-md animate-sheet-in">
        {phase === 'done' ? (
          <div className="ticket shadow-2xl" style={{ '--notch': '70%' }}>
            <div className="p-7 pb-6">
              <p className="text-sm font-semibold text-emerald-800">Booking confirmed</p>
              <h2 className="mt-1 font-display text-5xl font-extrabold leading-none">{showtime.movieTitle}</h2>
              <p className="mt-3 text-sm text-stub/70">{formatDay(showtime.startTime)} at {formatTime(showtime.startTime)} · {showtime.venue}, {showtime.screen}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {seats.map((s) => <span key={s._id} className="rounded-md bg-stub px-3 py-1.5 text-lg font-bold text-paper">{s.seatNumber}<small className="ml-1.5 text-xs font-medium text-paper/60">{s.tier}</small></span>)}
              </div>
              <p className="mt-4 text-sm text-stub/70">Paid <b className="text-stub">{inr(totals.total)}</b></p>
            </div>
            <div className="perf mx-4" />
            <div className="p-7 pt-5">
              <div className="barcode" aria-hidden />
              <p className="mt-2 break-all text-center text-xs tracking-wider text-stub/60">{message}</p>
              <button onClick={onClose} className="mt-5 w-full rounded-xl bg-stub py-3.5 font-bold text-paper hover:bg-black">Done</button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-velvet p-6 shadow-2xl ring-1 ring-white/10">
            <h2 className="font-display text-3xl font-extrabold">Confirm your booking</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row k="Movie" v={showtime.movieTitle} />
              <Row k="When" v={`${formatDay(showtime.startTime)}, ${formatTime(showtime.startTime)}`} />
              <Row k="Where" v={`${showtime.venue}, ${showtime.screen}`} />
              {seats.map((s) => <Row key={s._id} k={`Seat ${s.seatNumber} · ${s.tier}`} v={inr(s.price)} />)}
              <Row k="Convenience fee" v={inr(totals.convenienceFee)} />
              <Row k="GST on fee" v={inr(totals.tax)} />
              <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-bold"><dt>Total</dt><dd>{inr(totals.total)}</dd></div>
            </dl>
            {phase === 'error' && <p className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{message}</p>}
            <div className="mt-6 flex gap-3">
              <button onClick={onClose} disabled={phase === 'paying'} className="flex-1 rounded-xl border border-white/15 py-3 font-semibold hover:bg-white/5 disabled:opacity-40">
                {phase === 'error' ? 'Close' : 'Back'}
              </button>
              {phase !== 'error' && (
                <button onClick={pay} disabled={phase === 'paying'} className="flex-[1.4] rounded-xl bg-brass py-3 font-bold text-ink transition hover:bg-[#e2bb6c] disabled:opacity-60">
                  {phase === 'paying' ? 'Confirming…' : `Pay ${inr(totals.total)}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-4"><dt className="text-mist">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
);
