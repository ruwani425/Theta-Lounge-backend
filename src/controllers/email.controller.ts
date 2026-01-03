import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export const sendNotification = async (req: Request, res: Response) => {
  const { to, subject, message } = req.body;

 const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true, // Show debug output
    logger: true  // Log information to console
  });

  try {
    await transporter.sendMail({
      from: `"Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `<div style="font-family: Arial;">${message}</div>`,
    });
    res.status(200).json({ success: true, message: "Email sent" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};