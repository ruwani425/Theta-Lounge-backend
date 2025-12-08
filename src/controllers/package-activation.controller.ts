// src/controllers/package-activation.controller.ts

import { Request, Response } from 'express';
import PackageActivationModel from '../models/package-activation.model';
import PackageModel from '../models/package.model'; 
import { PackageActivation } from '../interfaces/package-activation.interface';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import cron from 'node-cron'; 

interface PackageActivationPayload extends Omit<PackageActivation, '_id' | 'packageName' | 'status' | 'createdAt' | 'updatedAt' | 'preferredDate'> {
    preferredDate: string; 
}

export const createPackageActivation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const payload = req.body as PackageActivationPayload;
        const { fullName, email, phone, address, message, preferredDate, packageId } = payload;
        const userId = req.userId;

        console.log(' [createPackageActivation] Request:', { 
            fullName, 
            email, 
            packageId, 
            userId 
        });

        if (!fullName || !email || !phone || !address || !packageId) {
            res.status(400).json({ message: 'Missing required fields: fullName, email, phone, address, packageId.' });
            return;
        }

        const pkg = await PackageModel.findById(packageId).select('name sessions duration');
        
        if (!pkg) {
            res.status(404).json({ message: 'Associated package not found.' });
            return;
        }

        console.log(' [createPackageActivation] Package found:', { 
            name: pkg.name, 
            sessions: pkg.sessions,
            duration: pkg.duration 
        });

        const newActivation: PackageActivation = {
            userId,
            fullName,
            email,
            phone,
            address,
            message: message ?? '',
            packageId,
            packageName: pkg.name,
            totalSessions: pkg.sessions,
            preferredDate: new Date(preferredDate),
            status: 'Pending',
            usedCount: 0, 
        };

        const activationDoc = new PackageActivationModel(newActivation);
        await activationDoc.save();

        console.log(' [createPackageActivation] Package activation created:', activationDoc._id);

        res.status(201).json({ 
            message: 'Package Activation request successfully submitted.', 
            data: activationDoc 
        });

    } catch (error) {
        console.error(' [createPackageActivation] Error:', error);
        res.status(500).json({ message: 'Failed to submit package activation request.', error });
    }
};

export const getAllPackageActivations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status,
            sortBy = 'createdAt',
            sortOrder = 'desc' 
        } = req.query;

        console.log(' [getAllPackageActivations] Fetching with params:', { 
            page, 
            limit, 
            status, 
            sortBy, 
            sortOrder 
        });

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const filter: any = {};
        if (status && typeof status === 'string') {
            filter.status = status;
        }

        const sort: any = {};
        sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

        const activations = await PackageActivationModel
            .find(filter)
            .populate('packageId', 'name duration sessions totalPrice')
            .populate('userId', 'name email profilePicture')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const activationsWithRemaining = activations.map(activation => {
            const totalSessions = activation.totalSessions || 0;
            const usedCount = activation.usedCount || 0;
            const remainingSessions = Math.max(0, totalSessions - usedCount);

            return {
                ...activation,
                remainingSessions,
            };
        });

        const total = await PackageActivationModel.countDocuments(filter);
        console.log(' [getAllPackageActivations] Found activations:', { 
            total, 
            returned: activations.length 
        });

        res.status(200).json({
            success: true,
            data: activationsWithRemaining,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });

    } catch (error) {
        console.error(' [getAllPackageActivations] Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch package activations.', 
            error 
        });
    }
};

export const updatePackageActivationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, startDate: requestedStartDate } = req.body;

        console.log(' [updatePackageActivationStatus] Updating status:', { id, status, requestedStartDate });

        if (!status || !['Pending', 'Contacted', 'Confirmed', 'Rejected'].includes(status)) {
            res.status(400).json({ message: 'Invalid status value.' });
            return;
        }

        const activation = await PackageActivationModel.findById(id);
        if (!activation) {
            res.status(404).json({ message: 'Package activation not found.' });
            return;
        }

        const pkg = await PackageModel.findById(activation.packageId).select('duration sessions');
        if (!pkg) {
            res.status(404).json({ message: 'Associated package not found.' });
            return;
        }

        activation.status = status;

        const isConfirmedOrDateUpdate = status === 'Confirmed' && (!activation.startDate || requestedStartDate);

        if (isConfirmedOrDateUpdate) {
            
            const actualStartDate = requestedStartDate ? new Date(requestedStartDate) : new Date();

            activation.startDate = actualStartDate;
            
            const expiryDate = new Date(actualStartDate); 
            const durationMatch = pkg.duration.match(/(\d+)-Month/);
            
            if (durationMatch) {
                const months = parseInt(durationMatch[1]);
                expiryDate.setMonth(expiryDate.getMonth() + months);
            } else {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }
            activation.expiryDate = expiryDate;

            console.log(' [updatePackageActivationStatus] Dates updated:', {
                startDate: activation.startDate,
                expiryDate: activation.expiryDate,
                duration: pkg.duration,
            });
        }

        await activation.save();

        console.log('✅ [updatePackageActivationStatus] Status updated successfully');

        res.status(200).json({
            success: true,
            message: 'Package activation status updated successfully.',
            data: activation,
        });

    } catch (error) {
        console.error('❌ [updatePackageActivationStatus] Error:', error);
        res.status(500).json({ message: 'Failed to update package activation status.', error });
    }
};

export const getUserActivePackages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const userEmail = req.userEmail;

        console.log('[getUserActivePackages] Fetching for user:', { userId, userEmail });

        if (!userId && !userEmail) {
            res.status(401).json({ message: 'User identification required.' });
            return;
        }

        // Find activations by userId or email, status Confirmed, and not expired
        const now = new Date();
        const query: any = {
            status: 'Confirmed',
            $or: []
        };

        if (userId) {
            query.$or.push({ userId });
        }
        if (userEmail) {
            query.$or.push({ email: userEmail });
        }

        const activations = await PackageActivationModel.find(query)
            .populate('packageId', 'name duration sessions totalPrice')
            .sort({ startDate: -1 });

        // Filter out expired packages and calculate remaining sessions
        const activePackages = activations
            .filter(activation => {
                // Check if package has expiry date and if it's not expired
                if (activation.expiryDate) {
                    return activation.expiryDate > now;
                }
                return true; // If no expiry date, include it
            })
            .map(activation => {
                const totalSessions = activation.totalSessions || 0;
                const usedCount = activation.usedCount || 0;
                const remainingSessions = Math.max(0, totalSessions - usedCount);

                return {
                    ...activation.toObject(),
                    remainingSessions,
                };
            });

        console.log(' [getUserActivePackages] Found packages:', { 
            total: activations.length, 
            active: activePackages.length 
        });

        res.status(200).json({
            success: true,
            data: activePackages,
        });

    } catch (error) {
        console.error(' [getUserActivePackages] Error:', error);
        res.status(500).json({ message: 'Failed to fetch active packages.', error });
    }
};

export const checkAndExpirePackages = async (): Promise<void> => {
    try {
        const now = new Date();
        
        console.log(` [CRON] Starting package expiration check at ${now.toISOString()}`);

        const query = {
            status: 'Confirmed',
            expiryDate: { $lte: now }
        };

        const update = {
            status: 'Expired' as const, 
        };

        const result = await PackageActivationModel.updateMany(query, update);

        if (result.modifiedCount > 0) {
            console.log(` [CRON] Successfully expired ${result.modifiedCount} confirmed packages.`);
        } else {
            console.log(' [CRON] No packages found for expiration.');
        }

    } catch (error) {
        console.error(' [CRON] Error during package expiration check:', error);
    }
};

export const startExpirationCronJob = (): void => {
    
    const PRODUCTION_SCHEDULE = "0 0 * * *"; 
    const timezone = "Asia/Colombo";

    cron.schedule(PRODUCTION_SCHEDULE, () => {
        checkAndExpirePackages();
    }, {
        timezone: timezone 
    });
    
    console.log(' [CRON] Package expiration job scheduled to run daily at 12:00 AM (Asia/Colombo).');
};