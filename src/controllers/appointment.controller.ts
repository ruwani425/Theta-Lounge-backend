
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

    const clientSubject = "Your Session is Scheduled! - Floating Theraphy";
    const clientHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="background-color: #2c3e50; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Floating Theraphy</h1>
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
          <p style="font-size: 12px; color: #95a5a6; margin: 0;">&copy; 2026 Floating Theraphy. All rights reserved.</p>
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
      emailSubject = "Thank you for visiting Floating Theraphy!";
      emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #27ae60; padding: 20px; text-align: center; color: white;">
            <h2>Session Completed</h2>
          </div>
          <div style="padding: 30px; color: #444;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for visiting <strong>Floating Theraphy</strong> today! We hope you had a relaxing and rejuvenating experience.</p>
            <p>Your session on <strong>${date}</strong> is now marked as completed in our system.</p>
            <p>We would love to see you again soon! You can book your next session anytime through our website.</p>
            <br />
            <p>Best regards,<br/>The Floating Theraphy Team</p>
          </div>
        </div>
      `;
    } else if (statusLower === "cancelled") {
      emailSubject = "Update regarding your appointment - Floating Theraphy";
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
            <p>Best regards,<br/>The Floating Theraphy Team</p>
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