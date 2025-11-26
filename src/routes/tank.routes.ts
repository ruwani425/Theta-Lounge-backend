import express from "express";
import { addTank, getAllTanks, getLastTank } from "../controllers/tank.controller";

const router = express.Router();

router.post("/", addTank);
router.get("/last", getLastTank);
router.get("/", getAllTanks);

export default router;
