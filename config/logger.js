const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Créer le répertoire logs s'il n'existe pas
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuration des niveaux de log
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Format personnalisé pour les logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Format pour la console (plus lisible)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      // Ne pas logger les détails en production (sécurité)
      if (process.env.NODE_ENV !== "production") {
        msg += ` ${JSON.stringify(meta, null, 2)}`;
      }
    }
    return msg;
  })
);

// Créer le logger Winston
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: logFormat,
  transports: [
    // Fichier pour les erreurs uniquement
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Fichier pour tous les logs
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Fichier pour les logs de sécurité (séparé)
    new winston.transports.File({
      filename: path.join(logsDir, "security.log"),
      level: "warn",
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// Ajouter la console seulement en développement
if (process.env.NODE_ENV !== "production") {
  // Ajout console uniquement pour les logs hors niveau 'http'
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format((info) => {
          // Ignore les logs de niveau 'http' pour la console
          return info.level === "http" ? false : info;
        })(),
        consoleFormat
      ),
    })
  );
}

// Fonction de logging sécurisé qui masque les données sensibles
function sanitizeData(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "privateKey",
    "private_key",
    "sessionId",
    "session_id",
    "csrfToken",
    "csrf_token",
    "authorization",
    "cookie",
    "smtp_pass",
    "db_pass",
  ];

  const sanitized = { ...data };

  for (const key in sanitized) {
    if (
      sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
    ) {
      sanitized[key] = "***HIDDEN***";
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

// Wrapper pour les méthodes de logging
const safeLogger = {
  error: (message, meta = {}) => {
    logger.error(message, sanitizeData(meta));
  },

  warn: (message, meta = {}) => {
    logger.warn(message, sanitizeData(meta));
  },

  info: (message, meta = {}) => {
    logger.info(message, sanitizeData(meta));
  },

  http: (message, meta = {}) => {
    logger.http(message, sanitizeData(meta));
  },

  debug: (message, meta = {}) => {
    // Debug logs uniquement en développement
    if (process.env.NODE_ENV !== "production") {
      logger.debug(message, sanitizeData(meta));
    }
  },

  // Log de sécurité spécial (toujours enregistré)
  security: (message, meta = {}) => {
    logger.warn(`🔒 [SECURITY] ${message}`, sanitizeData(meta));
  },
};

// Remplacer console.log/error en production
if (process.env.NODE_ENV === "production") {
  // Sauvegarder les méthodes originales
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;

  // Remplacer console.log par le logger
  console.log = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    safeLogger.info(message);
  };

  console.error = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    safeLogger.error(message);
  };

  console.warn = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    safeLogger.warn(message);
  };

  console.info = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    safeLogger.info(message);
  };

  // Permettre de restaurer les méthodes originales si nécessaire
  console.restore = () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
  };
}

// Middleware Express pour logger les requêtes HTTP
// En production : ne logger que les réponses 4xx/5xx (ANALYSE_PERFORMANCES § 3.5)
const httpLogger = (req, res, next) => {
  const start = Date.now();

  if (process.env.NODE_ENV !== "production") {
    safeLogger.http("Incoming request", {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      safeLogger.error("Server error", logData);
    } else if (res.statusCode >= 400) {
      safeLogger.warn("Client error", logData);
    } else if (process.env.NODE_ENV !== "production") {
      safeLogger.http("Request completed", logData);
    }
  });

  next();
};

module.exports = {
  logger: safeLogger,
  httpLogger,
  sanitizeData,
  logsDir,
};
