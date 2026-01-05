// // src/controllers/appointment.controller.ts

// import { Request, Response } from "express";
// import mongoose from "mongoose";
// import AppointmentModel from "../models/appointment.model";
// import CalendarDetailModel from "../models/calendar.detail.model";
// import PackageActivationModel from "../models/package-activation.model";
// import {
//   AppointmentCount,
//   IAppointment,
// } from "../interfaces/appointment.interface";
// import { ICalendarDetail } from "../interfaces/calendar.interface";
// import { generateReservationId } from "../utils/generateReservationId";
// // Assuming AuthenticatedRequest is defined/imported from middleware:
// import { AuthenticatedRequest } from '../middlewares/auth.middleware';


// const timeToMinutes = (time: string): number => {
//   try {
//     const [hours, minutes] = time.split(":").map(Number);
//     if (isNaN(hours) || isNaN(minutes)) return 0;
//     return hours * 60 + minutes;
//   } catch {
//     return 0;
//   }
// };

// const calculateStaggeredSessions = (
//   openTime: string,
//   closeTime: string,
//   duration: number,
//   buffer: number,
//   numberOfTanks: number,
//   staggerInterval: number
// ): {
//   sessionsPerTank: number;
//   actualCloseTime: string;
//   totalSessions: number;
// } => {
//   const durationNum = Number(duration);
//   const bufferNum = Number(buffer);

//   if (
//     !openTime ||
//     !closeTime ||
//     durationNum <= 0 ||
//     bufferNum < 0 ||
//     numberOfTanks <= 0
//   ) {
//     return { sessionsPerTank: 0, actualCloseTime: "00:00", totalSessions: 0 };
//   }

//   const openMinutes = timeToMinutes(openTime);
//   let closeMinutes = timeToMinutes(closeTime);
//   if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

//   const sessionLength = durationNum + bufferNum;

//   let maxSessionsPerTank = 0;
//   let latestEndTime = openMinutes;

//   for (let tankIndex = 0; tankIndex < numberOfTanks; tankIndex++) {
//     const tankStartMinutes =
//       openMinutes + tankIndex * Number(staggerInterval || 0);
//     const availableTime = closeMinutes - tankStartMinutes;
//     const tankSessions = Math.floor(availableTime / sessionLength);

//     if (tankSessions > 0) {
//       const tankEndTime = tankStartMinutes + tankSessions * sessionLength;
//       latestEndTime = Math.max(latestEndTime, tankEndTime);
//       maxSessionsPerTank = Math.max(maxSessionsPerTank, tankSessions);
//     }
//   }

//   const totalSessions = maxSessionsPerTank * numberOfTanks;

//   return {
//     sessionsPerTank: maxSessionsPerTank || 0,
//     actualCloseTime: "",
//     totalSessions: isNaN(totalSessions) ? 0 : totalSessions,
//   };
// };

// export const createAppointment = async (req: Request, res: Response) => {
//   const {
//     name,
//     date,
//     time,
//     email,
//     contactNumber,
//     specialNote,
//     calendarContext,
//     packageActivationId,
//   } = req.body;

//   console.log("🎫 [createAppointment] Request:", {
//     date,
//     time,
//     email,
//     packageActivationId,
//   });

//   if (!date || !time || !email || !contactNumber || !name || !calendarContext) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "Missing required fields: name, date, time, email, contactNumber, and calendar context are mandatory.",
//     });
//   }

//   const reservationId = await generateReservationId();

//   const newAppointmentData: Partial<IAppointment> = {
//     reservationId,
//     name,
//     date,
//     time,
//     email,
//     contactNumber,
//     specialNote,
//     status: "pending",
//     packageActivationId: packageActivationId || undefined,
//   };

//   const { defaultSystemSettings } = calendarContext;

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     let packageActivation = null;
//     if (packageActivationId) {
//       console.log(
//         "📦 [createAppointment] Checking package activation:",
//         packageActivationId
//       );

//       packageActivation = await PackageActivationModel.findById(
//         packageActivationId
//       ).session(session);

//       if (!packageActivation) {
//         throw new Error("Package activation not found.");
//       }

//       if (packageActivation.status !== "Confirmed") {
//         throw new Error(
//           "Package is not confirmed yet. Please wait for admin confirmation."
//         );
//       }

//       if (
//         packageActivation.expiryDate &&
//         new Date() > packageActivation.expiryDate
//       ) {
//         throw new Error("This package has expired.");
//       }

//       const usedCount = packageActivation.usedCount || 0;
//       const totalSessions = packageActivation.totalSessions || 0;
//       const remainingSessions = totalSessions - usedCount;

//       console.log("📊 [createAppointment] Package sessions:", {
//         total: totalSessions,
//         used: usedCount,
//         remaining: remainingSessions,
//       });

//       if (remainingSessions <= 0) {
//         throw new Error("No remaining sessions in this package.");
//       }

//       packageActivation.usedCount = usedCount + 1;
//       await packageActivation.save({ session });

//       console.log(
//         "✅ [createAppointment] Package session decremented. New used count:",
//         packageActivation.usedCount
//       );
//     }

//     let finalSessionsToSell: number;
//     let calendarRecord: (ICalendarDetail & mongoose.Document) | null = null;
//     let isNewCalendarRecord = false;

//     calendarRecord = await CalendarDetailModel.findOne({ date: date }).session(
//       session
//     );

//     if (calendarRecord) {
//       finalSessionsToSell = calendarRecord.sessionsToSell;
//     } else {
//       isNewCalendarRecord = true;
//       const settings = defaultSystemSettings;

//       const totalSessions = calculateStaggeredSessions(
//         settings.openTime,
//         settings.closeTime,
//         Number(settings.sessionDuration),
//         settings.cleaningBuffer,
//         settings.numberOfTanks,
//         settings.tankStaggerInterval
//       ).totalSessions;

//       finalSessionsToSell = totalSessions;
//     }

//     if (finalSessionsToSell <= 0) {
//       throw new Error("Sold Out: No available sessions for this date.");
//     }

//     const newSessionsToSell = finalSessionsToSell - 1;

//     const newAppointment = await AppointmentModel.create(
//       [newAppointmentData as IAppointment],
//       { session }
//     );

//     if (isNewCalendarRecord) {
//       const newCalendarData: Partial<ICalendarDetail> = {
//         date: date,
//         status: newSessionsToSell > 0 ? "Bookable" : "Sold Out",
//         openTime: defaultSystemSettings.openTime,
//         closeTime: defaultSystemSettings.closeTime,
//         sessionsToSell: newSessionsToSell,
//       };
//       await CalendarDetailModel.create([newCalendarData as ICalendarDetail], {
//         session,
//       });
//     } else {
//       if (calendarRecord) {
//         calendarRecord.sessionsToSell = newSessionsToSell;
//         calendarRecord.status = newSessionsToSell > 0 ? "Bookable" : "Sold Out";
//         await calendarRecord.save({ session });
//       }
//     }

//     await session.commitTransaction();
//     session.endSession();

//     console.log("✅ [createAppointment] Appointment created successfully");

//     const responseAppointment = {
//       ...newAppointment[0].toObject(),
//       status: newAppointment[0].status.toLowerCase(),
//       packageUsed: !!packageActivationId,
//       reservationId: newAppointment[0].reservationId,
//     };
    
//     res.status(201).json({
//       success: true,
//       message: packageActivationId
//         ? "Appointment successfully created using your package session."
//         : "Appointment successfully created and calendar updated.",
//       data: responseAppointment,
//     });
//   } catch (error: any) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error(" [createAppointment] Error:", error);

//     let errorMessage = "Failed to create appointment due to a server error.";
//     if (error.message.includes("Sold Out")) {
//       errorMessage = error.message;
//     } else if (
//       error.message.includes("package") ||
//       error.message.includes("Package") ||
//       error.message.includes("session")
//     ) {
//       errorMessage = error.message;
//     }

//     res.status(500).json({
//       success: false,
//       message: errorMessage,
//     });
//   }
// };

// export const updateAppointmentStatus = async (req: Request, res: Response) => {
//   try {
//     const appointmentId = req.params.id;
//     const { status: uiStatus } = req.body;

//     const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
//       appointmentId,
//       { $set: { status: uiStatus } },
//       { new: true, runValidators: true }
//     );

//     if (!updatedAppointment) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Appointment not found." });
//     }

//     const responseAppointment = {
//       ...updatedAppointment.toObject(),
//       status: updatedAppointment.status.toLowerCase(),
//     };

//     res.status(200).json({
//       success: true,
//       message: `Appointment status updated to ${uiStatus}.`,
//       data: responseAppointment,
//     });
//   } catch (error) {
//     console.error("Error updating appointment status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update appointment status.",
//     });
//   }
// };

// /**
//  * Retrieves appointment counts aggregated by date and status for a given range.
//  * GET /api/appointments/counts
//  */
// export const getAppointmentCounts = async (req: Request, res: Response) => {
//   const { startDate, endDate } = req.query;

//   if (!startDate || !endDate) {
//     return res.status(400).json({
//       success: false,
//       message: "Missing required query parameters: startDate and endDate.",
//     });
//   }

//   try {
//     const counts: AppointmentCount[] = await AppointmentModel.aggregate([
//       {
//         $match: {
//           date: { $gte: startDate as string, $lte: endDate as string },
//           // FIX: Include 'pending' AND 'completed' appointments to calculate total booked sessions (excluding 'canceled').
//           status: { $in: ["pending", "completed"] },
//         },
//       },
//       {
//         $group: {
//           _id: { date: "$date", status: "$status" },
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     const totalBookedSessionsByDate: Record<string, number> = {};

//     counts.forEach((item) => {
//       const dateKey = item._id.date;
//       totalBookedSessionsByDate[dateKey] =
//         (totalBookedSessionsByDate[dateKey] || 0) + item.count;
//     });

//     const bookedSessionsArray = Object.keys(totalBookedSessionsByDate).map(
//       (date) => ({
//         date: date,
//         count: totalBookedSessionsByDate[date],
//       })
//     );

//     res.status(200).json({
//       success: true,
//       message: "Appointment counts retrieved successfully.",
//       data: bookedSessionsArray,
//     });
//   } catch (error) {
//     console.error("Error fetching appointment counts:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve appointment counts due to a server error.",
//     });
//   }
// };

// /**
//  * Retrieves all booked times for a specific date.
//  * GET /api/appointments/booked-times/:date
//  * Returns array of booked times (HH:MM format) for that date
//  */
// export const getBookedTimesByDate = async (req: Request, res: Response) => {
//   const { date } = req.params;

//   if (!date) {
//     return res.status(400).json({
//       success: false,
//       message: "Missing required parameter: date.",
//     });
//   }

//   try {
//     // Fetch all pending and completed appointments for the specific date
//     const appointments = await AppointmentModel.find({
//       date: date,
//       status: { $in: ["pending", "completed"] },
//     })
//       .select("time")
//       .lean();

//     // Extract and deduplicate booked times
//     const bookedTimes = Array.from(
//       new Set(appointments.map((app) => app.time))
//     );

//     console.log(`[v0] Booked times for ${date}:`, bookedTimes);

//     res.status(200).json({
//       success: true,
//       message: "Booked times retrieved successfully.",
//       data: bookedTimes,
//     });
//   } catch (error) {
//     console.error("Error fetching booked times:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve booked times due to a server error.",
//     });
//   }
// };

// export const getAppointmentDetails = async (req: Request, res: Response) => {
//   const { startDate, endDate, page = 1, limit = 20 } = req.query;

//   try {
//     console.log(
//       "📋 [getAppointmentDetails] Fetching appointments with package info"
//     );

//     const pageNum = Math.max(1, Number.parseInt(page as string) || 1);
//     const limitNum = Math.max(1, Number.parseInt(limit as string) || 20);
//     const skip = (pageNum - 1) * limitNum;

//     const filter: any = {};

//     if (startDate && endDate) {
//       filter.date = { $gte: startDate as string, $lte: endDate as string };
//     }

//     const appointments = await AppointmentModel.find(filter)
//       .sort({ date: -1, time: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .populate({
//         path: "packageActivationId",
//         select:
//           "packageName totalSessions usedCount remainingSessions startDate expiryDate status packageId",
//         populate: {
//           path: "packageId",
//           select: "name duration sessions totalPrice",
//         },
//       })
//       .lean();

//     const totalCount = await AppointmentModel.countDocuments(filter);
//     const totalPages = Math.ceil(totalCount / limitNum);

//     // For each appointment, check if the user (by email) has any confirmed packages
//     const responseAppointments = await Promise.all(
//       appointments.map(async (app: any) => {
//         let isPackageUser = false;
//         let packageDetails = null;

//         // First check if this specific appointment used a package
//         if (app.packageActivationId) {
//           console.log(
//             `✅ [getAppointmentDetails] Appointment ${app._id} used packageActivationId`
//           );
//           isPackageUser = true;
//           packageDetails = app.packageActivationId;
//         } else if (app.email) {
//           // If no packageActivationId, check if user has any confirmed packages by email
//           const userPackage = await PackageActivationModel.findOne({
//             email: app.email,
//             status: "Confirmed",
//           })
//             .populate({
//               path: "packageId",
//               select: "name duration sessions totalPrice",
//             })
//             .lean();

//           if (userPackage) {
//             console.log(
//               `📧 [getAppointmentDetails] Found package for email: ${app.email}`
//             );
//             isPackageUser = true;
//             // Calculate remaining sessions
//             const totalSessions = userPackage.totalSessions || 0;
//             const usedCount = userPackage.usedCount || 0;
//             packageDetails = {
//               ...userPackage,
//               remainingSessions: Math.max(0, totalSessions - usedCount),
//             };
//           } else {
//             console.log(
//               `👤 [getAppointmentDetails] Normal user (no package): ${app.email}`
//             );
//           }
//         }

//         return {
//           ...app,
//           status: app.status.toLowerCase(),
//           isPackageUser,
//           packageDetails,
//         };
//       })
//     );

//     const packageUsersCount = responseAppointments.filter(
//       (app) => app.isPackageUser
//     ).length;
//     const normalUsersCount = responseAppointments.length - packageUsersCount;

//     console.log(
//       `📊 [getAppointmentDetails] Summary: ${packageUsersCount} package users, ${normalUsersCount} normal users`
//     );

//     res.status(200).json({
//       success: true,
//       message: "Appointment details retrieved successfully.",
//       data: responseAppointments,
//       pagination: {
//         currentPage: pageNum,
//         totalPages,
//         totalRecords: totalCount,
//         limit: limitNum,
//         hasNextPage: pageNum < totalPages,
//         hasPrevPage: pageNum > 1,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching appointment details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve appointment details due to a server error.",
//     });
//   }
// };


// export const updateAppointmentDetails = async (req: Request, res: Response) => {
//   try {
//     const appointmentId = req.params.id;
//     const { date, time } = req.body;

//     if (!date || !time) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: date and time are mandatory for update.",
//       });
//     }
//     
//     // NOTE: In a production app, complex logic to free up the old session and 
//     // book the new session (checking availability, updating the CalendarDetail document) 
//     // must be implemented here inside a transaction.
//     
//     const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
//       appointmentId,
//       { $set: { date: date, time: time } },
//       { new: true, runValidators: true }
//     )
//     .populate({ 
//         path: "packageActivationId",
//         select:
//           "packageName totalSessions usedCount remainingSessions startDate expiryDate status packageId",
//         populate: {
//           path: "packageId",
//           select: "name duration sessions totalPrice",
//         },
//     })
//     .lean();

//     if (!updatedAppointment) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Appointment not found." });
//     }
//     
//     let isPackageUser = !!updatedAppointment.packageActivationId;
//     let packageDetails = updatedAppointment.packageActivationId;
//     
//     const responseAppointment = {
//       ...updatedAppointment,
//       status: updatedAppointment.status.toLowerCase(),
//       isPackageUser,
//       packageDetails,
//     };

//     res.status(200).json({
//       success: true,
//       message: `Appointment date/time updated to ${date} at ${time}.`,
//       data: responseAppointment,
//     });
//   } catch (error) {
//     console.error("Error updating appointment details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update appointment details due to a server error.",
//     });
//   }
// };


// // --- NEW CONTROLLER FUNCTION ---

// /**
//  * Get current user's reservations (Client only)
//  * GET /api/appointments/me
//  */
// export const getMyReservations = async (req: AuthenticatedRequest, res: Response) => {
//     try {
//         const userEmail = req.userEmail; // Email is extracted by authenticateToken middleware

//         if (!userEmail) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'User email not found in token',
//             });
//         }

//         console.log(`👤 [getMyReservations] Fetching reservations for: ${userEmail}`);

//         // Find all appointments associated with the user's email
//         const appointments = await AppointmentModel.find({
//             email: userEmail
//         })
//             .sort({ date: -1, time: -1 }) // Sort by date/time descending (most recent first)
//             .lean();

//         // Standardize response format (status to lowercase)
//         const responseAppointments = appointments.map(app => ({
//             ...app,
//             status: app.status.toLowerCase(),
//             // Ensure the isPackageUser field is calculated or included if available on the model
//             isPackageUser: !!app.packageActivationId,
//         }));

//         console.log(`✅ [getMyReservations] Retrieved ${appointments.length} reservations.`);

//         return res.status(200).json({
//             success: true,
//             message: 'Reservations retrieved successfully',
//             data: responseAppointments,
//             count: responseAppointments.length,
//         });
//     } catch (error) {
//         console.error('Error fetching user reservations:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Failed to fetch reservations',
//             error: error instanceof Error ? error.message : 'Unknown error',
//         });
//     }
// };

// export const getPackageAppointmentCounts = async (req: Request, res: Response) => {
//     const { packageId } = req.params;

//     if (!packageId || !mongoose.Types.ObjectId.isValid(packageId)) {
//         return res.status(400).json({
//             success: false,
//             message: "Invalid Package Activation ID.",
//         });
//     }

//     try {
//         console.log(`📊 [getPackageAppointmentCounts] Counting sessions for PackageActivation ID: ${packageId}`);
        
//         // Match appointments to the package ID and group by status
//         const counts = await AppointmentModel.aggregate([
//             {
//                 $match: {
//                     packageActivationId: new mongoose.Types.ObjectId(packageId),
//                 },
//             },
//             {
//                 $group: {
//                     _id: "$status",
//                     count: { $sum: 1 },
//                 },
//             },
//         ]);

//         // Transform results into a simple map { "pending": 3, "completed": 5, "canceled": 1 }
//         const countsMap: Record<string, number> = { 
//             pending: 0, 
//             completed: 0, 
//             cancelled: 0 
//         };
//         counts.forEach(item => {
//             countsMap[item._id.toLowerCase()] = item.count;
//         });

//         console.log(`✅ [getPackageAppointmentCounts] Counts retrieved:`, countsMap);

//         res.status(200).json({
//             success: true,
//             message: "Package appointment counts retrieved successfully.",
//             data: countsMap,
//         });

//     } catch (error) {
//         console.error("❌ Error fetching package appointment counts:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to retrieve package appointment counts due to a server error.",
//         });
//     }
// };


//=====================================================================================================================================================================================================================

// import { Request, Response } from "express";
// import mongoose from "mongoose";
// import AppointmentModel from "../models/appointment.model";
// import CalendarDetailModel from "../models/calendar.detail.model";
// import PackageActivationModel from "../models/package-activation.model";
// import {
//   AppointmentCount,
//   IAppointment,
// } from "../interfaces/appointment.interface";
// import { ICalendarDetail } from "../interfaces/calendar.interface";
// import { generateReservationId } from "../utils/generateReservationId";
// import { AuthenticatedRequest } from '../middlewares/auth.middleware';
// // Import the email utility
// import { sendEmail } from "../utils/send.email";

// const timeToMinutes = (time: string): number => {
//   try {
//     const [hours, minutes] = time.split(":").map(Number);
//     if (isNaN(hours) || isNaN(minutes)) return 0;
//     return hours * 60 + minutes;
//   } catch {
//     return 0;
//   }
// };

// const calculateStaggeredSessions = (
//   openTime: string,
//   closeTime: string,
//   duration: number,
//   buffer: number,
//   numberOfTanks: number,
//   staggerInterval: number
// ): {
//   sessionsPerTank: number;
//   actualCloseTime: string;
//   totalSessions: number;
// } => {
//   const durationNum = Number(duration);
//   const bufferNum = Number(buffer);

//   if (
//     !openTime ||
//     !closeTime ||
//     durationNum <= 0 ||
//     bufferNum < 0 ||
//     numberOfTanks <= 0
//   ) {
//     return { sessionsPerTank: 0, actualCloseTime: "00:00", totalSessions: 0 };
//   }

//   const openMinutes = timeToMinutes(openTime);
//   let closeMinutes = timeToMinutes(closeTime);
//   if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

//   const sessionLength = durationNum + bufferNum;

//   let maxSessionsPerTank = 0;
//   let latestEndTime = openMinutes;

//   for (let tankIndex = 0; tankIndex < numberOfTanks; tankIndex++) {
//     const tankStartMinutes =
//       openMinutes + tankIndex * Number(staggerInterval || 0);
//     const availableTime = closeMinutes - tankStartMinutes;
//     const tankSessions = Math.floor(availableTime / sessionLength);

//     if (tankSessions > 0) {
//       const tankEndTime = tankStartMinutes + tankSessions * sessionLength;
//       latestEndTime = Math.max(latestEndTime, tankEndTime);
//       maxSessionsPerTank = Math.max(maxSessionsPerTank, tankSessions);
//     }
//   }

//   const totalSessions = maxSessionsPerTank * numberOfTanks;

//   return {
//     sessionsPerTank: maxSessionsPerTank || 0,
//     actualCloseTime: "",
//     totalSessions: isNaN(totalSessions) ? 0 : totalSessions,
//   };
// };

// export const createAppointment = async (req: Request, res: Response) => {
//   const {
//     name,
//     date,
//     time,
//     email,
//     contactNumber,
//     specialNote,
//     calendarContext,
//     packageActivationId,
//   } = req.body;

//   console.log("🎫 [createAppointment] Request:", {
//     date,
//     time,
//     email,
//     packageActivationId,
//   });

//   if (!date || !time || !email || !contactNumber || !name || !calendarContext) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "Missing required fields: name, date, time, email, contactNumber, and calendar context are mandatory.",
//     });
//   }

//   const reservationId = await generateReservationId();

//   const newAppointmentData: Partial<IAppointment> = {
//     reservationId,
//     name,
//     date,
//     time,
//     email,
//     contactNumber,
//     specialNote,
//     status: "pending",
//     packageActivationId: packageActivationId || undefined,
//   };

//   const { defaultSystemSettings } = calendarContext;

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     let packageActivation = null;
//     if (packageActivationId) {
//       packageActivation = await PackageActivationModel.findById(
//         packageActivationId
//       ).session(session);

//       if (!packageActivation) throw new Error("Package activation not found.");
//       if (packageActivation.status !== "Confirmed") throw new Error("Package is not confirmed yet.");
//       if (packageActivation.expiryDate && new Date() > packageActivation.expiryDate) throw new Error("This package has expired.");

//       const usedCount = packageActivation.usedCount || 0;
//       const totalSessions = packageActivation.totalSessions || 0;
//       if (totalSessions - usedCount <= 0) throw new Error("No remaining sessions.");

//       packageActivation.usedCount = usedCount + 1;
//       await packageActivation.save({ session });
//     }

//     let finalSessionsToSell: number;
//     let calendarRecord = await CalendarDetailModel.findOne({ date: date }).session(session);

//     if (calendarRecord) {
//       finalSessionsToSell = calendarRecord.sessionsToSell;
//     } else {
//       const settings = defaultSystemSettings;
//       finalSessionsToSell = calculateStaggeredSessions(
//         settings.openTime, settings.closeTime, Number(settings.sessionDuration),
//         settings.cleaningBuffer, settings.numberOfTanks, settings.tankStaggerInterval
//       ).totalSessions;
//     }

//     if (finalSessionsToSell <= 0) throw new Error("Sold Out: No available sessions.");

//     const newSessionsToSell = finalSessionsToSell - 1;
//     const newAppointment = await AppointmentModel.create([newAppointmentData as IAppointment], { session });

//     if (!calendarRecord) {
//       await CalendarDetailModel.create([{
//         date, status: newSessionsToSell > 0 ? "Bookable" : "Sold Out",
//         openTime: defaultSystemSettings.openTime, closeTime: defaultSystemSettings.closeTime,
//         sessionsToSell: newSessionsToSell
//       }], { session });
//     } else {
//       calendarRecord.sessionsToSell = newSessionsToSell;
//       calendarRecord.status = newSessionsToSell > 0 ? "Bookable" : "Sold Out";
//       await calendarRecord.save({ session });
//     }

//     // COMMIT CHANGES
//     await session.commitTransaction();
//     session.endSession();

// // --- UPDATED FRIENDLY EMAIL MESSAGE ---
//     const emailSubject = "Your Session is Scheduled! - Theta Lounge";
//     const emailHtml = `
//       <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
//         <div style="background-color: #2c3e50; padding: 30px; text-align: center;">
//           <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Theta Lounge</h1>
//         </div>

//         <div style="padding: 30px; background-color: #ffffff; line-height: 1.6; color: #444;">
//           <h2 style="color: #2c3e50; font-size: 20px;">Hi ${name},</h2>
//           <p>We’ve successfully received your booking! We are looking forward to seeing you at the lounge for your upcoming session.</p>
          
//           <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 20px; margin: 25px 0; border-radius: 4px;">
//             <p style="margin: 0 0 10px 0;"><strong>Reservation ID:</strong> <span style="color: #3498db;">${reservationId}</span></p>
//             <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${date}</p>
//             <p style="margin: 0 0 10px 0;"><strong>Time:</strong> ${time}</p>
//             <p style="margin: 0;"><strong>Current Status:</strong> Scheduled</p>
//           </div>

//           <p>If you need to make any changes or have specific requests for your visit, please have your Reservation ID ready and get in touch with our team.</p>
          
//           <div style="text-align: center; margin-top: 30px;">
//             <p style="font-style: italic; color: #7f8c8d;">"Relax. Recharge. Re-center."</p>
//           </div>
//         </div>

//         <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
//           <p style="font-size: 12px; color: #95a5a6; margin: 0;">&copy; 2026 Theta Lounge. All rights reserved.</p>
//         </div>
//       </div>
//     `;

//     // Send email without blocking the response
//     sendEmail(email, emailSubject, emailHtml).catch(err => console.error("📧 Email Notification Failed:", err));

//     const responseAppointment = {
//       ...newAppointment[0].toObject(),
//       status: newAppointment[0].status.toLowerCase(),
//       packageUsed: !!packageActivationId,
//     };
    
//     res.status(201).json({
//       success: true,
//       message: "Appointment successfully created. Please check your email for details.",
//       data: responseAppointment,
//     });
//   } catch (error: any) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export const updateAppointmentStatus = async (req: Request, res: Response) => {
//   try {
//     const appointmentId = req.params.id;
//     const { status: uiStatus } = req.body;

//     const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
//       appointmentId,
//       { $set: { status: uiStatus } },
//       { new: true, runValidators: true }
//     );

//     if (!updatedAppointment) {
//       return res.status(404).json({ success: false, message: "Appointment not found." });
//     }

//     res.status(200).json({
//       success: true,
//       message: `Appointment status updated to ${uiStatus}.`,
//       data: updatedAppointment,
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Failed to update status." });
//   }
// };

// export const getAppointmentCounts = async (req: Request, res: Response) => {
//   const { startDate, endDate } = req.query;
//   if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required." });

//   try {
//     const counts: AppointmentCount[] = await AppointmentModel.aggregate([
//       { $match: { date: { $gte: startDate as string, $lte: endDate as string }, status: { $in: ["pending", "completed"] } } },
//       { $group: { _id: { date: "$date", status: "$status" }, count: { $sum: 1 } } },
//     ]);

//     const totalBookedSessionsByDate: Record<string, number> = {};
//     counts.forEach((item) => {
//       const dateKey = item._id.date;
//       totalBookedSessionsByDate[dateKey] = (totalBookedSessionsByDate[dateKey] || 0) + item.count;
//     });

//     const bookedSessionsArray = Object.keys(totalBookedSessionsByDate).map((date) => ({
//       date: date, count: totalBookedSessionsByDate[date],
//     }));

//     res.status(200).json({ success: true, data: bookedSessionsArray });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error fetching counts." });
//   }
// };

// export const getBookedTimesByDate = async (req: Request, res: Response) => {
//   const { date } = req.params;
//   try {
//     const appointments = await AppointmentModel.find({ date: date, status: { $in: ["pending", "completed"] } }).select("time").lean();
//     const bookedTimes = Array.from(new Set(appointments.map((app) => app.time)));
//     res.status(200).json({ success: true, data: bookedTimes });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error fetching times." });
//   }
// };

// export const getAppointmentDetails = async (req: Request, res: Response) => {
//   const { startDate, endDate, page = 1, limit = 20 } = req.query;
//   try {
//     const pageNum = Math.max(1, Number(page));
//     const limitNum = Math.max(1, Number(limit));
//     const skip = (pageNum - 1) * limitNum;
//     const filter: any = {};
//     if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };

//     const appointments = await AppointmentModel.find(filter)
//       .sort({ date: -1, time: -1 }).skip(skip).limit(limitNum)
//       .populate({ path: "packageActivationId", populate: { path: "packageId" } }).lean();

//     const responseAppointments = await Promise.all(appointments.map(async (app: any) => {
//       let isPackageUser = !!app.packageActivationId;
//       let packageDetails = app.packageActivationId;
//       if (!isPackageUser && app.email) {
//         const userPkg = await PackageActivationModel.findOne({ email: app.email, status: "Confirmed" }).populate("packageId").lean();
//         if (userPkg) {
//           isPackageUser = true;
//           packageDetails = { ...userPkg, remainingSessions: (userPkg.totalSessions || 0) - (userPkg.usedCount || 0) };
//         }
//       }
//       return { ...app, status: app.status.toLowerCase(), isPackageUser, packageDetails };
//     }));

//     const totalCount = await AppointmentModel.countDocuments(filter);
//     res.status(200).json({
//       success: true,
//       data: responseAppointments,
//       pagination: { currentPage: pageNum, totalPages: Math.ceil(totalCount / limitNum), totalRecords: totalCount }
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error fetching details." });
//   }
// };

// export const updateAppointmentDetails = async (req: Request, res: Response) => {
//   try {
//     const { date, time } = req.body;
//     const updated = await AppointmentModel.findByIdAndUpdate(req.params.id, { $set: { date, time } }, { new: true }).populate("packageActivationId").lean();
//     if (!updated) return res.status(404).json({ success: false, message: "Not found." });
//     res.status(200).json({ success: true, data: { ...updated, status: updated.status.toLowerCase() } });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error updating details." });
//   }
// };

// export const getMyReservations = async (req: AuthenticatedRequest, res: Response) => {
//   try {
//     const userEmail = req.userEmail;
//     if (!userEmail) return res.status(400).json({ success: false, message: 'Email missing from token' });
//     const appointments = await AppointmentModel.find({ email: userEmail }).sort({ date: -1, time: -1 }).lean();
//     const response = appointments.map(app => ({ ...app, status: app.status.toLowerCase(), isPackageUser: !!app.packageActivationId }));
//     res.status(200).json({ success: true, data: response, count: response.length });
//   } catch (error) {
//     res.status(500).json({ success: false, message: 'Error fetching reservations' });
//   }
// };

// export const getPackageAppointmentCounts = async (req: Request, res: Response) => {
//   const { packageId } = req.params;
//   try {
//     const counts = await AppointmentModel.aggregate([
//       { $match: { packageActivationId: new mongoose.Types.ObjectId(packageId) } },
//       { $group: { _id: "$status", count: { $sum: 1 } } }
//     ]);
//     const countsMap: Record<string, number> = { pending: 0, completed: 0, cancelled: 0 };
//     counts.forEach(item => { countsMap[item._id.toLowerCase()] = item.count; });
//     res.status(200).json({ success: true, data: countsMap });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Error fetching package counts." });
//   }
// };


//=====================================================================================================================================================================================

import { Request, Response } from "express";
import mongoose from "mongoose";
import AppointmentModel from "../models/appointment.model";
import CalendarDetailModel from "../models/calendar.detail.model";
import PackageActivationModel from "../models/package-activation.model";
import UserModel from "../models/user.model";
import {
  AppointmentCount,
  IAppointment,
} from "../interfaces/appointment.interface";
import { ICalendarDetail } from "../interfaces/calendar.interface";
import { generateReservationId } from "../utils/generateReservationId";
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendEmail } from "../utils/send.email";

const timeToMinutes = (time: string): number => {
  try {
    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  } catch {
    return 0;
  }
};

const calculateStaggeredSessions = (
  openTime: string,
  closeTime: string,
  duration: number,
  buffer: number,
  numberOfTanks: number,
  staggerInterval: number
): {
  sessionsPerTank: number;
  actualCloseTime: string;
  totalSessions: number;
} => {
  const durationNum = Number(duration);
  const bufferNum = Number(buffer);

  if (!openTime || !closeTime || durationNum <= 0 || bufferNum < 0 || numberOfTanks <= 0) {
    return { sessionsPerTank: 0, actualCloseTime: "00:00", totalSessions: 0 };
  }

  const openMinutes = timeToMinutes(openTime);
  let closeMinutes = timeToMinutes(closeTime);
  if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

  const sessionLength = durationNum + bufferNum;
  let maxSessionsPerTank = 0;
  let latestEndTime = openMinutes;

  for (let tankIndex = 0; tankIndex < numberOfTanks; tankIndex++) {
    const tankStartMinutes = openMinutes + tankIndex * Number(staggerInterval || 0);
    const availableTime = closeMinutes - tankStartMinutes;
    const tankSessions = Math.floor(availableTime / sessionLength);

    if (tankSessions > 0) {
      const tankEndTime = tankStartMinutes + tankSessions * sessionLength;
      latestEndTime = Math.max(latestEndTime, tankEndTime);
      maxSessionsPerTank = Math.max(maxSessionsPerTank, tankSessions);
    }
  }

  const totalSessions = maxSessionsPerTank * numberOfTanks;
  return {
    sessionsPerTank: maxSessionsPerTank || 0,
    actualCloseTime: "",
    totalSessions: isNaN(totalSessions) ? 0 : totalSessions,
  };
};

export const createAppointment = async (req: Request, res: Response) => {
  const {
    name,
    date,
    time,
    email,
    contactNumber,
    specialNote,
    calendarContext,
    packageActivationId,
  } = req.body;

  if (!date || !time || !email || !contactNumber || !name || !calendarContext) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: name, date, time, email, contactNumber, and calendar context are mandatory.",
    });
  }

  const reservationId = await generateReservationId();
  const newAppointmentData: Partial<IAppointment> = {
    reservationId,
    name,
    date,
    time,
    email,
    contactNumber,
    specialNote,
    status: "pending",
    packageActivationId: packageActivationId || undefined,
  };

  const { defaultSystemSettings } = calendarContext;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (packageActivationId) {
      const packageActivation = await PackageActivationModel.findById(packageActivationId).session(session);
      if (!packageActivation) throw new Error("Package activation not found.");
      if (packageActivation.status !== "Confirmed") throw new Error("Package is not confirmed yet.");
      if (packageActivation.expiryDate && new Date() > packageActivation.expiryDate) throw new Error("This package has expired.");

      const usedCount = packageActivation.usedCount || 0;
      if ((packageActivation.totalSessions || 0) - usedCount <= 0) throw new Error("No remaining sessions.");

      packageActivation.usedCount = usedCount + 1;
      await packageActivation.save({ session });
    }

    let finalSessionsToSell: number;
    let calendarRecord = await CalendarDetailModel.findOne({ date: date }).session(session);

    if (calendarRecord) {
      finalSessionsToSell = calendarRecord.sessionsToSell;
    } else {
      const settings = defaultSystemSettings;
      finalSessionsToSell = calculateStaggeredSessions(
        settings.openTime, settings.closeTime, Number(settings.sessionDuration),
        settings.cleaningBuffer, settings.numberOfTanks, settings.tankStaggerInterval
      ).totalSessions;
    }

    if (finalSessionsToSell <= 0) throw new Error("Sold Out: No available sessions.");

    const newSessionsToSell = finalSessionsToSell - 1;
    const newAppointment = await AppointmentModel.create([newAppointmentData as IAppointment], { session });

    if (!calendarRecord) {
      await CalendarDetailModel.create([{
        date, status: newSessionsToSell > 0 ? "Bookable" : "Sold Out",
        openTime: defaultSystemSettings.openTime, closeTime: defaultSystemSettings.closeTime,
        sessionsToSell: newSessionsToSell
      }], { session });
    } else {
      calendarRecord.sessionsToSell = newSessionsToSell;
      calendarRecord.status = newSessionsToSell > 0 ? "Bookable" : "Sold Out";
      await calendarRecord.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    const clientSubject = "Your Session is Scheduled! - Theta Lounge";
    const clientHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="background-color: #2c3e50; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Theta Lounge</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff; line-height: 1.6; color: #444;">
          <h2 style="color: #2c3e50; font-size: 20px;">Hi ${name},</h2>
          <p>We’ve successfully received your booking! We are looking forward to seeing you at the lounge for your upcoming session.</p>
          <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px 0;"><strong>Reservation ID:</strong> <span style="color: #3498db;">${reservationId}</span></p>
            <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 0 0 10px 0;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 0;"><strong>Status:</strong> Scheduled</p>
          </div>
          <p>If you need to make any changes, please have your Reservation ID ready and contact us.</p>
          <div style="text-align: center; margin-top: 30px;">
            <p style="font-style: italic; color: #7f8c8d;">"Relax. Recharge. Re-center."</p>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #95a5a6; margin: 0;">&copy; 2026 Theta Lounge. All rights reserved.</p>
        </div>
      </div>
    `;

    sendEmail(email, clientSubject, clientHtml).catch(err => console.error("Client Email Failed:", err));

    const notifyAdmins = async () => {
      try {
        const admins = await UserModel.find({ role: "admin" }).select("email");
        const adminEmails = admins.map(admin => admin.email);

        if (adminEmails.length > 0) {
          const adminSubject = `🚨 New Booking Alert: ${name}`;
          const adminHtml = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
              <h2 style="color: #d35400;">New Appointment Notification</h2>
              <p>A new appointment has been scheduled via the platform.</p>
              <hr />
              <p><strong>Customer:</strong> ${name}</p>
              <p><strong>Date/Time:</strong> ${date} at ${time}</p>
              <p><strong>Contact:</strong> ${contactNumber}</p>
              <p><strong>Reservation ID:</strong> ${reservationId}</p>
              <p><strong>Note:</strong> ${specialNote || "No special notes provided."}</p>
              <hr />
              <p>Log in to the Admin Dashboard to manage this session.</p>
            </div>
          `;
          await sendEmail(adminEmails.join(","), adminSubject, adminHtml);
        }
      } catch (err) {
        console.error("Failed to notify admins:", err);
      }
    };
    notifyAdmins();

    res.status(201).json({
      success: true,
      message: "Appointment successfully created. Confirmation email sent.",
      data: { ...newAppointment[0].toObject(), status: "pending" },
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;
    const { status: uiStatus } = req.body;

    const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
      appointmentId,
      { $set: { status: uiStatus } },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedAppointment) {
      return res.status(404).json({ success: false, message: "Appointment not found." });
    }

    const { email, name, date, time, reservationId } = updatedAppointment;
    const statusLower = uiStatus.toLowerCase();

    let emailSubject = "";
    let emailHtml = "";

    if (statusLower === "completed") {
      emailSubject = "Thank you for visiting Theta Lounge!";
      emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #27ae60; padding: 20px; text-align: center; color: white;">
            <h2>Session Completed</h2>
          </div>
          <div style="padding: 30px; color: #444;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for visiting <strong>Theta Lounge</strong> today! We hope you had a relaxing and rejuvenating experience.</p>
            <p>Your session on <strong>${date}</strong> is now marked as completed in our system.</p>
            <p>We would love to see you again soon! You can book your next session anytime through our website.</p>
            <br />
            <p>Best regards,<br/>The Theta Lounge Team</p>
          </div>
        </div>
      `;
    } else if (statusLower === "cancelled") {
      emailSubject = "Update regarding your appointment - Theta Lounge";
      emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #e74c3c; padding: 20px; text-align: center; color: white;">
            <h2>Appointment Cancelled</h2>
          </div>
          <div style="padding: 30px; color: #444;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>This email is to inform you that your appointment (ID: ${reservationId}) scheduled for <strong>${date}</strong> at <strong>${time}</strong> has been <strong>cancelled</strong>.</p>
            <p>If you did not request this cancellation or have questions, please contact our support team immediately.</p>
            <p>We hope to serve you another time.</p>
            <br />
            <p>Best regards,<br/>The Theta Lounge Team</p>
          </div>
        </div>
      `;
    }

    if (emailHtml) {
      sendEmail(email, emailSubject, emailHtml).catch((err) =>
        console.error(`Status Email Failed (${statusLower}):`, err)
      );
    }

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${uiStatus}.`,
      data: { ...updatedAppointment, status: statusLower },
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

export const getAppointmentCounts = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required." });
  try {
    const counts: AppointmentCount[] = await AppointmentModel.aggregate([
      { $match: { date: { $gte: startDate as string, $lte: endDate as string }, status: { $in: ["pending", "completed"] } } },
      { $group: { _id: { date: "$date", status: "$status" }, count: { $sum: 1 } } },
    ]);
    const totalBookedSessionsByDate: Record<string, number> = {};
    counts.forEach((item) => {
      const dateKey = item._id.date;
      totalBookedSessionsByDate[dateKey] = (totalBookedSessionsByDate[dateKey] || 0) + item.count;
    });
    const bookedSessionsArray = Object.keys(totalBookedSessionsByDate).map((date) => ({ date, count: totalBookedSessionsByDate[date] }));
    res.status(200).json({ success: true, data: bookedSessionsArray });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching counts." });
  }
};

export const getBookedTimesByDate = async (req: Request, res: Response) => {
  try {
    const appointments = await AppointmentModel.find({ date: req.params.date, status: { $in: ["pending", "completed"] } }).select("time").lean();
    const bookedTimes = Array.from(new Set(appointments.map((app) => app.time)));
    res.status(200).json({ success: true, data: bookedTimes });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching times." });
  }
};

export const getAppointmentDetails = async (req: Request, res: Response) => {
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const filter: any = {};
    if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };
    const appointments = await AppointmentModel.find(filter).sort({ date: -1, time: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).populate({ path: "packageActivationId", populate: { path: "packageId" } }).lean();
    
    const responseAppointments = await Promise.all(appointments.map(async (app: any) => {
      let isPackageUser = !!app.packageActivationId;
      let packageDetails = app.packageActivationId;
      if (!isPackageUser && app.email) {
        const userPkg = await PackageActivationModel.findOne({ email: app.email, status: "Confirmed" }).populate("packageId").lean();
        if (userPkg) { isPackageUser = true; packageDetails = { ...userPkg, remainingSessions: (userPkg.totalSessions || 0) - (userPkg.usedCount || 0) }; }
      }
      return { ...app, status: app.status.toLowerCase(), isPackageUser, packageDetails };
    }));

    const totalCount = await AppointmentModel.countDocuments(filter);
    res.status(200).json({ success: true, data: responseAppointments, pagination: { currentPage: pageNum, totalPages: Math.ceil(totalCount / limitNum), totalRecords: totalCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching details." });
  }
};

export const updateAppointmentDetails = async (req: Request, res: Response) => {
  try {
    const updated = await AppointmentModel.findByIdAndUpdate(req.params.id, { $set: { date: req.body.date, time: req.body.time } }, { new: true }).populate("packageActivationId").lean();
    if (!updated) return res.status(404).json({ success: false, message: "Not found." });
    res.status(200).json({ success: true, data: { ...updated, status: updated.status.toLowerCase() } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating details." });
  }
};

export const getMyReservations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userEmail = req.userEmail;
    if (!userEmail) return res.status(400).json({ success: false, message: 'Email missing' });
    const appointments = await AppointmentModel.find({ email: userEmail }).sort({ date: -1, time: -1 }).lean();
    const response = appointments.map(app => ({ ...app, status: app.status.toLowerCase(), isPackageUser: !!app.packageActivationId }));
    res.status(200).json({ success: true, data: response, count: response.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

export const getPackageAppointmentCounts = async (req: Request, res: Response) => {
  try {
    const counts = await AppointmentModel.aggregate([{ $match: { packageActivationId: new mongoose.Types.ObjectId(req.params.packageId) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
    const countsMap: Record<string, number> = { pending: 0, completed: 0, cancelled: 0 };
    counts.forEach(item => { countsMap[item._id.toLowerCase()] = item.count; });
    res.status(200).json({ success: true, data: countsMap });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error" });
  }
};