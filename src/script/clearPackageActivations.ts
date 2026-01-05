import mongoose from "mongoose";
import PackageActivationModel from "../models/package-activation.model";
import AppointmentModel from "../models/appointment.model";

const clearPackageActivations = async () => {
  try {
    console.log(" Starting to clear all package activations...");
    
    const count = await AppointmentModel.countDocuments({});
    console.log(`Found ${count} package activation(s) in the database.`);
    
    if (count === 0) {
      console.log("No package activations to delete.");
      return;
    }

    const result = await AppointmentModel.deleteMany({});
    
    console.log(`Successfully deleted ${result.deletedCount} package activation(s).`);
    console.log("Database cleared successfully!");
    
  } catch (err) {
    console.error("Error clearing package activations:", err);
    throw err;
  }
};

export default clearPackageActivations;

