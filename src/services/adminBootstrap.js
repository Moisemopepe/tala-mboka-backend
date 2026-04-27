import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function ensureConfiguredAdmin() {
  const { ADMIN_NAME = "Admin Tala Mboka", ADMIN_PHONE, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_PHONE || !ADMIN_PASSWORD) {
    console.log("Admin bootstrap skipped: ADMIN_PHONE or ADMIN_PASSWORD missing.");
    return;
  }

  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { phone: ADMIN_PHONE },
    { name: ADMIN_NAME, phone: ADMIN_PHONE, password, role: "admin", banned: false },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin ready: ${user.name} (${user.phone})`);
}
