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
 getPackageAppointmentCounts,
} from "../controllers/appointment.controller"

const router = Router()

router.get("/me", authenticateToken, getMyReservations); 

router.post("/", createAppointment)
router.get("/counts", getAppointmentCounts)
router.get("/", getAppointmentDetails)
router.put("/:id/status", updateAppointmentStatus)
router.get("/booked-times/:date", getBookedTimesByDate)
router.put("/:id", updateAppointmentDetails)
router.get("/package-counts/:packageId", authenticateToken, getPackageAppointmentCounts);

export default router