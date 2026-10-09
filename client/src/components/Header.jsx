import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Header() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // The auth button for the page you're on is the filled one; the other becomes plain text.
  const onLogin = pathname === "/login";
  const filled =
    "rounded-full bg-brass px-4 py-1.5 font-semibold text-ink transition hover:bg-[#e2bb6c]";
  const plain = "rounded-full px-4 py-1.5 transition hover:text-paper";
  const link = ({ isActive }) =>
    `transition hover:text-paper ${isActive ? "text-paper" : ""}`;

  return (
    <header className="flex items-center justify-between gap-4">
      <Link
        to="/"
        className="font-display text-2xl font-black tracking-wide text-brass"
      >
        Front Row
      </Link>
      <nav className="flex items-center gap-3 text-sm text-mist sm:gap-5">
        {/* Movies = the screenings list; stays highlighted while you're picking seats for one */}
        <NavLink
          to="/movies"
          className={() =>
            `transition hover:text-paper ${pathname === "/movies" || pathname.startsWith("/showtime") ? "text-paper" : ""}`
          }
        >
          Movies
        </NavLink>
        {user && (
          <NavLink to="/bookings" className={link}>
            My tickets
          </NavLink>
        )}
        {user?.role === "admin" && (
          <NavLink to="/admin" className={link}>
            Admin panel
          </NavLink>
        )}
        {user ? (
          <>
            {/* Account chip: avatar initial + name, visually distinct from the links */}
            <span
              className="flex items-center gap-2 rounded-full bg-velvet py-1 pl-1 pr-3 ring-1 ring-white/10"
              title={`Signed in as ${user.name} (${user.role})`}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full bg-brass text-xs font-bold text-ink"
                aria-hidden
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[8rem] truncate text-paper sm:inline">
                {user.name}
              </span>
            </span>
            <button onClick={logout} className="transition hover:text-paper">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              aria-current={onLogin ? "page" : undefined}
              className={onLogin ? filled : plain}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              aria-current={!onLogin ? "page" : undefined}
              className={onLogin ? plain : filled}
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
