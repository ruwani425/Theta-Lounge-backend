import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import tankRoutes from "./routes/tank.routes";
import calendarRoutes from "./routes/calendar.routes"
import appointmentRoutes from "./routes/appointment.routes"
import packageRoutes from "./routes/package.routes"

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/system-settings", adminRoutes);
app.use("/api/tanks", tankRoutes);
app.use("/api/calendar", calendarRoutes)
app.use("/api/appointments", appointmentRoutes)
app.use("/api/packages", packageRoutes)

export default app;
