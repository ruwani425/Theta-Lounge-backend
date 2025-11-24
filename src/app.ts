import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

app.use(
  cors({
    origin: "http://localhost:5000",
    credentials: true,
  })
);


export default app;
