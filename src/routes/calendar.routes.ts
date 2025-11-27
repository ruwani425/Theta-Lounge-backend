import express from "express";
import { saveCalendarDay, getCalendar } from "../controllers/calendar.controller";

const router = express.Router();

router.post("/", saveCalendarDay);

router.get("/", getCalendar);

export default router;
