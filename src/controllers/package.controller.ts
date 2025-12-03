// src/controllers/Package.controller.ts

import { Request, Response } from 'express';
import PackageModel from '../models/package.model';
import { Package } from '../interfaces/package.interface';

const calculateFinalPrice = (sessions: number, pricePerSlot: number, discount: number): number => {
    if (sessions <= 0 || pricePerSlot <= 0) return 0;
    
    const originalTotal = sessions * pricePerSlot;
    const discountFactor = (100 - discount) / 100;
    
    return Math.round(originalTotal * discountFactor);
};

const checkGenesisEligibility = (sessions: number): boolean => {
    const MIN_SESSIONS_FOR_ELIGIBILITY = 48;
    return sessions >= MIN_SESSIONS_FOR_ELIGIBILITY;
};

export const createPackage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, duration, sessions, pricePerSlot, discount } = req.body as Partial<Package>;

        if (!name || !duration || sessions === undefined || pricePerSlot === undefined) {
            res.status(400).json({ message: 'Missing required fields: name, duration, sessions, pricePerSlot.' });
            return;
        }

        const finalDiscount = discount ?? 0;
        
        const calculatedTotalPrice = calculateFinalPrice(sessions, pricePerSlot, finalDiscount);
        const isEligible = checkGenesisEligibility(sessions);

        const newPackage: Partial<Package> = {
            name,
            duration,
            sessions,
            pricePerSlot,
            discount: finalDiscount,
            totalPrice: calculatedTotalPrice,
            isGenesisEligible: isEligible,
            isActive: true,
        };

        const packageDoc = new PackageModel(newPackage);
        await packageDoc.save();

        res.status(201).json({ 
            message: 'Package created successfully.', 
            data: packageDoc 
        });

    } catch (error) {
        console.error('Error creating package:', error);
        if (error instanceof Error && (error as any).code === 11000) {
            res.status(409).json({ message: 'Package name already exists.' });
            return;
        }
        res.status(500).json({ message: 'Failed to create package.', error });
    }
};


export const updatePackage = async (req: Request, res: Response): Promise<void> => {
    try {
        const packageId = req.params.id;
        const updates = req.body as Partial<Package>;

        if (updates.sessions !== undefined || updates.pricePerSlot !== undefined || updates.discount !== undefined) {
            
            const existingPackage = await PackageModel.findById(packageId);
            if (!existingPackage) {
                res.status(404).json({ message: 'Package not found.' });
                return;
            }

            const sessions = updates.sessions ?? existingPackage.sessions;
            const pricePerSlot = updates.pricePerSlot ?? existingPackage.pricePerSlot;
            const discount = updates.discount ?? existingPackage.discount;

            updates.totalPrice = calculateFinalPrice(sessions, pricePerSlot, discount);
            updates.isGenesisEligible = checkGenesisEligibility(sessions);
        }

        const updatedPackage = await PackageModel.findByIdAndUpdate(
            packageId,
            { $set: updates }, // Use $set to only update provided fields
            { new: true, runValidators: true }
        );

        if (!updatedPackage) {
            res.status(404).json({ message: 'Package not found.' });
            return;
        }

        res.status(200).json({ 
            message: 'Package updated successfully.', 
            data: updatedPackage 
        });

    } catch (error) {
        console.error('Error updating package:', error);
        if (error instanceof Error && (error as any).code === 11000) {
            res.status(409).json({ message: 'Package name already exists.' });
            return;
        }
        res.status(500).json({ message: 'Failed to update package.', error });
    }
};

export const getAllPackages = async (req: Request, res: Response): Promise<void> => {
    try {
        // Removed the filter { isActive: true }
        const packages = await PackageModel.find().sort({ sessions: 1 });
        res.status(200).json({ data: packages });
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve packages.' });
    }
};