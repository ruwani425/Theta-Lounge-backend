import { Request, Response } from "express";
import SystemSettingsModel from "../models/settings.model";
import { SystemSettings } from "../interfaces/setting.interface";

export const saveSystemSettings = async (req: Request, res: Response) => {
  try {
    const {
      defaultFloatPrice,
      cleaningBuffer,
      sessionDuration,
      sessionsPerDay,
      openTime,
      closeTime,
      numberOfTanks,
      tankStaggerInterval,
      actualCloseTime,
    } = req.body;

    // ✅ Validation
    if (
      defaultFloatPrice === undefined ||
      cleaningBuffer === undefined ||
      sessionDuration === undefined ||
      sessionsPerDay === undefined ||
      !openTime ||
      !closeTime ||
      numberOfTanks === undefined ||
      tankStaggerInterval === undefined
    ) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const settingsData = {
      defaultFloatPrice,
      cleaningBuffer,
      sessionDuration,
      sessionsPerDay,
      openTime,
      closeTime,
      numberOfTanks,
      tankStaggerInterval,
      actualCloseTime,
    };

    // ✅ Allow ONLY one settings row
    const existingSettings = await SystemSettingsModel.findOne();

    if (existingSettings) {
      await SystemSettingsModel.findByIdAndUpdate(
        existingSettings._id,
        settingsData,
        { new: true }
      );

      return res.status(200).json({
        message: "Settings updated successfully",
      });
    }

    const newSettings = new SystemSettingsModel(settingsData);
    await newSettings.save();

    res.status(201).json({
      message: "Settings created successfully",
    });

  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ message: "Failed to save settings" });
  }
};

// ✅ GET API FOR FRONTEND LOAD
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettingsModel.findOne();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const settingsId = req.params.id;
    const updateData: SystemSettings = req.body;

    // Use findByIdAndUpdate to find the document by ID and apply the updates
    // { new: true } returns the updated document
    const updatedSettings = await SystemSettingsModel.findByIdAndUpdate(
      settingsId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedSettings) {
      return res.status(404).json({ message: "Settings document not found." });
    }

    res.status(200).json(updatedSettings);
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Failed to update settings." });
  }
};
