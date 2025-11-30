import express from "express";
import { addTank, deleteTank, getAllTanks, getLastTank, getTankById, updateTank, updateTankStatus } from "../controllers/tank.controller";

const router = express.Router();

router.post("/", addTank);
router.get("/last", getLastTank);
router.get("/", getAllTanks);

// FIX: Removed the conflicting updateTankStatus route.
// The updateTank controller handles all PATCH requests to /:id,
// including status changes and full form updates, as it uses req.body.
router.patch("/:id", updateTank);

router.delete("/:id", deleteTank);
router.get("/:id", getTankById);

export default router;