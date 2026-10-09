import { Router } from "express";
import {
  handleLockSeats,
  handleReleaseSeats,
  handleConfirmBooking,
} from "../controllers/checkout.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler as h } from "../utils/asyncHandler.js";

const router = Router();
router.use(requireAuth); // you must be signed in to hold or buy seats
router.post("/lock", h(handleLockSeats));
router.post("/release", h(handleReleaseSeats));
router.post("/confirm", h(handleConfirmBooking));

export default router;
