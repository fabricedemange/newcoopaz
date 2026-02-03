const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { getCurrentOrgId } = require("../utils/session-helpers");
const { requirePermission } = require("../middleware/rbac.middleware");

/**
 * GET /api/caisse/utilisateurs
 * Récupère la liste des utilisateurs actifs pour la caisse
 */
router.get("/", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const orgId = getCurrentOrgId(req);

  const query = `
    SELECT
      id,
      username,
      email
    FROM users
    WHERE organization_id = ?
      AND is_validated = 1
    ORDER BY
      CASE WHEN LOWER(username) = 'anonyme' THEN 0 ELSE 1 END,
      username ASC
  `;

  db.query(query, [orgId], (err, utilisateurs) => {
    if (err) {
      console.error('ERROR api.caisse.utilisateurs:', err);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }

    res.json({
      success: true,
      utilisateurs: utilisateurs || []
    });
  });
});

module.exports = router;
