import express from "express";
import { addTank, deleteTank, getAllTanks, getLastTank, getTankById, updateTank, updateTankStatus } from "../controllers/tank.controller";

const router = express.Router();

router.post("/", addTank);
router.get("/last", getLastTank);
router.get("/", getAllTanks);
router.patch("/:id", updateTank);
router.delete("/:id", deleteTank);
router.get("/:id", getTankById);

export default router;