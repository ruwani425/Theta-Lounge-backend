import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import tankRoutes from "./routes/tank.routes";
import calendarRoutes from "./routes/calendar.routes";
import appointmentRoutes from "./routes/appointment.routes";
import packageRoutes from "./routes/package.routes";
import packageActivationRoutes from "./routes/package-activation.routes";
import userRoutes from "./routes/user.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportsRoutes from "./routes/reports.routes";
import blogRoutes from "./routes/blog.routes";
import emailRoutes from "./routes/email.routes";
import contactRoutes from "./routes/contact.routes";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://theta-lounge-frontend.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true); 
      } else {
        console.error(`CORS blocked for origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200 
  })
);

app.use(express.json());
app.get("/", (req, res) => {
  res.json({ message: "Express running on Vercel 🚀" });
});
app.use("/api/auth", authRoutes);
app.use("/api/system-settings", adminRoutes);
app.use("/api/tanks", tankRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/package-activations", packageActivationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/blogs", blogRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/contact', contactRoutes);

export default app;
