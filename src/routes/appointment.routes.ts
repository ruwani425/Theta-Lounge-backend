// src/routes/appointment.routes.ts

import { Router } from "express"
import { authenticateToken } from "../middlewares/auth.middleware"
import {
  createAppointment,
  getAppointmentCounts,
  getAppointmentDetails,
  getBookedTimesByDate,
  updateAppointmentDetails,
  updateAppointmentStatus,
  getMyReservations,
  getPackageAppointmentCounts, // <-- NEW IMPORT
} from "../controllers/appointment.controller"

const router = Router()

// ===== Client Routes =====
// Get current user's reservations (Protected by JWT)
router.get("/me", authenticateToken, getMyReservations); // <-- NEW ROUTE DEFINITION

// ===== Admin/General Routes =====
router.post("/", createAppointment)
router.get("/counts", getAppointmentCounts)
// Query params: startDate, endDate, page (default 1), limit (default 20)
router.get("/", getAppointmentDetails)
router.put("/:id/status", updateAppointmentStatus)
router.get("/booked-times/:date", getBookedTimesByDate)
router.put("/:id", updateAppointmentDetails)
router.get("/package-counts/:packageId", authenticateToken, getPackageAppointmentCounts);

export default router