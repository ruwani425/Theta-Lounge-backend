import { Request, Response } from "express";
import CalendarDetail from "../models/calendar.detail.model";

export const saveCalendarDay = async (req: Request, res: Response) => {
    try {
        const { date, status, openTime, closeTime, sessionsToSell } = req.body;

        if (!date) {
            return res.status(400).json({ success: false, message: "Missing required fields: tankId or date." });
        }

        let record = await CalendarDetail.findOne({ date });

        if (record) {
            record.status = status ?? record.status;
            record.openTime = openTime ?? record.openTime;
            record.closeTime = closeTime ?? record.closeTime;
            record.sessionsToSell = sessionsToSell ?? record.sessionsToSell;

            await record.save();

        } else {
            record = await CalendarDetail.create({
                date,
                status,
                openTime,
                closeTime,
                sessionsToSell
            });
        }

        res.json({ success: true, data: record });
    } catch (error) {
        console.error("Error saving calendar day:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getCalendar = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        if (typeof startDate !== 'string' || typeof endDate !== 'string') {
            return res.status(400).json({ success: false, message: "Invalid date range provided." });
        }

        const days = await CalendarDetail.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        res.json({ success: true, data: days });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}