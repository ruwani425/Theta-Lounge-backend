
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import UserModel, { IUserDocument } from '../models/user.model';
import PackageActivationModel from '../models/package-activation.model';
import AppointmentModel from '../models/appointment.model';
import { sendEmail } from "../utils/send.email"; 

const isSelfModification = (req: AuthenticatedRequest, targetId: string): boolean => {
    return req.userId === targetId;
};

const VALID_PERMISSIONS = [
    "reservations", "tanks", "users", "packages", 
    "activations", "reports", "content", "access_control", "settings"
];

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
        });
    }
};

export const getMyActivatedPackages = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userEmail = req.userEmail;
        if (!userEmail) return res.status(400).json({ success: false, message: 'User email not found' });

        const packageActivations = await PackageActivationModel.find({ email: userEmail })
            .populate('packageId')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Package activations retrieved successfully',
            data: packageActivations,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch' });
    }
};

export const getMyProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.userId;
        const user = await UserModel.findById(userId).select('-firebaseUid');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error' });
    }
};

export const getClientDashboardDetails = async (req: Request, res: Response) => {
    try {
        const { email } = req.params;
        if (!email) return res.status(400).json({ success: false, message: 'Email missing' });

        const user = await UserModel.findOne({ email }).select('-firebaseUid -__v');
        if (!user) return res.status(404).json({ success: false, message: 'Client not found' });

        const clientReservations = await AppointmentModel.find({ email }).sort({ date: -1, time: -1 }).lean();
        const packageActivations = await PackageActivationModel.find({ email }).populate('packageId').sort({ createdAt: -1 }).lean();

        const now = new Date();
        const packagesSummary = packageActivations.map(act => ({
            ...act,
            remainingSessions: Math.max(0, (act.totalSessions || 0) - (act.usedCount || 0)),
            isActive: act.status === 'Confirmed' && (!act.expiryDate || act.expiryDate > now),
        }));

        return res.status(200).json({
            success: true,
            data: {
                profile: user,
                reservations: clientReservations,
                packages: packagesSummary,
                activePackagesCount: packagesSummary.filter(p => p.isActive).length,
                totalReservations: clientReservations.length,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllAdmins = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const admins = await UserModel.find({ role: 'admin', _id: { $ne: req.userId } })
        .select('_id name email permissions createdAt').sort({ createdAt: 1 });
        return res.status(200).json({ success: true, data: admins });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error' });
    }
};

export const addAdminUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { email, permissions } = req.body;

        if (!email || !permissions || !Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: 'Invalid payload.' });
        }
        
        const invalidPermissions = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
        if (invalidPermissions.length > 0) {
            return res.status(400).json({ success: false, message: `Invalid: ${invalidPermissions.join(', ')}` });
        }
        
        let user: IUserDocument | null = await UserModel.findOne({ email });

        if (!user) {
            user = await UserModel.create({
                email,
                name: email.split('@')[0],
                role: 'admin',
                permissions: permissions,
            });
        } else {
            user.role = 'admin';
            user.permissions = permissions;
            await user.save();
        }

        const emailSubject = "Administrative Access Granted - Floating Theraphy";
        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #2c3e50; padding: 20px; text-align: center; color: white;">
                    <h2>Admin Access Updated</h2>
                </div>
                <div style="padding: 30px; color: #444;">
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>Your administrative permissions for the <strong>Floating Theraphy Management System</strong> have been updated.</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2c3e50;">
                        <p style="margin: 0;"><strong>Assigned Permissions:</strong></p>
                        <p style="margin: 5px 0; font-family: monospace; color: #555;">${permissions.join(', ')}</p>
                    </div>
                    <p>Please log in to the dashboard to view your updated access.</p>
                </div>
            </div>
        `;
        sendEmail(email, emailSubject, emailHtml).catch(err => console.error("📧 Admin Add Email Failed:", err));

        return res.status(201).json({ success: true, message: `Access granted to ${email}`, data: user });

    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const revokeAdminAccess = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        if (isSelfModification(req, userId)) {
             return res.status(403).json({ success: false, message: 'Self-revocation not allowed.' });
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { role: 'client', permissions: [] },
            { new: true }
        ).select('_id email name role permissions');

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const emailSubject = "Administrative Access Revoked";
        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #e74c3c; padding: 20px; text-align: center; color: white;">
                    <h2>Access Revoked</h2>
                </div>
                <div style="padding: 30px; color: #444;">
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>This is to inform you that your administrative access to the <strong>Floating Theraphy Management System</strong> has been revoked.</p>
                    <p>Your account role has been set to <strong>Client</strong>. If you believe this is an error, please contact the Master Admin.</p>
                </div>
            </div>
        `;
        sendEmail(user.email, emailSubject, emailHtml).catch(err => console.error("📧 Revoke Email Failed:", err));
        
        return res.status(200).json({ success: true, message: `Access revoked for ${user.email}`, data: user });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to revoke access.' });
    }
};