// src/models/Package.model.ts

import mongoose, { Schema, Document, Model } from 'mongoose';
import { Package } from '../interfaces/package.interface';

// 1. Define a base interface for the schema that omits Mongoose-managed fields.
// Mongoose will handle _id, createdAt, and updatedAt.
export type IPackageBase = Omit<Package, '_id' | 'createdAt' | 'updatedAt'>;


// 2. Extend the base interface with Mongoose Document properties.
// This resolves the conflict by letting Mongoose define the structure of _id and timestamps.
export interface PackageDocument extends IPackageBase, Document {
    // Mongoose automatically adds _id: ObjectId, createdAt: Date, and updatedAt: Date
}

const PackageSchema: Schema<PackageDocument> = new Schema({
    name: {
        type: String,
        required: [true, 'Package name is required'],
        trim: true,
        unique: true,
    },
    duration: {
        type: String,
        enum: ['1-Month', '6-Month', '12-Month'],
        required: [true, 'Duration is required'],
    },
    sessions: {
        type: Number,
        required: [true, 'Total sessions is required'],
        min: [1, 'Sessions must be at least 1'],
    },
    totalPrice: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Total price cannot be negative'],
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    isGenesisEligible: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true, // Automatically manages createdAt and updatedAt (Dates)
});

// Create and export the Mongoose Model
const PackageModel: Model<PackageDocument> = mongoose.model<PackageDocument>('Package', PackageSchema);
export default PackageModel;