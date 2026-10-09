import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./models/User.model.js";

// Usage: set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in server/.env, then `npm run create-admin`.
// Creates the admin, or promotes the account if that email already exists. Admins can't be made via the public signup.
const { ADMIN_NAME = "Admin", ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in server/.env first.",
  );
  process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI);
const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
if (existing) {
  existing.role = "admin";
  await existing.save();
  console.log(`Promoted ${existing.email} to admin.`);
} else {
  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    role: "admin",
  });
  console.log(`Created admin ${ADMIN_EMAIL}.`);
}
process.exit(0);
