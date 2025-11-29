import { Router } from "express";
import { saveSystemSettings, getSystemSettings, updateSystemSettings } from "../controllers/settings.controller";

const router = Router();

router.post("/", saveSystemSettings);
router.get("/", getSystemSettings);
router.put("/:id", updateSystemSettings);

export default router;
