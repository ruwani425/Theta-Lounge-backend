import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes"
import tankRoutes from "./routes/tank.routes"

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/system-settings", adminRoutes);
app.use("/api/tanks", tankRoutes);
app.use(
  cors({
    origin: "http://localhost:5000",
    credentials: true,
  })
);


export default app;
