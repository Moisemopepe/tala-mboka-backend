import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Invalid session" });
    }

    if (user.banned) {
      return res.status(403).json({ message: "Account banned" });
    }

    req.user = user;
    next();
  } catch (_error) {
    res.status(401).json({ message: "Invalid session" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}
