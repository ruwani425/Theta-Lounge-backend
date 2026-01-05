// src/models/Package.model.ts

import mongoose, { Schema, Document, Model } from 'mongoose';
import { Package } from '../interfaces/package.interface';

export type IPackageBase = Omit<Package, '_id' | 'createdAt' | 'updatedAt'>;


export interface PackageDocument extends IPackageBase, Document {}

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
    timestamps: true,
});

const PackageModel: Model<PackageDocument> = mongoose.model<PackageDocument>('Package', PackageSchema);
export default PackageModel;