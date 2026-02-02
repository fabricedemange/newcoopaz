const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId } = require("../utils/session-helpers");

// GET /api/caisse/modes-paiement - Liste modes de paiement actifs
router.get("/", (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);

    const query = `
      SELECT id, nom, icon
      FROM modes_paiement
      WHERE organization_id = ?
        AND is_active = TRUE
      ORDER BY nom ASC
    `;

    db.query(query, [orgId], (err, modes) => {
      if (err) {
        console.error('Erreur chargement modes paiement:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      res.json({
        success: true,
        modes: modes || []
      });
    });
  } catch (error) {
    console.error('Erreur authentification modes paiement:', error);
    return res.status(401).json({ success: false, error: error.message });
  }
});

module.exports = router;
