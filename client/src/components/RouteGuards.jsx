import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// UI-level guards only. The real enforcement is on the server (requireAuth / requireAdmin).
export function RequireAuth({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-10 text-mist">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
