import mongoose, { Schema, model, Types } from "mongoose";
import { ICalendarDetail } from "../interfaces/calendar.interface";

const calendarDetailSchema = new Schema<ICalendarDetail>({
    date: { type: String, required: true }, 
    status: { type: String, enum: ["Bookable", "Closed", "Sold Out"], default: "Bookable" },
    openTime: { type: String },
    closeTime: { type: String },
    sessionsToSell: { type: Number, default: 1 }
});

calendarDetailSchema.index({ date: 1 }, { unique: true });

export default model<ICalendarDetail>("CalendarDetail", calendarDetailSchema);