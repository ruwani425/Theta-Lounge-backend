import { Router } from "express";
import { googleAuth } from "../controllers/auth.controller";

const router = Router();

// POST /google-auth
router.post("/google-auth", googleAuth);

export default router;
