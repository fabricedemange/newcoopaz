const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission, hasPermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId } = require("../utils/session-helpers");

// ============================================================================
// API: Liste des fournisseurs (JSON)
// ============================================================================
router.get("/", requirePermission('suppliers', { json: true }), async (req, res) => {
  const orgId = getCurrentOrgId(req);
  const isSuperAdmin = await hasPermission(req, "organizations.view_all");

  const suppliersQuery = `
    SELECT
      s.*,
      COUNT(DISTINCT p.id) as nb_products
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id
    ${!isSuperAdmin ? 'WHERE s.organization_id = ?' : ''}
    GROUP BY s.id
    ORDER BY s.nom
  `;

  const params = !isSuperAdmin ? [orgId] : [];

  db.query(suppliersQuery, params, (err, suppliers) => {
    if (err) {
      console.error('ERROR api.admin.suppliers - Query:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      suppliers: suppliers || []
    });
  });
});

// ============================================================================
// API: Fusionner deux fournisseurs
// ============================================================================
router.post("/merge", requirePermission('suppliers', { json: true }), async (req, res) => {
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
      error: 'Impossible de fusionner un fournisseur avec lui-même'
    });
  }

  // Vérifier que les deux fournisseurs existent et appartiennent à l'organisation
  const checkQuery = `
    SELECT id, nom, organization_id
    FROM suppliers
    WHERE id IN (?, ?)
    ${!isSuperAdmin ? 'AND organization_id = ?' : ''}
  `;
  const checkParams = !isSuperAdmin ? [sourceId, targetId, orgId] : [sourceId, targetId];

  db.query(checkQuery, checkParams, (err, suppliers) => {
    if (err) {
      console.error('ERROR checking suppliers:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    if (suppliers.length !== 2) {
      return res.status(404).json({
        success: false,
        error: 'Un ou plusieurs fournisseurs introuvables'
      });
    }

    const sourceSupplier = suppliers.find(s => s.id === parseInt(sourceId));
    const targetSupplier = suppliers.find(s => s.id === parseInt(targetId));

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

        // 1. Transférer tous les produits du fournisseur source vers la cible
        const updateProductsQuery = `
          UPDATE products
          SET supplier_id = ?
          WHERE supplier_id = ?
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

          // 2. Supprimer le fournisseur source
          const deleteSupplierQuery = `DELETE FROM suppliers WHERE id = ?`;

          connection.query(deleteSupplierQuery, [sourceId], (err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('ERROR deleting source supplier:', err);
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
                message: `Fournisseur "${sourceSupplier.nom}" fusionné dans "${targetSupplier.nom}"`,
                productsUpdated
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
