import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import Report from "../models/Report.js";
import User from "../models/User.js";

const router = express.Router();
const statuses = ["pending", "in_progress", "resolved"];
const categories = ["road", "water", "electricity", "waste", "security"];

function signToken(user) {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

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

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
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

router.use(requireAuth, requireAdmin);

router.get("/stats", async (_req, res, next) => {
  try {
    const [totalReports, totalUsers, pendingReports, resolvedReports, categoryRows, statusRows] = await Promise.all([
      Report.countDocuments(),
      User.countDocuments(),
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({ status: "resolved" }),
      Report.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);

    res.json({
      totalReports,
      totalUsers,
      pendingReports,
      resolvedReports,
      categoryBreakdown: categoryRows.map((row) => ({ category: row._id, count: row.count })),
      statusBreakdown: statusRows.map((row) => ({ status: row._id, count: row.count }))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports", async (_req, res, next) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name phone role banned")
      .lean({ virtuals: true });

    res.json(reports.map((report) => ({ ...report, likesCount: report.likes?.length || 0 })));
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!statuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate(
      "userId",
      "name phone"
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id", async (req, res, next) => {
  try {
    const { title, description, category, status, lat, lng } = req.body;
    const update = {};

    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (category !== undefined) {
      if (!categories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      update.category = category;
    }
    if (status !== undefined) {
      if (!statuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      update.status = status;
    }
    if (lat !== undefined || lng !== undefined) {
      const nextLat = Number(lat);
      const nextLng = Number(lng);
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      update.location = { lat: nextLat, lng: nextLng };
    }

    if (update.title === "" || update.description === "") {
      return res.status(400).json({ message: "Title and description cannot be empty" });
    }

    const report = await Report.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).populate("userId", "name phone role banned");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ ...report.toJSON(), likesCount: report.likes.length });
  } catch (error) {
    next(error);
  }
});

router.delete("/reports/:id", async (req, res, next) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ message: "Report deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "reports",
          localField: "_id",
          foreignField: "userId",
          as: "reports"
        }
      },
      {
        $project: {
          name: 1,
          phone: 1,
          role: 1,
          banned: 1,
          createdAt: 1,
          reportCount: { $size: "$reports" }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/ban", async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot ban yourself" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { banned: Boolean(req.body.banned) }, { new: true }).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (req.params.id === req.user._id.toString() && role !== "admin") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
