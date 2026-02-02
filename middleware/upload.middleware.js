const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { queryWithUser } = require("../config/db-trace-wrapper");

// Configuration de sécurité pour les uploads
const UPLOAD_CONFIG = {
  // Taille maximale : 10 MB
  maxFileSize: 10 * 1024 * 1024,

  // Types MIME autorisés (Excel uniquement pour les catalogues)
  allowedMimeTypes: [
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ],

  // Extensions autorisées
  allowedExtensions: [".xls", ".xlsx"],

  // Répertoire de destination
  uploadDir: "uploads/",
};

// Créer le répertoire uploads s'il n'existe pas
if (!fs.existsSync(UPLOAD_CONFIG.uploadDir)) {
  fs.mkdirSync(UPLOAD_CONFIG.uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_CONFIG.uploadDir);
  },
  filename: function (req, file, cb) {
    // Générer un nom de fichier sécurisé unique
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();

    // Sanitize le nom de fichier original
    const sanitizedName = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]/gi, "_")
      .substring(0, 50); // Limiter la longueur

    cb(null, sanitizedName + "-" + uniqueSuffix + ext);
  },
});

// Filtre de validation des fichiers
const fileFilter = function (req, file, cb) {
  // 1. Vérifier le type MIME
  if (!UPLOAD_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error(
        `Type de fichier non autorisé. Types acceptés : ${UPLOAD_CONFIG.allowedExtensions.join(
          ", "
        )}`
      ),
      false
    );
  }

  // 2. Vérifier l'extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
    return cb(
      new Error(
        `Extension de fichier non autorisée. Extensions acceptées : ${UPLOAD_CONFIG.allowedExtensions.join(
          ", "
        )}`
      ),
      false
    );
  }

  // 3. Vérifier que le nom de fichier ne contient pas de caractères dangereux
  const filename = file.originalname;
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return cb(new Error("Nom de fichier invalide."), false);
  }

  // Tout est OK
  cb(null, true);
};

// Middleware multer configuré avec sécurité
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.maxFileSize,
    files: 1, // Un seul fichier à la fois
  },
});

// Middleware de validation post-upload
const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const file = req.file;
  const filePath = file.path;

  try {
    // 1. Vérifier que le fichier existe réellement
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        error: "Le fichier uploadé est introuvable.",
      });
    }

    // 2. Vérifier la taille réelle du fichier sur le disque
    const stats = fs.statSync(filePath);
    if (stats.size > UPLOAD_CONFIG.maxFileSize) {
      fs.unlinkSync(filePath); // Supprimer le fichier
      return res.status(400).json({
        error: `Fichier trop volumineux. Taille maximale : ${
          UPLOAD_CONFIG.maxFileSize / 1024 / 1024
        } MB`,
      });
    }

    // 3. Vérifier que le fichier n'est pas vide
    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: "Le fichier est vide.",
      });
    }

    // 4. Vérification supplémentaire du contenu du fichier (magic bytes)
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // Vérifier les magic bytes pour Excel
    const isValidExcel = isExcelFile(buffer, file.originalname);
    if (!isValidExcel) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: "Le fichier n'est pas un fichier Excel valide.",
      });
    }

    // Tout est OK, continuer
    next();
  } catch (error) {
    // En cas d'erreur, supprimer le fichier si possible
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.status(500).json({
      error: "Erreur lors de la validation du fichier.",
    });
  }
};

// Fonction de vérification des magic bytes Excel
function isExcelFile(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".xlsx") {
    // XLSX est un fichier ZIP (commence par PK)
    // Magic bytes: 50 4B 03 04 ou 50 4B 05 06 ou 50 4B 07 08
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
      (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
    );
  } else if (ext === ".xls") {
    // XLS (format binaire BIFF8)
    // Magic bytes: D0 CF 11 E0 A1 B1 1A E1 (OLE2/CFB)
    return (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    );
  }

  return false;
}

// Middleware de gestion des erreurs multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Erreurs spécifiques à multer
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `Fichier trop volumineux. Taille maximale : ${
          UPLOAD_CONFIG.maxFileSize / 1024 / 1024
        } MB`,
      });
    } else if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Trop de fichiers. Un seul fichier autorisé.",
      });
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Nom de champ de fichier inattendu.",
      });
    } else {
      return res.status(400).json({
        error: `Erreur d'upload : ${err.message}`,
      });
    }
  } else if (err) {
    // Autres erreurs (par exemple, fileFilter)
    return res.status(400).json({
      error: err.message,
    });
  }
  next();
};

// Fonction de nettoyage des fichiers temporaires
const cleanupFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Fichier temporaire supprimé : ${filePath}`);
    }
  } catch (error) {
    console.error(
      `❌ Erreur lors de la suppression du fichier ${filePath}:`,
      error
    );
  }
};

// Exporter les middlewares et utilitaires
module.exports = {
  upload,
  validateUploadedFile,
  handleMulterError,
  cleanupFile,
  UPLOAD_CONFIG,
};
