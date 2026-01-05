// // src/controllers/package-activation.controller.ts

// import { Request, Response } from 'express';
// import PackageActivationModel from '../models/package-activation.model';
// import PackageModel from '../models/package.model'; 
// import { PackageActivation } from '../interfaces/package-activation.interface';
// import { AuthenticatedRequest } from '../middlewares/auth.middleware';
// import cron from 'node-cron'; 

// interface PackageActivationPayload extends Omit<PackageActivation, '_id' | 'packageName' | 'status' | 'createdAt' | 'updatedAt' | 'preferredDate'> {
//     preferredDate: string; 
// }

// export const createPackageActivation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//     try {
//         const payload = req.body as PackageActivationPayload;
//         const { fullName, email, phone, address, message, preferredDate, packageId } = payload;
//         const userId = req.userId;

//         console.log(' [createPackageActivation] Request:', { 
//             fullName, 
//             email, 
//             packageId, 
//             userId 
//         });

//         if (!fullName || !email || !phone || !address || !packageId) {
//             res.status(400).json({ message: 'Missing required fields: fullName, email, phone, address, packageId.' });
//             return;
//         }

//         const pkg = await PackageModel.findById(packageId).select('name sessions duration');
        
//         if (!pkg) {
//             res.status(404).json({ message: 'Associated package not found.' });
//             return;
//         }

//         console.log(' [createPackageActivation] Package found:', { 
//             name: pkg.name, 
//             sessions: pkg.sessions,
//             duration: pkg.duration 
//         });

//         const newActivation: PackageActivation = {
//             userId,
//             fullName,
//             email,
//             phone,
//             address,
//             message: message ?? '',
//             packageId,
//             packageName: pkg.name,
//             totalSessions: pkg.sessions,
//             preferredDate: new Date(preferredDate),
//             status: 'Pending',
//             usedCount: 0, 
//         };

//         const activationDoc = new PackageActivationModel(newActivation);
//         await activationDoc.save();

//         console.log(' [createPackageActivation] Package activation created:', activationDoc._id);

//         res.status(201).json({ 
//             message: 'Package Activation request successfully submitted.', 
//             data: activationDoc 
//         });

//     } catch (error) {
//         console.error(' [createPackageActivation] Error:', error);
//         res.status(500).json({ message: 'Failed to submit package activation request.', error });
//     }
// };

// export const getAllPackageActivations = async (req: Request, res: Response): Promise<void> => {
//     try {
//         const { 
//             page = 1, 
//             limit = 20, 
//             status,
//             sortBy = 'createdAt',
//             sortOrder = 'desc' 
//         } = req.query;

//         console.log(' [getAllPackageActivations] Fetching with params:', { 
//             page, 
//             limit, 
//             status, 
//             sortBy, 
//             sortOrder 
//         });

//         const pageNum = Number(page);
//         const limitNum = Number(limit);
//         const skip = (pageNum - 1) * limitNum;

//         const filter: any = {};
//         if (status && typeof status === 'string') {
//             filter.status = status;
//         }

//         const sort: any = {};
//         sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

//         const activations = await PackageActivationModel
//             .find(filter)
//             .populate('packageId', 'name duration sessions totalPrice')
//             .populate('userId', 'name email profilePicture')
//             .sort(sort)
//             .skip(skip)
//             .limit(limitNum)
//             .lean();

//         const activationsWithRemaining = activations.map(activation => {
//             const totalSessions = activation.totalSessions || 0;
//             const usedCount = activation.usedCount || 0;
//             const remainingSessions = Math.max(0, totalSessions - usedCount);

//             return {
//                 ...activation,
//                 remainingSessions,
//             };
//         });

//         const total = await PackageActivationModel.countDocuments(filter);
//         console.log(' [getAllPackageActivations] Found activations:', { 
//             total, 
//             returned: activations.length 
//         });

//         res.status(200).json({
//             success: true,
//             data: activationsWithRemaining,
//             pagination: {
//                 page: pageNum,
//                 limit: limitNum,
//                 total,
//                 totalPages: Math.ceil(total / limitNum),
//             },
//         });

//     } catch (error) {
//         console.error(' [getAllPackageActivations] Error:', error);
//         res.status(500).json({ 
//             success: false,
//             message: 'Failed to fetch package activations.', 
//             error 
//         });
//     }
// };

// export const updatePackageActivationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//     try {
//         const { id } = req.params;
//         const { status, startDate: requestedStartDate } = req.body;

//         console.log(' [updatePackageActivationStatus] Updating status:', { id, status, requestedStartDate });

//         if (!status || !['Pending', 'Contacted', 'Confirmed', 'Rejected'].includes(status)) {
//             res.status(400).json({ message: 'Invalid status value.' });
//             return;
//         }

//         const activation = await PackageActivationModel.findById(id);
//         if (!activation) {
//             res.status(404).json({ message: 'Package activation not found.' });
//             return;
//         }

//         const pkg = await PackageModel.findById(activation.packageId).select('duration sessions');
//         if (!pkg) {
//             res.status(404).json({ message: 'Associated package not found.' });
//             return;
//         }

//         activation.status = status;

//         const isConfirmedOrDateUpdate = status === 'Confirmed' && (!activation.startDate || requestedStartDate);

//         if (isConfirmedOrDateUpdate) {
            
//             const actualStartDate = requestedStartDate ? new Date(requestedStartDate) : new Date();

//             activation.startDate = actualStartDate;
            
//             const expiryDate = new Date(actualStartDate); 
//             const durationMatch = pkg.duration.match(/(\d+)-Month/);
            
//             if (durationMatch) {
//                 const months = parseInt(durationMatch[1]);
//                 expiryDate.setMonth(expiryDate.getMonth() + months);
//             } else {
//                 expiryDate.setMonth(expiryDate.getMonth() + 1);
//             }
//             activation.expiryDate = expiryDate;

//             console.log(' [updatePackageActivationStatus] Dates updated:', {
//                 startDate: activation.startDate,
//                 expiryDate: activation.expiryDate,
//                 duration: pkg.duration,
//             });
//         }

//         await activation.save();

//         console.log('✅ [updatePackageActivationStatus] Status updated successfully');

//         res.status(200).json({
//             success: true,
//             message: 'Package activation status updated successfully.',
//             data: activation,
//         });

//     } catch (error) {
//         console.error('❌ [updatePackageActivationStatus] Error:', error);
//         res.status(500).json({ message: 'Failed to update package activation status.', error });
//     }
// };

// export const getUserActivePackages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//     try {
//         const userId = req.userId;
//         const userEmail = req.userEmail;

//         console.log('[getUserActivePackages] Fetching for user:', { userId, userEmail });

//         if (!userId && !userEmail) {
//             res.status(401).json({ message: 'User identification required.' });
//             return;
//         }

//         // Find activations by userId or email, status Confirmed, and not expired
//         const now = new Date();
//         const query: any = {
//             status: 'Confirmed',
//             $or: []
//         };

//         if (userId) {
//             query.$or.push({ userId });
//         }
//         if (userEmail) {
//             query.$or.push({ email: userEmail });
//         }

//         const activations = await PackageActivationModel.find(query)
//             .populate('packageId', 'name duration sessions totalPrice')
//             .sort({ startDate: -1 });

//         // Filter out expired packages and calculate remaining sessions
//         const activePackages = activations
//             .filter(activation => {
//                 // Check if package has expiry date and if it's not expired
//                 if (activation.expiryDate) {
//                     return activation.expiryDate > now;
//                 }
//                 return true; // If no expiry date, include it
//             })
//             .map(activation => {
//                 const totalSessions = activation.totalSessions || 0;
//                 const usedCount = activation.usedCount || 0;
//                 const remainingSessions = Math.max(0, totalSessions - usedCount);

//                 return {
//                     ...activation.toObject(),
//                     remainingSessions,
//                 };
//             });

//         console.log(' [getUserActivePackages] Found packages:', { 
//             total: activations.length, 
//             active: activePackages.length 
//         });

//         res.status(200).json({
//             success: true,
//             data: activePackages,
//         });

//     } catch (error) {
//         console.error(' [getUserActivePackages] Error:', error);
//         res.status(500).json({ message: 'Failed to fetch active packages.', error });
//     }
// };

// export const checkAndExpirePackages = async (): Promise<void> => {
//     try {
//         const now = new Date();
        
//         console.log(` [CRON] Starting package expiration check at ${now.toISOString()}`);

//         const query = {
//             status: 'Confirmed',
//             expiryDate: { $lte: now }
//         };

//         const update = {
//             status: 'Expired' as const, 
//         };

//         const result = await PackageActivationModel.updateMany(query, update);

//         if (result.modifiedCount > 0) {
//             console.log(` [CRON] Successfully expired ${result.modifiedCount} confirmed packages.`);
//         } else {
//             console.log(' [CRON] No packages found for expiration.');
//         }

//     } catch (error) {
//         console.error(' [CRON] Error during package expiration check:', error);
//     }
// };

// export const startExpirationCronJob = (): void => {
    
//     const PRODUCTION_SCHEDULE = "0 0 * * *"; 
//     const timezone = "Asia/Colombo";

//     cron.schedule(PRODUCTION_SCHEDULE, () => {
//         checkAndExpirePackages();
//     }, {
//         timezone: timezone 
//     });
    
//     console.log(' [CRON] Package expiration job scheduled to run daily at 12:00 AM (Asia/Colombo).');
// };


//===========================================================================================================================================================================

import { Request, Response } from 'express';
import PackageActivationModel from '../models/package-activation.model';
import PackageModel from '../models/package.model'; 
import { PackageActivation } from '../interfaces/package-activation.interface';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import cron from 'node-cron'; 
import { sendEmail } from "../utils/send.email";

interface PackageActivationPayload extends Omit<PackageActivation, '_id' | 'packageName' | 'status' | 'createdAt' | 'updatedAt' | 'preferredDate'> {
    preferredDate: string; 
}

export const createPackageActivation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const payload = req.body as PackageActivationPayload;
        const { fullName, email, phone, address, message, preferredDate, packageId } = payload;
        const userId = req.userId;

        if (!fullName || !email || !phone || !address || !packageId) {
            res.status(400).json({ message: 'Missing required fields: fullName, email, phone, address, packageId.' });
            return;
        }

        const pkg = await PackageModel.findById(packageId).select('name sessions duration');
        if (!pkg) {
            res.status(404).json({ message: 'Associated package not found.' });
            return;
        }

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

        const emailSubject = "Package Activation Request Received - Theta Lounge";
        const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #2c3e50; padding: 25px; text-align: center; color: white;">
                    <h2 style="margin:0;">Request Received</h2>
                </div>
                <div style="padding: 30px; color: #444; line-height: 1.6;">
                    <p>Hi <strong>${fullName}</strong>,</p>
                    <p>We have received your request to activate the <strong>${pkg.name}</strong> package.</p>
                    <p>Your request is currently <strong>Pending</strong>. Our team will review the details and reach out to you shortly to complete the activation process.</p>
                    <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;">
                        <strong>Package:</strong> ${pkg.name}<br/>
                        <strong>Status:</strong> Awaiting Admin Review
                    </div>
                    <p>Thank you for your patience!</p>
                </div>
            </div>
        `;
        sendEmail(email, emailSubject, emailHtml).catch(err => console.error("📧 Initial Package Email Failed:", err));

        res.status(201).json({ 
            message: 'Package Activation request successfully submitted.', 
            data: activationDoc 
        });

    } catch (error) {
        console.error(' [createPackageActivation] Error:', error);
        res.status(500).json({ message: 'Failed to submit package activation request.', error });
    }
};

export const updatePackageActivationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, startDate: requestedStartDate } = req.body;

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

        const oldStatus = activation.status;
        activation.status = status;

        if (status === 'Confirmed' && (!activation.startDate || requestedStartDate)) {
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
        }

        await activation.save();

        if (oldStatus !== status) {
            let statusSubject = `Update: Your ${activation.packageName} Package Status`;
            let statusColor = "#3498db"; 
            let statusMessage = "";

            if (status === 'Confirmed') {
                statusColor = "#27ae60";
                statusMessage = `Your package has been <strong>Confirmed</strong>! You can now use your ${activation.totalSessions} sessions. Your package is valid until <strong>${activation.expiryDate?.toDateString()}</strong>.`;
            } else if (status === 'Contacted') {
                statusMessage = `An admin has processed your request. We will be contacting you shortly at <strong>${activation.phone}</strong> to discuss the next steps.`;
            } else if (status === 'Rejected') {
                statusColor = "#e74c3c";
                statusMessage = `We regret to inform you that your request for the ${activation.packageName} package has been declined. Please contact us if you have any questions.`;
            }

            if (statusMessage) {
                const statusHtml = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: ${statusColor}; padding: 20px; text-align: center; color: white;">
                            <h2 style="margin:0;">Status Updated: ${status}</h2>
                        </div>
                        <div style="padding: 30px; color: #444; line-height: 1.6;">
                            <p>Hi <strong>${activation.fullName}</strong>,</p>
                            <p>${statusMessage}</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
                            <p style="font-size: 13px; color: #7f8c8d;">Package ID: ${activation._id}</p>
                        </div>
                    </div>
                `;
                sendEmail(activation.email, statusSubject, statusHtml).catch(err => console.error("📧 Status Update Email Failed:", err));
            }
        }

        res.status(200).json({
            success: true,
            message: 'Package activation status updated successfully.',
            data: activation,
        });

    } catch (error) {
        console.error('[updatePackageActivationStatus] Error:', error);
        res.status(500).json({ message: 'Failed to update status.', error });
    }
};

export const getAllPackageActivations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const filter: any = {};
        if (status && typeof status === 'string') filter.status = status;

        const sort: any = {};
        sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

        const activations = await PackageActivationModel.find(filter)
            .populate('packageId', 'name duration sessions totalPrice')
            .populate('userId', 'name email profilePicture')
            .sort(sort).skip(skip).limit(limitNum).lean();

        const activationsWithRemaining = activations.map(activation => ({
            ...activation,
            remainingSessions: Math.max(0, (activation.totalSessions || 0) - (activation.usedCount || 0)),
        }));

        const total = await PackageActivationModel.countDocuments(filter);
        res.status(200).json({
            success: true,
            data: activationsWithRemaining,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activations.', error });
    }
};

export const getUserActivePackages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const userEmail = req.userEmail;
        if (!userId && !userEmail) {
            res.status(401).json({ message: 'User identification required.' });
            return;
        }

        const now = new Date();
        const query: any = { status: 'Confirmed', $or: [] };
        if (userId) query.$or.push({ userId });
        if (userEmail) query.$or.push({ email: userEmail });

        const activations = await PackageActivationModel.find(query).populate('packageId').sort({ startDate: -1 });

        const activePackages = activations
            .filter(act => !act.expiryDate || act.expiryDate > now)
            .map(act => ({
                ...act.toObject(),
                remainingSessions: Math.max(0, (act.totalSessions || 0) - (act.usedCount || 0)),
            }));

        res.status(200).json({ success: true, data: activePackages });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch active packages.', error });
    }
};

export const checkAndExpirePackages = async (): Promise<void> => {
    try {
        const now = new Date();
        console.log(` [CRON] Starting package expiration check at ${now.toISOString()}`);

        const expiredPackages = await PackageActivationModel.find({
            status: 'Confirmed',
            expiryDate: { $lte: now }
        });

        if (expiredPackages.length === 0) {
            console.log(' [CRON] No packages found for expiration.');
            return;
        }

        for (const activation of expiredPackages) {
            activation.status = 'Expired' as any;
            await activation.save();

            const emailSubject = `Package Expired: ${activation.packageName}`;
            const emailHtml = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #7f8c8d; padding: 20px; text-align: center; color: white;">
                        <h2 style="margin:0;">Package Expired</h2>
                    </div>
                    <div style="padding: 30px; color: #444; line-height: 1.6;">
                        <p>Hi <strong>${activation.fullName}</strong>,</p>
                        <p>Your <strong>${activation.packageName}</strong> package at Theta Lounge has expired as of ${activation.expiryDate?.toDateString()}.</p>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7f8c8d;">
                            <p style="margin: 5px 0;"><strong>Used Sessions:</strong> ${activation.usedCount}</p>
                            <p style="margin: 5px 0;"><strong>Total Sessions:</strong> ${activation.totalSessions}</p>
                        </div>

                        <p>We hope you enjoyed your sessions! If you'd like to continue your wellness journey, you can purchase a new package through our mobile app or website.</p>
                        <br />
                        <p>Best regards,<br/>The Theta Lounge Team</p>
                    </div>
                </div>
            `;

            sendEmail(activation.email, emailSubject, emailHtml).catch(err => 
                console.error(`📧 Expiration Email Failed for ${activation.email}:`, err)
            );
        }

        console.log(` [CRON] Successfully expired and notified ${expiredPackages.length} users.`);

    } catch (error) {
        console.error(' [CRON] Error during package expiration check:', error);
    }
};

export const startExpirationCronJob = (): void => {
    cron.schedule("0 0 * * *", () => checkAndExpirePackages(), { timezone: "Asia/Colombo" });
    console.log(' [CRON] Package expiration job scheduled.');
};