import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

const sign = (u) =>
  jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(req, res) {
  const { name, email, password } = req.body;
  if (
    !name?.trim() ||
    !EMAIL_RE.test(email || "") ||
    (password || "").length < 8
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Enter your name, a valid email and a password of at least 8 characters.",
      });
  }
  if (await User.exists({ email: email.toLowerCase() })) {
    return res
      .status(409)
      .json({
        success: false,
        message: "An account with this email already exists. Sign in instead.",
      });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash }); // role defaults to 'user'
  res
    .status(201)
    .json({ success: true, token: sign(user), user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({
    email: (email || "").toLowerCase(),
  }).select("+passwordHash");
  // Same message for unknown email and wrong password so the API can't be used to discover accounts.
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res
      .status(401)
      .json({ success: false, message: "Incorrect email or password." });
  }
  res.json({ success: true, token: sign(user), user: publicUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Account not found." });
  res.json({ success: true, user: publicUser(user) });
}
