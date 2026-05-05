import mongoose from "mongoose";

const adminAuditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    targetType: { type: String, enum: ["report", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    summary: { type: String, trim: true, default: "", maxlength: 500 },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

adminAuditSchema.index({ createdAt: -1 });
adminAuditSchema.index({ actor: 1, createdAt: -1 });
adminAuditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.model("AdminAudit", adminAuditSchema);
