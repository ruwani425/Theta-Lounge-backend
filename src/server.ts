import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
import bcrypt from "bcryptjs";
import userModel from "./models/user.model";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URL!)
  .then(async () => {
    console.log("MongoDB Connected");

    const userCount = await userModel.countDocuments();
    if (userCount === 0) {
      const adminPassword = "admin123";
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      const admin = new userModel({
        name: "ruwani",
        email: "ruwaniranthika2001@gmail.com",
        password: hashedPassword,
        role: "admin",
      });

      await admin.save();
      console.log("Admin user created:", admin.email);
    }

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.log("DB Error: ", err));
