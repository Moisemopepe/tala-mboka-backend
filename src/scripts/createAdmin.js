import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const {
  ADMIN_NAME = "Moise Mopepe",
  ADMIN_EMAIL = "moisemopepe3@gmail.com",
  ADMIN_PHONE = "0850767267",
  ADMIN_PASSWORD = "Mokili243@#$",
  MONGODB_URI
} = process.env;

if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
const user = await User.findOneAndUpdate(
  { email: ADMIN_EMAIL.toLowerCase().trim() },
  { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase().trim(), phone: ADMIN_PHONE, password, role: "admin", banned: false },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);

console.log(`Admin ready: ${user.name} (${user.email})`);
await mongoose.disconnect();
