import { v2 as cloudinary } from "cloudinary";

function clean(value = "") {
  return String(value).trim();
}

function hasCloudinaryConfig() {
  return (
    Boolean(clean(process.env.CLOUDINARY_URL)) ||
    (Boolean(clean(process.env.CLOUDINARY_CLOUD_NAME)) &&
      Boolean(clean(process.env.CLOUDINARY_API_KEY)) &&
      Boolean(clean(process.env.CLOUDINARY_API_SECRET)))
  );
}

function ensureCloudinaryConfig() {
  const cloudinaryUrl = clean(process.env.CLOUDINARY_URL);

  if (cloudinaryUrl) {
    process.env.CLOUDINARY_URL = cloudinaryUrl;
    cloudinary.config({ secure: true });
    return;
  }

  cloudinary.config({
    cloud_name: clean(process.env.CLOUDINARY_CLOUD_NAME),
    api_key: clean(process.env.CLOUDINARY_API_KEY),
    api_secret: clean(process.env.CLOUDINARY_API_SECRET),
    secure: true
  });
}

function uploadBuffer(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: clean(process.env.CLOUDINARY_FOLDER) || "tala-mboka/reports",
        resource_type: "image",
        transformation: [
          { width: 1600, height: 1200, crop: "limit" },
          { quality: "auto", fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload failed:", error.message);
          const uploadError = new Error("Impossible d'envoyer l'image pour le moment. Verifiez la configuration Cloudinary.");
          uploadError.status = 502;
          return reject(uploadError);
        }
        resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
}

export async function uploadReportImages(files = []) {
  if (!files.length) return [];

  if (!hasCloudinaryConfig()) {
    const error = new Error("Le stockage image n'est pas configure.");
    error.status = 500;
    throw error;
  }

  ensureCloudinaryConfig();
  return Promise.all(files.map((file) => uploadBuffer(file)));
}
