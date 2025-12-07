// src/models/package-activation.model.ts

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { PackageActivation } from '../interfaces/package-activation.interface';

/**
 * 1. Define a base interface that strips Mongoose-managed fields and the packageId string.
 * This prevents conflicts when extending the Mongoose Document type.
 */
export type IPackageActivationBase = Omit<PackageActivation, '_id' | 'createdAt' | 'updatedAt' | 'packageId'>;

/**
 * 2. Extend the base interface with Mongoose Document properties.
 * We explicitly redefine `packageId` as Mongoose's ObjectId type.
 */
export interface PackageActivationDocument extends IPackageActivationBase, Document {
    // Overriding packageId to explicitly use Mongoose's ObjectId for reference
    packageId: Types.ObjectId; 
}

const PackageActivationSchema: Schema<PackageActivationDocument> = new Schema({
    // User Reference
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Optional for backward compatibility
    },

    // User/Client Information
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

    // Package Information
    packageId: {
        type: Schema.Types.ObjectId,
        ref: 'Package', // Reference the Package model
        required: [true, 'Package ID is required'],
    },
    packageName: {
        type: String,
        required: [true, 'Package name is required'],
    },

    // Status/Activation Details
    preferredDate: {
        type: Date,
        required: [true, 'Preferred date (request submission date) is required'],
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['Pending', 'Contacted', 'Confirmed', 'Rejected'],
        default: 'Pending',
        required: true,
    },

    // Session Tracking
    usedCount: {
        type: Number,
        default: 0,
        min: [0, 'Used count cannot be negative'],
    },
    totalSessions: {
        type: Number,
        required: false, // Populated from package data
    },

    // Date Tracking
    startDate: {
        type: Date,
        required: false, // Set when status becomes 'Confirmed'
    },
    expiryDate: {
        type: Date,
        required: false, // Calculated based on package duration
    },

}, {
    timestamps: true, // Automatically manages createdAt and updatedAt (Dates)
});

// Create and export the Mongoose Model
const PackageActivationModel: Model<PackageActivationDocument> = mongoose.model<PackageActivationDocument>('PackageActivation', PackageActivationSchema);
export default PackageActivationModel;