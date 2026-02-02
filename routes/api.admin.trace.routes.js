const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");

// ============================================================================
// API: Liste des traces (JSON)
// ============================================================================
router.get("/", requirePermission('audit_logs', { json: true }), (req, res) => {
  // Purge: garder seulement les 50000 dernières traces
  db.query(
    `DELETE FROM trace
     WHERE id NOT IN (
       SELECT id FROM (SELECT id FROM trace ORDER BY id DESC LIMIT 50000) AS sub
     )`,
    [],
    (purgeErr) => {
      if (purgeErr) {
        console.error('ERROR api.admin.trace - Purge:', purgeErr);
        // Continuer même si la purge échoue
      }

      // Récupérer toutes les traces
      db.query(
        "SELECT * FROM trace ORDER BY id DESC",
        [],
        (err, traces) => {
          if (err) {
            console.error('ERROR api.admin.trace - Query:', err);
            return res.status(500).json({
              success: false,
              error: "Erreur lors de la récupération des traces"
            });
          }

          res.json({
            success: true,
            traces: traces || []
          });
        }
      );
    }
  );
});

module.exports = router;
