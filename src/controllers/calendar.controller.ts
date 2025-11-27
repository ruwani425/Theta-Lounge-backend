import { Request, Response } from "express";
import CalendarDetail from "../models/calendar-detail.model";

// Save or update a calendar day
export const saveCalendarDay = async (req: Request, res: Response) => {
  try {
    const { date, status, openTime, closeTime, sessionsToSell } = req.body;

    let record = await CalendarDetail.findOne({ date });
    if (record) {
      record.status = status ?? record.status;
      record.openTime = openTime ?? record.openTime;
      record.closeTime = closeTime ?? record.closeTime;
      record.sessionsToSell = sessionsToSell ?? record.sessionsToSell;
      await record.save();
    } else {
      record = await CalendarDetail.create({ date, status, openTime, closeTime, sessionsToSell });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get calendar days in a range
export const getCalendar = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const days = await CalendarDetail.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    res.json({ success: true, data: days });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}