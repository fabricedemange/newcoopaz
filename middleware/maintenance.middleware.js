/**
 * Middleware maintenance : en mode maintenance, seul le super admin (organizations.view_all) peut accéder au site.
 * Les autres voient la page /maintenance avec le message configuré.
 */

const { getMaintenanceSettings } = require("../services/app-settings.service");
const { hasPermission } = require("./rbac.middleware");

const SKIP_PATHS = [
  "/maintenance",
  "/login",
  "/logout",
  "/favicon.ico",
  "/dist/",
  "/css/",
  "/js/",
  "/img/",
  "/images/",
];

function shouldSkip(path) {
  if (!path) return true;
  return SKIP_PATHS.some((p) => path === p || path.startsWith(p));
}

async function maintenanceMiddleware(req, res, next) {
  const path = req.path;
  if (shouldSkip(path)) {
    return next();
  }

  try {
    const settings = await new Promise((resolve, reject) => {
      getMaintenanceSettings((err, s) => (err ? reject(err) : resolve(s)));
    });

    if (!settings || !settings.enabled) {
      return next();
    }

    // Super admin : RBAC (organizations.view_all) ou rôle legacy SuperAdmin
    let isSuperAdmin = false;
    if (req.session?.userId) {
      try {
        isSuperAdmin = req.session.role === "SuperAdmin" || await hasPermission(req, "organizations.view_all");
      } catch (_) {
        isSuperAdmin = req.session.role === "SuperAdmin";
      }
    }
    if (isSuperAdmin) {
      return next();
    }

    res.status(503).render("maintenance", {
      message: settings.message || "Le site est actuellement en maintenance. Merci de réessayer plus tard.",
    });
  } catch (err) {
    console.error("maintenance middleware error:", err?.message);
    next();
  }
}

module.exports = { maintenanceMiddleware };
