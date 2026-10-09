import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import LiveDemo from '../components/LiveDemo.jsx';
import Poster from '../components/Poster.jsx';
import { api } from '../api/axiosClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDay, formatTime } from '../utils/format.js';
import { inr } from '../utils/pricing.js';

const STEPS = [
  ['Pick your seats', 'Choose up to 6 seats on the map. Each tier has its own price.'],
  ['We hold them for you', 'The moment you click, the seat is yours for 5 minutes. Nobody else can take it.'],
  ['Pay before the timer ends', 'Check your total, including fees, then confirm. If time runs out, the seats go back on sale.'],
  ['Get your ticket', 'Your booking is saved to My tickets, and the seats turn to booked for everyone.'],
];

export default function HomePage() {
  const { user } = useAuth();
  const [shows, setShows] = useState([]);
  useEffect(() => { api.get('/showtimes').then((r) => setShows(r.data.slice(0, 3))).catch(() => {}); }, []);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 pb-20 sm:px-8">
      <Header />

      <section className="mt-10 max-w-2xl sm:mt-14">
        <h1 className="font-display text-5xl font-black leading-[.92] sm:text-7xl">Grab the seat before anyone else does.</h1>
        <p className="mt-4 max-w-lg text-base text-mist sm:text-lg">
          Seats lock the instant you pick them, and everyone watching sees it live. Two people can never book the same seat. Try it below, no account needed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/movies" className="rounded-lg bg-brass px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-[#e2bb6c]">Browse movies</Link>
          {!user && <Link to="/signup" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/5">Create an account</Link>}
        </div>
      </section>

      <section className="mt-10" aria-label="Try the seat map">
        <LiveDemo />
      </section>

      <section className="mt-24" aria-labelledby="how">
        <h2 id="how" className="font-display text-4xl font-black leading-[.95] sm:text-5xl">How booking works</h2>
        <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="font-display text-6xl font-black leading-none text-brass">{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mist">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {shows.length > 0 && (
        <section className="mt-24" aria-labelledby="now">
          <div className="flex items-end justify-between gap-4">
            <h2 id="now" className="font-display text-4xl font-black leading-[.95] sm:text-5xl">Now showing</h2>
            <Link to="/movies" className="text-sm text-brass hover:underline">See all movies</Link>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {shows.map((s) => (
              <li key={s._id}>
                <Link to={`/showtime/${s._id}`} className="group block">
                  <Poster url={s.movie?.posterUrl} title={s.movieTitle} className="aspect-[2/3] w-full rounded-xl ring-1 ring-white/10 transition group-hover:ring-brass" />
                  <p className="mt-3 font-display text-3xl font-extrabold leading-none transition group-hover:text-brass">{s.movieTitle}</p>
                  <p className="mt-1 text-sm text-mist">{formatDay(s.startTime)}, {formatTime(s.startTime)} · from {inr(s.price)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!user && (
        <section className="mt-24 rounded-3xl bg-gradient-to-br from-wine to-velvet p-8 sm:p-12">
          <h2 className="font-display text-4xl font-black leading-[.95] sm:text-5xl">Ready to pick a real seat?</h2>
          <p className="mt-3 max-w-md text-mist">Sign up in a few seconds and your tickets will be waiting in one place.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/signup" className="rounded-lg bg-brass px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-[#e2bb6c]">Create an account</Link>
            <Link to="/login" className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/5">Sign in</Link>
          </div>
        </section>
      )}
    </div>
  );
}
