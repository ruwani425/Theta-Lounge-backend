import express from "express";
import { saveCalendarDay, getCalendar } from "../controllers/calendar.controller";

const router = express.Router();

// Save or update a calendar day
router.post("/", saveCalendarDay);

// Get calendar days in a range
router.get("/", getCalendar);

export default router;
