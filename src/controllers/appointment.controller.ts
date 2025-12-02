// src/controllers/appointment.controller.ts

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AppointmentModel from '../models/appointment.model';
import CalendarDetailModel from '../models/calendar-detail.model';
import { AppointmentCount, IAppointment } from '../interfaces/appointment.interface';
import { ICalendarDetail } from '../interfaces/calendar.interface';


const timeToMinutes = (time: string): number => {
    try {
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return 0;
        return hours * 60 + minutes;
    } catch {
        return 0;
    }
};

const calculateStaggeredSessions = (
    openTime: string, closeTime: string, duration: number, buffer: number, 
    numberOfTanks: number, staggerInterval: number,
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


export const createAppointment = async (req: Request, res: Response) => {
    const { 
        name, date, time, email, contactNumber, specialNote,
        calendarContext 
    } = req.body;

    if (!date || !time || !email || !contactNumber || !name || !calendarContext) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: name, date, time, email, contactNumber, and calendar context are mandatory.' 
        });
    }

    const newAppointmentData: Partial<IAppointment> = {
        name, date, time, email, contactNumber, specialNote, status: 'pending',
    };
    
    const { 
        defaultSystemSettings,
    } = calendarContext;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let finalSessionsToSell: number;
        let calendarRecord: (ICalendarDetail & mongoose.Document) | null = null;
        let isNewCalendarRecord = false;

        calendarRecord = await CalendarDetailModel.findOne({ date: date }).session(session);
        
        if (calendarRecord) {
            finalSessionsToSell = calendarRecord.sessionsToSell;
            
        } else {
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

        if (finalSessionsToSell <= 0) {
            throw new Error('Sold Out: No available sessions for this date.');
        }

        const newSessionsToSell = finalSessionsToSell - 1;

        const newAppointment = await AppointmentModel.create([newAppointmentData as IAppointment], { session });

        if (isNewCalendarRecord) {
            const newCalendarData: Partial<ICalendarDetail> = {
                date: date,
                status: newSessionsToSell > 0 ? 'Bookable' : 'Sold Out',
                openTime: defaultSystemSettings.openTime,
                closeTime: defaultSystemSettings.closeTime,
                sessionsToSell: newSessionsToSell,
            };
            await CalendarDetailModel.create([newCalendarData as ICalendarDetail], { session });
        } else {
            if (calendarRecord) {
                calendarRecord.sessionsToSell = newSessionsToSell;
                calendarRecord.status = newSessionsToSell > 0 ? 'Bookable' : 'Sold Out';
                await calendarRecord.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        const responseAppointment = {
            ...newAppointment[0].toObject(),
            status: newAppointment[0].status.toLowerCase(),
        };

        res.status(201).json({
            success: true,
            message: 'Appointment successfully created and calendar updated.',
            data: responseAppointment,
        });
        
    } catch (error: any) {
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

export const updateAppointmentStatus = async (req: Request, res: Response) => {
    try {
        const appointmentId = req.params.id;
        const { status: uiStatus } = req.body; 

        const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
            appointmentId,
            { $set: { status: uiStatus } },
            { new: true, runValidators: true }
        );

        if (!updatedAppointment) {
            return res.status(404).json({ success: false, message: "Appointment not found." });
        }

        const responseAppointment = {
            ...updatedAppointment.toObject(),
            status: updatedAppointment.status.toLowerCase(), 
        };

        res.status(200).json({
            success: true,
            message: `Appointment status updated to ${uiStatus}.`,
            data: responseAppointment,
        });

    } catch (error) {
        console.error("Error updating appointment status:", error);
        res.status(500).json({ success: false, message: "Failed to update appointment status." });
    }
};

export const getAppointmentCounts = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required query parameters: startDate and endDate.' 
        });
    }

    try {
        const counts: AppointmentCount[] = await AppointmentModel.aggregate([
            {
                $match: {
                    date: { $gte: startDate as string, $lte: endDate as string },
                    status: { $in: ['pending', 'cancelled'] } 
                }
            },
            {
                $group: {
                    _id: { date: "$date", status: "$status" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalBookedSessionsByDate: Record<string, number> = {};
        
        counts.forEach(item => {
            const dateKey = item._id.date;
            totalBookedSessionsByDate[dateKey] = (totalBookedSessionsByDate[dateKey] || 0) + item.count;
        });
        
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
        res.status(500).json({ success: false, message: 'Failed to retrieve appointment counts due to a server error.' });
    }
};


export const getAppointmentDetails = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    try {
        const filter: any = {};
        
        if (startDate && endDate) {
            filter.date = { $gte: startDate as string, $lte: endDate as string };
        }
        
        const appointments = await AppointmentModel.find(filter).lean(); 

        const responseAppointments = appointments.map(app => ({
            ...app,
            status: app.status.toLowerCase(),
        }));

        res.status(200).json({
            success: true,
            message: 'Appointment details retrieved successfully.',
            data: responseAppointments, 
        });
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve appointment details due to a server error.' });
    }
};