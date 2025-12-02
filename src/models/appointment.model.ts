// src/models/AppointmentModel.ts

import mongoose, { Schema, Model } from 'mongoose';
import { IAppointment } from '../interfaces/appointment.interface';

const AppointmentSchema: Schema<IAppointment> = new Schema({
    name: {
        type: String,
        required: true,
    },
    date: { 
        type: String, 
        required: true,
        // Enforce YYYY-MM-DD format if possible at the schema level
        match: /^\d{4}-\d{2}-\d{2}$/,
    },
    time: {
        type: String,
        required: true,
        // Example: Enforce HH:MM AM/PM format
        // match: /^\d{1,2}:\d{2} (AM|PM)$/
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    contactNumber: {
        type: String,
        required: true,
        trim: true,
    },
    specialNote: {
        type: String,
        required: false,
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Canceled'],
        default: 'Pending',
    },
}, { 
    timestamps: true 
});

const AppointmentModel: Model<IAppointment> = mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default AppointmentModel;