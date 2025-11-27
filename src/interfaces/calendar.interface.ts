export interface ICalendarDetail {
  date: string; // YYYY-MM-DD
  status?: "Bookable" | "Closed" | "Sold Out";
  openTime?: string;  // e.g., "09:00"
  closeTime?: string; // e.g., "21:00"
  sessionsToSell?: number;
}
