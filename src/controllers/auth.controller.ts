import { Request, Response } from "express";
import User from "../models/user.model";
import { generateToken } from "../utils/jwt";

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { name, email, profileImage, uid } = req.body;

    if (!email || !uid) {
      return res.status(400).json({ message: "Invalid Google data" });
    }

    // 1️⃣ FIND USER BY EMAIL
    let user = await User.findOne({ email });

    // 2️⃣ IF NOT FOUND → CREATE USER
    if (!user) {
      user = await User.create({
        name,
        email,
        profileImage,
        firebaseUid: uid,
        role: email.includes("admin") ? "admin" : "client",
      });
    }

    // 3️⃣ CREATE TOKEN
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
