import { Router } from "express";
import { saveSystemSettings, getSystemSettings } from "../controllers/settings.controller";

const router = Router();

router.post("/", saveSystemSettings);
router.get("/", getSystemSettings);

export default router;
