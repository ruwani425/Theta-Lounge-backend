import mongoose, { Schema, Document } from "mongoose";
import { randomUUID } from "crypto";
import { IUser } from "../interfaces/user.interface";

export interface IUserDocument extends IUser, Document {}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    profileImage: { type: String },
    firebaseUid: { 
      type: String, 
      unique: true,
      default: () => randomUUID() 
    },
    role: { 
      type: String, 
      enum: ["admin", "client"], 
      default: "client",
      required: true 
    },
    permissions: { 
      type: [String], 
      default: [], // Default to no extra permissions
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUserDocument>("User", UserSchema);
