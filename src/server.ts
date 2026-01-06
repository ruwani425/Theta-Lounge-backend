
import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
import seedAdmin from "./script/seedAdmin";
import { startExpirationCronJob } from "./controllers/package-activation.controller";

dotenv.config();

const PORT = process.env.PORT || 5000;

if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(process.env.MONGO_URL!)
    .then(async () => {
      console.log("MongoDB Connected");

      await seedAdmin();
      startExpirationCronJob();

      if (process.env.NODE_ENV !== "production") {
        if (!(global as any).serverStarted) {
          app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
          });
          (global as any).serverStarted = true;
        }
      }
    })
    .catch((err) => console.log("DB Error: ", err));
}

export default app;