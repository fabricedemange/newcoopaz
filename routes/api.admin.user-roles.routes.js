/**
 * API Routes: User Roles Assignment
 *
 * Endpoints for assigning/removing roles to/from users
 * Supports multi-role assignment
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission, clearUserPermissionCache } = require("../middleware/rbac.middleware");
const { invalidateUserRolesCache } = require("../utils/user-roles-cache");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");
const { hasPermission } = require("../middleware/rbac.middleware");

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
 * GET /api/admin/users/:userId/roles
 * Get all roles assigned to a user
 */
router.get("/:userId/roles", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Check user belongs to org (unless SuperAdmin)
    if (!superAdmin) {
      const userCheckQuery = `SELECT organization_id FROM users WHERE id = ?`;
      const users = await queryPromise(userCheckQuery, [targetUserId]);

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      if (users[0].organization_id !== orgId) {
        return res.status(403).json({
          success: false,
          error: 'Cet utilisateur appartient à une autre organisation'
        });
      }
    }

    // Get user's roles
    const query = `
      SELECT r.*, ur.assigned_at, ur.expires_at, ur.reason,
             u_assigned.username as assigned_by_username
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      LEFT JOIN users u_assigned ON u_assigned.id = ur.assigned_by
      WHERE ur.user_id = ?
      ORDER BY r.is_system DESC, r.display_name
    `;

    const roles = await queryPromise(query, [targetUserId]);

    res.json({ success: true, roles });
  } catch (error) {
    console.error('Error loading user roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/roles
 * Assign a role to a user
 */
router.post("/:userId/roles", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const { role_id, expires_at, reason } = req.body;
    const actorId = getCurrentUserId(req);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    if (!role_id) {
      return res.status(400).json({
        success: false,
        error: 'role_id est requis'
      });
    }

    // Check target user
    const userCheckQuery = `SELECT organization_id FROM users WHERE id = ?`;
    const users = await queryPromise(userCheckQuery, [targetUserId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const userOrgId = users[0].organization_id;

    if (!superAdmin && userOrgId !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez assigner des rôles qu\'aux utilisateurs de votre organisation'
      });
    }

    // Check role exists and is accessible
    const roleCheckQuery = `SELECT is_system, organization_id FROM roles WHERE id = ?`;
    const roles = await queryPromise(roleCheckQuery, [role_id]);

    if (roles.length === 0) {
      return res.status(404).json({ success: false, error: 'Rôle non trouvé' });
    }

    const role = roles[0];

    // Check role belongs to same org (or is system role)
    if (!superAdmin && role.is_system === 0 && role.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez assigner que des rôles système ou des rôles de votre organisation'
      });
    }

    // Check if role already assigned
    const existsQuery = `SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?`;
    const existing = await queryPromise(existsQuery, [targetUserId, role_id]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ce rôle est déjà assigné à cet utilisateur'
      });
    }

    // Insert user_role
    const insertQuery = `
      INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at, reason)
      VALUES (?, ?, ?, ?, ?)
    `;
    await queryPromise(
      insertQuery,
      [targetUserId, role_id, actorId, expires_at || null, reason || null]
    );

    // Clear permission cache and display roles cache for this user
    await clearUserPermissionCache(targetUserId);
    invalidateUserRolesCache(targetUserId);

    // Audit log
    await queryPromise(
      `INSERT INTO permission_audit_log (event_type, user_id, actor_id, role_id, details)
       VALUES ('role_assigned', ?, ?, ?, ?)`,
      [targetUserId, actorId, role_id, JSON.stringify({ expires_at, reason })]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:userId/roles/:roleId
 * Remove a role from a user
 */
router.delete("/:userId/roles/:roleId", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const roleId = req.params.roleId;
    const actorId = getCurrentUserId(req);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Check target user
    const userCheckQuery = `SELECT organization_id FROM users WHERE id = ?`;
    const users = await queryPromise(userCheckQuery, [targetUserId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    if (!superAdmin && users[0].organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez modifier que les utilisateurs de votre organisation'
      });
    }

    // Check role assignment exists
    const existsQuery = `SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?`;
    const existing = await queryPromise(existsQuery, [targetUserId, roleId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ce rôle n\'est pas assigné à cet utilisateur'
      });
    }

    // Check user has at least 2 roles (can't remove last role)
    const countQuery = `SELECT COUNT(*) as role_count FROM user_roles WHERE user_id = ?`;
    const counts = await queryPromise(countQuery, [targetUserId]);

    if (counts[0].role_count <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de retirer le dernier rôle d\'un utilisateur. Assignez un autre rôle d\'abord.'
      });
    }

    // Delete user_role
    await queryPromise(
      `DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`,
      [targetUserId, roleId]
    );

    // Clear permission cache and display roles cache
    await clearUserPermissionCache(targetUserId);
    invalidateUserRolesCache(targetUserId);

    // Audit log
    await queryPromise(
      `INSERT INTO permission_audit_log (event_type, user_id, actor_id, role_id)
       VALUES ('role_removed', ?, ?, ?)`,
      [targetUserId, actorId, roleId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/effective-permissions
 * Get all effective permissions for a user (union of all roles)
 */
router.get("/:userId/effective-permissions", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Check target user
    const userCheckQuery = `SELECT organization_id, rbac_enabled FROM users WHERE id = ?`;
    const users = await queryPromise(userCheckQuery, [targetUserId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    if (!superAdmin && users[0].organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez consulter que les utilisateurs de votre organisation'
      });
    }

    if (users[0].rbac_enabled !== 1) {
      return res.json({
        success: true,
        rbac_enabled: false,
        permissions: [],
        message: 'RBAC non activé pour cet utilisateur'
      });
    }

    // Get effective permissions (UNION of all role permissions)
    const query = `
      SELECT DISTINCT p.id, p.name, p.display_name, p.module,
             GROUP_CONCAT(DISTINCT r.display_name SEPARATOR ', ') as from_roles
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
        AND p.is_active = 1
        AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      GROUP BY p.id
      ORDER BY p.module, p.name
    `;

    const permissions = await queryPromise(query, [targetUserId]);

    // Group by module
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      rbac_enabled: true,
      permissions: grouped,
      total_count: permissions.length
    });
  } catch (error) {
    console.error('Error loading effective permissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
