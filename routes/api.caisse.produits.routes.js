const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId } = require("../utils/session-helpers");

// GET /api/caisse/produits - Liste produits pour la caisse
router.get("/", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const orgId = getCurrentOrgId(req);

  const produitsQuery = `
    SELECT
      p.id,
      p.nom,
      p.stock,
      p.prix,
      p.unite,
      p.quantite_min,
      p.image_url,
      p.category_id,
      c.nom as category_nom
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.organization_id = ?
      AND p.is_active = 1
    ORDER BY p.nom ASC
  `;

  const categoriesQuery = `
    SELECT id, nom, couleur
    FROM categories
    WHERE organization_id = ?
    ORDER BY nom ASC
  `;

  db.query(produitsQuery, [orgId], (err, produits) => {
    if (err) {
      console.error('Erreur chargement produits:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    db.query(categoriesQuery, [orgId], (err2, categories) => {
      if (err2) {
        console.error('Erreur chargement catégories:', err2);
        return res.status(500).json({ success: false, error: err2.message });
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: true,
        produits: produits || [],
        categories: categories || []
      });
    });
  });
});

module.exports = router;
