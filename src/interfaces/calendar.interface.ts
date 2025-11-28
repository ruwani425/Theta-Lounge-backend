// Assuming this is your calendar.interface.ts file
import { Types } from "mongoose";

export interface ICalendarDetail {
    date: string;
    status: "Bookable" | "Closed" | "Sold Out";
    openTime?: string;
    closeTime?: string;
    sessionsToSell: number;
}