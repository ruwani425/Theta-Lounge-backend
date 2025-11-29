import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
import seedAdmin from "./script/seedAdmin";
import bcrypt from "bcryptjs";
import userModel from "./models/user.model";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URL!)
  .then(async () => {
    console.log("MongoDB Connected");

    await seedAdmin();

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.log("DB Error: ", err));
