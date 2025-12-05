// src/controllers/package-activation.controller.ts

import { Request, Response } from 'express';
import PackageActivationModel from '../models/package-activation.model';
import PackageModel from '../models/package.model'; // To fetch package name
import { PackageActivation } from '../interfaces/package-activation.interface';

// Helper interface based on the frontend payload
interface PackageActivationPayload extends Omit<PackageActivation, '_id' | 'packageName' | 'status' | 'createdAt' | 'updatedAt' | 'preferredDate'> {
    preferredDate: string; // The date comes as a string from the frontend (new Date().toISOString())
}


/**
 * POST /api/package-activations
 * Creates a new package activation request from the client form.
 */
export const createPackageActivation = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body as PackageActivationPayload;
        const { fullName, email, phone, address, message, preferredDate, packageId } = payload;

        // 1. Basic Validation
        if (!fullName || !email || !phone || !address || !packageId) {
            res.status(400).json({ message: 'Missing required fields: fullName, email, phone, address, packageId.' });
            return;
        }

        // 2. Fetch Package Details (for name and validation)
        const pkg = await PackageModel.findById(packageId).select('name');
        
        if (!pkg) {
            res.status(404).json({ message: 'Associated package not found.' });
            return;
        }

        // 3. Create the new Package Activation document
        const newActivation: PackageActivation = {
            fullName,
            email,
            phone,
            address,
            message: message ?? '',
            packageId,
            packageName: pkg.name, // Use fetched package name
            preferredDate: new Date(preferredDate), // Convert string to Date
            status: 'Pending',
        };

        const activationDoc = new PackageActivationModel(newActivation);
        await activationDoc.save();

        // 4. Respond with success
        res.status(201).json({ 
            message: 'Package Activation request successfully submitted.', 
            data: activationDoc 
        });

    } catch (error) {
        console.error('Error creating package activation:', error);
        res.status(500).json({ message: 'Failed to submit package activation request.', error });
    }
};

/**
 * GET /api/package-activations (Admin route)
 * Fetches all package activation requests (implementation intentionally omitted for brevity).
 */
export const getAllPackageActivations = async (req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: 'Not Implemented: Fetching all package activations.' });
};