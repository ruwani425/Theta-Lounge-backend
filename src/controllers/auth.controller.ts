import { Request, Response } from "express";
import User from "../models/user.model";
import { generateToken } from "../utils/jwt";

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { name, email, profileImage, uid } = req.body;

    if (!email || !uid) {
      return res.status(400).json({ message: "Invalid Google data" });
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = await User.create({
        name,
        email,
        profileImage,
        firebaseUid: uid,
      });
    }

    // Create JWT
    const token = generateToken(user._id.toString());

    return res.status(200).json({
      message: "Success",
      token,
      user,
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
