import { Request, Response } from "express";
import CalendarDetail from "../models/calendar-detail.model";

// Save or update a calendar day
export const saveCalendarDay = async (req: Request, res: Response) => {
    try {
        // FIX 1: Extract tankId from the request body
        const {date, status, openTime, closeTime, sessionsToSell } = req.body;

        // Validation Check (Optional but recommended, especially if you remove required checks elsewhere)
        if (!date) {
            return res.status(400).json({ success: false, message: "Missing required fields: tankId or date." });
        }

        // FIX 2: Find the existing record by both date AND tankId
        let record = await CalendarDetail.findOne({ date });

        if (record) {
            // Update existing record
            record.status = status ?? record.status;
            record.openTime = openTime ?? record.openTime;
            record.closeTime = closeTime ?? record.closeTime;
            record.sessionsToSell = sessionsToSell ?? record.sessionsToSell;
            
            await record.save();
            
        } else {
            // Create new record, including tankId
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
        // Log the full error to help debug Mongoose/validation issues
        console.error("Error saving calendar day:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Get calendar days in a range
export const getCalendar = async (req: Request, res: Response) => {
    // NOTE: This controller currently retrieves ALL calendar days in the range, 
    // across all tanks. You may want to add a tankId filter to req.query later.
    
    try {
        const { startDate, endDate } = req.query;
        
        // Ensure date queries are valid strings
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