const db = require("../config/config").db;
const { debugLog } = require("../utils/logger-helpers");
const {
  getCurrentUserRole,
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUsername,
} = require("../utils/session-helpers");
const { hasPermission } = require("./rbac.middleware");

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

// Middleware de validation (accès catalogue : toutes orgs si permission organizations.view_all, sinon filtre par org)
async function validateCatalogOwnership(req, res, next) {
  const id = req.params.id;
  let sql, params;
  const canViewAllOrgs = await hasPermission(req, "organizations.view_all");
  if (canViewAllOrgs) {
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
  validateCatalogOwnership,
  injectBandeaux,
  handleCSRFError,
  handle404,
};
