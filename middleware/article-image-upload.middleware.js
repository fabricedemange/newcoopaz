const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOADS_BASE_DIR = path.join(__dirname, "..", "uploads");

const IMAGE_UPLOAD_CONFIG = {
  maxFileSize: 8 * 1024 * 1024, // 8 MB
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  uploadDir: path.join(UPLOADS_BASE_DIR, "tmp-article-images"),
};

if (!fs.existsSync(IMAGE_UPLOAD_CONFIG.uploadDir)) {
  fs.mkdirSync(IMAGE_UPLOAD_CONFIG.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMAGE_UPLOAD_CONFIG.uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "").toLowerCase() || ".img";

    const sanitizedBase = path
      .basename(file.originalname || "upload", ext)
      .replace(/[^a-z0-9_-]/gi, "_")
      .substring(0, 50);

    cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = function (req, file, cb) {
  if (!IMAGE_UPLOAD_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error(
        `Type d'image non autorisé (${file.mimetype}). Formats acceptés: JPG, PNG, WEBP (HEIC/HEIF selon support serveur).`
      ),
      false
    );
  }

  const filename = file.originalname || "";
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return cb(new Error("Nom de fichier invalide."), false);
  }

  cb(null, true);
};

const articleImageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: IMAGE_UPLOAD_CONFIG.maxFileSize,
    files: 1,
  },
});

const cleanupFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // best-effort
  }
};

module.exports = {
  articleImageUpload,
  IMAGE_UPLOAD_CONFIG,
  cleanupFile,
};
