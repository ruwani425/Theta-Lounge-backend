// src/controllers/AppointmentController.ts

import { Request, Response } from 'express';
// Note: Verify these relative paths are correct in your project structure
import AppointmentModel from '../models/appointment.model'; 
import { IAppointment } from '../interfaces/appointment.interface';

/**
 * Interface for the MongoDB aggregation output structure.
 * This is the definition that was missing and caused the error.
 */
interface AppointmentCount {
    _id: {
        date: string;
        status: 'Pending' | 'Confirmed' | 'Canceled';
    };
    count: number;
}

/**
 * Creates a new appointment booking.
 * POST /api/appointments
 */
export const createAppointment = async (req: Request, res: Response) => {
    // 1. Destructure and validate required fields from the request body
    const { 
        date, 
        time, 
        email, 
        contactNumber, 
        specialNote 
    } = req.body;

    if (!date || !time || !email || !contactNumber) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: date, time, email, and contactNumber are mandatory.' 
        });
    }

    try {
        // 2. Prepare the new appointment object
        const newAppointmentData: Partial<IAppointment> = {
            date,
            time,
            email,
            contactNumber,
            specialNote,
            status: 'Pending', // Default status
        };

        // 3. Create and save the document to MongoDB
        // Casting the input object as `IAppointment` might be necessary depending on Mongoose setup
        const newAppointment = await AppointmentModel.create(newAppointmentData as IAppointment); 

        // 4. Respond with success
        res.status(201).json({
            success: true,
            message: 'Appointment successfully created.',
            data: newAppointment, // Returns the saved appointment object
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create appointment due to a server error.' 
        });
    }
};


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
                        // $gte and $lte are used for string comparison which works for YYYY-MM-DD
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
                        // Note: Grouping by status is good for detail, but frontend currently needs the total count per date.
                        // We will keep the status grouping here for robust backend functionality, 
                        // but map the results below to provide the required per-date count.
                        status: "$status" 
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Process the aggregation result: Calculate the total count per date by summing up counts from different statuses
        const totalBookedSessionsByDate: Record<string, number> = {};
        
        counts.forEach(item => {
            const dateKey = item._id.date;
            // Sum up counts for the same date regardless of status (Pending or Confirmed)
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