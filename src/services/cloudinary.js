import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localUploadDir = path.join(__dirname, "..", "uploads");

function hasCloudinaryConfig() {
  return (
    Boolean(process.env.CLOUDINARY_URL) ||
    (Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
      Boolean(process.env.CLOUDINARY_API_KEY) &&
      Boolean(process.env.CLOUDINARY_API_SECRET))
  );
}

function ensureCloudinaryConfig() {
  if (process.env.CLOUDINARY_URL) return;
  if (!hasCloudinaryConfig()) return;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function uploadBuffer(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "tala-mboka/reports",
        resource_type: "image",
        transformation: [
          { width: 1600, height: 1200, crop: "limit" },
          { quality: "auto", fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
}

export async function uploadReportImages(files = []) {
  if (!files.length) return [];

  if (!hasCloudinaryConfig()) {
    await fs.mkdir(localUploadDir, { recursive: true });
    return Promise.all(files.map(saveLocalImage));
  }

  ensureCloudinaryConfig();
  return Promise.all(files.map((file) => uploadBuffer(file)));
}

async function saveLocalImage(file) {
  const extension = path.extname(file.originalname || "") || extensionFromMime(file.mimetype);
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  await fs.writeFile(path.join(localUploadDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

function extensionFromMime(mimetype = "") {
  if (mimetype.includes("png")) return ".png";
  if (mimetype.includes("webp")) return ".webp";
  return ".jpg";
}
