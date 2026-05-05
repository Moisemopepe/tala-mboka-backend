import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const { MONGODB_URI } = process.env;
const ADMIN_NAME = process.env.PRIMARY_ADMIN_NAME || "Moise Mopepe";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "moisemopepe3@gmail.com").toLowerCase().trim();
const ADMIN_PHONE = String(process.env.ADMIN_PHONE || "0850767267").trim();
const ADMIN_PASSWORD = process.env.PRIMARY_ADMIN_PASSWORD || "Mokili243@#$";

if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
const existingUser = await User.findOne({ $or: [{ email: ADMIN_EMAIL }, { phone: ADMIN_PHONE }] });
const payload = { name: ADMIN_NAME, email: ADMIN_EMAIL, phone: ADMIN_PHONE, password, role: "admin", banned: false };
const user = existingUser
  ? await User.findByIdAndUpdate(existingUser._id, payload, { new: true, runValidators: true })
  : await User.create(payload);

console.log(`Admin ready: ${user.name} (${user.email})`);
await mongoose.disconnect();
