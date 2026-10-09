import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import ShowtimePage from "./pages/ShowtimePage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { RequireAuth } from "./components/RouteGuards.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/movies" element={<ShowtimePage />} />
      <Route path="/showtime/:id" element={<ShowtimePage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route
        path="/bookings"
        element={
          <RequireAuth>
            <BookingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth admin>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
