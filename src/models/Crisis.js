import mongoose from "mongoose";

const crisisSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["earthquake", "flood", "conflict", "fire", "explosion", "chemical_incident", "tsunami", "hurricane", "wildfire", "civil_unrest", "other"],
      default: "other"
    },
    country: { type: String, trim: true, default: "DRC", maxlength: 120 },
    region: { type: String, trim: true, default: "", maxlength: 160 },
    description: { type: String, trim: true, default: "", maxlength: 700 },
    status: { type: String, enum: ["active", "monitoring", "closed"], default: "active" },
    startsAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

crisisSchema.index({ status: 1, startsAt: -1 });
crisisSchema.index({ type: 1 });

export default mongoose.model("Crisis", crisisSchema);
