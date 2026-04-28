import { v2 as cloudinary } from "cloudinary";

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
    const error = new Error("Image storage is not configured");
    error.status = 500;
    throw error;
  }

  ensureCloudinaryConfig();
  return Promise.all(files.map((file) => uploadBuffer(file)));
}
