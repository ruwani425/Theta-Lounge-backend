// server.ts

import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
import seedAdmin from "./script/seedAdmin";
// 🆕 1. Import the cron job starting function
import { startExpirationCronJob } from "./controllers/package-activation.controller";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URL!)
  .then(async () => {
    console.log("MongoDB Connected");

    await seedAdmin();

    startExpirationCronJob();

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.log("DB Error: ", err));
