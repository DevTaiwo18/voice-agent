import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log("   Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`   MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`   MongoDB Error: ${error.message}`);
    // Don't exit, let server run without DB for now
  }
};

export default connectDB;
