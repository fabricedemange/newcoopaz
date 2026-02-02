const db = require("../config/config").db;
const { debugLog } = require("../utils/logger-helpers");
const {
  getCurrentUserRole,
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUsername,
} = require("../utils/session-helpers");
const { hasAnyPermission } = require("./rbac.middleware");

function requireLogin(req, res, next) {
  try {
    getCurrentUserId(req); // Vérifier que la session est valide
    return next();
  } catch (error) {
    // Pour les appels API, renvoyer 401 JSON au lieu d'une redirection
    const path = req.originalUrl || req.path || "";
    const isApi = path.startsWith("/api") || /application\/json/i.test(req.get("Accept") || "");
    if (isApi) {
      return res.status(401).json({ success: false, error: "Non authentifié" });
    }
    return res.redirect("/login");
  }
}

// RBAC ONLY - Plus de support legacy
const { requireAnyPermission } = require('./rbac.middleware');

// Wrapper pour migration: convertit rôles legacy en permissions RBAC
function requireRole(roles) {
  // Mapping rôles legacy → permissions RBAC minimales
  const rolePermissionMap = {
    'SuperAdmin': ['users.view'], // SuperAdmin a tout via rôle super_admin
    'admin': ['users.view', 'organizations.view', 'catalogues.view'],
    'referent': ['catalogues.view', 'paniers.validate'],
    'epicier': ['paniers.validate'],
    'utilisateur': ['paniers.view_own', 'paniers.create']
  };

  // Collecter toutes les permissions correspondant aux rôles demandés
  if (!Array.isArray(roles)) roles = [roles];
  const requiredPermissions = [];

  for (const role of roles) {
    if (rolePermissionMap[role]) {
      requiredPermissions.push(...rolePermissionMap[role]);
    }
  }

  // Si aucune permission trouvée, bloquer
  if (requiredPermissions.length === 0) {
    return async (req, res, next) => {
      return res.status(403).render("403", {
        message: "Accès refusé - rôles non reconnus",
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req),
      });
    };
  }

  // Utiliser requireAnyPermission pour vérifier
  return requireAnyPermission(requiredPermissions);
}

function injectBandeaux(req, res, next) {
  //console.log("test");
  db.query(
    "SELECT id, titre, message, type FROM bandeaux WHERE actif = 1 ORDER BY created_at DESC",
    [],
    (err, bandeaux) => {
      if (err) {
        debugLog("Erreur lors de la récupération des bandeaux :", err);
        res.locals.bandeaux = [];
        return next();
      }
      res.locals.bandeaux = bandeaux || [];
      next();
    }
  );
}

function handleCSRFError(req, res) {
  res.status(403).render("404", {
    message: "Session expirée ou token CSRF invalide.",
    user: getCurrentUsername(req),
    role: getCurrentUserRole(req),
  });
}

function handle404(req, res) {
  res.status(404).render("404", {
    message: "Page non trouvée.",
    user: getCurrentUsername(req),
    role: getCurrentUserRole(req),
  });
}

// Specific role middlewares
const requireAdmin = requireRole(["admin", "SuperAdmin"]);
const requireSuperAdmin = requireRole(["SuperAdmin"]);
const requireReferent = requireRole(["admin", "referent", "SuperAdmin"]);
const requireUtilisateur = requireRole([
  "admin",
  "referent",
  "utilisateur",
  "SuperAdmin",
]);

// Middleware de validation
function validateCatalogOwnership(req, res, next) {
  const id = req.params.id;
  let sql, params;
  if (getCurrentUserRole(req) === "SuperAdmin") {
    sql = "SELECT * FROM catalog_files WHERE id = ?";
    params = [id];
  } else {
    sql = "SELECT * FROM catalog_files WHERE id = ? AND organization_id = ?";
    params = [id, getCurrentOrgId(req)];
  }
  db.query(sql, params, (err, results) => {
    if (err || !results || results.length === 0) {
      return res.status(403).render("403", {
        message: "Catalogue non trouvé ou accès refusé.",
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req),
      });
    }
    req.catalog = results[0];
    next();
  });
}

module.exports = {
  requireLogin,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireReferent,
  requireUtilisateur,
  validateCatalogOwnership,
  injectBandeaux,
  handleCSRFError,
  handle404,
};
