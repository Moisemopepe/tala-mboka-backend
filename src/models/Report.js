import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1200 },
    category: {
      type: String,
      enum: ["road", "water", "electricity", "waste", "security", "fraud", "kidnapping"],
      required: true
    },
    imageUrl: { type: String, default: "" },
    imageUrls: [{ type: String }],
    province: { type: String, trim: true, default: "" },
    commune: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 }
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["danger", "critique", "suivi", "resolved"],
      default: "suivi"
    }
  },
  { timestamps: true }
);

reportSchema.index({ createdAt: -1 });
reportSchema.index({ category: 1 });

reportSchema.virtual("likesCount").get(function likesCount() {
  return this.likes.length;
});

reportSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Report", reportSchema);
