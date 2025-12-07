import mongoose, { Schema, type Model } from "mongoose"
import type { IAppointment } from "../interfaces/appointment.interface"

const AppointmentSchema: Schema<IAppointment> = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true, // Added index for faster date range queries
    },
    time: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    specialNote: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "cancelled", "completed"],
      default: "pending",
    },
    packageActivationId: {
      type: Schema.Types.ObjectId,
      ref: "PackageActivation",
      required: false,
    },
  },
  {
    timestamps: true,
  },
)

const AppointmentModel: Model<IAppointment> = mongoose.model<IAppointment>("Appointment", AppointmentSchema)

export default AppointmentModel
