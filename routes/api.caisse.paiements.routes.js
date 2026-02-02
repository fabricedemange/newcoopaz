const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId } = require("../utils/session-helpers");

// POST /api/caisse/paiements - Créer un paiement
router.post("/", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const { vente_id, mode_paiement_id, montant } = req.body;
  const orgId = getCurrentOrgId(req);

  // Validation (accepter montant 0 pour ventes avec avoir)
  if (!vente_id || !mode_paiement_id) {
    return res.status(400).json({
      success: false,
      error: "Données de paiement incomplètes"
    });
  }
  const montantNum = Number(montant);
  if (montant === undefined || montant === null || montant === "" || isNaN(montantNum) || montantNum < 0) {
    return res.status(400).json({
      success: false,
      error: montantNum < 0 ? "Le montant ne peut pas être négatif" : "Montant de paiement invalide"
    });
  }

  // Vérifier que la vente appartient à l'organisation
  const checkVenteQuery = `
    SELECT id FROM ventes
    WHERE id = ? AND organization_id = ?
  `;

  db.query(checkVenteQuery, [vente_id, orgId], (err, ventes) => {
    if (err) {
      console.error('Erreur vérification vente:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    if (!ventes || ventes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vente non trouvée"
      });
    }

    // Créer le paiement
    const insertQuery = `
      INSERT INTO paiements (vente_id, mode_paiement_id, montant)
      VALUES (?, ?, ?)
    `;

    db.query(insertQuery, [vente_id, mode_paiement_id, montantNum], (err, result) => {
      if (err) {
        console.error('Erreur création paiement:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      res.json({
        success: true,
        paiement: {
          id: result.insertId,
          vente_id,
          mode_paiement_id,
          montant: montantNum
        }
      });
    });
  });
});

// GET /api/caisse/paiements/:venteId - Liste paiements d'une vente
router.get("/:venteId", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const venteId = req.params.venteId;
  const orgId = getCurrentOrgId(req);

  const query = `
    SELECT
      p.id,
      p.montant,
      p.created_at,
      mp.nom as mode_paiement_nom,
      mp.icon as mode_paiement_icon
    FROM paiements p
    INNER JOIN modes_paiement mp ON p.mode_paiement_id = mp.id
    INNER JOIN ventes v ON p.vente_id = v.id
    WHERE p.vente_id = ?
      AND v.organization_id = ?
    ORDER BY p.created_at DESC
  `;

  db.query(query, [venteId, orgId], (err, paiements) => {
    if (err) {
      console.error('Erreur chargement paiements:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      paiements: paiements || []
    });
  });
});

module.exports = router;
