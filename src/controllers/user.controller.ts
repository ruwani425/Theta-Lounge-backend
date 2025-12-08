import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import UserModel from '../models/user.model';
import PackageActivationModel from '../models/package-activation.model';
import AppointmentModel from '../models/appointment.model';

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const users = await UserModel.find()
            .select('-firebaseUid')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: users,
            count: users.length,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get single user by ID with their package activations (Admin only)
 */
export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        const user = await UserModel.findById(userId).select('-firebaseUid');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Get all package activations for this user
        const packageActivations = await PackageActivationModel.find({ email: user.email })
            .populate('packageId')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: {
                user,
                packageActivations,
            },
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get current user's activated packages (Client only)
 */
export const getMyActivatedPackages = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userEmail = req.userEmail;

        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'User email not found in token',
            });
        }

        // Get all package activations for current user
        const packageActivations = await PackageActivationModel.find({
            email: userEmail
        })
            .populate('packageId')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Package activations retrieved successfully',
            data: packageActivations,
            count: packageActivations.length,
        });
    } catch (error) {
        console.error('Error fetching user packages:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch package activations',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Get current user's profile
 */
export const getMyProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID not found in token',
            });
        }

        const user = await UserModel.findById(userId).select('-firebaseUid');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Profile retrieved successfully',
            data: user,
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * Update user role (Admin only)
 */
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !['admin', 'client'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be "admin" or "client"',
            });
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { role },
            { new: true, runValidators: true }
        ).select('-firebaseUid');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            data: user,
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update user role',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Required addition to src/controllers/user.controller.ts

/**
 * GET /api/users/dashboard/:email
 * Aggregates client data: profile, all reservations, and all package activations. (Admin only)
 */
export const getClientDashboardDetails = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Missing client email.' });
        }

        // 1. Fetch User Profile
        const user = await UserModel.findOne({ email }).select('-firebaseUid -__v');

        if (!user) {
            return res.status(404).json({ success: false, message: 'Client not found.' });
        }

        // 2. Fetch All Reservations for this client
        const clientReservations = await AppointmentModel.find({ email })
            .select('reservationId date time status specialNote isPackageUser')
            .sort({ date: -1, time: -1 })
            .lean();

        // 3. Fetch All Package Activations (Confirmed and Unconfirmed)
        const packageActivations = await PackageActivationModel.find({ email })
            .populate('packageId', 'name duration sessions totalPrice')
            .sort({ createdAt: -1 })
            .lean();

        // 4. Calculate Active/Remaining sessions and filter active
        const now = new Date();
        const packagesSummary = packageActivations.map(activation => {
            const totalSessions = activation.totalSessions || 0;
            const usedCount = activation.usedCount || 0;
            const remainingSessions = Math.max(0, totalSessions - usedCount);

            const isActive = activation.status === 'Confirmed' && (!activation.expiryDate || activation.expiryDate > now);

            return {
                ...activation,
                remainingSessions,
                isActive,
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Client dashboard data retrieved successfully',
            data: {
                profile: user,
                reservations: clientReservations,
                packages: packagesSummary,
                activePackagesCount: packagesSummary.filter(p => p.isActive).length,
                totalReservations: clientReservations.length,
            },
        });
    } catch (error) {
        console.error('Error fetching client dashboard:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch client dashboard data.',
        });
    }
};