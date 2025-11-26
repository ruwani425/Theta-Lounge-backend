import mongoose, { Schema, Document } from "mongoose";

export interface ITank extends Document {
  name: string;
  capacity: number;
  length: number;
  width: number;
  sessionDuration: number;
  basePrice: number;
  benefits: string;
  createdAt: Date;
}

const TankSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    capacity: { type: Number, required: true },
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    sessionDuration: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    benefits: { type: String, required: true },
  },
  { timestamps: true } // automatically adds createdAt & updatedAt
);

export const Tank = mongoose.model<ITank>("Tank", TankSchema);
