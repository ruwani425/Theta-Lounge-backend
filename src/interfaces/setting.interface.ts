export interface SystemSettings {
  defaultFloatPrice: number;
  cleaningBuffer: number;
  sessionDuration: number | string;
  sessionsPerDay: number;
  openTime: string;
  closeTime: string;
  numberOfTanks: number;
  tankStaggerInterval: number;
  actualCloseTime?: string;
}
