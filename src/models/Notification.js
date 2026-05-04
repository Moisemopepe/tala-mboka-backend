import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    roles: [{ type: String, enum: ["user", "admin", "moderator"] }],
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
    type: {
      type: String,
      enum: ["report_created", "report_approved", "report_rejected", "report_updated", "version_release"],
      required: true
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ roles: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
