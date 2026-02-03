const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission, hasPermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId } = require("../utils/session-helpers");

// ============================================================================
// API: Liste des catégories (JSON)
// ============================================================================
router.get("/", requirePermission('categories', { json: true }), async (req, res) => {
  const orgId = getCurrentOrgId(req);
  const isSuperAdmin = await hasPermission(req, "organizations.view_all");

  const categoriesQuery = `
    SELECT
      c.*,
      cp.nom as parent_nom,
      COUNT(DISTINCT p.id) as nb_products
    FROM categories c
    LEFT JOIN categories cp ON c.parent_id = cp.id
    LEFT JOIN products p ON p.category_id = c.id
    ${!isSuperAdmin ? 'WHERE c.organization_id = ?' : ''}
    GROUP BY c.id
    ORDER BY c.ordre, c.nom
  `;

  const params = !isSuperAdmin ? [orgId] : [];

  db.query(categoriesQuery, params, (err, categories) => {
    if (err) {
      console.error('ERROR api.admin.categories - Query:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      categories: categories || []
    });
  });
});

// ============================================================================
// API: Fusionner deux catégories
// ============================================================================
router.post("/merge", requirePermission('categories', { json: true }), async (req, res) => {
  const { sourceId, targetId } = req.body;
  const orgId = getCurrentOrgId(req);
  const isSuperAdmin = await hasPermission(req, "organizations.view_all");

  // Validation
  if (!sourceId || !targetId) {
    return res.status(400).json({
      success: false,
      error: 'Les IDs source et cible sont requis'
    });
  }

  if (sourceId === targetId) {
    return res.status(400).json({
      success: false,
      error: 'Impossible de fusionner une catégorie avec elle-même'
    });
  }

  // Vérifier que les deux catégories existent et appartiennent à l'organisation
  const checkQuery = `
    SELECT id, nom, organization_id
    FROM categories
    WHERE id IN (?, ?)
    ${!isSuperAdmin ? 'AND organization_id = ?' : ''}
  `;
  const checkParams = !isSuperAdmin ? [sourceId, targetId, orgId] : [sourceId, targetId];

  db.query(checkQuery, checkParams, (err, categories) => {
    if (err) {
      console.error('ERROR checking categories:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    if (categories.length !== 2) {
      return res.status(404).json({
        success: false,
        error: 'Une ou plusieurs catégories introuvables'
      });
    }

    const sourceCategory = categories.find(c => c.id === parseInt(sourceId));
    const targetCategory = categories.find(c => c.id === parseInt(targetId));

    // Obtenir une connexion du pool pour la transaction
    db.getConnection((err, connection) => {
      if (err) {
        console.error('ERROR getting connection:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      // Commencer la transaction
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          console.error('ERROR starting transaction:', err);
          return res.status(500).json({ success: false, error: err.message });
        }

        // 1. Transférer tous les produits de la catégorie source vers la cible
        const updateProductsQuery = `
          UPDATE products
          SET category_id = ?
          WHERE category_id = ?
        `;

        connection.query(updateProductsQuery, [targetId, sourceId], (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('ERROR updating products:', err);
              res.status(500).json({ success: false, error: err.message });
            });
          }

          const productsUpdated = result.affectedRows;

          // 2. Transférer les sous-catégories (changer leur parent_id)
          const updateSubcategoriesQuery = `
            UPDATE categories
            SET parent_id = ?
            WHERE parent_id = ?
          `;

          connection.query(updateSubcategoriesQuery, [targetId, sourceId], (err, subResult) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('ERROR updating subcategories:', err);
                res.status(500).json({ success: false, error: err.message });
              });
            }

            const subcategoriesUpdated = subResult.affectedRows;

            // 3. Supprimer la catégorie source
            const deleteCategoryQuery = `DELETE FROM categories WHERE id = ?`;

            connection.query(deleteCategoryQuery, [sourceId], (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('ERROR deleting source category:', err);
                  res.status(500).json({ success: false, error: err.message });
                });
              }

              // Commit la transaction
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('ERROR committing transaction:', err);
                    res.status(500).json({ success: false, error: err.message });
                  });
                }

                connection.release();
                res.json({
                  success: true,
                  message: `Catégorie "${sourceCategory.nom}" fusionnée dans "${targetCategory.nom}"`,
                  productsUpdated,
                  subcategoriesUpdated
                });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
