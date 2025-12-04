import { Router } from "express"
import { createPackage, updatePackage, getAllPackages, getActivePackages } from "../controllers/package.controller"

const router: Router = Router()

// Route for Client/Public Pages (Only Active packages)
// GET /api/packages/active?page=1&limit=4&duration=12-Month
router.get("/active", getActivePackages)

// Route for Admin Dashboard (All packages)
// GET /api/packages/all?page=1&limit=4&duration=12-Month
router.get("/all", getAllPackages)

// Route to create a new package
router.post("/", createPackage)

// Route to update a package by ID
router.put("/:id", updatePackage)

export default router
