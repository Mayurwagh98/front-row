import CheckoutTimer from "./CheckoutTimer.jsx";
import { formatDay, formatTime } from "../utils/format.js";
import { inr } from "../utils/pricing.js";

/** Your ticket builds up as you pick seats. Each line shows the seat's own tier price; × releases it. */
export default function TicketPanel({
  showtime,
  seats,
  totals,
  expiresAt,
  maxSeats,
  onRelease,
  onExpire,
  onPay,
}) {
  const empty = seats.length === 0;

  return (
    <aside
      className="ticket shadow-2xl shadow-black/40"
      style={{ "--notch": empty ? "58%" : "70%" }}
      aria-label="Your ticket"
    >
      <div className="p-6 pb-5">
        <p className="text-sm text-stub/60">
          {formatDay(showtime?.startTime)} at {formatTime(showtime?.startTime)}
        </p>
        <h2 className="mt-1 font-display text-4xl font-extrabold leading-none">
          {showtime?.movieTitle}
        </h2>
        <p className="mt-2 text-sm text-stub/70">
          {showtime?.venue}, {showtime?.screen}
        </p>

        <div className="mt-5 min-h-[4.5rem]">
          {empty ? (
            <p className="text-sm leading-relaxed text-stub/70">
              Pick up to {maxSeats} seats on the map. Each seat is held for you
              for 5 minutes while you check out.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {seats.map((s) => (
                <li key={s._id} className="flex items-center gap-3 text-sm">
                  <span className="w-9 rounded-md bg-stub py-0.5 text-center font-bold text-paper">
                    {s.seatNumber}
                  </span>
                  <span className="flex-1 text-stub/70">{s.tier}</span>
                  <span className="font-semibold">{inr(s.price)}</span>
                  <button
                    onClick={() => onRelease(s)}
                    className="grid h-6 w-6 place-items-center rounded-full text-stub/50 transition hover:bg-stub/10 hover:text-red-700"
                    aria-label={`Release seat ${s.seatNumber}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="perf mx-4" />

      <div className="p-6 pt-5">
        {empty ? (
          <div className="barcode opacity-25" aria-hidden />
        ) : (
          <>
            <dl className="space-y-1 text-sm">
              <Line k={`Tickets (${seats.length})`} v={inr(totals.subtotal)} />
              <Line k="Convenience fee" v={inr(totals.convenienceFee)} />
              <Line k="GST on fee" v={inr(totals.tax)} />
              <div className="flex justify-between border-t border-stub/15 pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{inr(totals.total)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <CheckoutTimer expiresAt={expiresAt} onExpire={onExpire} />
            </div>
            <button
              onClick={onPay}
              className="mt-5 w-full rounded-xl bg-stub py-3.5 text-base font-bold text-paper transition hover:bg-black active:scale-[.99]"
            >
              Pay {inr(totals.total)}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

const Line = ({ k, v }) => (
  <div className="flex justify-between text-stub/70">
    <dt>{k}</dt>
    <dd>{v}</dd>
  </div>
);
