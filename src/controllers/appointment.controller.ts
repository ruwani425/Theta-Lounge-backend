// src/controllers/appointment.controller.ts

import { Request, Response } from "express";
import mongoose from "mongoose";
import AppointmentModel from "../models/appointment.model";
import CalendarDetailModel from "../models/calendar.detail.model";
import PackageActivationModel from "../models/package-activation.model";
import {
  AppointmentCount,
  IAppointment,
} from "../interfaces/appointment.interface";
import { ICalendarDetail } from "../interfaces/calendar.interface";

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

  if (
    !openTime ||
    !closeTime ||
    durationNum <= 0 ||
    bufferNum < 0 ||
    numberOfTanks <= 0
  ) {
    return { sessionsPerTank: 0, actualCloseTime: "00:00", totalSessions: 0 };
  }

  const openMinutes = timeToMinutes(openTime);
  let closeMinutes = timeToMinutes(closeTime);
  if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

  const sessionLength = durationNum + bufferNum;

  let maxSessionsPerTank = 0;
  let latestEndTime = openMinutes;

  for (let tankIndex = 0; tankIndex < numberOfTanks; tankIndex++) {
    const tankStartMinutes =
      openMinutes + tankIndex * Number(staggerInterval || 0);
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
    packageActivationId, // Optional: ID of package activation to use
  } = req.body;

  console.log("🎫 [createAppointment] Request:", {
    date,
    time,
    email,
    packageActivationId,
  });

  if (!date || !time || !email || !contactNumber || !name || !calendarContext) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: name, date, time, email, contactNumber, and calendar context are mandatory.",
    });
  }

  const newAppointmentData: Partial<IAppointment> = {
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
    // If package activation ID is provided, verify and decrement session
    let packageActivation = null;
    if (packageActivationId) {
      console.log(
        "📦 [createAppointment] Checking package activation:",
        packageActivationId
      );

      packageActivation = await PackageActivationModel.findById(
        packageActivationId
      ).session(session);

      if (!packageActivation) {
        throw new Error("Package activation not found.");
      }

      if (packageActivation.status !== "Confirmed") {
        throw new Error(
          "Package is not confirmed yet. Please wait for admin confirmation."
        );
      }

      // Check if package is expired
      if (
        packageActivation.expiryDate &&
        new Date() > packageActivation.expiryDate
      ) {
        throw new Error("This package has expired.");
      }

      // Check remaining sessions
      const usedCount = packageActivation.usedCount || 0;
      const totalSessions = packageActivation.totalSessions || 0;
      const remainingSessions = totalSessions - usedCount;

      console.log("📊 [createAppointment] Package sessions:", {
        total: totalSessions,
        used: usedCount,
        remaining: remainingSessions,
      });

      if (remainingSessions <= 0) {
        throw new Error("No remaining sessions in this package.");
      }

      // Increment used count
      packageActivation.usedCount = usedCount + 1;
      await packageActivation.save({ session });

      console.log(
        "✅ [createAppointment] Package session decremented. New used count:",
        packageActivation.usedCount
      );
    }

    let finalSessionsToSell: number;
    let calendarRecord: (ICalendarDetail & mongoose.Document) | null = null;
    let isNewCalendarRecord = false;

    calendarRecord = await CalendarDetailModel.findOne({ date: date }).session(
      session
    );

    if (calendarRecord) {
      finalSessionsToSell = calendarRecord.sessionsToSell;
    } else {
      isNewCalendarRecord = true;
      const settings = defaultSystemSettings;

      const totalSessions = calculateStaggeredSessions(
        settings.openTime,
        settings.closeTime,
        Number(settings.sessionDuration),
        settings.cleaningBuffer,
        settings.numberOfTanks,
        settings.tankStaggerInterval
      ).totalSessions;

      finalSessionsToSell = totalSessions;
    }

    if (finalSessionsToSell <= 0) {
      throw new Error("Sold Out: No available sessions for this date.");
    }

    const newSessionsToSell = finalSessionsToSell - 1;

    const newAppointment = await AppointmentModel.create(
      [newAppointmentData as IAppointment],
      { session }
    );

    if (isNewCalendarRecord) {
      const newCalendarData: Partial<ICalendarDetail> = {
        date: date,
        status: newSessionsToSell > 0 ? "Bookable" : "Sold Out",
        openTime: defaultSystemSettings.openTime,
        closeTime: defaultSystemSettings.closeTime,
        sessionsToSell: newSessionsToSell,
      };
      await CalendarDetailModel.create([newCalendarData as ICalendarDetail], {
        session,
      });
    } else {
      if (calendarRecord) {
        calendarRecord.sessionsToSell = newSessionsToSell;
        calendarRecord.status = newSessionsToSell > 0 ? "Bookable" : "Sold Out";
        await calendarRecord.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log("✅ [createAppointment] Appointment created successfully");

    const responseAppointment = {
      ...newAppointment[0].toObject(),
      status: newAppointment[0].status.toLowerCase(),
      packageUsed: !!packageActivationId,
    };

    res.status(201).json({
      success: true,
      message: packageActivationId
        ? "Appointment successfully created using your package session."
        : "Appointment successfully created and calendar updated.",
      data: responseAppointment,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ [createAppointment] Error:", error);

    let errorMessage = "Failed to create appointment due to a server error.";
    if (error.message.includes("Sold Out")) {
      errorMessage = error.message;
    } else if (
      error.message.includes("package") ||
      error.message.includes("Package") ||
      error.message.includes("session")
    ) {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
    });
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
    );

    if (!updatedAppointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found." });
    }

    const responseAppointment = {
      ...updatedAppointment.toObject(),
      status: updatedAppointment.status.toLowerCase(),
    };

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${uiStatus}.`,
      data: responseAppointment,
    });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment status.",
    });
  }
};

// src/controllers/appointment.controller.ts

// ... (existing imports and other controller logic)

/**
 * Retrieves appointment counts aggregated by date and status for a given range.
 * GET /api/appointments/counts
 */
export const getAppointmentCounts = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: "Missing required query parameters: startDate and endDate.",
    });
  }

  try {
    const counts: AppointmentCount[] = await AppointmentModel.aggregate([
      {
        $match: {
          date: { $gte: startDate as string, $lte: endDate as string },
          // FIX: Include 'pending' AND 'completed' appointments to calculate total booked sessions (excluding 'canceled').
          status: { $in: ["pending", "completed"] },
        },
      },
      {
        $group: {
          _id: { date: "$date", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalBookedSessionsByDate: Record<string, number> = {};

    counts.forEach((item) => {
      const dateKey = item._id.date;
      totalBookedSessionsByDate[dateKey] =
        (totalBookedSessionsByDate[dateKey] || 0) + item.count;
    });

    const bookedSessionsArray = Object.keys(totalBookedSessionsByDate).map(
      (date) => ({
        date: date,
        count: totalBookedSessionsByDate[date],
      })
    );

    res.status(200).json({
      success: true,
      message: "Appointment counts retrieved successfully.",
      data: bookedSessionsArray, // This now contains booked (non-canceled) sessions per date
    });
  } catch (error) {
    console.error("Error fetching appointment counts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve appointment counts due to a server error.",
    });
  }
};

// export const getAppointmentDetails = async (req: Request, res: Response) => {
//     const { startDate, endDate } = req.query;

//     try {
//         const filter: any = {};

//         if (startDate && endDate) {
//             filter.date = { $gte: startDate as string, $lte: endDate as string };
//         }

//         const appointments = await AppointmentModel.find(filter).lean();

//         const responseAppointments = appointments.map(app => ({
//             ...app,
//             status: app.status.toLowerCase(),
//         }));

//         res.status(200).json({
//             success: true,
//             message: 'Appointment details retrieved successfully.',
//             data: responseAppointments,
//         });
//     } catch (error) {
//         console.error('Error fetching appointment details:', error);
//         res.status(500).json({ success: false, message: 'Failed to retrieve appointment details due to a server error.' });
//     }
// };

/**
 * Retrieves all booked times for a specific date.
 * GET /api/appointments/booked-times/:date
 * Returns array of booked times (HH:MM format) for that date
 */
export const getBookedTimesByDate = async (req: Request, res: Response) => {
  const { date } = req.params;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameter: date.",
    });
  }

  try {
    // Fetch all pending and completed appointments for the specific date
    const appointments = await AppointmentModel.find({
      date: date,
      status: { $in: ["pending", "completed"] },
    })
      .select("time")
      .lean();

    // Extract and deduplicate booked times
    const bookedTimes = Array.from(
      new Set(appointments.map((app) => app.time))
    );

    console.log(`[v0] Booked times for ${date}:`, bookedTimes);

    res.status(200).json({
      success: true,
      message: "Booked times retrieved successfully.",
      data: bookedTimes,
    });
  } catch (error) {
    console.error("Error fetching booked times:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve booked times due to a server error.",
    });
  }
};

export const getAppointmentDetails = async (req: Request, res: Response) => {
  const { startDate, endDate, page = 1, limit = 20 } = req.query;

  try {
    console.log(
      "📋 [getAppointmentDetails] Fetching appointments with package info"
    );

    const pageNum = Math.max(1, Number.parseInt(page as string) || 1);
    const limitNum = Math.max(1, Number.parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};

    if (startDate && endDate) {
      filter.date = { $gte: startDate as string, $lte: endDate as string };
    }

    const appointments = await AppointmentModel.find(filter)
      .sort({ date: -1, time: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: "packageActivationId",
        select:
          "packageName totalSessions usedCount remainingSessions startDate expiryDate status packageId",
        populate: {
          path: "packageId",
          select: "name duration sessions totalPrice",
        },
      })
      .lean();

    const totalCount = await AppointmentModel.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // For each appointment, check if the user (by email) has any confirmed packages
    const responseAppointments = await Promise.all(
      appointments.map(async (app: any) => {
        let isPackageUser = false;
        let packageDetails = null;

        // First check if this specific appointment used a package
        if (app.packageActivationId) {
          console.log(
            `✅ [getAppointmentDetails] Appointment ${app._id} used packageActivationId`
          );
          isPackageUser = true;
          packageDetails = app.packageActivationId;
        } else if (app.email) {
          // If no packageActivationId, check if user has any confirmed packages by email
          const userPackage = await PackageActivationModel.findOne({
            email: app.email,
            status: "Confirmed",
          })
            .populate({
              path: "packageId",
              select: "name duration sessions totalPrice",
            })
            .lean();

          if (userPackage) {
            console.log(
              `📧 [getAppointmentDetails] Found package for email: ${app.email}`
            );
            isPackageUser = true;
            // Calculate remaining sessions
            const totalSessions = userPackage.totalSessions || 0;
            const usedCount = userPackage.usedCount || 0;
            packageDetails = {
              ...userPackage,
              remainingSessions: Math.max(0, totalSessions - usedCount),
            };
          } else {
            console.log(
              `👤 [getAppointmentDetails] Normal user (no package): ${app.email}`
            );
          }
        }

        return {
          ...app,
          status: app.status.toLowerCase(),
          isPackageUser,
          packageDetails,
        };
      })
    );

    const packageUsersCount = responseAppointments.filter(
      (app) => app.isPackageUser
    ).length;
    const normalUsersCount = responseAppointments.length - packageUsersCount;

    console.log(
      `📊 [getAppointmentDetails] Summary: ${packageUsersCount} package users, ${normalUsersCount} normal users`
    );

    res.status(200).json({
      success: true,
      message: "Appointment details retrieved successfully.",
      data: responseAppointments,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords: totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching appointment details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve appointment details due to a server error.",
    });
  }
};
