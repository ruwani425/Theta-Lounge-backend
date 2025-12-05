// src/routes/package-activation.routes.ts

import { Router } from "express"
import { createPackageActivation, getAllPackageActivations } from "../controllers/package-activation.controller"
import { authenticateToken } from "../middlewares/auth.middleware"

const router: Router = Router()

// Public route to submit a new package activation request from the client form
// POST /api/package-activations
router.post("/", createPackageActivation)

// Protected route for Admins to view all activation requests
// GET /api/package-activations
router.get("/", authenticateToken, getAllPackageActivations)

export default router