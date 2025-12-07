// src/routes/package-activation.routes.ts

import { Router } from "express";
import {
  createPackageActivation,
  getAllPackageActivations,
  updatePackageActivationStatus,
  getUserActivePackages,
} from "../controllers/package-activation.controller";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/auth.middleware";

const router: Router = Router();

// Optional auth route - allows both logged in and guest users
// POST /api/package-activations
router.post("/", authenticateToken, createPackageActivation);

// Protected route for Users to get their active packages
// GET /api/package-activations/user/active
router.get("/user/active", authenticateToken, getUserActivePackages);

// Protected route for Admins to view all activation requests
// GET /api/package-activations
router.get("/", authenticateToken, requireAdmin, getAllPackageActivations);

// Protected route for Admins to update activation status
// PATCH /api/package-activations/:id/status
router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  updatePackageActivationStatus
);

export default router;
