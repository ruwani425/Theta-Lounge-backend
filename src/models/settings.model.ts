import mongoose, { Schema } from "mongoose";
import { SystemSettings } from "../interfaces/setting.interface";

const DaysOpenSchema = new Schema({
  monday: { type: Boolean, required: true },
  tuesday: { type: Boolean, required: true },
  wednesday: { type: Boolean, required: true },
  thursday: { type: Boolean, required: true },
  friday: { type: Boolean, required: true },
  saturday: { type: Boolean, required: true },
  sunday: { type: Boolean, required: true },
});

const SystemSettingsSchema = new Schema<SystemSettings>(
  {
    float60MinPrice: { type: Number, required: true },
    float90MinPrice: { type: Number, required: true },
    packageDealPrice: { type: Number, required: true },
    addonServicePrice: { type: Number, required: true },

    maintenanceTime: { type: Number, required: true },
    cleaningBuffer: { type: Number, required: true },

    sessionsPerDay: { type: Number, required: true },
    maxConcurrentSessions: { type: Number, required: true },

    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },

    daysOpen: { type: DaysOpenSchema, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<SystemSettings>("SystemSettings", SystemSettingsSchema);
