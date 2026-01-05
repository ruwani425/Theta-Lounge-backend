// src/routes/package.routes.ts

import { Router } from "express"
import { createPackage, updatePackage, getAllPackages, getActivePackages, getPackageById } from "../controllers/package.controller"
import { authenticateToken } from "../middlewares/auth.middleware"

const router: Router = Router()


router.get("/active", getActivePackages)


router.get("/all", getAllPackages) 


router.get("/:id", getPackageById) 

router.post("/", createPackage)

router.put("/:id", updatePackage)

export default router