// src/controllers/package-activation.controller.ts

import { Request, Response } from 'express';
import PackageActivationModel from '../models/package-activation.model';
import PackageModel from '../models/package.model'; // To fetch package name
import { PackageActivation } from '../interfaces/package-activation.interface';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// Helper interface based on the frontend payload
interface PackageActivationPayload extends Omit<PackageActivation, '_id' | 'packageName' | 'status' | 'createdAt' | 'updatedAt' | 'preferredDate'> {
    preferredDate: string; // The date comes as a string from the frontend (new Date().toISOString())
}


/**
 * POST /api/package-activations
 * Creates a new package activation request from the client form.
 */
export const createPackageActivation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const payload = req.body as PackageActivationPayload;
        const { fullName, email, phone, address, message, preferredDate, packageId } = payload;
        const userId = req.userId; // From JWT token (optional for guests)

        console.log('📦 [createPackageActivation] Request:', { 
            fullName, 
            email, 
            packageId, 
            userId 
        });

        // 1. Basic Validation
        if (!fullName || !email || !phone || !address || !packageId) {
            res.status(400).json({ message: 'Missing required fields: fullName, email, phone, address, packageId.' });
            return;
        }

        // 2. Fetch Package Details (for name, sessions, and validation)
        const pkg = await PackageModel.findById(packageId).select('name sessions duration');
        
        if (!pkg) {
            res.status(404).json({ message: 'Associated package not found.' });
            return;
        }

        console.log('✅ [createPackageActivation] Package found:', { 
            name: pkg.name, 
            sessions: pkg.sessions,
            duration: pkg.duration 
        });

        // 3. Create the new Package Activation document
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
            usedCount: 0, // Initialize to 0
            // startDate and expiryDate will be set when status becomes 'Confirmed'
        };

        const activationDoc = new PackageActivationModel(newActivation);
        await activationDoc.save();

        console.log('✅ [createPackageActivation] Package activation created:', activationDoc._id);

        // 4. Respond with success
        res.status(201).json({ 
            message: 'Package Activation request successfully submitted.', 
            data: activationDoc 
        });

    } catch (error) {
        console.error('❌ [createPackageActivation] Error:', error);
        res.status(500).json({ message: 'Failed to submit package activation request.', error });
    }
};

/**
 * GET /api/package-activations (Admin route)
 * Fetches all package activation requests with pagination and filtering
 */
export const getAllPackageActivations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status,
            sortBy = 'createdAt',
            sortOrder = 'desc' 
        } = req.query;

        console.log('📦 [getAllPackageActivations] Fetching with params:', { 
            page, 
            limit, 
            status, 
            sortBy, 
            sortOrder 
        });

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build query filter
        const filter: any = {};
        if (status && typeof status === 'string') {
            filter.status = status;
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

        // Fetch activations with user and package details
        const activations = await PackageActivationModel
            .find(filter)
            .populate('packageId', 'name duration sessions totalPrice')
            .populate('userId', 'name email profilePicture')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Calculate remaining sessions for each activation
        const activationsWithRemaining = activations.map(activation => {
            const totalSessions = activation.totalSessions || 0;
            const usedCount = activation.usedCount || 0;
            const remainingSessions = Math.max(0, totalSessions - usedCount);

            return {
                ...activation,
                remainingSessions,
            };
        });

        // Get total count for pagination
        const total = await PackageActivationModel.countDocuments(filter);

        console.log('✅ [getAllPackageActivations] Found activations:', { 
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
        console.error('❌ [getAllPackageActivations] Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch package activations.', 
            error 
        });
    }
};

/**
 * PATCH /api/package-activations/:id/status
 * Updates package activation status and sets start/expiry dates when confirmed
 */
export const updatePackageActivationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        console.log('📝 [updatePackageActivationStatus] Updating status:', { id, status });

        if (!status || !['Pending', 'Contacted', 'Confirmed', 'Rejected'].includes(status)) {
            res.status(400).json({ message: 'Invalid status value.' });
            return;
        }

        const activation = await PackageActivationModel.findById(id);
        if (!activation) {
            res.status(404).json({ message: 'Package activation not found.' });
            return;
        }

        // Fetch package details to get duration
        const pkg = await PackageModel.findById(activation.packageId).select('duration sessions');
        if (!pkg) {
            res.status(404).json({ message: 'Associated package not found.' });
            return;
        }

        activation.status = status;

        // If confirming, set start date and calculate expiry date
        if (status === 'Confirmed' && !activation.startDate) {
            activation.startDate = new Date();
            
            // Calculate expiry date based on package duration
            const expiryDate = new Date();
            const durationMatch = pkg.duration.match(/(\d+)-Month/);
            if (durationMatch) {
                const months = parseInt(durationMatch[1]);
                expiryDate.setMonth(expiryDate.getMonth() + months);
            } else {
                // Default to 1 month if parsing fails
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            }
            activation.expiryDate = expiryDate;

            console.log('✅ [updatePackageActivationStatus] Set dates:', {
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

/**
 * GET /api/package-activations/user/active
 * Gets active package activations for the authenticated user
 */
export const getUserActivePackages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const userEmail = req.userEmail;

        console.log('📦 [getUserActivePackages] Fetching for user:', { userId, userEmail });

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

        console.log('✅ [getUserActivePackages] Found packages:', { 
            total: activations.length, 
            active: activePackages.length 
        });

        res.status(200).json({
            success: true,
            data: activePackages,
        });

    } catch (error) {
        console.error('❌ [getUserActivePackages] Error:', error);
        res.status(500).json({ message: 'Failed to fetch active packages.', error });
    }
};