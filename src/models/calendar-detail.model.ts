import mongoose, { Schema, model } from "mongoose";
import { ICalendarDetail } from "../interfaces/calendar.interface";

const calendarDetailSchema = new Schema<ICalendarDetail>({
  date: { type: String, required: true, unique: true },
  status: { type: String, enum: ["Bookable", "Closed", "Sold Out"], default: "Bookable" },
  openTime: { type: String },
  closeTime: { type: String },
  sessionsToSell: { type: Number, default: 1 }
});

export default model<ICalendarDetail>("CalendarDetail", calendarDetailSchema);
