// src/controllers/appointment.controller.ts

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AppointmentModel from '../models/appointment.model';
import CalendarDetailModel from '../models/calendar-detail.model';
import { IAppointment } from '../interfaces/appointment.interface';
import { ICalendarDetail } from '../interfaces/calendar.interface';

// --- Utility Functions (for calculating sessions when no record exists) ---

// Helper to convert time string (HH:MM) to total minutes from midnight
const timeToMinutes = (time: string): number => {
    try {
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return 0;
        return hours * 60 + minutes;
    } catch {
        return 0;
    }
};

// Calculates total sessions based on staggered tank logic
const calculateStaggeredSessions = (
    openTime: string,
    closeTime: string,
    duration: number, // sessionDuration
    buffer: number, // cleaningBuffer
    numberOfTanks: number,
    staggerInterval: number,
): {
    sessionsPerTank: number;
    actualCloseTime: string;
    totalSessions: number;
} => {
    const durationNum = Number(duration); 
    const bufferNum = Number(buffer);

    if (!openTime || !closeTime || durationNum <= 0 || bufferNum < 0 || numberOfTanks <= 0) {
        return { sessionsPerTank: 0, actualCloseTime: '00:00', totalSessions: 0 };
    }

    const openMinutes = timeToMinutes(openTime);
    let closeMinutes = timeToMinutes(closeTime);
    if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

    const sessionLength = durationNum + bufferNum;

    let maxSessionsPerTank = 0;
    let latestEndTime = openMinutes; 

    for (let tankIndex = 0; tankIndex < numberOfTanks; tankIndex++) {
        const tankStartMinutes = openMinutes + tankIndex * Number(staggerInterval || 0);
        const availableTime = closeMinutes - tankStartMinutes;
        const tankSessions = Math.floor(availableTime / sessionLength);

        if (tankSessions > 0) {
            const tankEndTime = tankStartMinutes + tankSessions * sessionLength;
            latestEndTime = Math.max(latestEndTime, tankEndTime);
            maxSessionsPerTank = Math.max(maxSessionsPerTank, tankSessions);
        }
    }

    const totalSessions = maxSessionsPerTank * numberOfTanks;

    return {
        sessionsPerTank: maxSessionsPerTank || 0,
        actualCloseTime: '',
        totalSessions: isNaN(totalSessions) ? 0 : totalSessions,
    };
};

// --- Main Transactional Controller ---

/**
 * Creates a new appointment booking and atomically updates the calendar count.
 * POST /api/appointments
 */
export const createAppointment = async (req: Request, res: Response) => {
    // 1. Destructure fields from the frontend payload (root and context)
    const { 
        name, date, time, email, contactNumber, specialNote,
        calendarContext 
    } = req.body;

    // Basic required field validation (must match frontend root fields)
    if (!date || !time || !email || !contactNumber || !name || !calendarContext) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: name, date, time, email, contactNumber, and calendar context are mandatory.' 
        });
    }

    const newAppointmentData: Partial<IAppointment> = {
        name, date, time, email, contactNumber, specialNote, status: 'Pending',
    };
    
    const { 
        defaultSystemSettings,
    } = calendarContext;

    // Start Mongoose Session for Atomic Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let finalSessionsToSell: number;
        let calendarRecord: (ICalendarDetail & mongoose.Document) | null = null;
        let isNewCalendarRecord = false;

        // --- PHASE 1: Determine the starting session count ---
        
        // Find the existing calendar record within the session
        calendarRecord = await CalendarDetailModel.findOne({ date: date }).session(session);
        
        if (calendarRecord) {
            // Case A: Record exists, use its current sessionsToSell count
            finalSessionsToSell = calendarRecord.sessionsToSell;
            
        } else {
            // Case B: No record exists, calculate from defaults 
            isNewCalendarRecord = true;
            const settings = defaultSystemSettings;
            
            const totalSessions = calculateStaggeredSessions(
                settings.openTime,
                settings.closeTime,
                Number(settings.sessionDuration),
                settings.cleaningBuffer,
                settings.numberOfTanks,
                settings.tankStaggerInterval
            ).totalSessions;

            finalSessionsToSell = totalSessions;
        }

        // --- PHASE 2: Validate and Update/Create Logic ---
        
        if (finalSessionsToSell <= 0) {
            // Check for availability
            throw new Error('Sold Out: No available sessions for this date.');
        }

        const newSessionsToSell = finalSessionsToSell - 1;

        // 1. Create the Appointment (Must succeed for the transaction to commit)
        const newAppointment = await AppointmentModel.create([newAppointmentData as IAppointment], { session });

        // 2. Update/Create the Calendar Detail
        if (isNewCalendarRecord) {
            // Create New Record
            const newCalendarData: Partial<ICalendarDetail> = {
                date: date,
                status: newSessionsToSell > 0 ? 'Bookable' : 'Sold Out',
                openTime: defaultSystemSettings.openTime,
                closeTime: defaultSystemSettings.closeTime,
                sessionsToSell: newSessionsToSell,
            };
            await CalendarDetailModel.create([newCalendarData as ICalendarDetail], { session });
        } else {
            // Update Existing Record
            if (calendarRecord) {
                calendarRecord.sessionsToSell = newSessionsToSell;
                calendarRecord.status = newSessionsToSell > 0 ? 'Bookable' : 'Sold Out';
                await calendarRecord.save({ session });
            }
        }

        // --- PHASE 3: Commit and Respond ---
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: 'Appointment successfully created and calendar updated.',
            data: newAppointment[0], // Return the saved appointment object
        });
        
    } catch (error: any) {
        // Rollback the transaction if any error occurred (e.g., Sold Out, DB error)
        await session.abortTransaction();
        session.endSession();
        
        console.error('Error creating appointment:', error);
        
        let errorMessage = 'Failed to create appointment due to a server error.';
        if (error.message.includes('Sold Out')) {
             errorMessage = error.message; 
        }
        
        res.status(500).json({ 
            success: false, 
            message: errorMessage 
        });
    }
};

// --- Existing Controllers (Retained) ---

/**
 * Interface for the MongoDB aggregation output structure.
 */
interface AppointmentCount {
    _id: {
        date: string;
        status: 'Pending' | 'Confirmed' | 'Canceled';
    };
    count: number;
}


/**
 * Retrieves appointment counts aggregated by date and status for a given range.
 * GET /api/appointments/counts?startDate=...&endDate=...
 */
export const getAppointmentCounts = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required query parameters: startDate and endDate.' 
        });
    }

    try {
        // Mongoose aggregation pipeline to count bookings
        const counts: AppointmentCount[] = await AppointmentModel.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate as string, 
                        $lte: endDate as string
                    },
                    // Only count appointments that indicate a slot is taken
                    status: { $in: ['Pending', 'Confirmed'] } 
                }
            },
            {
                $group: {
                    _id: {
                        date: "$date",
                        status: "$status" 
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Process the aggregation result: Calculate the total count per date 
        const totalBookedSessionsByDate: Record<string, number> = {};
        
        counts.forEach(item => {
            const dateKey = item._id.date;
            totalBookedSessionsByDate[dateKey] = (totalBookedSessionsByDate[dateKey] || 0) + item.count;
        });
        
        // Convert map back to the desired array format for the frontend
        const bookedSessionsArray = Object.keys(totalBookedSessionsByDate).map(date => ({
            date: date,
            count: totalBookedSessionsByDate[date] 
        }));


        res.status(200).json({
            success: true,
            message: 'Appointment counts retrieved successfully.',
            data: bookedSessionsArray,
        });
    } catch (error) {
        console.error('Error fetching appointment counts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve appointment counts due to a server error.' 
        });
    }
};


export const getAppointmentDetails = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    try {
        const filter: any = {};
        
        if (startDate && endDate) {
            filter.date = {
                $gte: startDate as string,
                $lte: endDate as string
            };
        }
        
        const appointments = await AppointmentModel.find(filter).lean(); 

        res.status(200).json({
            success: true,
            message: 'Appointment details retrieved successfully.',
            data: appointments, 
        });
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve appointment details due to a server error.' 
        });
    }
};