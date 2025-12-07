import mongoose from "mongoose";
import dotenv from "dotenv";
import clearPackageActivations from "./clearPackageActivations";

// Load environment variables
dotenv.config();

const runScript = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URL;
    console.log("🔌 Connecting to MongoDB...");
    if (!mongoUri) {
      throw new Error("MONGO_URL is not set");
    }
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB successfully!");

    // Run the clear script
    await clearPackageActivations();

    // Disconnect from MongoDB
    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Script failed:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
runScript();

