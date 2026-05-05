import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAdmin, requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import AdminAudit from "../models/AdminAudit.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import { uploadReportImages } from "../services/cloudinary.js";
import { notifyRoles, notifyUser } from "../services/notifications.js";

const router = express.Router();
const statuses = ["pending", "verified", "rejected"];
const categories = [
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
const infrastructureTypes = ["residential", "commercial", "government", "utility", "transport", "communication", "health", "education", "community", "public_space", "other"];
const crisisTypes = ["earthquake", "flood", "fire", "explosion", "chemical_incident", "conflict", "tsunami", "hurricane", "wildfire", "civil_unrest", "other"];
const damageLevels = ["minimal", "partial", "complete"];
const debrisOptions = ["unknown", "no", "yes"];
const languages = ["ar", "zh", "en", "fr", "ru", "es"];

function parseBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function signToken(user) {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function uploadedFiles(req) {
  return req.files || (req.file ? [req.file] : []);
}

function adminReport(report) {
  const plain = typeof report.toJSON === "function" ? report.toJSON() : report;
  const accountReporter = plain.userId && typeof plain.userId === "object" ? plain.userId : null;
  return {
    ...plain,
    moderationStatus: plain.status,
    status: plain.status,
    likesCount: plain.likes?.length || 0,
    reporterSummary: {
      source: plain.source || "guest",
      channel: plain.submissionMeta?.channel || "web",
      account: accountReporter
        ? {
            id: accountReporter._id,
            name: accountReporter.name || "",
            email: accountReporter.email || "",
            phone: accountReporter.phone || "",
            role: accountReporter.role || "",
            banned: Boolean(accountReporter.banned)
          }
        : null,
      submittedBy: accountReporter?.name || plain.reporter?.name || "Anonymous community reporter",
      contact: accountReporter?.email || accountReporter?.phone || plain.reporter?.contact || "",
      organization: plain.reporter?.organization || "",
      role: accountReporter?.role || plain.reporter?.role || "community_member",
      consentToContact: Boolean(plain.reporter?.consentToContact),
      offlineCreatedAt: plain.submissionMeta?.offlineCreatedAt || null,
      offlineSyncedAt: plain.submissionMeta?.offlineSyncedAt || null,
      appVersion: plain.submissionMeta?.appVersion || "",
      deviceId: plain.submissionMeta?.deviceId || "",
      userAgent: plain.submissionMeta?.userAgent || "",
      ipHash: plain.submissionMeta?.ipHash || ""
    },
    responseTrace: {
      crisisId: plain.crisisId || "default-crisis",
      collectionTime: plain.collectionTime || plain.createdAt,
      version: plain.version || 1,
      duplicateScore: plain.duplicateScore || 0,
      duplicateOf: plain.duplicateOf || null,
      possibleDuplicateIds: plain.possibleDuplicateIds || [],
      buildingFootprint: plain.buildingFootprint || {}
    }
  };
}

function firstAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeImportedReport(item) {
  const lat = Number(item.lat ?? item.location?.lat ?? item.location?.coordinates?.[1]);
  const lng = Number(item.lng ?? item.location?.lng ?? item.location?.coordinates?.[0]);

  if (!String(item.description || "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const infrastructureType = firstAllowed(item.infrastructureType || item.category, infrastructureTypes, "other");
  const category = firstAllowed(item.category || infrastructureType, categories, infrastructureType);
  const locationDescription = String(item.locationDescription || item.addressText || item.location?.address || "").trim();

  return {
    title: String(item.title || "Crisis damage report").trim().slice(0, 120),
    description: String(item.description).trim().slice(0, 1200),
    category,
    infrastructureType,
    infrastructureName: String(item.infrastructureName || "").trim().slice(0, 180),
    assetId: String(item.assetId || item._id || `import-${lat}-${lng}-${Date.now()}`).trim().slice(0, 180),
    language: firstAllowed(item.language || "en", languages, "en"),
    crisisType: firstAllowed(item.crisisType || "other", crisisTypes, "other"),
    damageLevel: firstAllowed(item.damageLevel || "partial", damageLevels, "partial"),
    debris: firstAllowed(item.debris || "unknown", debrisOptions, "unknown"),
    locationDescription,
    addressText: String(item.addressText || locationDescription).trim().slice(0, 300),
    crisisId: String(item.crisisId || "default-crisis").trim().slice(0, 120) || "default-crisis",
    collectionTime: item.collectionTime ? new Date(item.collectionTime) : new Date(),
    reporter: {
      name: String(item.reporter?.name || item.reporterName || "").trim().slice(0, 120),
      contact: String(item.reporter?.contact || item.reporterContact || "").trim().slice(0, 160),
      organization: String(item.reporter?.organization || item.reporterOrganization || "").trim().slice(0, 160),
      role: firstAllowed(item.reporter?.role || item.reporterRole || "community_member", ["community_member", "local_leader", "ngo", "government", "responder", "other"], "community_member"),
      consentToContact: parseBoolean(item.reporter?.consentToContact ?? item.reporterConsent)
    },
    submissionMeta: {
      channel: firstAllowed(item.submissionMeta?.channel || item.channel || "import", ["web", "mobile", "whatsapp", "api", "import"], "import"),
      offlineCreatedAt: item.submissionMeta?.offlineCreatedAt || item.offlineCreatedAt ? new Date(item.submissionMeta?.offlineCreatedAt || item.offlineCreatedAt) : null,
      offlineSyncedAt: item.submissionMeta?.offlineSyncedAt || item.offlineSyncedAt ? new Date(item.submissionMeta?.offlineSyncedAt || item.offlineSyncedAt) : null,
      appVersion: String(item.submissionMeta?.appVersion || item.appVersion || "").trim().slice(0, 80),
      deviceId: String(item.submissionMeta?.deviceId || item.deviceId || "").trim().slice(0, 160)
    },
    buildingFootprint: {
      id: String(item.buildingFootprint?.id || item.buildingFootprintId || item.assetId || "").trim().slice(0, 180),
      name: String(item.buildingFootprint?.name || item.buildingFootprintName || item.infrastructureName || "").trim().slice(0, 180),
      source: String(item.buildingFootprint?.source || item.buildingFootprintSource || "").trim().slice(0, 120),
      ...(item.buildingFootprint?.geometry ? { geometry: item.buildingFootprint.geometry } : {})
    },
    needs: Array.isArray(item.needs) ? item.needs.map((need) => String(need).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [],
    modularAnswers: {
      accessBlocked: parseBoolean(item.modularAnswers?.accessBlocked ?? item.accessBlocked),
      servicesDisrupted: parseBoolean(item.modularAnswers?.servicesDisrupted ?? item.servicesDisrupted),
      livelihoodsAffected: parseBoolean(item.modularAnswers?.livelihoodsAffected ?? item.livelihoodsAffected),
      peopleAtRisk: parseBoolean(item.modularAnswers?.peopleAtRisk ?? item.peopleAtRisk)
    },
    province: String(item.province || "").trim(),
    commune: String(item.commune || "").trim(),
    imageUrl: String(item.imageUrl || item.imageUrls?.[0] || "").trim(),
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.map((url) => String(url).trim()).filter(Boolean).slice(0, 3) : [],
    location: {
      type: "Point",
      coordinates: [lng, lat],
      lat,
      lng,
      address: String(item.address || item.addressText || locationDescription).trim()
    },
    source: firstAllowed(item.source || "guest", ["guest", "user"], "guest"),
    status: firstAllowed(item.status || "pending", statuses, "pending"),
    risk: firstAllowed(item.risk || "suivi", ["suivi", "critique", "danger", "resolved"], "suivi"),
    rejectionReason: String(item.rejectionReason || "").trim(),
    version: Number.isFinite(Number(item.version)) ? Number(item.version) : 1,
    createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
  };
}

async function writeAudit(req, { action, targetType, targetId, summary = "", changes = {} }) {
  if (!req.user?._id || !targetId) return;
  await AdminAudit.create({
    actor: req.user._id,
    action,
    targetType,
    targetId,
    summary,
    changes
  });
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    const identifier = String(email || phone || "").toLowerCase().trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.banned) {
      return res.status(403).json({ message: "Account banned" });
    }

    if (!["admin", "moderator"].includes(user.role)) {
      return res.status(403).json({ message: "Admin or moderator access required" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth, requireRole("admin", "moderator"));

router.post("/version-notifications", requireAdmin, async (req, res, next) => {
  try {
    const { version, adminNotes, userNotes } = req.body;
    const trimmedVersion = String(version || "").trim();
    const trimmedAdminNotes = String(adminNotes || "").trim();
    const trimmedUserNotes = String(userNotes || "").trim();

    if (!trimmedVersion || !trimmedAdminNotes || !trimmedUserNotes) {
      return res.status(400).json({ message: "Version, admin notes and user notes are required" });
    }

    if (trimmedAdminNotes.length > 2000 || trimmedUserNotes.length > 2000) {
      return res.status(400).json({ message: "Version notes cannot exceed 2000 characters" });
    }

    await notifyRoles({
      roles: ["admin", "moderator"],
      type: "version_release",
      title: `Nouvelle version ${trimmedVersion}`,
      message: trimmedAdminNotes
    });

    await notifyRoles({
      roles: ["user"],
      type: "version_release",
      title: `Tala Mboka ${trimmedVersion}`,
      message: trimmedUserNotes
    });

    res.status(201).json({ message: "Version notifications sent" });
  } catch (error) {
    next(error);
  }
});

router.get("/stats", async (_req, res, next) => {
  try {
    const [totalReports, totalUsers, pendingReports, verifiedReports, rejectedReports, damageRows, crisisRows, infrastructureRows, statusRows] = await Promise.all([
      Report.countDocuments(),
      User.countDocuments(),
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({ status: "verified" }),
      Report.countDocuments({ status: "rejected" }),
      Report.aggregate([{ $group: { _id: "$damageLevel", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $group: { _id: "$crisisType", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $group: { _id: "$infrastructureType", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);

    res.json({
      users: totalUsers,
      reports: totalReports,
      pending: pendingReports,
      verified: verifiedReports,
      rejected: rejectedReports,
      totalReports,
      totalUsers,
      pendingReports,
      verifiedReports,
      rejectedReports,
      pendingModerationReports: pendingReports,
      damageBreakdown: damageRows.map((row) => ({ damageLevel: row._id || "partial", count: row.count })),
      crisisBreakdown: crisisRows.map((row) => ({ crisisType: row._id || "other", count: row.count })),
      infrastructureBreakdown: infrastructureRows.map((row) => ({ infrastructureType: row._id || "other", count: row.count })),
      statusBreakdown: statusRows.map((row) => ({ status: row._id || "pending", count: row.count }))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && statuses.includes(req.query.status)) filter.status = req.query.status;

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email phone role banned")
      .populate("duplicateOf", "title damageLevel status version createdAt location")
      .populate("possibleDuplicateIds", "title damageLevel status version createdAt location")
      .lean({ virtuals: true });

    res.json(reports.map(adminReport));
  } catch (error) {
    next(error);
  }
});

router.get("/audit", requireAdmin, async (_req, res, next) => {
  try {
    const entries = await AdminAudit.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actor", "name email phone role")
      .lean();

    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.post("/reports/import", requireAdmin, async (req, res, next) => {
  try {
    const reports = Array.isArray(req.body?.reports) ? req.body.reports : [];

    if (!reports.length || reports.length > 250) {
      return res.status(400).json({ message: "Provide between 1 and 250 reports" });
    }

    let imported = 0;
    const skipped = [];

    for (const item of reports) {
      const normalized = normalizeImportedReport(item);

      if (!normalized) {
        skipped.push({ assetId: item?.assetId || item?._id || "", reason: "invalid report data" });
        continue;
      }

      const existing = normalized.assetId ? await Report.findOne({ assetId: normalized.assetId }) : null;

      if (existing) {
        Object.assign(existing, normalized);
        await existing.save();
      } else {
        await Report.create(normalized);
      }

      imported += 1;
    }

    res.status(201).json({ imported, skipped });
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id/approve", async (req, res, next) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "verified", rejectionReason: "" },
      { new: true }
    ).populate("userId", "name email phone role banned");

    if (!report) return res.status(404).json({ message: "Report not found" });

    await writeAudit(req, {
      action: "report_verified",
      targetType: "report",
      targetId: report._id,
      summary: `${report.title} verified`
    });

    await notifyRoles({
      reportId: report._id,
      type: "report_approved",
      title: "Signalement approuve",
      message: `${report.title} est maintenant visible publiquement.`
    });
    await notifyUser({
      userId: report.userId,
      reportId: report._id,
      type: "report_approved",
      title: "Votre signalement est approuve",
      message: `${report.title} est maintenant publie.`
    });

    res.json(adminReport(report));
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id/reject", async (req, res, next) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejectionReason: String(req.body.reason || "").trim() },
      { new: true }
    ).populate("userId", "name email phone role banned");

    if (!report) return res.status(404).json({ message: "Report not found" });

    await writeAudit(req, {
      action: "report_rejected",
      targetType: "report",
      targetId: report._id,
      summary: `${report.title} rejected`,
      changes: { reason: report.rejectionReason }
    });

    await notifyRoles({
      reportId: report._id,
      type: "report_rejected",
      title: "Signalement rejete",
      message: `${report.title} a ete rejete.`
    });
    await notifyUser({
      userId: report.userId,
      reportId: report._id,
      type: "report_rejected",
      title: "Votre signalement est rejete",
      message: report.rejectionReason || `${report.title} n'a pas ete publie.`
    });

    res.json(adminReport(report));
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!statuses.includes(status)) {
      return res.status(400).json({ message: "Invalid report status" });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, rejectionReason: status === "rejected" ? String(req.body.reason || "").trim() : "" },
      { new: true, runValidators: true }
    ).populate("userId", "name email phone");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    await writeAudit(req, {
      action: "report_status_updated",
      targetType: "report",
      targetId: report._id,
      summary: `${report.title} changed to ${report.status}`,
      changes: { status: report.status }
    });

    await notifyRoles({
      reportId: report._id,
      type: "report_updated",
      title: "Report status updated",
      message: `${report.title} is now ${report.status}.`
    });
    await notifyUser({
      userId: report.userId,
      reportId: report._id,
      type: "report_updated",
      title: "Your report was updated",
      message: `${report.title} is now ${report.status}.`
    });

    res.json(adminReport(report));
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id", upload.array("images", 3), async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      infrastructureType,
      infrastructureName,
      assetId,
      language,
      crisisType,
      damageLevel,
      debris,
      locationDescription,
      modularAnswers,
      province,
      commune,
      status,
      lat,
      lng,
      addressText,
      address,
      reporterName,
      reporterContact,
      reporterOrganization,
      reporterRole,
      reporterConsent,
      channel,
      offlineCreatedAt,
      offlineSyncedAt,
      appVersion,
      deviceId,
      buildingFootprintId,
      buildingFootprintName,
      buildingFootprintSource
    } = req.body;
    const update = {};
    const before = await Report.findById(req.params.id).lean();
    if (!before) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (title !== undefined) update.title = String(title).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (province !== undefined) update.province = String(province).trim();
    if (commune !== undefined) update.commune = String(commune).trim();
    if (category !== undefined) {
      if (!categories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      update.category = category;
    }
    if (infrastructureType !== undefined) {
      if (!infrastructureTypes.includes(infrastructureType)) {
        return res.status(400).json({ message: "Invalid infrastructure type" });
      }
      update.infrastructureType = infrastructureType;
    }
    if (infrastructureName !== undefined) update.infrastructureName = String(infrastructureName).trim();
    if (assetId !== undefined) update.assetId = String(assetId).trim();
    if (language !== undefined) {
      if (!languages.includes(language)) {
        return res.status(400).json({ message: "Invalid language" });
      }
      update.language = language;
    }
    if (crisisType !== undefined) {
      if (!crisisTypes.includes(crisisType)) {
        return res.status(400).json({ message: "Invalid crisis type" });
      }
      update.crisisType = crisisType;
    }
    if (damageLevel !== undefined) {
      if (!damageLevels.includes(damageLevel)) {
        return res.status(400).json({ message: "Invalid damage level" });
      }
      update.damageLevel = damageLevel;
    }
    if (debris !== undefined) {
      if (!debrisOptions.includes(debris)) {
        return res.status(400).json({ message: "Invalid debris value" });
      }
      update.debris = debris;
    }
    if (locationDescription !== undefined) update.locationDescription = String(locationDescription).trim();
    if (
      reporterName !== undefined ||
      reporterContact !== undefined ||
      reporterOrganization !== undefined ||
      reporterRole !== undefined ||
      reporterConsent !== undefined
    ) {
      update.reporter = {
        name: String(reporterName ?? before?.reporter?.name ?? "").trim().slice(0, 120),
        contact: String(reporterContact ?? before?.reporter?.contact ?? "").trim().slice(0, 160),
        organization: String(reporterOrganization ?? before?.reporter?.organization ?? "").trim().slice(0, 160),
        role: firstAllowed(reporterRole || before?.reporter?.role || "community_member", ["community_member", "local_leader", "ngo", "government", "responder", "other"], "community_member"),
        consentToContact: reporterConsent !== undefined ? parseBoolean(reporterConsent) : Boolean(before?.reporter?.consentToContact)
      };
    }
    if (channel !== undefined || offlineCreatedAt !== undefined || offlineSyncedAt !== undefined || appVersion !== undefined || deviceId !== undefined) {
      update.submissionMeta = {
        ...(before?.submissionMeta || {}),
        ...(channel !== undefined ? { channel: firstAllowed(channel, ["web", "mobile", "whatsapp", "api", "import"], "web") } : {}),
        ...(offlineCreatedAt !== undefined ? { offlineCreatedAt: offlineCreatedAt ? new Date(offlineCreatedAt) : null } : {}),
        ...(offlineSyncedAt !== undefined ? { offlineSyncedAt: offlineSyncedAt ? new Date(offlineSyncedAt) : null } : {}),
        ...(appVersion !== undefined ? { appVersion: String(appVersion).trim().slice(0, 80) } : {}),
        ...(deviceId !== undefined ? { deviceId: String(deviceId).trim().slice(0, 160) } : {})
      };
    }
    if (buildingFootprintId !== undefined || buildingFootprintName !== undefined || buildingFootprintSource !== undefined) {
      update.buildingFootprint = {
        ...(before?.buildingFootprint || {}),
        id: String(buildingFootprintId ?? before?.buildingFootprint?.id ?? "").trim().slice(0, 180),
        name: String(buildingFootprintName ?? before?.buildingFootprint?.name ?? "").trim().slice(0, 180),
        source: String(buildingFootprintSource ?? before?.buildingFootprint?.source ?? "").trim().slice(0, 120)
      };
    }
    if (addressText !== undefined || address !== undefined) {
      update.addressText = String(addressText || address || "").trim();
    }
    if (modularAnswers !== undefined && typeof modularAnswers === "object") {
      update.modularAnswers = {
        accessBlocked: parseBoolean(modularAnswers.accessBlocked),
        servicesDisrupted: parseBoolean(modularAnswers.servicesDisrupted),
        livelihoodsAffected: parseBoolean(modularAnswers.livelihoodsAffected),
        peopleAtRisk: parseBoolean(modularAnswers.peopleAtRisk)
      };
    }
    if (status !== undefined) {
      if (!statuses.includes(status)) {
        return res.status(400).json({ message: "Invalid report status" });
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
      if (addressText !== undefined || address !== undefined) {
        update.location.address = String(addressText || address || "").trim();
      }
    }

    const images = await uploadReportImages(uploadedFiles(req));
    if (images.length > 0) {
      update.imageUrl = images[0];
      update.imageUrls = images;
    }

    if (update.title === "" || update.description === "") {
      return res.status(400).json({ message: "Title and description cannot be empty" });
    }

    const report = await Report.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).populate("userId", "name email phone role banned");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    await writeAudit(req, {
      action: "report_edited",
      targetType: "report",
      targetId: report._id,
      summary: `${report.title} edited`,
      changes: { before: { status: before.status, title: before.title }, after: update }
    });

    res.json(adminReport(report));
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

    await writeAudit(req, {
      action: "report_deleted",
      targetType: "report",
      targetId: report._id,
      summary: `${report.title} deleted`
    });

    res.json({ message: "Report deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/users", requireAdmin, async (_req, res, next) => {
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
          email: 1,
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

router.post("/users", requireAdmin, async (req, res, next) => {
  try {
    const { name, email, phone, password, role = "moderator" } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedPhone = String(phone || "").trim();

    if (!name?.trim() || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (!["moderator", "admin"].includes(role)) {
      return res.status(400).json({ message: "Only moderator or admin accounts can be created here" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const duplicateFilter = normalizedPhone
      ? { $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] }
      : { email: normalizedEmail };
    const existingUser = await User.findOne(duplicateFilter);
    if (existingUser) {
      return res.status(409).json({ message: "Admin user already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      password: hashedPassword,
      role
    });

    await writeAudit(req, {
      action: "user_created",
      targetType: "user",
      targetId: user._id,
      summary: `${user.name} created as ${user.role}`
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/ban", requireAdmin, async (req, res, next) => {
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

    await writeAudit(req, {
      action: user.banned ? "user_suspended" : "user_unsuspended",
      targetType: "user",
      targetId: user._id,
      summary: `${user.name} ${user.banned ? "suspended" : "reactivated"}`
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!["user", "moderator", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (req.params.id === req.user._id.toString() && role !== "admin") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await writeAudit(req, {
      action: "user_role_updated",
      targetType: "user",
      targetId: user._id,
      summary: `${user.name} role changed to ${user.role}`,
      changes: { role }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete yourself" });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await writeAudit(req, {
      action: "user_deleted",
      targetType: "user",
      targetId: user._id,
      summary: `${user.name} deleted`
    });

    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
