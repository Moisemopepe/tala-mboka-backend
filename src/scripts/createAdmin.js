import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const { ADMIN_NAME = "Admin Tala Mboka", ADMIN_PHONE, ADMIN_PASSWORD, MONGODB_URI } = process.env;

if (!MONGODB_URI || !ADMIN_PHONE || !ADMIN_PASSWORD) {
  console.error("Set MONGODB_URI, ADMIN_PHONE and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
const user = await User.findOneAndUpdate(
  { phone: ADMIN_PHONE },
  { name: ADMIN_NAME, phone: ADMIN_PHONE, password, role: "admin", banned: false },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);

console.log(`Admin ready: ${user.name} (${user.phone})`);
await mongoose.disconnect();
