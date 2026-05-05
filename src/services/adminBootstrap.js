import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function ensureConfiguredAdmin() {
  const adminName = process.env.PRIMARY_ADMIN_NAME || "Moise Mopepe";
  const adminEmail = (process.env.ADMIN_EMAIL || "moisemopepe3@gmail.com").toLowerCase().trim();
  const adminPhone = String(process.env.ADMIN_PHONE || "0850767267").trim();
  const adminPassword = process.env.PRIMARY_ADMIN_PASSWORD || "Mokili243@#$";

  if (!adminEmail || !adminPassword) {
    console.log("Admin bootstrap skipped: admin email or password missing.");
    return;
  }

  const password = await bcrypt.hash(adminPassword, 12);
  const existingUser = await User.findOne({ $or: [{ email: adminEmail }, { phone: adminPhone }] });
  const payload = { name: adminName, email: adminEmail, phone: adminPhone, password, role: "admin", banned: false };
  const user = existingUser
    ? await User.findByIdAndUpdate(existingUser._id, payload, { new: true, runValidators: true })
    : await User.create(payload);

  console.log(`Admin ready: ${user.name} (${user.email})`);
}
