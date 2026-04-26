import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, trim: true, maxlength: 30 },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    banned: { type: Boolean, default: false }
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model("User", userSchema);
