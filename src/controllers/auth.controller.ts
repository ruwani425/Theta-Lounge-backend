import { Request, Response } from "express";
import User from "../models/user.model";
import { generateToken } from "../utils/jwt";
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { name, email, profileImage, uid } = req.body;

    if (!email || !uid) {
      return res.status(400).json({ message: "Invalid Google data" });
    }

    let user = await User.findOne({ email }).select('+role +permissions'); 

    if (!user) {
      const isAdmin = email.includes("admin");
      user = await User.create({
        name,
        email,
        profileImage,
        firebaseUid: uid,
        role: isAdmin ? "admin" : "client",
        permissions: isAdmin ? [
          'reservations',
          'tanks',
          'users',
          'packages',
          'activations',
          'reports',
          'content',
          'access_control',
          'settings'
        ] : [],
      });
    }

    const token = generateToken(user._id.toString(), user.email, user.role);

    const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        permissions: user.role === 'admin' ? (user.permissions || []) : undefined,
    };

    console.log('User authenticated:', {
      email: user.email,
      role: user.role,
      permissions: userResponse.permissions
    });

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};