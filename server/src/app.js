import express from "express";
import cors from "cors";
import checkoutRoutes from "./routes/checkout.routes.js";
import showtimeRoutes from "./routes/showtime.routes.js";
import authRoutes from "./routes/auth.routes.js";
import movieRoutes from "./routes/movie.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import { uploadRouter, imageRouter } from "./routes/upload.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.set("trust proxy", 1); // behind Render's proxy: makes req.protocol "https" so poster URLs are correct

// CLIENT_URL may list several origins, comma-separated (production site + localhost).
export const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/checkout", checkoutRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/uploads", uploadRouter);
app.use("/uploads", imageRouter); // posters are stored in MongoDB, not on the (ephemeral) disk
app.use(errorHandler);

export default app;
