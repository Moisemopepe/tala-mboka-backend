import express from "express";
import crypto from "crypto";
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
const allowedReporterRoles = ["community_member", "local_leader", "ngo", "government", "responder", "other"];
const allowedChannels = ["web", "mobile", "whatsapp", "api", "import"];
const publicStatuses = ["verified"];
const moderationStatuses = ["pending", "verified", "rejected"];

function parseBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function boundedString(value, limit = 180) {
  return String(value || "").trim().slice(0, limit);
}

function hashIp(value = "") {
  return value ? crypto.createHash("sha256").update(String(value)).digest("hex") : "";
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
    crisisId = "default-crisis",
    collectionTime,
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
    addressText = "",
    reporterName = "",
    reporterContact = "",
    reporterOrganization = "",
    reporterRole = "community_member",
    reporterConsent = false,
    channel = "web",
    offlineCreatedAt,
    offlineSyncedAt,
    appVersion = "",
    deviceId = "",
    buildingFootprintId = "",
    buildingFootprintName = "",
    buildingFootprintSource = "",
    buildingFootprintGeometry
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

  let parsedFootprintGeometry = null;
  if (buildingFootprintGeometry) {
    try {
      parsedFootprintGeometry = typeof buildingFootprintGeometry === "string" ? JSON.parse(buildingFootprintGeometry) : buildingFootprintGeometry;
    } catch {
      parsedFootprintGeometry = null;
    }
  }

  return {
    value: {
      title: String(title).trim(),
      description: String(description).trim(),
      category,
      infrastructureType: nextInfrastructureType,
      infrastructureName: boundedString(infrastructureName),
      assetId: boundedString(assetId),
      crisisId: boundedString(crisisId || "default-crisis", 120) || "default-crisis",
      collectionTime: parseOptionalDate(collectionTime) || new Date(),
      language: nextLanguage,
      crisisType: nextCrisisType,
      damageLevel: nextDamageLevel,
      debris: nextDebris,
      locationDescription: boundedString(locationDescription, 300),
      reporter: {
        name: boundedString(reporterName, 120),
        contact: boundedString(reporterContact, 160),
        organization: boundedString(reporterOrganization, 160),
        role: allowedReporterRoles.includes(reporterRole) ? reporterRole : "community_member",
        consentToContact: parseBoolean(reporterConsent)
      },
      submissionMeta: {
        channel: allowedChannels.includes(channel) ? channel : "web",
        offlineCreatedAt: parseOptionalDate(offlineCreatedAt),
        offlineSyncedAt: parseOptionalDate(offlineSyncedAt),
        appVersion: boundedString(appVersion, 80),
        deviceId: boundedString(deviceId, 160)
      },
      buildingFootprint: {
        id: boundedString(buildingFootprintId || assetId, 180),
        name: boundedString(buildingFootprintName || infrastructureName, 180),
        source: boundedString(buildingFootprintSource, 120),
        ...(parsedFootprintGeometry && typeof parsedFootprintGeometry === "object" ? { geometry: parsedFootprintGeometry } : {})
      },
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
        address: boundedString(address || addressText, 300)
      },
      addressText: boundedString(addressText || address || locationDescription, 300)
    }
  };
}

function publicReport(report) {
  const { reporter, submissionMeta, ip, userId, createdBy, ...publicFields } = report;
  const moderationStatus = report.status;
  return {
    ...publicFields,
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

function textTokens(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 16);
}

function tokenSimilarity(left = "", right = "") {
  const a = new Set(textTokens(left));
  const b = new Set(textTokens(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / Math.max(a.size, b.size);
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

  if (parsedValue.buildingFootprint?.id) {
    duplicateFilters.push({
      ...baseFilter,
      "buildingFootprint.id": parsedValue.buildingFootprint.id,
      createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90) }
    });
  }

  duplicateFilters.push({
    ...baseFilter,
    ...coordinateWindow(parsedValue.location, 300),
    createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21) }
  });

  const nearby = await Report.find({ $or: duplicateFilters })
    .sort({ createdAt: -1 })
    .limit(12)
    .select("_id title assetId buildingFootprint location infrastructureType crisisType damageLevel createdAt version")
    .lean();

  return nearby
    .map((item) => ({
      ...item,
      duplicateScore:
        parsedValue.assetId && item.assetId === parsedValue.assetId
          ? 1
          : parsedValue.buildingFootprint?.id && item.buildingFootprint?.id === parsedValue.buildingFootprint.id
            ? 0.95
            : Math.max(0.72, tokenSimilarity(`${parsedValue.title} ${parsedValue.description}`, item.title))
    }))
    .filter((item) => item.duplicateScore >= 0.72)
    .slice(0, 5);
}

async function createReportWithDuplicates(parsedValue, metadata) {
  const possibleDuplicates = await findPossibleDuplicates(parsedValue);
  const versionAnchor = possibleDuplicates[0]?._id;
  let nextVersion = 1;

  if (versionAnchor || parsedValue.assetId || parsedValue.buildingFootprint?.id) {
    const versionFilter = {
      $or: [
        ...(versionAnchor ? [{ _id: versionAnchor }, { duplicateOf: versionAnchor }] : []),
        ...(parsedValue.assetId ? [{ assetId: parsedValue.assetId }] : []),
        ...(parsedValue.buildingFootprint?.id ? [{ "buildingFootprint.id": parsedValue.buildingFootprint.id }] : [])
      ]
    };
    const latest = await Report.find(versionFilter).sort({ version: -1, createdAt: -1 }).select("version").lean();
    nextVersion = Math.max(1, Number(latest?.version || 0) + 1);
  }

  const report = await Report.create({
    ...parsedValue,
    ...metadata,
    possibleDuplicateIds: possibleDuplicates.map((item) => item._id),
    duplicateOf: possibleDuplicates[0]?._id || null,
    duplicateScore: possibleDuplicates[0]?.duplicateScore || 0,
    version: nextVersion
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
      "crisisId",
      "collectionTime",
      "crisisType",
      "infrastructureType",
      "infrastructureName",
      "assetId",
      "buildingFootprintId",
      "damageLevel",
      "debris",
      "description",
      "imageUrl",
      "longitude",
      "latitude",
      "addressText",
      "status",
      "source",
      "channel",
      "reporterName",
      "reporterContact",
      "reporterOrganization",
      "reporterRole",
      "offlineCreatedAt",
      "offlineSyncedAt",
      "duplicateOf",
      "duplicateScore",
      "possibleDuplicateIds",
      "createdAt",
      "updatedAt",
      "version"
    ];
    const rows = reports.map((report) => [
      report._id,
      report.crisisId || "default-crisis",
      report.collectionTime?.toISOString?.() || report.collectionTime || "",
      report.crisisType || "",
      report.infrastructureType || report.category || "",
      report.infrastructureName || "",
      report.assetId || "",
      report.buildingFootprint?.id || "",
      report.damageLevel || "",
      report.debris || "unknown",
      report.description || "",
      report.imageUrl || report.imageUrls?.[0] || "",
      report.location?.lng ?? "",
      report.location?.lat ?? "",
      report.addressText || report.locationDescription || report.location?.address || "",
      report.status,
      report.source || "",
      report.submissionMeta?.channel || "",
      report.reporter?.name || "",
      report.reporter?.contact || "",
      report.reporter?.organization || "",
      report.reporter?.role || "",
      report.submissionMeta?.offlineCreatedAt?.toISOString?.() || report.submissionMeta?.offlineCreatedAt || "",
      report.submissionMeta?.offlineSyncedAt?.toISOString?.() || report.submissionMeta?.offlineSyncedAt || "",
      report.duplicateOf || report.possibleDuplicateIds?.[0] || "",
      report.duplicateScore || 0,
      (report.possibleDuplicateIds || []).join("|"),
      report.createdAt?.toISOString?.() || report.createdAt || "",
      report.updatedAt?.toISOString?.() || report.updatedAt || "",
      report.version || report.__v || 1
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
          crisisId: report.crisisId || "default-crisis",
          collectionTime: report.collectionTime || report.createdAt,
          title: report.title,
          description: report.description,
          infrastructureType: report.infrastructureType || report.category,
          infrastructureName: report.infrastructureName || "",
          assetId: report.assetId || "",
          buildingFootprint: report.buildingFootprint || {},
          crisisType: report.crisisType || "other",
          damageLevel: report.damageLevel || "partial",
          debris: report.debris || "unknown",
          language: report.language || "en",
          locationDescription: report.locationDescription || "",
          addressText: report.addressText || report.locationDescription || report.location?.address || "",
          status: report.status,
          source: report.source || "",
          channel: report.submissionMeta?.channel || "",
          reporter: report.reporter || {},
          submissionMeta: report.submissionMeta || {},
          duplicateOf: report.duplicateOf || report.possibleDuplicateIds?.[0] || null,
          version: report.version || 1,
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
      submissionMeta: {
        ...parsed.value.submissionMeta,
        channel: parsed.value.submissionMeta.channel || "web",
        offlineSyncedAt: parsed.value.submissionMeta.offlineSyncedAt || (parsed.value.submissionMeta.offlineCreatedAt ? new Date() : null),
        userAgent: boundedString(req.get("user-agent"), 260),
        ipHash: hashIp(req.clientIp)
      },
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
      submissionMeta: {
        ...parsed.value.submissionMeta,
        channel: parsed.value.submissionMeta.channel || "web",
        offlineSyncedAt: parsed.value.submissionMeta.offlineSyncedAt || (parsed.value.submissionMeta.offlineCreatedAt ? new Date() : null),
        userAgent: boundedString(req.get("user-agent"), 260),
        ipHash: hashIp(getClientIp(req))
      },
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
