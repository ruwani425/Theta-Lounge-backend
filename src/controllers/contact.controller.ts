import { Request, Response } from 'express';
import { sendEmail } from '../utils/send.email';
import UserModel from '../models/user.model';

export const handleContactForm = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, service, message } = req.body;

    const clientSubject = "We've received your message - Theta Lounge";
    const clientHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #3a7ca5; padding: 20px; text-align: center; color: white;">
          <h2>Hello ${name}!</h2>
        </div>
        <div style="padding: 30px; color: #444;">
          <p>Thank you for reaching out to <strong>Theta Lounge</strong>.</p>
          <p>We have received your message regarding <strong>${service || 'General Inquiry'}</strong> and our team will get back to you within 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">This is an automated confirmation. No need to reply to this email.</p>
        </div>
      </div>
    `;

    sendEmail(email, clientSubject, clientHtml).catch(err => console.error("📧 Client Contact Email Failed:", err));

    const admins = await UserModel.find({ role: 'admin' }).select('email');
    const adminEmails = admins.map(admin => admin.email);

    if (adminEmails.length > 0) {
      const adminSubject = `📢 New Inquiry from ${name}`;
      const adminHtml = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #1B4965;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Message:</strong></p>
          <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #3a7ca5;">${message}</div>
        </div>
      `;
      
      await sendEmail(adminEmails.join(','), adminSubject, adminHtml);
    }

    res.status(200).json({ success: true, message: "Inquiry received successfully" });
  } catch (error) {
    console.error("Contact Form Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};