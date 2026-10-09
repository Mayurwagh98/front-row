import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, setToken } from "../api/axiosClient.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken()); // only "loading" if there is a token to verify
  const beforeLogout = useRef(new Set()); // pages register cleanup (e.g. release held seats) that needs the token

  useEffect(() => {
    if (!getToken()) return;
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("auth:expired", expire);
    return () => window.removeEventListener("auth:expired", expire);
  }, []);

  const accept = ({ token, user }) => {
    setToken(token);
    setUser(user);
    return user;
  };
  const login = useCallback(
    async (email, password) =>
      accept((await api.post("/auth/login", { email, password })).data),
    [],
  );
  const signup = useCallback(
    async (name, email, password) =>
      accept((await api.post("/auth/signup", { name, email, password })).data),
    [],
  );
  const registerBeforeLogout = useCallback((fn) => {
    beforeLogout.current.add(fn);
    return () => beforeLogout.current.delete(fn);
  }, []);
  const logout = useCallback(async () => {
    // 1) Cleanup that needs the token (e.g. release held seats), but never let it hang the sign-out.
    const cleanup = Promise.allSettled(
      [...beforeLogout.current].map((fn) => fn()),
    );
    await Promise.race([cleanup, new Promise((r) => setTimeout(r, 3000))]);
    // 2) Clear the session and go to /login in the SAME tick, so a protected page (e.g. /admin)
    //    never re-renders with user=null and redirects to /login with a stale "return to" target.
    setToken(null);
    navigate("/login", { replace: true, state: null });
    setUser(null);
  }, [navigate]);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, registerBeforeLogout }),
    [user, loading, login, signup, logout, registerBeforeLogout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
