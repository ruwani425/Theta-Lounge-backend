import { Request, Response } from "express";
import { Tank } from "../models/tank.model";

// POST /tanks
export const addTank = async (req: Request, res: Response) => {
  try {
    const { name, capacity, length, width, sessionDuration, basePrice, benefits } = req.body;

    const newTank = new Tank({
      name,
      capacity,
      length,
      width,
      sessionDuration,
      basePrice,
      benefits,
    });

    await newTank.save();

    res.status(201).json({ message: "Tank added successfully", tank: newTank });
  } catch (error) {
    console.error("Failed to add tank:", error);
    res.status(500).json({ message: "Failed to add tank" });
  }
};

// GET /tanks/last
export const getLastTank = async (req: Request, res: Response) => {
  try {
    const lastTank = await Tank.findOne().sort({ _id: -1 }); // last added
    res.status(200).json(lastTank);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch last tank" });
  }
};

export const getAllTanks = async (req:Request, res:Response) => {
  try {
    const tanks = await Tank.find(); // Assuming MongoDB / Mongoose
    res.json(tanks);
  } catch (error) {
    console.error("Failed to fetch tanks", error);
    res.status(500).json({ message: "Failed to fetch tanks" });
  }
};
