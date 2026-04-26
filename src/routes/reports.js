import express from "express";
import Report from "../models/Report.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

const allowedCategories = ["road", "water", "electricity", "waste", "security"];

function imageUrl(req) {
  if (!req.file) return "";
  return `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
}

router.get("/", async (req, res, next) => {
  try {
    const { sort = "newest", category, nearLat, nearLng } = req.query;
    const filter = {};

    if (category && allowedCategories.includes(category)) {
      filter.category = category;
    }

    const reports = await Report.find(filter).populate("userId", "name phone").lean({ virtuals: true });

    const withDistance = reports.map((report) => {
      if (!nearLat || !nearLng) return report;
      const lat = Number(nearLat);
      const lng = Number(nearLng);
      const distance = Math.hypot(report.location.lat - lat, report.location.lng - lng);
      return { ...report, distance };
    });

    withDistance.sort((a, b) => {
      if (nearLat && nearLng) return (a.distance || 0) - (b.distance || 0);
      if (sort === "liked") return (b.likes?.length || 0) - (a.likes?.length || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(withDistance.map((report) => ({ ...report, likesCount: report.likes?.length || 0 })));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id).populate("userId", "name phone");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    const { title, description, category, lat, lng } = req.body;

    if (!title || !description || !category || !lat || !lng) {
      return res.status(400).json({ message: "All report fields are required" });
    }

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const report = await Report.create({
      userId: req.user._id,
      title,
      description,
      category,
      imageUrl: imageUrl(req),
      location: { lat: Number(lat), lng: Number(lng) }
    });

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const userId = req.user._id.toString();
    const alreadyLiked = report.likes.some((like) => like.toString() === userId);

    if (!alreadyLiked) {
      report.likes.push(req.user._id);
      await report.save();
    }

    res.json({ likesCount: report.likes.length, liked: true });
  } catch (error) {
    next(error);
  }
});

export default router;
