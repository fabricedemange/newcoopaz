/**
 * API Routes: User Management with RBAC
 *
 * Endpoints for managing users and their role assignments
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission, hasPermission } = require("../middleware/rbac.middleware");
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
 * GET /api/admin/users
 * List all users with their roles
 */
router.get("/", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Base query - get users with role count
    let query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.role as legacy_role,
        u.rbac_enabled,
        u.is_validated,
        u.organization_id,
        o.name as organization_name,
        COUNT(DISTINCT ur.role_id) as role_count,
        GROUP_CONCAT(DISTINCT r.display_name ORDER BY r.display_name SEPARATOR ', ') as role_names
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
    `;

    const params = [];

    // Filter by organization if not SuperAdmin
    if (!superAdmin) {
      query += ` WHERE u.organization_id = ?`;
      params.push(orgId);
    }

    query += `
      GROUP BY u.id, u.username, u.email, u.role, u.rbac_enabled, u.is_validated, u.organization_id, o.name
      ORDER BY u.username ASC
    `;

    const users = await queryPromise(query, params);

    res.json({
      success: true,
      users: users.map(u => ({
        ...u,
        rbac_enabled: u.rbac_enabled === 1,
        is_active: u.is_validated === 1,
        role_names: u.role_names || 'Aucun rôle'
      }))
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post("/", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const { username, email, password, role_ids } = req.body;
    const orgId = getCurrentOrgId(req);
    const actorId = getCurrentUserId(req);
    const bcrypt = require('bcrypt');

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email et mot de passe sont requis'
      });
    }

    // Check if username already exists
    const existingUser = await queryPromise(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username, email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Un utilisateur avec ce nom ou cet email existe déjà'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await queryPromise(
      `INSERT INTO users (
        username,
        email,
        password,
        organization_id,
        is_validated,
        rbac_enabled,
        email_catalogue
      ) VALUES (?, ?, ?, ?, 1, ?, 0)`,
      [username, email, hashedPassword, orgId, role_ids && role_ids.length > 0 ? 1 : 0]
    );

    const userId = result.insertId;

    // Assign roles if provided
    if (role_ids && role_ids.length > 0) {
      const values = role_ids.map(roleId =>
        `(${userId}, ${parseInt(roleId)}, ${actorId}, NOW())`
      ).join(',');

      await queryPromise(
        `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at) VALUES ${values}`,
        []
      );
    }

    res.json({
      success: true,
      user_id: userId,
      message: 'Utilisateur créé avec succès'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Get user details with assigned roles
 */
router.get("/:id", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Get user
    const userQuery = `SELECT * FROM users WHERE id = ?`;
    const users = await queryPromise(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const user = users[0];

    // Check access
    if (!superAdmin && user.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé: cet utilisateur appartient à une autre organisation'
      });
    }

    // Get assigned roles
    const rolesQuery = `
      SELECT
        r.id,
        r.name,
        r.display_name,
        r.is_system,
        ur.assigned_at,
        ur.expires_at
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.is_system DESC, r.display_name ASC
    `;
    const roles = await queryPromise(rolesQuery, [userId]);

    res.json({
      success: true,
      user: {
        ...user,
        rbac_enabled: user.rbac_enabled === 1
      },
      roles: roles,
      role_ids: roles.map(r => r.id)
    });
  } catch (error) {
    console.error('Error loading user details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/users/:id/roles
 * Update roles for a user
 */
router.put("/:id/roles", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role_ids } = req.body;
    const actorId = getCurrentUserId(req);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Get user
    const userQuery = `SELECT * FROM users WHERE id = ?`;
    const users = await queryPromise(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const user = users[0];

    // Check access
    if (!superAdmin && user.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé: cet utilisateur appartient à une autre organisation'
      });
    }

    // Delete existing roles
    await queryPromise(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);

    // Insert new roles
    if (role_ids && role_ids.length > 0) {
      const values = role_ids.map(roleId =>
        `(${userId}, ${parseInt(roleId)}, ${actorId}, NOW())`
      ).join(',');

      await queryPromise(
        `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at) VALUES ${values}`,
        []
      );
    }

    // Enable RBAC for this user if not already enabled
    if (user.rbac_enabled !== 1) {
      await queryPromise(
        `UPDATE users SET rbac_enabled = 1 WHERE id = ?`,
        [userId]
      );
    }

    // Clear permission cache for this user
    const { clearUserPermissionCache } = require("../middleware/rbac.middleware");
    await clearUserPermissionCache(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/bulk-assign-roles
 * Assign roles to multiple users at once
 */
router.post("/bulk-assign-roles", requirePermission('roles', { json: true }), async (req, res) => {
  try {
    const { user_ids, role_ids } = req.body;
    const actorId = getCurrentUserId(req);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun utilisateur sélectionné' });
    }

    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun rôle sélectionné' });
    }

    // Check access to all users
    const placeholders = user_ids.map(() => '?').join(',');
    const checkQuery = `SELECT id, organization_id FROM users WHERE id IN (${placeholders})`;
    const users = await queryPromise(checkQuery, user_ids);

    if (users.length !== user_ids.length) {
      return res.status(404).json({ success: false, error: 'Certains utilisateurs n\'existent pas' });
    }

    // Check organization access
    if (!superAdmin) {
      const wrongOrgUsers = users.filter(u => u.organization_id !== orgId);
      if (wrongOrgUsers.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Certains utilisateurs appartiennent à d\'autres organisations'
        });
      }
    }

    let updatedCount = 0;

    // Update each user - REPLACE all existing roles with selected ones
    for (const userId of user_ids) {
      // Delete all existing roles for this user
      await queryPromise(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);

      // Insert new roles
      const values = role_ids.map(roleId =>
        `(${userId}, ${parseInt(roleId)}, ${actorId}, NOW())`
      ).join(',');

      await queryPromise(
        `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at) VALUES ${values}`,
        []
      );

      // Enable RBAC for this user
      await queryPromise(
        `UPDATE users SET rbac_enabled = 1 WHERE id = ? AND rbac_enabled = 0`,
        [userId]
      );

      // Clear permission cache
      const { clearUserPermissionCache } = require("../middleware/rbac.middleware");
      await clearUserPermissionCache(userId);

      updatedCount++;
    }

    res.json({
      success: true,
      updated_count: updatedCount,
      message: `${updatedCount} utilisateur(s) mis à jour`
    });
  } catch (error) {
    console.error('Error bulk assigning roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/users/:id/toggle-rbac
 * Enable/disable RBAC for a user
 */
router.put("/:id/toggle-rbac", requirePermission('users.manage', { json: true }), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { rbac_enabled } = req.body;
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");

    // Get user
    const userQuery = `SELECT * FROM users WHERE id = ?`;
    const users = await queryPromise(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const user = users[0];

    // Check access
    if (!superAdmin && user.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    // Update RBAC status
    await queryPromise(
      `UPDATE users SET rbac_enabled = ? WHERE id = ?`,
      [rbac_enabled ? 1 : 0, userId]
    );

    // Clear permission cache
    const { clearUserPermissionCache } = require("../middleware/rbac.middleware");
    await clearUserPermissionCache(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling RBAC:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete("/:id", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");
    const currentUserId = getCurrentUserId(req);

    // Prevent self-deletion
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: 'Vous ne pouvez pas vous supprimer vous-même'
      });
    }

    // Get user
    const userQuery = `SELECT * FROM users WHERE id = ?`;
    const users = await queryPromise(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const user = users[0];

    // Check access
    if (!superAdmin && user.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    // Check if user has any data (paniers, commandes, etc.)
    const panierQuery = `SELECT COUNT(*) as count FROM paniers WHERE user_id = ?`;
    const panierResult = await queryPromise(panierQuery, [userId]);

    const commandeQuery = `SELECT COUNT(*) as count FROM commandes WHERE user_id = ?`;
    const commandeResult = await queryPromise(commandeQuery, [userId]);

    const totalData = panierResult[0].count + commandeResult[0].count;

    if (totalData > 0) {
      return res.status(400).json({
        success: false,
        error: `Impossible de supprimer cet utilisateur : ${panierResult[0].count} panier(s) et ${commandeResult[0].count} commande(s) associés. Veuillez plutôt désactiver l'utilisateur.`
      });
    }

    // Delete user roles first (foreign key)
    await queryPromise(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);

    // Delete user
    await queryPromise(`DELETE FROM users WHERE id = ?`, [userId]);

    // Clear permission cache
    const { clearUserPermissionCache } = require("../middleware/rbac.middleware");
    await clearUserPermissionCache(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/users/:id/toggle-active
 * Toggle user active status (is_validated)
 */
router.put("/:id/toggle-active", requirePermission('users', { json: true }), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { is_active } = req.body;
    const orgId = getCurrentOrgId(req);
    const superAdmin = await hasPermission(req, "organizations.view_all");
    const currentUserId = getCurrentUserId(req);

    // Prevent self-deactivation
    if (userId === currentUserId && !is_active) {
      return res.status(400).json({
        success: false,
        error: 'Vous ne pouvez pas vous désactiver vous-même'
      });
    }

    // Get user
    const userQuery = `SELECT * FROM users WHERE id = ?`;
    const users = await queryPromise(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const user = users[0];

    // Check access
    if (!superAdmin && user.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    // Update is_validated (0 = inactive, 1 = active)
    await queryPromise(
      `UPDATE users SET is_validated = ? WHERE id = ?`,
      [is_active ? 1 : 0, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling user active status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
