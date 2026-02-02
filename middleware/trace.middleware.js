// Middleware pour journaliser toutes les actions utilisateurs (hors GET affichage)
const { db } = require("../config/config");
const { queryWithUser } = require("../config/db-trace-wrapper");
const {
  getCurrentUsername,
  getCurrentUserRole,
} = require("../utils/session-helpers");

function logTrace(req, action, details) {
  const username = getCurrentUsername(req);
  const role = getCurrentUserRole(req);
  const rolerequis = req.session.rolerequis || null;
  const chemin = req.originalUrl || null;
  console.log("MiddleWare : ", username, role, "vue", chemin, req.method);
  db.query(
    "INSERT INTO trace (created_at, username, role, chemin) VALUES (NOW(), ?, ?, ?)",
    [username, role, chemin + "(" + req.method + ")"],
    (err) => {
      if (err) console.error("Erreur insertion trace:", err);
    }
  );
}

function traceActionsMiddlewareold(req, res, next) {
  console.log("Middleware.........................");
  console.log("TRACE MIDDLEWARE", req.method, req.originalUrl);
  // Log temporaire pour debug session
  // console.log("TRACE SESSION:", req.session);
  // Trace toute requête où username est présent en session

  try {
    getCurrentUsername(req); // Vérifier que la session est valide
    const action = `${req.method} ${req.originalUrl}`;
    const details = JSON.stringify({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    //logTrace(req, action, details);
    //console.log("Trace logged for user:", details);
  } catch (error) {
    // Session invalide, ignorer le tracing
  }
  next();
}

module.exports = { traceActionsMiddleware, logTrace };
