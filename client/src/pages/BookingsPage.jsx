import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell.jsx";
import { api } from "../api/axiosClient.js";
import { formatDay, formatTime } from "../utils/format.js";
import { inr } from "../utils/pricing.js";

export default function BookingsPage() {
  const [bookings, setBookings] = useState(null);
  useEffect(() => {
    api
      .get("/bookings/mine")
      .then((r) => setBookings(r.data))
      .catch(() => setBookings([]));
  }, []);

  return (
    <PageShell>
      <h1 className="font-display text-6xl font-black leading-[.9]">
        My tickets
      </h1>
      {!bookings && <p className="mt-6 text-mist">Loading your tickets…</p>}
      {bookings?.length === 0 && (
        <p className="mt-6 text-mist">
          You haven't booked anything yet.{" "}
          <Link to="/" className="text-brass hover:underline">
            Browse screenings
          </Link>
        </p>
      )}
      <div className="mt-8 space-y-6">
        {bookings?.map((b) => (
          <article
            key={b._id}
            className="ticket shadow-xl shadow-black/30"
            style={{ "--notch": "66%" }}
          >
            <div className="p-6 pb-5">
              <p className="text-sm text-stub/60">
                {formatDay(b.showtime?.startTime)} at{" "}
                {formatTime(b.showtime?.startTime)}
              </p>
              <h2 className="mt-1 font-display text-4xl font-extrabold leading-none">
                {b.showtime?.movieTitle}
              </h2>
              <p className="mt-2 text-sm text-stub/70">
                {b.showtime?.venue}, {b.showtime?.screen}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {b.seats.map((s) => (
                  <span
                    key={s._id}
                    className="rounded-md bg-stub px-2.5 py-1 text-sm font-bold text-paper"
                  >
                    {s.seatNumber}
                    <small className="ml-1.5 font-medium text-paper/60">
                      {s.tier}
                    </small>
                  </span>
                ))}
              </div>
            </div>
            <div className="perf mx-4" />
            <div className="flex items-center justify-between gap-4 p-6 pt-5">
              <div className="barcode w-40 opacity-80" aria-hidden />
              <div className="text-right">
                <p className="text-sm text-stub/60">Paid</p>
                <p className="text-xl font-bold">{inr(b.totalAmount)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
