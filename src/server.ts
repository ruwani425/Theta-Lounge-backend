// server.ts

import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
import seedAdmin from "./script/seedAdmin";
import { startExpirationCronJob } from "./controllers/package-activation.controller";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URL!)
  .then(async () => {
    console.log("MongoDB Connected");
    await seedAdmin();
    startExpirationCronJob();
  })
  .catch((err) => console.log("DB Error: ", err));
module.exports = app

// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import app from "./app";
// import seedAdmin from "./script/seedAdmin";
// import { startExpirationCronJob } from "./controllers/package-activation.controller";

// dotenv.config();

// const PORT = process.env.PORT || 5000;

// // Prevent multiple connection attempts
// if (mongoose.connection.readyState === 0) {
//   mongoose
//     .connect(process.env.MONGO_URL!)
//     .then(async () => {
//       console.log("✅ MongoDB Connected");

//       // Run these only once upon successful connection
//       await seedAdmin();
//       startExpirationCronJob();

//       // --- RUN LOCALLY ---
//       // We check if it's not production AND ensure we don't start multiple listeners
//      // --- RUN LOCALLY ---
//       if (process.env.NODE_ENV !== "production") {
//         // Use (global as any) to bypass the index signature error
//         if (!(global as any).serverStarted) {
//           app.listen(PORT, () => {
//             console.log(`🚀 Server is running on http://localhost:${PORT}`);
//           });
//           (global as any).serverStarted = true;
//         }
//       }
//     })
//     .catch((err) => console.log("❌ DB Error: ", err));
// }

// // Keep this for Vercel
// export default app;