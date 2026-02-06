// Préserver NODE_ENV=test (Jest) pour ne pas être écrasé par .env
const nodeEnvBeforeDotenv = process.env.NODE_ENV;
require("dotenv").config({ override: true });
if (nodeEnvBeforeDotenv === "test") process.env.NODE_ENV = "test";

// Validation des variables d'environnement critiques
const requiredEnvVars = [
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "SESSION_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(
    "❌ Variables d'environnement manquantes :",
    missingVars.join(", ")
  );
  console.error("Veuillez configurer ces variables dans votre fichier .env");
  process.exit(1);
}

console.log(
  "✅ Toutes les variables d'environnement critiques sont configurées"
);

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const {
  requireLogin,
  injectBandeaux,
  handleCSRFError,
  handle404,
} = require("./middleware/middleware");

// Import du cache des bandeaux
const { getBandeaux } = require("./utils/bandeaux-cache");
// Cache des rôles utilisateur (évite 1 requête SQL par requête HTTP)
const { getDisplayRoles } = require("./utils/user-roles-cache");

// Import du logger sécurisé
const { logger, httpLogger, logsDir } = require("./config/logger");
const logsPath = (logsDir && path.resolve(logsDir)) || path.join(__dirname, "logs");
console.log("Logs écrits dans:", logsPath);
const { debugLog } = require("./utils/logger-helpers");
const {
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentUsername,
  getOriginalUser,
  isImpersonating,
} = require("./utils/session-helpers");

// Import des services
const emailService = require("./services/email.service");
const { startEmailQueueWorker } = require("./services/email-queue.service");
const {
  startCatalogueOrderReminderWorker,
} = require("./services/catalogue-order-reminder.service");
const {
  startCatalogueAutoArchiveScheduler,
} = require("./services/catalogue-auto-archive.service");
const pdfService = require("./services/pdf.service");
const excelService = require("./services/excel.service");

// Import de la route organisations admin
const adminOrganizationsRoutes = require("./routes/admin_organizations.routes");

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pageCibleMatches = (pageCible, urlPath, viewName) => {
  if (!pageCible || pageCible.trim() === "" || pageCible === "*") {
    return true;
  }

  if (pageCible === urlPath || pageCible === viewName) {
    return true;
  }

  if (!pageCible.includes("*")) {
    return false;
  }

  const wildcardPattern = escapeRegex(pageCible).replace(/\\\*/g, ".*");
  const matcher = new RegExp(`^${wildcardPattern}$`);
  return matcher.test(urlPath) || matcher.test(viewName);
};

const app = express();

// Cache busting: version basée sur le timestamp de démarrage du serveur
const APP_VERSION = Date.now();
app.locals.APP_VERSION = APP_VERSION;

// En dehors du mode test : démarrer les workers (évite connexions DB/Redis en tests)
if (process.env.NODE_ENV !== "test") {
  startEmailQueueWorker();
  startCatalogueOrderReminderWorker();
  startCatalogueAutoArchiveScheduler();
  logger.info("Workers démarrés (email, rappel catalogue, auto-archive)", {
    logsPath,
    isMainModule: require.main === module,
  });
}

// Compression Gzip pour toutes les réponses
app.use(compression());

// Configuration Helmet - Sécurité des headers HTTP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdn.datatables.net",
          "https://stackpath.bootstrapcdn.com",
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Requis pour Vue.js
          "https://cdn.jsdelivr.net",
          "https://code.jquery.com",
          "https://cdn.datatables.net",
          "https://stackpath.bootstrapcdn.com",
          "https://unpkg.com",
          "http://localhost:3200", // Vite dev (page /vue-dev)
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://cdn.jsdelivr.net", // Pour les source maps
        ],
        fontSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://stackpath.bootstrapcdn.com",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        // Ne pas forcer HTTPS en développement
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // Désactiver HSTS en développement (HTTP), activer uniquement en production (HTTPS)
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
    frameguard: {
      action: "deny",
    },
    noSniff: true,
    xssFilter: true,
  })
);

// Import de la configuration DB depuis config/config.js
const { db } = require("./config/config");

// Configuration trust proxy - SÉCURITÉ
// L'application tourne derrière un reverse proxy (nginx/Passenger)
// On fait confiance UNIQUEMENT au premier proxy (pas à tous)
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
// public/ contient les assets statiques ; public/dist/ = build Vite (frontend)
app.use(
  express.static("public", {
    maxAge: "1d", // Cache 1 jour pour les assets statiques
    etag: true,
  })
);

// Servir les fichiers uploadés via /uploads (produits dans public/uploads, reste dans uploads/)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "public", "uploads"), {
    maxAge: "1d",
    etag: true,
    dotfiles: "deny",
  })
);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d",
    etag: true,
    dotfiles: "deny",
    fallthrough: false,
  })
);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json({ limit: "5mb" }));

// Logger HTTP automatique - Log toutes les requêtes
app.use(httpLogger);

// gestion de l'expiration de session à 1 heure, sauf action utilisateur
let sessionStore;
if (process.env.NODE_ENV === "test") {
  sessionStore = new (require("express-session").MemoryStore)();
} else {
  const MySQLStore = require("express-mysql-session")(session);
  const options = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  };
  sessionStore = new MySQLStore(options);
}

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "session_cookie_name",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
    rolling: true,
  })
);

// Protection CSRF - Middleware
app.use(cookieParser());
const csrfProtection = require("./config/csrf");
app.use((req, res, next) => {
  const contentType = req.headers && req.headers["content-type"];
  // Skip CSRF validation for multipart/form-data (file uploads)
  if (contentType && contentType.indexOf("multipart/form-data") !== -1) {
    return next();
  }
  // En test : permettre POST /test/session sans token pour les tests RBAC
  const pathname = (req.originalUrl || req.url || req.path || "").split("?")[0];
  if (process.env.NODE_ENV === "test" && pathname === "/test/session") {
    return next();
  }
  csrfProtection(req, res, next);
});

// Route de test (NODE_ENV=test uniquement) pour créer une session mockée (RBAC 403)
if (process.env.NODE_ENV === "test") {
  app.post("/test/session", (req, res) => {
    req.session.userId = 999;
    req.session.rbac_enabled = true;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(204).end();
    });
  });
}

// Injection du token CSRF dans toutes les vues
app.use((req, res, next) => {
  if (typeof req.csrfToken === "function") {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

app.use((req, res, next) => {
  req.session.lastPing = Date.now();
  next();
});

// Gestion des erreurs CSRF
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    logger.warn("Erreur CSRF détectée", {
      error: err.message,
      ip: req.ip,
      url: req.url,
    });
    return res.status(403).render("404", {
      message: "Token de sécurité invalide. Veuillez réessayer.",
      user: getCurrentUsername(req),
      role: getCurrentUserRole(req)
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  // Gestion spéciale des erreurs Multer
  if (err.name === 'MulterError') {
    logger.error("Erreur Multer", {
      code: err.code,
      field: err.field,
      message: err.message,
      url: req.url
    });
    console.error('❌ MULTER ERROR - Code:', err.code);
    console.error('❌ MULTER ERROR - Field:', err.field);
    console.error('❌ MULTER ERROR - Message:', err.message);

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).send(`Champ fichier inattendu: '${err.field}'. Le champ attendu est 'image'.`);
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('Fichier trop volumineux (maximum 5MB).');
    }
    return res.status(400).send('Erreur lors de l\'upload: ' + err.message);
  }

  logger.error("Erreur serveur", {
    error: err.message,
    url: req.url,
    method: req.method,
    stack: err.stack
  });

  // Détection requête API (commence par /api/)
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Une erreur serveur est survenue'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  }

  // Pour les requêtes HTML, retourner page d'erreur
  res.status(500).send("Une erreur serveur est survenue.");
});

// Import des routes
const authRoutes = require("./routes/auth.routes");
const indexRoutes = require("./routes/index.routes");
const cataloguesRoutes = require("./routes/catalogues.routes");
const panierRoutes = require("./routes/panier.routes");
const commandesRoutes = require("./routes/commandes.routes");
const adminRoutes = require("./routes/admin.routes");
const apiRoutes = require("./routes/api.routes");
const apiHomeRoutes = require("./routes/api.home.routes");
const apiCataloguesRoutes = require("./routes/api.catalogues.routes");
const apiPanierRoutes = require("./routes/api.panier.routes");
const apiCommandesRoutes = require("./routes/api.commandes.routes");
const apiAdminRoutes = require("./routes/api.admin.routes");
const apiAdminCataloguesRoutes = require("./routes/api.admin.catalogues.routes");
const apiAdminProductsRoutes = require("./routes/api.admin.products.routes");
const apiAdminCategoriesRoutes = require("./routes/api.admin.categories.routes");
const apiAdminSuppliersRoutes = require("./routes/api.admin.suppliers.routes");
const suppliersRoutes = require("./routes/suppliers.routes");
const categoriesRoutes = require("./routes/categories.routes");
const productsRoutes = require("./routes/products.routes");

// RBAC Routes
const apiRolesRoutes = require("./routes/api.admin.roles.routes");
const apiPermissionsRoutes = require("./routes/api.admin.permissions.routes");
const apiUserRolesRoutes = require("./routes/api.admin.user-roles.routes");
const apiUsersRoutes = require("./routes/api.admin.users.routes");

// Stats, Trace, Email Queue, Bandeaux, Organizations Routes
const apiTraceRoutes = require("./routes/api.admin.trace.routes");
const apiEmailQueueRoutes = require("./routes/api.admin.email-queue.routes");
const apiMaintenanceRoutes = require("./routes/api.admin.maintenance.routes");
const apiStatsRoutes = require("./routes/api.admin.stats.routes");
const apiBandeauxRoutes = require("./routes/api.admin.bandeaux.routes");
const apiOrganizationsRoutes = require("./routes/api.admin.organizations.routes");

// Routes caisse
const caisseRoutes = require("./routes/caisse.routes");
const apiCaisseProduitsRoutes = require("./routes/api.caisse.produits.routes");
const apiCaisseVentesRoutes = require("./routes/api.caisse.ventes.routes");
const apiCaissePaiementsRoutes = require("./routes/api.caisse.paiements.routes");
const apiCaisseModePaiementRoutes = require("./routes/api.caisse.modes-paiement.routes");
const apiCaisseUtilisateursRoutes = require("./routes/api.caisse.utilisateurs.routes");
const apiCaissePaniersVentesRoutes = require("./routes/api.caisse.paniers-ventes.routes");
const apiCaisseVentesHistoriqueRoutes = require("./routes/api.caisse.ventes-historique.routes");
const apiCaisseCommandesRoutes = require("./routes/api.caisse.commandes.routes");
const apiCaisseCotisationRoutes = require("./routes/api.caisse.cotisation.routes");
const apiCaisseInventaireRoutes = require("./routes/api.caisse.inventaire.routes");

// --- Middleware: inject user/admin info and bandeaux in views ---
app.use(async (req, res, next) => {
  try {
    // Cache busting pour les fichiers JS Vue.js
    res.locals.APP_VERSION = app.locals.APP_VERSION;

    res.locals.user = getCurrentUsername(req);
    res.locals.userId = getCurrentUserId(req);
    res.locals.role = getCurrentUserRole(req);
    res.locals.rbac_enabled = req.session?.rbac_enabled || false;

    // Load user's RBAC roles for display (via cache pour éviter 1 SQL par requête)
    if (req.session?.userId) {
      res.locals.userRoles = await getDisplayRoles(req.session.userId);
    } else {
      res.locals.userRoles = [];
    }

    // Inject user permissions for RBAC users
    if (req.session?.rbac_enabled && req.session?.userId) {
      const { getUserPermissions } = require('./middleware/rbac.middleware');
      const permissions = await getUserPermissions(req.session.userId);
      res.locals.userPermissions = Array.from(permissions);

      // Debug: log permissions loading
      if (res.locals.userPermissions.length === 0) {
        console.log('[app.js] ⚠️  User has rbac_enabled but 0 permissions!', {
          userId: req.session.userId,
          username: req.session.username
        });
      }
    } else {
      res.locals.userPermissions = [];

      // Debug: why permissions not loaded?
      if (req.session?.userId) {
        console.log('[app.js] ⚠️  Permissions NOT loaded - rbac_enabled:', req.session.rbac_enabled);
      }
    }
  } catch (error) {
    // Session invalide, définir les valeurs par défaut
    res.locals.user = null;
    res.locals.userId = null;
    res.locals.role = null;
    res.locals.rbac_enabled = false;
    res.locals.userPermissions = [];
    res.locals.userRoles = [];
  }

  const impersonationActive = isImpersonating(req);
  res.locals.isImpersonating = impersonationActive;
  if (impersonationActive) {
    const originalUser = getOriginalUser(req);
    res.locals.impersonationContext = {
      original: originalUser || null,
      target: {
        id: req.session?.userId || null,
        username: req.session?.username || null,
        role: req.session?.role || null,
      },
    };
  } else {
    res.locals.impersonationContext = null;
  }

  const originalRender = res.render.bind(res);
  res.render = function (view, options, callback) {
    // logger.debug(`Vue appelée : ${view}`);

    // Ne pas injecter automatiquement les bandeaux pour les vues d'administration des bandeaux
    if (view === "admin_bandeau_form" || view === "admin_bandeau_edit") {
      return originalRender(view, options, callback);
    }

    // Filtrage avancé des bandeaux selon la page cible
    const urlPath = req.originalUrl;
    const viewName = "/" + view.replace(/_/g, "/");
    // On prépare le pattern pour le LIKE si wildcard
    const likePattern = urlPath.replace(/\d+/g, "%"); // remplace les ID numériques par %
    let orgId = null;
    try {
      orgId = getCurrentOrgId(req);
    } catch (error) {
      // Utilisateur non authentifié, orgId reste null
    }
    try {
      getCurrentUsername(req); // Vérifier que la session est valide
      logger.debug(
        "TRACE : username :" +
          getCurrentUsername(req) +
          " role:" +
          getCurrentUserRole(req) +
          " url:" +
          req.originalUrl +
          " view:" +
          view
      );
      // suivi des actions utilisateurs sur les vues
      // db.query(
      //   "INSERT INTO trace (created_at, username, role, chemin) VALUES (NOW(), ?, ?, ?)",
      //   [req.session.username, req.session.role, req.originalUrl + " (" + view + ")"],
      //   (err) => {
      //   if (err) console.error("Erreur insertion trace:", err);
      //   }
      //  );
    } catch (error) {
      // Session invalide, ignorer le tracing
    }

    // Cache bandeaux pré-filtré par org (voir utils/bandeaux-cache.js, ANALYSE_PERFORMANCES § 3.2)
    getBandeaux(orgId, (err, allBandeaux) => {
      if (err) {
        logger.error("Erreur lors de la récupération des bandeaux", {
          error: err.message,
          view: viewName,
        });
        allBandeaux = [];
      }

      // Filtrage page cible uniquement (organisation déjà filtrée en SQL/cache)
      const bandeaux = (allBandeaux || [])
        .filter((bandeau) => pageCibleMatches(bandeau.page_cible, urlPath, viewName))
        .sort((a, b) => {
          // Trier par date d'expiration
          if (!a.expiration_date && !b.expiration_date) return 0;
          if (!a.expiration_date) return 1;
          if (!b.expiration_date) return -1;
          return new Date(a.expiration_date) - new Date(b.expiration_date);
        });

      const mergedOptions = {
        ...options,
        bandeaux: bandeaux || [],
        APP_VERSION: res.locals.APP_VERSION, // Cache busting
      };

      return originalRender(view, mergedOptions, callback);
    });
  };

  next();
});

// Middleware global compatible MySQL
// HelpText middleware removed - feature disabled

// Middleware maintenance : en mode maintenance, seul le super admin peut accéder
const { maintenanceMiddleware } = require("./middleware/maintenance.middleware");
app.use(maintenanceMiddleware);

// Import du middleware de traçage
//const { traceActionsMiddleware } = require("./middleware/trace.middleware");
//app.use(traceActionsMiddleware);
//app.use(require("./middleware/trace.middleware").traceActionsMiddleware);

// UTILISATION DES ROUTES
app.use("/", authRoutes);
app.use("/", indexRoutes);
app.use("/catalogues", cataloguesRoutes);
app.use("/panier", panierRoutes);
app.use("/commandes", commandesRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/organizations", adminOrganizationsRoutes);
app.use("/admin/suppliers", suppliersRoutes);
app.use("/admin/categories", categoriesRoutes);
app.use("/admin/products", productsRoutes);

// Rate limiting pour les routes API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes par fenêtre pour les API
  message: {
    error: "Trop de requêtes API. Veuillez réessayer dans 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Appliquer le rate limiting aux routes API
app.use("/api/", apiLimiter);

app.use("/", apiRoutes);
app.use("/api", apiHomeRoutes);
app.use("/api", apiCataloguesRoutes);
app.use("/api", apiPanierRoutes);
app.use("/api", apiCommandesRoutes);
app.use("/api", apiAdminRoutes);
app.use("/api", apiAdminCataloguesRoutes);
app.use("/api/admin/products", apiAdminProductsRoutes);
app.use("/api/admin/categories", apiAdminCategoriesRoutes);
app.use("/api/admin/suppliers", apiAdminSuppliersRoutes);

// RBAC API Routes
app.use("/api/admin/roles", apiRolesRoutes);
app.use("/api/admin/permissions", apiPermissionsRoutes);
app.use("/api/admin/user-roles", apiUserRolesRoutes);
app.use("/api/admin/users", apiUsersRoutes);

// Stats, Trace, Email Queue, Bandeaux, Organizations API Routes
app.use("/api/admin/trace", apiTraceRoutes);
app.use("/api/admin/email-queue", apiEmailQueueRoutes);
app.use("/api/admin/maintenance", apiMaintenanceRoutes);
app.use("/api/admin/stats", apiStatsRoutes);
app.use("/api/admin/bandeaux", apiBandeauxRoutes);
app.use("/api/admin/organizations", apiOrganizationsRoutes);

// Routes caisse
app.use("/caisse", caisseRoutes);
app.use("/api/caisse/produits", apiCaisseProduitsRoutes);
app.use("/api/caisse/ventes", apiCaisseVentesRoutes);
app.use("/api/caisse/paiements", apiCaissePaiementsRoutes);
app.use("/api/caisse/modes-paiement", apiCaisseModePaiementRoutes);
app.use("/api/caisse/utilisateurs", apiCaisseUtilisateursRoutes);
app.use("/api/caisse/paniers", apiCaissePaniersVentesRoutes);
app.use("/api/caisse/ventes-historique", apiCaisseVentesHistoriqueRoutes);
app.use("/api/caisse/cotisation", apiCaisseCotisationRoutes);
app.use("/api/caisse", apiCaisseInventaireRoutes);
app.use("/api/caisse", apiCaisseCommandesRoutes);

// Helpers pour les dates
app.locals.formatDate = function (dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

app.locals.formatDateTime = function (dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Gestionnaire 404
app.use((req, res) => {
  try {
    res.status(404).render("404", {
      message: "Page non trouvée.",
      user: getCurrentUsername(req),
      role: getCurrentUserRole(req)
    });
  } catch (error) {
    // Session invalide
    res.status(404).render("404", {
      message: "Page non trouvée.",
      user: null,
      role: null
    });
  }
});

// Gestion des promesses rejetées non gérées (pour éviter les crashes)
process.on("unhandledRejection", (reason, promise) => {
  const errMessage = reason instanceof Error ? reason.message : String(reason);
  const errStack = reason instanceof Error ? reason.stack : undefined;
  logger.error("Unhandled Rejection", {
    message: errMessage,
    stack: errStack,
    reason: reason !== null && typeof reason === "object" ? JSON.stringify(reason) : String(reason),
  });
});

// Démarrage du serveur (sauf en mode test ; nécessaire même quand Passenger charge l'app comme module)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    const env = process.env.NODE_ENV || "development";
    logger.info("Serveur démarré", {
      port: PORT,
      environment: env,
      logsPath,
    });
    // Vérification config production (priorité haute sécurité)
    if (env === "production") {
      logger.info("Config production active", {
        cookiesSecure: true,
        hstsEnabled: true,
        rateLimitAuth: true,
      });
    } else if (env !== "development") {
      logger.warn("NODE_ENV devrait être 'production' en production ou 'development' en dev", { current: env });
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.error("Port déjà utilisé", { port: PORT, code: err.code });
    } else {
      logger.error("Erreur serveur au démarrage", { error: err.message, code: err.code });
    }
    process.exitCode = 1;
  });
}

module.exports = app;
