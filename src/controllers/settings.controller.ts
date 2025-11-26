import { Request, Response } from "express";
import SystemSettingsModel from "../models/settings.model";

export const saveSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = req.body;

    // ✅ Only allow ONE settings document in DB
    const existingSettings = await SystemSettingsModel.findOne();

    if (existingSettings) {
      await SystemSettingsModel.findByIdAndUpdate(existingSettings._id, settings, { new: true });
      return res.status(200).json({
        message: "Settings updated successfully",
      });
    }

    const newSettings = new SystemSettingsModel(settings);
    await newSettings.save();

    res.status(201).json({
      message: "Settings created successfully",
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ message: "Failed to save settings" });
  }
};

// ✅ Optional GET API to load settings into UI
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettingsModel.findOne();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};
