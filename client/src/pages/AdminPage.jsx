import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell.jsx";
import Toasts from "../components/Toasts.jsx";
import Poster from "../components/Poster.jsx";
import { normalizePosterUrl } from "../utils/poster.js";
import { Field } from "./AuthPage.jsx";
import { api } from "../api/axiosClient.js";
import { formatDay, formatTime } from "../utils/format.js";
import { inr } from "../utils/pricing.js";
import { errMsg, ghostBtn, inputCls, primaryBtn } from "../utils/ui.js";

const EMPTY_MOVIE = {
  title: "",
  genre: "",
  language: "English",
  durationMins: "",
  posterUrl: "",
  description: "",
};
const DEFAULT_TIERS = [
  { name: "Classic", price: 180, rows: 2 },
  { name: "Prime", price: 260, rows: 4 },
  { name: "Recliner", price: 420, rows: 2 },
];

export default function AdminPage() {
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [movie, setMovie] = useState(EMPTY_MOVIE);
  const [show, setShow] = useState({
    movieId: "",
    venue: "",
    screen: "",
    startTime: "",
    seatsPerRow: 10,
  });
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, kind = "info") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([
      api.get("/movies"),
      api.get("/showtimes"),
    ]);
    setMovies(m.data);
    setShowtimes(s.data);
    setShow((f) =>
      f.movieId || !m.data.length ? f : { ...f, movieId: m.data[0]._id },
    );
  }, []);
  useEffect(() => {
    load().catch(() => toast("Could not load data.", "error"));
  }, [load, toast]);

  const totalRows = useMemo(
    () => tiers.reduce((n, t) => n + (Number(t.rows) || 0), 0),
    [tiers],
  );
  const setM = (k) => (e) => setMovie((f) => ({ ...f, [k]: e.target.value }));
  const setS = (k) => (e) => setShow((f) => ({ ...f, [k]: e.target.value }));
  const setT = (i, k) => (e) =>
    setTiers((ts) =>
      ts.map((t, j) => (j === i ? { ...t, [k]: e.target.value } : t)),
    );

  const uploadPoster = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("poster", file);
      const { data } = await api.post("/uploads/poster", body);
      setMovie((f) => ({ ...f, posterUrl: data.url }));
    } catch (err) {
      toast(
        errMsg(err, "Upload failed. Try a JPG, PNG or WebP under 3 MB."),
        "error",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addMovie = async (e) => {
    e.preventDefault();
    setBusy("movie");
    try {
      const { data } = await api.post("/movies", movie);
      toast(`"${data.movie.title}" added.`, "success");
      setMovie(EMPTY_MOVIE);
      await load();
      setShow((f) => ({ ...f, movieId: data.movie._id }));
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy("");
    }
  };

  const addShowtime = async (e) => {
    e.preventDefault();
    setBusy("show");
    try {
      await api.post("/showtimes", {
        ...show,
        startTime: new Date(show.startTime).toISOString(),
        tiers,
      });
      toast("Screening scheduled. Seats were created.", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <PageShell width="max-w-5xl">
      <h1 className="font-display text-6xl font-black leading-[.9]">Admin</h1>
      <p className="mt-3 text-mist">
        Add movies, then schedule screenings with seat tiers and prices.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <form onSubmit={addMovie} className="space-y-4">
          <h2 className="font-display text-3xl font-extrabold">Add a movie</h2>
          <Field label="Title">
            <input
              className={inputCls}
              value={movie.title}
              onChange={setM("title")}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Genre">
              <input
                className={inputCls}
                value={movie.genre}
                onChange={setM("genre")}
                placeholder="Sci-Fi"
              />
            </Field>
            <Field label="Language">
              <input
                className={inputCls}
                value={movie.language}
                onChange={setM("language")}
              />
            </Field>
          </div>
          <Field label="Duration (minutes)">
            <input
              className={inputCls}
              type="number"
              min="1"
              value={movie.durationMins}
              onChange={setM("durationMins")}
              required
            />
          </Field>
          <Field label="Poster" hint="JPG, PNG or WebP, up to 3 MB">
            <div className="flex items-start gap-4">
              <Poster
                url={movie.posterUrl}
                title={movie.title || "Poster"}
                className="h-32 w-[5.5rem] shrink-0 rounded-lg ring-1 ring-white/10"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadPoster}
                  disabled={uploading}
                  className="block w-full text-sm text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-velvet file:px-4 file:py-2 file:font-semibold file:text-paper hover:file:bg-white/10"
                />
                <input
                  className={inputCls}
                  type="url"
                  value={movie.posterUrl}
                  onChange={setM("posterUrl")}
                  onBlur={(e) =>
                    setMovie((f) => ({
                      ...f,
                      posterUrl: normalizePosterUrl(e.target.value),
                    }))
                  }
                  placeholder="…or paste an image URL"
                  aria-label="Poster URL"
                />
                {uploading && <p className="text-xs text-mist">Uploading…</p>}
              </div>
            </div>
          </Field>
          <Field label="Description" hint="Optional">
            <textarea
              className={inputCls}
              rows={3}
              value={movie.description}
              onChange={setM("description")}
            />
          </Field>
          <button
            className={primaryBtn}
            disabled={busy === "movie" || uploading}
          >
            {busy === "movie" ? "Saving…" : "Add movie"}
          </button>
        </form>

        <form onSubmit={addShowtime} className="space-y-4">
          <h2 className="font-display text-3xl font-extrabold">
            Schedule a screening
          </h2>
          {!movies.length ? (
            <p className="text-sm text-mist">Add a movie first.</p>
          ) : (
            <>
              <Field label="Movie">
                <select
                  className={inputCls}
                  value={show.movieId}
                  onChange={setS("movieId")}
                  required
                >
                  {movies.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Venue">
                  <input
                    className={inputCls}
                    value={show.venue}
                    onChange={setS("venue")}
                    placeholder="PVR Cinemas"
                    required
                  />
                </Field>
                <Field label="Screen">
                  <input
                    className={inputCls}
                    value={show.screen}
                    onChange={setS("screen")}
                    placeholder="Screen 1"
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Starts at">
                  <input
                    className={inputCls}
                    type="datetime-local"
                    value={show.startTime}
                    onChange={setS("startTime")}
                    required
                  />
                </Field>
                <Field label="Seats per row">
                  <input
                    className={inputCls}
                    type="number"
                    min="4"
                    max="20"
                    value={show.seatsPerRow}
                    onChange={setS("seatsPerRow")}
                    required
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">
                  Seat tiers, front to back
                </legend>
                <div className="space-y-2">
                  {tiers.map((t, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] items-center gap-2"
                    >
                      <input
                        className={inputCls}
                        aria-label="Tier name"
                        value={t.name}
                        onChange={setT(i, "name")}
                        required
                      />
                      <input
                        className={inputCls}
                        aria-label="Price"
                        type="number"
                        min="1"
                        value={t.price}
                        onChange={setT(i, "price")}
                        required
                      />
                      <input
                        className={inputCls}
                        aria-label="Rows"
                        type="number"
                        min="1"
                        value={t.rows}
                        onChange={setT(i, "rows")}
                        required
                      />
                      <button
                        type="button"
                        disabled={tiers.length === 1}
                        onClick={() =>
                          setTiers((ts) => ts.filter((_, j) => j !== i))
                        }
                        className="px-2 text-mist hover:text-red-300 disabled:opacity-30"
                        aria-label="Remove tier"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-mist">
                  <button
                    type="button"
                    onClick={() =>
                      setTiers((ts) => [
                        ...ts,
                        { name: "", price: "", rows: 1 },
                      ])
                    }
                    className="text-brass hover:underline"
                  >
                    Add tier
                  </button>
                  <span>
                    Name · price (₹) · rows — {totalRows} rows,{" "}
                    {totalRows * (Number(show.seatsPerRow) || 0)} seats
                    {totalRows > 26 ? " (max 26 rows)" : ""}
                  </span>
                </div>
              </fieldset>
              <button
                className={primaryBtn}
                disabled={busy === "show" || totalRows > 26}
              >
                {busy === "show" ? "Scheduling…" : "Schedule screening"}
              </button>
            </>
          )}
        </form>
      </div>

      <h2 className="mt-14 font-display text-3xl font-extrabold">
        Scheduled screenings
      </h2>
      <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
        {showtimes.map((s) => (
          <li
            key={s._id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-semibold">{s.movieTitle}</p>
              <p className="text-sm text-mist">
                {formatDay(s.startTime)}, {formatTime(s.startTime)} · {s.venue},{" "}
                {s.screen} · from {inr(s.price)} · {s.totalSeats} seats
              </p>
            </div>
            <Link
              to={`/showtime/${s._id}`}
              className={`${ghostBtn} !px-4 !py-2 text-sm`}
            >
              View seats
            </Link>
          </li>
        ))}
        {!showtimes.length && (
          <li className="py-4 text-mist">Nothing scheduled yet.</li>
        )}
      </ul>
      <Toasts
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
    </PageShell>
  );
}
