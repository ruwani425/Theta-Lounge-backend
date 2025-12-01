// src/interfaces/IAppointment.ts

import { Document } from 'mongoose';

/**
 * Defines the structure for a new Appointment document.
 */
export interface IAppointment extends Document {
    date: string;         // YYYY-MM-DD
    time: string;         // HH:MM AM/PM format (the selected slot)
    email: string;        // Customer's email address
    contactNumber: string; // Customer's contact number
    specialNote?: string; // Optional note from the customer
    status: 'Pending' | 'Confirmed' | 'Canceled'; // Initial status is usually Pending or Confirmed
    createdAt: Date;
    updatedAt: Date;
}

interface AppointmentCount {
    _id: {
        date: string;
        status: 'Pending' | 'Confirmed' | 'Canceled';
    };
    count: number;
}