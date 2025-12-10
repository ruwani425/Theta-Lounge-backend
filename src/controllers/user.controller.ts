import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import UserModel, { IUserDocument } from '../models/user.model';
import PackageActivationModel from '../models/package-activation.model';
import AppointmentModel from '../models/appointment.model';

// --- Admin Management Helpers & Constants ---
// Helper function to check if the caller is the user being modified
const isSelfModification = (req: AuthenticatedRequest, targetId: string): boolean => {
    return req.userId === targetId;
};

// Permission Keys (Must match frontend)
const VALID_PERMISSIONS = [
    "reservations", "tanks", "users", "packages", 
    "activations", "reports", "content", "access_control", "settings"
];
// ---------------------------------------------


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

        // Include 'permissions' in the select statement for the admin user calling this
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

// =================================================================
// NEW ADMIN MANAGEMENT FUNCTIONS (FOR ACCESS CONTROL PAGE)
// =================================================================

/**
 * GET /api/users/admin/list
 * Get all users with the 'admin' role, excluding self (Master Admin)
 */
export const getAllAdmins = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const admins = await UserModel.find({ 
            role: 'admin',
            _id: { $ne: req.userId } // Exclude the requesting admin (Master Admin)
        })
        .select('_id name email permissions createdAt')
        .sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            message: 'Admin users retrieved successfully',
            data: admins,
            count: admins.length,
        });
    } catch (error) {
        console.error('Error fetching admin users:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch admin users',
        });
    }
};

/**
 * POST /api/users/admin/add
 * Create a new user or update an existing one to an 'admin' role and set permissions.
 */
export const addAdminUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { email, permissions } = req.body;

        if (!email || !permissions || !Array.isArray(permissions)) {
            return res.status(400).json({
                success: false,
                message: 'Missing email or permissions list.',
            });
        }
        
        // 1. Validate Permissions
        const invalidPermissions = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
        if (invalidPermissions.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid permissions found: ${invalidPermissions.join(', ')}`,
            });
        }
        
        // 2. Find or Create User
        let user: IUserDocument | null = await UserModel.findOne({ email });

        if (!user) {
            // Placeholder user creation
            user = await UserModel.create({
                email,
                name: email.split('@')[0], // Placeholder name
                role: 'admin',
                permissions: permissions,
            });
            
        } else {
            // Update existing user to admin role and set permissions
            user.role = 'admin';
            user.permissions = permissions;
            await user.save();
        }

        // 3. Return the new admin data
        const adminData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            permissions: user.permissions,
            createdAt: user.createdAt,
        };

        return res.status(201).json({
            success: true,
            message: `User ${email} promoted/updated to Admin.`,
            data: adminData,
        });

    } catch (error) {
        console.error('Error adding admin user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add admin user.',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

/**
 * DELETE /api/users/admin/:userId
 * Revoke admin status by changing role to 'client' and clearing permissions.
 */
export const revokeAdminAccess = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        if (isSelfModification(req, userId)) {
             return res.status(403).json({
                success: false,
                message: 'You cannot revoke your own access via this endpoint.',
            });
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { role: 'client', permissions: [] }, // Demote and clear permissions
            { new: true }
        ).select('_id email role permissions');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            });
        }
        
        return res.status(200).json({
            success: true,
            message: `${user.email} admin access revoked. Role set to 'client'.`,
            data: user,
        });

    } catch (error) {
        console.error('Error revoking admin access:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to revoke admin access.',
        });
    }
};