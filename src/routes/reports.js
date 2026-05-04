import express from "express";
import Report from "../models/Report.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getClientIp, guestReportRateLimit } from "../middleware/rateLimit.js";
import { upload } from "../middleware/upload.js";
import { uploadReportImages } from "../services/cloudinary.js";
import { notifyRoles } from "../services/notifications.js";

const router = express.Router();
const allowedCategories = [
  "residential",
  "commercial",
  "government",
  "utility",
  "transport",
  "communication",
  "health",
  "education",
  "community",
  "public_space",
  "other",
  "road",
  "water",
  "electricity",
  "waste",
  "security",
  "fraud",
  "kidnapping"
];
const allowedInfrastructureTypes = ["residential", "commercial", "government", "utility", "transport", "communication", "health", "education", "public_space", "community", "other"];
const allowedCrisisTypes = ["flood", "earthquake", "conflict", "fire", "explosion", "chemical_incident", "tsunami", "hurricane", "wildfire", "civil_unrest", "other"];
const allowedDamageLevels = ["minimal", "partial", "complete"];
const allowedDebris = ["unknown", "no", "yes"];
const allowedLanguages = ["ar", "zh", "en", "fr", "ru", "es"];
const publicStatuses = ["verified"];
const moderationStatuses = ["pending", "verified", "rejected"];

function parseBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function uploadedFiles(req) {
  return req.files || (req.file ? [req.file] : []);
}

function handleReportUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  return upload.array("images", 3)(req, res, next);
}

function validateReportInput(body) {
  const {
    title,
    description,
    category,
    infrastructureType,
    infrastructureName = "",
    assetId = "",
    language = "en",
    crisisType,
    damageLevel,
    debris = "unknown",
    locationDescription = "",
    accessBlocked = false,
    servicesDisrupted = false,
    livelihoodsAffected = false,
    peopleAtRisk = false,
    province,
    commune,
    lat,
    lng,
    address = "",
    addressText = ""
  } = body;

  if (
    !title?.trim() ||
    !description?.trim() ||
    !category ||
    !province?.trim() ||
    !commune?.trim() ||
    lat === undefined ||
    lat === null ||
    lng === undefined ||
    lng === null
  ) {
    return { message: "All report fields are required" };
  }

  if (String(description).trim().length > 1200) {
    return { message: "Description is too long" };
  }

  if (!allowedCategories.includes(category)) {
    return { message: "Invalid category" };
  }

  const nextInfrastructureType = infrastructureType || category || "other";
  if (!allowedInfrastructureTypes.includes(nextInfrastructureType)) {
    return { message: "Invalid infrastructure type" };
  }

  const nextCrisisType = crisisType || "other";
  if (!allowedCrisisTypes.includes(nextCrisisType)) {
    return { message: "Invalid crisis type" };
  }

  const nextDamageLevel = damageLevel || "partial";
  if (!allowedDamageLevels.includes(nextDamageLevel)) {
    return { message: "Invalid damage level" };
  }

  const nextDebris = debris || "unknown";
  if (!allowedDebris.includes(nextDebris)) {
    return { message: "Invalid debris value" };
  }

  const nextLanguage = language || "en";
  if (!allowedLanguages.includes(nextLanguage)) {
    return { message: "Invalid language" };
  }

  const nextLat = Number(lat);
  const nextLng = Number(lng);
  if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
    return { message: "Invalid coordinates" };
  }

  return {
    value: {
      title: String(title).trim(),
      description: String(description).trim(),
      category,
      infrastructureType: nextInfrastructureType,
      infrastructureName: String(infrastructureName).trim(),
      assetId: String(assetId).trim(),
      language: nextLanguage,
      crisisType: nextCrisisType,
      damageLevel: nextDamageLevel,
      debris: nextDebris,
      locationDescription: String(locationDescription).trim(),
      modularAnswers: {
        accessBlocked: parseBoolean(accessBlocked),
        servicesDisrupted: parseBoolean(servicesDisrupted),
        livelihoodsAffected: parseBoolean(livelihoodsAffected),
        peopleAtRisk: parseBoolean(peopleAtRisk)
      },
      province: String(province).trim(),
      commune: String(commune).trim(),
      location: {
        type: "Point",
        coordinates: [nextLng, nextLat],
        lat: nextLat,
        lng: nextLng,
        address: String(address || addressText).trim()
      },
      addressText: String(addressText || address || locationDescription).trim()
    }
  };
}

function publicReport(report) {
  const moderationStatus = report.status;
  return {
    ...report,
    moderationStatus,
    status: moderationStatus,
    risk: report.risk || "suivi",
    likesCount: report.likes?.length || 0
  };
}

function coordinateWindow(location, radiusMeters = 120) {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.2));
  return {
    "location.lat": { $gte: location.lat - latDelta, $lte: location.lat + latDelta },
    "location.lng": { $gte: location.lng - lngDelta, $lte: location.lng + lngDelta }
  };
}

async function findPossibleDuplicates(parsedValue) {
  const baseFilter = {
    status: { $in: ["pending", "verified"] },
    infrastructureType: parsedValue.infrastructureType,
    crisisType: parsedValue.crisisType
  };
  const duplicateFilters = [];

  if (parsedValue.assetId) {
    duplicateFilters.push({ ...baseFilter, assetId: parsedValue.assetId });
  }

  duplicateFilters.push({
    ...baseFilter,
    ...coordinateWindow(parsedValue.location),
    createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) }
  });

  return Report.find({ $or: duplicateFilters })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("_id title assetId location infrastructureType crisisType damageLevel createdAt")
    .lean();
}

async function createReportWithDuplicates(parsedValue, metadata) {
  const possibleDuplicates = await findPossibleDuplicates(parsedValue);
  const report = await Report.create({
    ...parsedValue,
    ...metadata,
    possibleDuplicateIds: possibleDuplicates.map((item) => item._id),
    duplicateOf: possibleDuplicates[0]?._id || null,
    duplicateScore: possibleDuplicates.length > 0 ? (parsedValue.assetId ? 1 : 0.72) : 0
  });

  return { report, possibleDuplicates };
}

router.get("/", async (req, res, next) => {
  try {
    const { sort = "newest", category, province, commune, status, crisisType, damageLevel, infrastructureType, nearLat, nearLng } = req.query;
    const filter = { status: { $in: publicStatuses } };

    if (category && allowedCategories.includes(category)) filter.category = category;
    if (infrastructureType && allowedInfrastructureTypes.includes(infrastructureType)) filter.infrastructureType = infrastructureType;
    if (province) filter.province = province;
    if (commune) filter.commune = commune;
    if (status && ["suivi", "critique", "danger", "resolved"].includes(status)) filter.risk = status;
    if (crisisType && allowedCrisisTypes.includes(crisisType)) filter.crisisType = crisisType;
    if (damageLevel && allowedDamageLevels.includes(damageLevel)) filter.damageLevel = damageLevel;

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

    res.json(withDistance.map(publicReport));
  } catch (error) {
    next(error);
  }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const reports = await Report.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json(reports.map(publicReport));
  } catch (error) {
    next(error);
  }
});

router.get("/export/csv", requireAuth, requireRole("admin", "moderator"), async (_req, res, next) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).lean({ virtuals: true });
    const headers = [
      "id",
      "crisisType",
      "infrastructureType",
      "damageLevel",
      "description",
      "imageUrl",
      "longitude",
      "latitude",
      "addressText",
      "status",
      "duplicateOf",
      "createdAt",
      "updatedAt",
      "version"
    ];
    const rows = reports.map((report) => [
      report._id,
      report.crisisType || "",
      report.infrastructureType || report.category || "",
      report.damageLevel || "",
      report.description || "",
      report.imageUrl || report.imageUrls?.[0] || "",
      report.location?.lng ?? "",
      report.location?.lat ?? "",
      report.addressText || report.locationDescription || report.location?.address || "",
      report.status,
      report.duplicateOf || report.possibleDuplicateIds?.[0] || "",
      report.createdAt?.toISOString?.() || report.createdAt || "",
      report.updatedAt?.toISOString?.() || report.updatedAt || "",
      report.__v ?? 0
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tala-mboka-crisis-reports.csv");
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.get("/export/geojson", requireAuth, requireRole("admin", "moderator"), async (_req, res, next) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).lean({ virtuals: true });
    res.json({
      type: "FeatureCollection",
      features: reports.map((report) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [report.location.lng, report.location.lat]
        },
        properties: {
          id: report._id,
          title: report.title,
          description: report.description,
          infrastructureType: report.infrastructureType || report.category,
          infrastructureName: report.infrastructureName || "",
          assetId: report.assetId || "",
          crisisType: report.crisisType || "other",
          damageLevel: report.damageLevel || "partial",
          debris: report.debris || "unknown",
          language: report.language || "en",
          locationDescription: report.locationDescription || "",
          addressText: report.addressText || report.locationDescription || report.location?.address || "",
          status: report.status,
          duplicateOf: report.duplicateOf || report.possibleDuplicateIds?.[0] || null,
          modularAnswers: report.modularAnswers || {},
          province: report.province,
          commune: report.commune,
          risk: report.risk || "suivi",
          duplicateScore: report.duplicateScore || 0,
          possibleDuplicateIds: report.possibleDuplicateIds || [],
          createdAt: report.createdAt,
          imageUrl: report.imageUrl || report.imageUrls?.[0] || ""
        }
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id).populate("userId", "name phone");
    if (!report || !publicStatuses.includes(report.status)) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(publicReport(report.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.post("/guest", guestReportRateLimit, handleReportUpload, async (req, res, next) => {
  try {
    const parsed = validateReportInput(req.body);
    if (parsed.message) return res.status(400).json({ message: parsed.message });

    console.log(`Guest report from IP ${req.clientIp}`);

    const images = await uploadReportImages(uploadedFiles(req));
    const { report, possibleDuplicates } = await createReportWithDuplicates(parsed.value, {
      userId: null,
      createdBy: null,
      source: "guest",
      status: "pending",
      risk: "suivi",
      ip: req.clientIp,
      imageUrl: images[0] || "",
      imageUrls: images
    });

    await notifyRoles({
      reportId: report._id,
      type: "report_created",
      title: "Nouveau signalement invite",
      message: `${report.title} attend une validation admin.${possibleDuplicates.length ? ` ${possibleDuplicates.length} possible duplicate(s).` : ""}`
    });

    res.status(201).json({
      message: "Votre alerte a ete envoyee et sera validee",
      reportId: report._id,
      possibleDuplicatesCount: possibleDuplicates.length
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, handleReportUpload, async (req, res, next) => {
  try {
    const parsed = validateReportInput(req.body);
    if (parsed.message) return res.status(400).json({ message: parsed.message });

    const images = await uploadReportImages(uploadedFiles(req));
    const { report, possibleDuplicates } = await createReportWithDuplicates(parsed.value, {
      userId: req.user._id,
      createdBy: req.user._id,
      source: "user",
        status: "verified",
      risk: "suivi",
      ip: getClientIp(req),
      imageUrl: images[0] || "",
      imageUrls: images
    });

    await notifyRoles({
      reportId: report._id,
      type: "report_created",
      title: "Nouveau signalement publie",
      message: `${report.title} a ete publie par un utilisateur.${possibleDuplicates.length ? ` ${possibleDuplicates.length} possible duplicate(s).` : ""}`
    });

    res.status(201).json({
      ...publicReport(report.toJSON()),
      message: "Votre alerte a ete envoyee",
      possibleDuplicatesCount: possibleDuplicates.length
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/like", requireAuth, async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!publicStatuses.includes(report.status)) return res.status(400).json({ message: "Report is not public yet" });

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

router.patch("/:id/status", requireAuth, requireRole("admin", "moderator"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!moderationStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid report status" });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, rejectionReason: status === "rejected" ? String(req.body.reason || "").trim() : "" },
      { new: true, runValidators: true }
    );

    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(publicReport(report.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "moderator"), async (req, res, next) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json({ message: "Report deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
