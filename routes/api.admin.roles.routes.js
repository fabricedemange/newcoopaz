/**
 * API Routes: Role Management
 *
 * Endpoints for CRUD operations on roles
 * - System roles (is_system=1): Read-only
 * - Custom roles (is_system=0): Full CRUD
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission, requireAllPermissions, hasPermission, clearAllPermissionCaches } = require("../middleware/rbac.middleware");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");

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
 * GET /api/admin/roles
 * List all roles (system + organization custom roles)
 */
router.get("/", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    let query = `
      SELECT r.*,
             COUNT(DISTINCT ur.user_id) as user_count,
             COUNT(DISTINCT rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      WHERE 1=1
    `;

    const params = [];

    if (!superAdmin) {
      // Admin sees: system roles + their org's custom roles
      query += ` AND (r.is_system = 1 OR r.organization_id = ?)`;
      params.push(orgId);
    }

    query += ` GROUP BY r.id ORDER BY r.is_system DESC, r.display_name ASC`;

    const roles = await queryPromise(query, params);

    res.json({ success: true, roles });
  } catch (error) {
    console.error('Error loading roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/roles/:id
 * Get role details with assigned permissions
 */
router.get("/:id", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const roleId = req.params.id;
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Get role
    const roleQuery = `SELECT * FROM roles WHERE id = ?`;
    const roles = await queryPromise(roleQuery, [roleId]);

    if (roles.length === 0) {
      return res.status(404).json({ success: false, error: 'Rôle non trouvé' });
    }

    const role = roles[0];

    // Check access: SuperAdmin sees all, Admin sees system + their org
    if (!superAdmin && role.is_system === 0 && role.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé: ce rôle appartient à une autre organisation'
      });
    }

    // Get assigned permissions
    const permissionsQuery = `
      SELECT p.*
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.name
    `;
    const permissions = await queryPromise(permissionsQuery, [roleId]);

    res.json({
      success: true,
      role,
      permissions,
      permission_ids: permissions.map(p => p.id)
    });
  } catch (error) {
    console.error('Error loading role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/roles
 * Create a new custom role
 */
router.post("/", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const { name, display_name, description, permission_ids } = req.body;
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);

    if (!name || !display_name) {
      return res.status(400).json({
        success: false,
        error: 'Le nom et le nom d\'affichage sont requis'
      });
    }

    // Validate name format (lowercase, underscores only)
    if (!/^[a-z_]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        error: 'Le nom doit contenir uniquement des lettres minuscules et underscores'
      });
    }

    // Check if role name already exists for this org
    const existsQuery = `
      SELECT id FROM roles
      WHERE name = ? AND organization_id = ?
    `;
    const existing = await queryPromise(existsQuery, [name, orgId]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Un rôle avec ce nom existe déjà dans votre organisation'
      });
    }

    // Insert role
    const insertQuery = `
      INSERT INTO roles (name, display_name, description, is_system, organization_id)
      VALUES (?, ?, ?, 0, ?)
    `;
    const result = await queryPromise(insertQuery, [name, display_name, description, orgId]);
    const roleId = result.insertId;

    // Insert permissions
    if (permission_ids && permission_ids.length > 0) {
      const values = permission_ids.map(pid => `(${roleId}, ${parseInt(pid)})`).join(',');
      await queryPromise(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, []);
    }

    // Audit log
    await queryPromise(
      `INSERT INTO permission_audit_log (event_type, actor_id, role_id, details)
       VALUES ('role_created', ?, ?, ?)`,
      [userId, roleId, JSON.stringify({ name, display_name, permission_count: permission_ids?.length || 0 })]
    );

    await clearAllPermissionCaches();
    res.json({ success: true, role_id: roleId });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/roles/:id
 * Update a custom role
 */
router.put("/:id", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const roleId = req.params.id;
    const { display_name, description, permission_ids } = req.body;
    const userId = getCurrentUserId(req);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Check if role exists and is editable
    const checkQuery = `SELECT is_system, organization_id FROM roles WHERE id = ?`;
    const roles = await queryPromise(checkQuery, [roleId]);

    if (roles.length === 0) {
      return res.status(404).json({ success: false, error: 'Rôle non trouvé' });
    }

    const role = roles[0];

    // System roles: Only allow permission updates (not name/description)
    const isSystemRole = role.is_system === 1;

    if (!superAdmin && !isSystemRole && role.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez modifier que les rôles de votre organisation'
      });
    }

    // Update role (skip for system roles - only update permissions)
    if (!isSystemRole) {
      await queryPromise(
        `UPDATE roles SET display_name = ?, description = ? WHERE id = ?`,
        [display_name, description, roleId]
      );
    }

    // Update permissions
    await queryPromise(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);

    if (permission_ids && permission_ids.length > 0) {
      const values = permission_ids.map(pid => `(${roleId}, ${parseInt(pid)})`).join(',');
      await queryPromise(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`, []);
    }

    // Audit log
    await queryPromise(
      `INSERT INTO permission_audit_log (event_type, actor_id, role_id, details)
       VALUES ('role_updated', ?, ?, ?)`,
      [userId, roleId, JSON.stringify({ display_name, permission_count: permission_ids?.length || 0 })]
    );

    await clearAllPermissionCaches();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/roles/:id
 * Delete a custom role (only if no users have it)
 */
router.delete("/:id", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const roleId = req.params.id;
    const userId = getCurrentUserId(req);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Check if role exists and can be deleted
    const checkQuery = `
      SELECT r.is_system, r.name, r.organization_id,
             COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON ur.role_id = r.id
      WHERE r.id = ?
      GROUP BY r.id
    `;
    const roles = await queryPromise(checkQuery, [roleId]);

    if (roles.length === 0) {
      return res.status(404).json({ success: false, error: 'Rôle non trouvé' });
    }

    const role = roles[0];

    if (role.is_system === 1) {
      return res.status(403).json({
        success: false,
        error: 'Impossible de supprimer un rôle système'
      });
    }

    if (!superAdmin && role.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez supprimer que les rôles de votre organisation'
      });
    }

    if (role.user_count > 0) {
      return res.status(400).json({
        success: false,
        error: `Impossible de supprimer ce rôle : ${role.user_count} utilisateur(s) l'utilisent encore`
      });
    }

    // Delete role (cascades to role_permissions)
    await queryPromise(`DELETE FROM roles WHERE id = ?`, [roleId]);

    // Audit log
    await queryPromise(
      `INSERT INTO permission_audit_log (event_type, actor_id, role_id, details)
       VALUES ('role_deleted', ?, ?, ?)`,
      [userId, roleId, JSON.stringify({ name: role.name })]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/roles/:id/users
 * Get users who have this role
 */
router.get("/:id/users", requireAllPermissions(['roles', 'users'], { json: true }), async (req, res) => {
  try {
    const roleId = req.params.id;

    const query = `
      SELECT u.id, u.username, u.email, ur.assigned_at, ur.expires_at
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      WHERE ur.role_id = ?
      ORDER BY u.username
    `;

    const users = await queryPromise(query, [roleId]);

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error loading role users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
