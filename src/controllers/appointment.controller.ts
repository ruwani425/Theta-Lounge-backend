// src/controllers/AppointmentController.ts

import { Request, Response } from 'express';
import AppointmentModel from '../models/appointment.model';
import { IAppointment } from '../interfaces/appointment.interface';

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
        // Optional: Add more specific validation here (e.g., check if the slot is still available)
        // For simplicity, we skip slot availability check on the calendar API here.

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
        const newAppointment = await AppointmentModel.create(newAppointmentData);

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

// You can export other methods like getAppointments, deleteAppointment, etc.