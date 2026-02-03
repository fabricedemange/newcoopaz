/**
 * API Routes: Permissions
 *
 * Endpoints for listing available permissions
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission } = require("../middleware/rbac.middleware");

// Helper: Query with promise
function queryPromise(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

/**
 * GET /api/admin/permissions
 * List all permissions grouped by module
 */
router.get("/", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const query = `
      SELECT id, name, display_name, description, module, is_active
      FROM permissions
      WHERE is_active = 1
      ORDER BY module, name
    `;

    const permissions = await queryPromise(query, []);

    // Group by module
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {});

    // Libellés des modules (zone de saisie unique pour Inventaire et stock)
    const moduleDisplayNames = {
      inventory_stock: 'Inventaire et stock'
    };

    // Get module list with counts
    const modules = Object.keys(grouped).map(moduleName => ({
      name: moduleName,
      display_name: moduleDisplayNames[moduleName] || moduleName.charAt(0).toUpperCase() + moduleName.slice(1).replace(/_/g, ' '),
      permission_count: grouped[moduleName].length
    }));

    res.json({
      success: true,
      permissions: grouped,
      modules,
      total_count: permissions.length
    });
  } catch (error) {
    console.error('Error loading permissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/permissions/modules
 * List all available modules
 */
router.get("/modules", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT module,
             COUNT(*) as permission_count
      FROM permissions
      WHERE is_active = 1
      GROUP BY module
      ORDER BY module
    `;

    const modules = await queryPromise(query, []);
    const moduleDisplayNames = { inventory_stock: 'Inventaire et stock' };

    res.json({
      success: true,
      modules: modules.map(m => ({
        name: m.module,
        display_name: moduleDisplayNames[m.module] || m.module.charAt(0).toUpperCase() + m.module.slice(1).replace(/_/g, ' '),
        permission_count: m.permission_count
      }))
    });
  } catch (error) {
    console.error('Error loading modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
