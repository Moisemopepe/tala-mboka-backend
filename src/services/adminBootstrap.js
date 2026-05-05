import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function ensureConfiguredAdmin() {
  const {
    ADMIN_NAME = "Moise Mopepe",
    ADMIN_EMAIL = "moisemopepe3@gmail.com",
    ADMIN_PHONE = "0850767267",
    ADMIN_PASSWORD = "Mokili243@#$"
  } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("Admin bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD missing.");
    return;
  }

  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase().trim() },
    { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase().trim(), phone: ADMIN_PHONE, password, role: "admin", banned: false },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin ready: ${user.name} (${user.email})`);
}
