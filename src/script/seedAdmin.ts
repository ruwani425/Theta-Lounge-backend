import mongoose from "mongoose";
import userModel from "../models/user.model";
import bcrypt from "bcryptjs";

const seedAdmin = async () => {
  try {
    const userCount = await userModel.countDocuments({});
    
    if (userCount === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        const admin = new userModel({
        name: "savinda",
        email: "thantrige32@gmail.com",
        password: hashedPassword,
        role: "admin",
        firebaseUid: "admin-seeder-1",
        });


      await admin.save();
      console.log("Admin user created:", admin.email);
    } else {
      console.log("Users already exist. Admin not created.");
    }
  } catch (err) {
    console.error("Error creating admin:", err);
  }
};

export default seedAdmin;
