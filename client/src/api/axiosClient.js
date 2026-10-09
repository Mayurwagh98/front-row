import axios from "axios";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

const TOKEN_KEY = "token";
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked */
  }
};

// Attach the JWT to every request.
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Expired/invalid token on a protected call: clear it and let AuthContext sign the user out.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isAuthForm = /\/auth\/(login|signup)/.test(err.config?.url || "");
    if (err.response?.status === 401 && !isAuthForm && getToken()) {
      setToken(null);
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  },
);

// Per-tab id used as the Redis lock owner. sessionStorage => each tab is its own "holder",
// so you can test seat contention with two tabs even when signed in as the same user.
export function getSessionId() {
  let id = sessionStorage.getItem("sessionId");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("sessionId", id);
  }
  return id;
}
