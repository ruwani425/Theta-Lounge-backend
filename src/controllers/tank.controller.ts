import { Request, Response } from "express";
import { Tank } from "../models/tank.model";

// POST /tanks
export const addTank = async (req: Request, res: Response) => {
  try {
    const { name, capacity, length, width, benefits, status } = req.body;

    const newTank = new Tank({
      name,
      capacity,
      length,
      width,
      benefits,
      status,
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

export const updateTankStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // Expects { status: "Ready" | "Maintenance" }

    try {
        const updatedTank = await Tank.findByIdAndUpdate(
            id,
            { status: status }, // Only update the status field
            { new: true, runValidators: true }
        );

        if (!updatedTank) {
            return res.status(404).json({ message: "Tank not found" });
        }

        res.status(200).json(updatedTank);
    } catch (error) {
        console.error("Failed to update tank status:", error);
        res.status(500).json({ message: "Failed to update tank status" });
    }
};


// PATCH /tanks/:id (Used for full tank editing AND status updates)
export const updateTank = async (req: Request, res: Response) => {
    try {
        const tankId = req.params.id;
        const updateData = req.body;

        const updatedTank = await Tank.findByIdAndUpdate(
            tankId,
            { $set: updateData }, // Use $set to allow partial updates (PATCH semantics)
            { new: true, runValidators: true }
        );

        if (!updatedTank) {
            return res.status(404).json({ message: "Tank not found." });
        }

        res.status(200).json(updatedTank);
    } catch (error) {
        console.error("Error updating tank:", error);
        res.status(500).json({ message: "Failed to update tank" });
    }
};

// DELETE /tanks/:id
export const deleteTank = async (req: Request, res: Response) => {
    try {
        const deletedTank = await Tank.findByIdAndDelete(req.params.id);

        if (!deletedTank) {
            return res.status(404).json({ message: "Tank not found." });
        }

        res.status(200).json({ message: "Tank deleted successfully" });
    } catch (error) {
        console.error("Error deleting tank:", error);
        res.status(500).json({ message: "Failed to delete tank" });
    }
};

export const getTankById = async (req: Request, res: Response) => {
    try {
        const tankId = req.params.id; // Correctly grabs the ID from the URL
        
        // Find the specific tank in the database
        const tank = await Tank.findById(tankId); 

        if (!tank) {
            // Returns the 404 error the frontend is currently receiving if the ID is wrong
            return res.status(404).json({ message: "Tank not found" });
        }

        // Returns the tank data, which the frontend needs to populate the form
        res.status(200).json(tank); 
    } catch (error) {
        console.error("Failed to fetch tank:", error);
        // This handles cases where the ID format is invalid
        res.status(500).json({ message: "Failed to fetch tank" });
    }
};