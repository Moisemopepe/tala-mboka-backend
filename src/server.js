import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import reportRoutes from "./routes/reports.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tala-mboka-api" });
});

app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const port = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => {
      console.log(`Tala Mboka API running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });
