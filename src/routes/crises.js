import express from "express";
import Crisis from "../models/Crisis.js";
import { requireAdmin, requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const crisisTypes = ["earthquake", "flood", "conflict", "fire", "explosion", "chemical_incident", "tsunami", "hurricane", "wildfire", "civil_unrest", "other"];
const statuses = ["active", "monitoring", "closed"];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function normalizeCrisis(body) {
  const name = String(body.name || "").trim();
  if (!name) return { message: "Crisis name is required" };

  const slug = slugify(body.slug || name);
  if (!slug) return { message: "Crisis slug is required" };

  return {
    value: {
      name,
      slug,
      type: crisisTypes.includes(body.type) ? body.type : "other",
      country: String(body.country || "DRC").trim().slice(0, 120),
      region: String(body.region || "").trim().slice(0, 160),
      description: String(body.description || "").trim().slice(0, 700),
      status: statuses.includes(body.status) ? body.status : "active",
      startsAt: body.startsAt ? new Date(body.startsAt) : new Date()
    }
  };
}

async function ensureDefaultCrises() {
  const count = await Crisis.countDocuments();
  if (count > 0) return;
  await Crisis.create([
    {
      name: "Kinshasa Flood Response",
      slug: "kinshasa-flood-response",
      type: "flood",
      country: "DRC",
      region: "Kinshasa",
      description: "Active crisis workspace for flood-related community damage reports."
    },
    {
      name: "Eastern DRC Multi-Hazard Monitoring",
      slug: "eastern-drc-monitoring",
      type: "other",
      country: "DRC",
      region: "North Kivu",
      status: "monitoring",
      description: "Monitoring workspace for earthquake, conflict, landslide, and infrastructure damage signals."
    }
  ]);
}

router.get("/", async (_req, res, next) => {
  try {
    await ensureDefaultCrises();
    const crises = await Crisis.find({ status: { $in: ["active", "monitoring"] } }).sort({ status: 1, startsAt: -1 }).lean();
    res.json(crises);
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth, requireRole("admin", "moderator"));

router.get("/admin", async (_req, res, next) => {
  try {
    await ensureDefaultCrises();
    const crises = await Crisis.find().sort({ startsAt: -1 }).lean();
    res.json(crises);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const parsed = normalizeCrisis(req.body);
    if (parsed.message) return res.status(400).json({ message: parsed.message });
    const crisis = await Crisis.create(parsed.value);
    res.status(201).json(crisis);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Crisis already exists" });
    next(error);
  }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const parsed = normalizeCrisis(req.body);
    if (parsed.message) return res.status(400).json({ message: parsed.message });
    const crisis = await Crisis.findByIdAndUpdate(req.params.id, parsed.value, { new: true, runValidators: true });
    if (!crisis) return res.status(404).json({ message: "Crisis not found" });
    res.json(crisis);
  } catch (error) {
    next(error);
  }
});

export default router;
