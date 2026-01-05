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

router.post("/", authenticateToken, createPackageActivation);

router.get("/user/active", authenticateToken, getUserActivePackages);

router.get("/", authenticateToken, requireAdmin, getAllPackageActivations);

router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  updatePackageActivationStatus
);

export default router;
