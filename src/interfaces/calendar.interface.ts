import { Types } from "mongoose";

export interface ICalendarDetail {
    date: string;
    status: "Bookable" | "Closed" | "Sold Out";
    openTime?: string;
    closeTime?: string;
    sessionsToSell: number;
}