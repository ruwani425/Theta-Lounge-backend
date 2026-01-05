import mongoose, { Schema, Document } from "mongoose";

export interface ITank extends Document {
  name: string;
  capacity: number;
  length: number;
  width: number;
  benefits: string;
  status: string;
  createdAt: Date;
}

const TankSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    capacity: { type: Number, required: true },
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    benefits: { type: String, required: true },
    status: { type: String, required: true },
  },
  { timestamps: true }
);

export const Tank = mongoose.model<ITank>("Tank", TankSchema);
