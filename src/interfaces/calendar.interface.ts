// Assuming this is your calendar.interface.ts file
import { Types } from "mongoose";

export interface ICalendarDetail {
    tankId: Types.ObjectId; // Add this field
    date: string;
    status: "Bookable" | "Closed" | "Sold Out";
    openTime?: string;
    closeTime?: string;
    sessionsToSell: number;
}