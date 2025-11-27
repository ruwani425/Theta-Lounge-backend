// Corrected calendar-detail.model.ts
import mongoose, { Schema, model, Types } from "mongoose";
import { ICalendarDetail } from "../interfaces/calendar.interface";

const calendarDetailSchema = new Schema<ICalendarDetail>({
    tankId: { 
        type: Schema.Types.ObjectId, 
        required: true, 
        ref: 'Tank'
    },
    // FIX 1: Remove 'unique: true' from date
    date: { type: String, required: true }, 
    status: { type: String, enum: ["Bookable", "Closed", "Sold Out"], default: "Bookable" },
    openTime: { type: String },
    closeTime: { type: String },
    sessionsToSell: { type: Number, default: 1 }
});

// FIX 2: Add compound unique index on tankId and date
calendarDetailSchema.index({ tankId: 1, date: 1 }, { unique: true });

export default model<ICalendarDetail>("CalendarDetail", calendarDetailSchema);