import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1200 },
    category: {
      type: String,
      enum: [
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
      ],
      required: true
    },
    infrastructureType: {
      type: String,
      enum: ["residential", "commercial", "government", "utility", "transport", "communication", "health", "education", "public_space", "community", "other"],
      default: "other"
    },
    infrastructureName: { type: String, trim: true, default: "", maxlength: 180 },
    assetId: { type: String, trim: true, default: "", maxlength: 180 },
    language: {
      type: String,
      enum: ["ar", "zh", "en", "fr", "ru", "es"],
      default: "en"
    },
    crisisType: {
      type: String,
      enum: ["earthquake", "flood", "conflict", "fire", "explosion", "chemical_incident", "tsunami", "hurricane", "wildfire", "civil_unrest", "other"],
      default: "other"
    },
    damageLevel: {
      type: String,
      enum: ["minimal", "partial", "complete"],
      default: "partial"
    },
    debris: {
      type: String,
      enum: ["unknown", "no", "yes"],
      default: "unknown"
    },
    locationDescription: { type: String, trim: true, default: "", maxlength: 300 },
    addressText: { type: String, trim: true, default: "", maxlength: 300 },
    needs: [{ type: String, trim: true, maxlength: 80 }],
    modularAnswers: {
      accessBlocked: { type: Boolean, default: false },
      servicesDisrupted: { type: Boolean, default: false },
      livelihoodsAffected: { type: Boolean, default: false },
      peopleAtRisk: { type: Boolean, default: false }
    },
    province: { type: String, trim: true, default: "" },
    commune: { type: String, trim: true, default: "" },
    imageUrl: { type: String, default: "" },
    imageUrls: [{ type: String }],
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator(value) {
            return !value || value.length === 2;
          },
          message: "Coordinates must be [longitude, latitude]"
        }
      },
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
      address: { type: String, trim: true, default: "" }
    },
    source: { type: String, enum: ["guest", "user"], required: true },
    ip: { type: String, default: "" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    possibleDuplicateIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
    duplicateScore: { type: Number, default: 0, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },
    risk: {
      type: String,
      enum: ["suivi", "critique", "danger", "resolved"],
      default: "suivi"
    },
    rejectionReason: { type: String, trim: true, default: "" },
    version: { type: Number, default: 1, min: 1 }
  },
  { timestamps: true }
);

reportSchema.index({ createdAt: -1 });
reportSchema.index({ category: 1 });
reportSchema.index({ crisisType: 1, damageLevel: 1 });
reportSchema.index({ assetId: 1 });
reportSchema.index({ location: "2dsphere" });

reportSchema.pre("validate", function syncGeoFields(next) {
  if (this.location?.lat !== undefined && this.location?.lng !== undefined) {
    this.location.type = "Point";
    this.location.coordinates = [Number(this.location.lng), Number(this.location.lat)];
  }
  if (!this.addressText && (this.locationDescription || this.location?.address)) {
    this.addressText = this.locationDescription || this.location.address;
  }
  if (!this.duplicateOf && this.possibleDuplicateIds?.length) {
    this.duplicateOf = this.possibleDuplicateIds[0];
  }
  if (!this.createdBy && this.userId) {
    this.createdBy = this.userId;
  }
  next();
});

reportSchema.virtual("likesCount").get(function likesCount() {
  return this.likes.length;
});

reportSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Report", reportSchema);
