// src/models/package-activation.model.ts

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { PackageActivation } from '../interfaces/package-activation.interface';


export type IPackageActivationBase = Omit<PackageActivation, '_id' | 'createdAt' | 'updatedAt' | 'packageId'>;


export interface PackageActivationDocument extends IPackageActivationBase, Document {
    packageId: Types.ObjectId; 
}

const PackageActivationSchema: Schema<PackageActivationDocument> = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false, 
    },

    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
    },
    message: {
        type: String,
        default: '',
    },

    packageId: {
        type: Schema.Types.ObjectId,
        ref: 'Package', 
        required: [true, 'Package ID is required'],
    },
    packageName: {
        type: String,
        required: [true, 'Package name is required'],
    },

    preferredDate: {
        type: Date,
        required: [true, 'Preferred date (request submission date) is required'],
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['Pending', 'Contacted', 'Confirmed', 'Rejected', 'Expired'],
        default: 'Pending',
        required: true,
    },

    usedCount: {
        type: Number,
        default: 0,
        min: [0, 'Used count cannot be negative'],
    },
    totalSessions: {
        type: Number,
        required: false, 
    },

    startDate: {
        type: Date,
        required: false, 
    },
    expiryDate: {
        type: Date,
        required: false, 
    },

}, {
    timestamps: true, 
});

const PackageActivationModel: Model<PackageActivationDocument> = mongoose.model<PackageActivationDocument>('PackageActivation', PackageActivationSchema);
export default PackageActivationModel;