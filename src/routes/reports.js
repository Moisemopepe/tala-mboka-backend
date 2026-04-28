import express from "express";
import Report from "../models/Report.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { uploadReportImages } from "../services/cloudinary.js";

const router = express.Router();

const allowedCategories = ["road", "water", "electricity", "waste", "security", "fraud", "kidnapping"];
const allowedStatuses = ["danger", "critique", "suivi", "resolved"];

function uploadedFiles(req) {
  const files = [
    ...(req.files?.images || []),
    ...(req.files?.image || [])
  ];
  return files;
}

async function createReportFromRequest(req, userId = null) {
  const { title, description, category, lat, lng, province = "", commune = "", address = "" } = req.body;
  const images = await uploadReportImages(uploadedFiles(req));

  if (!title || !description || !category || !lat || !lng) {
    const error = new Error("All report fields are required");
    error.status = 400;
    throw error;
  }

  if (!allowedCategories.includes(category)) {
    const error = new Error("Invalid category");
    error.status = 400;
    throw error;
  }

  return Report.create({
    ...(userId ? { userId, source: "user" } : { source: "guest" }),
    title,
    description,
    category,
    imageUrl: images[0] || "",
    imageUrls: images,
    province,
    commune,
    address,
    status: "suivi",
    moderationStatus: userId ? "approved" : "pending",
    location: { lat: Number(lat), lng: Number(lng) }
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { sort = "newest", category, status, nearLat, nearLng } = req.query;
    const filter = {
      $or: [{ moderationStatus: "approved" }, { moderationStatus: { $exists: false } }]
    };

    if (category && allowedCategories.includes(category)) {
      filter.category = category;
    }
    if (status && allowedStatuses.includes(status)) {
      filter.status =
        status === "suivi"
          ? { $in: ["suivi", "pending", "in_progress", "approved"] }
          : status === "resolved"
            ? { $in: ["resolved", "rejected"] }
            : status;
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

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const reports = await Report.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("userId", "name phone")
      .lean({ virtuals: true });

    res.json(reports.map((report) => ({ ...report, likesCount: report.likes?.length || 0 })));
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
    if (report.moderationStatus && report.moderationStatus !== "approved") {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "image", maxCount: 1 }
  ]),
  async (req, res, next) => {
  try {
    const report = await createReportFromRequest(req, req.user._id);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/guest",
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "image", maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const report = await createReportFromRequest(req);
      res.status(201).json({ report, message: "Signalement envoye avec succes." });
    } catch (error) {
      next(error);
    }
  }
);

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
