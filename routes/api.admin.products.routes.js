const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission, hasPermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId } = require("../utils/session-helpers");

// ============================================================================
// API: Liste des produits (JSON)
// ============================================================================
router.get("/", requirePermission('products', { json: true }), async (req, res) => {
  const orgId = getCurrentOrgId(req);
  const isSuperAdmin = await hasPermission(req, "organizations.view_all");

  // Récupérer les produits avec prix depuis products.prix
  const productsQuery = `
    SELECT
      p.*,
      c.nom as categorie,
      c.couleur as categorie_couleur,
      s.nom as fournisseur,
      COUNT(DISTINCT cp.catalog_file_id) as nb_catalogues
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN catalog_products cp ON cp.product_id = p.id
    ${!isSuperAdmin ? 'WHERE p.organization_id = ?' : ''}
    GROUP BY p.id
    ORDER BY p.nom
  `;

  const productsParams = !isSuperAdmin ? [orgId] : [];

  db.query(productsQuery, productsParams, (err, products) => {
    if (err) {
      console.error('ERROR api.admin.products - Products query:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    // Récupérer les catégories pour les filtres
    const categoriesQuery = `
      SELECT * FROM categories
      ${!isSuperAdmin ? 'WHERE organization_id = ?' : ''}
      ORDER BY ordre, nom
    `;
    const categoriesParams = !isSuperAdmin ? [orgId] : [];

    db.query(categoriesQuery, categoriesParams, (err2, categories) => {
      if (err2) {
        console.error('ERROR api.admin.products - Categories query:', err2);
        return res.status(500).json({ success: false, error: err2.message });
      }

      // Récupérer les fournisseurs pour les filtres
      const suppliersQuery = `
        SELECT * FROM suppliers
        ${!isSuperAdmin ? 'WHERE organization_id = ?' : ''}
        ORDER BY nom
      `;
      const suppliersParams = !isSuperAdmin ? [orgId] : [];

      db.query(suppliersQuery, suppliersParams, (err3, suppliers) => {
        if (err3) {
          console.error('ERROR api.admin.products - Suppliers query:', err3);
          return res.status(500).json({ success: false, error: err3.message });
        }

        res.json({
          success: true,
          products: products || [],
          categories: categories || [],
          suppliers: suppliers || []
        });
      });
    });
  });
});

// ============================================================================
// API: Mise à jour en masse (catégorie, fournisseur, unité, quantité min)
// ============================================================================
router.post("/bulk-update", requirePermission('products', { json: true }), async (req, res) => {
  const { productIds, categoryId, supplierId, unite, quantiteMin } = req.body;
  const orgId = getCurrentOrgId(req);
  const isSuperAdmin = await hasPermission(req, "organizations.view_all");

  // Validation
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Aucun produit sélectionné'
    });
  }

  if (!categoryId && !supplierId && !unite && !quantiteMin) {
    return res.status(400).json({
      success: false,
      error: 'Aucune modification spécifiée'
    });
  }

  // Construire les champs à mettre à jour
  const updates = [];
  const params = [];

  if (categoryId) {
    updates.push('category_id = ?');
    params.push(categoryId);
  }

  if (supplierId) {
    updates.push('supplier_id = ?');
    params.push(supplierId);
  }

  if (unite) {
    updates.push('unite = ?');
    params.push(unite);
  }

  if (quantiteMin) {
    updates.push('quantite_min = ?');
    params.push(parseFloat(quantiteMin));
  }

  // Ajouter les IDs des produits
  const placeholders = productIds.map(() => '?').join(',');
  params.push(...productIds);

  // Ajouter l'organisation si pas superadmin
  if (!isSuperAdmin) {
    params.push(orgId);
  }

  const updateQuery = `
    UPDATE products
    SET ${updates.join(', ')}
    WHERE id IN (${placeholders})
    ${!isSuperAdmin ? 'AND organization_id = ?' : ''}
  `;

  db.query(updateQuery, params, (err, result) => {
    if (err) {
      console.error('ERROR api.admin.products - Bulk update:', err);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }

    res.json({
      success: true,
      updated: result.affectedRows
    });
  });
});

// ============================================================================
// API: Mise à jour en masse de la catégorie (ancienne route pour compatibilité)
// ============================================================================
router.post("/bulk-update-category", requirePermission('products', { json: true }), (req, res) => {
  const { productIds, categoryId } = req.body;
  req.body.supplierId = null;

  // Rediriger vers la nouvelle route
  const newReq = { ...req, body: { productIds, categoryId, supplierId: null } };
  router.handle(newReq, res);
});

module.exports = router;
