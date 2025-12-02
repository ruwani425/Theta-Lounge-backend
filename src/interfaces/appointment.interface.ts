// src/interfaces/IAppointment.ts

import { Document } from 'mongoose';


export interface IAppointment extends Document {
    name: string;
    date: string;         
    time: string;         
    email: string;       
    contactNumber: string; 
    specialNote?: string; 
    status: 'pending' | 'cancelled' | 'completed'; 
    createdAt: Date;
    updatedAt: Date;
}


export interface AppointmentCount {
    _id: {
        date: string;
        status: 'pending' | 'cancelled' | 'completed';
    };
    count: number;
}

