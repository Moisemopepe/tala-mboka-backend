import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: "Name, phone and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ message: "Phone number already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const role = phone === process.env.ADMIN_PHONE ? "admin" : "user";
    const user = await User.create({ name, phone, password: hashedPassword, role });

    res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    if (user.banned) {
      return res.status(403).json({ message: "Account banned" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    res.json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
});

export default router;
