import { Router } from "express";
import { listMovies, createMovie, deleteMovie } from "../controllers/movie.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler as h } from "../utils/asyncHandler.js";

const router = Router();
router.get("/", h(listMovies));
router.post("/", requireAuth, requireAdmin, h(createMovie)); // admin only
router.delete("/:id", requireAuth, requireAdmin, h(deleteMovie)); // admin only, cascades

export default router;
