export interface DaysOpen {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface SystemSettings {
  float60MinPrice: number;
  float90MinPrice: number;
  packageDealPrice: number;
  addonServicePrice: number;
  maintenanceTime: number;
  cleaningBuffer: number;
  sessionsPerDay: number;
  maxConcurrentSessions: number;
  openTime: string;
  closeTime: string;
  daysOpen: DaysOpen;
}
