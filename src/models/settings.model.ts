import mongoose, { Schema } from "mongoose";
import { SystemSettings } from "../interfaces/setting.interface";

const SystemSettingsSchema = new Schema<SystemSettings>(
  {
    defaultFloatPrice: { type: Number, required: true },
    cleaningBuffer: { type: Number, required: true },
    sessionDuration: { type: Number, required: true },
    sessionsPerDay: { type: Number, required: true },
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<SystemSettings>("SystemSettings", SystemSettingsSchema);
