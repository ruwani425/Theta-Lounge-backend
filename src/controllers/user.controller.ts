import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import UserModel from '../models/user.model';
import PackageActivationModel from '../models/package-activation.model';

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

