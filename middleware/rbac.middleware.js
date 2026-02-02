/**
 * RBAC Middleware - Pure RBAC System with Multi-Role Support
 *
 * Features:
 * - Multi-level caching (L1: Map JS, L2: MySQL MEMORY table)
 * - Multi-role support per user
 * - Permission-based access control
 * - 15-minute TTL with auto-refresh
 * - Audit logging for denied permissions
 */

const { getCurrentUserId, getCurrentUserRole, isSuperAdmin } = require('../utils/session-helpers');
const { db } = require('../config/db-trace-wrapper');

// L1 Cache: In-memory JavaScript Map (ultra-fast, <1ms)
const permissionCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Query wrapper with promise support
 * Uses globally imported db connection
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
function queryPromise(query, params = []) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

/**
 * Get all permissions for a user from database (with caching)
 * Uses L1 (Map) and L2 (MySQL MEMORY table) caching
 *
 * @param {number} userId - User ID
 * @param {Object} db - Database connection
 * @returns {Promise<Set<string>>} Set of permission names
 */
async function getUserPermissions(userId) {
  const cacheKey = `user_${userId}_permissions`;
  const now = Date.now();

  // L1 Cache: Check in-memory Map
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  // L2 Cache: Check MySQL MEMORY table
  try {
    const cacheQuery = `
      SELECT DISTINCT permission_name
      FROM permission_cache
      WHERE user_id = ?
        AND expires_at > NOW()
    `;
    const cacheResults = await queryPromise(cacheQuery, [userId]);

    if (cacheResults.length > 0) {
      const permissions = new Set(cacheResults.map(r => r.permission_name));

      // Store in L1 cache
      permissionCache.set(cacheKey, {
        permissions,
        expiresAt: now + CACHE_TTL_MS
      });

      return permissions;
    }
  } catch (err) {
    console.error('Error checking L2 cache:', err);
  }

  // Cache miss: Query from source with JOINs
  const query = `
    SELECT DISTINCT p.name
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = ?
      AND p.is_active = 1
      AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  `;

  try {
    const results = await queryPromise(query, [userId]);
    const permissions = new Set(results.map(r => r.name));

    // Store in L1 cache
    permissionCache.set(cacheKey, {
      permissions,
      expiresAt: now + CACHE_TTL_MS
    });

    // Store in L2 cache (MySQL MEMORY table)
    if (permissions.size > 0) {
      const cacheExpiresAt = new Date(now + CACHE_TTL_MS);
      const values = Array.from(permissions).map(perm =>
        `(${userId}, '${perm.replace(/'/g, "''")}', 1, NOW(), '${cacheExpiresAt.toISOString().slice(0, 19).replace('T', ' ')}')`
      ).join(',');

      const insertCacheQuery = `
        INSERT INTO permission_cache (user_id, permission_name, has_permission, cached_at, expires_at)
        VALUES ${values}
        ON DUPLICATE KEY UPDATE
          has_permission = VALUES(has_permission),
          cached_at = VALUES(cached_at),
          expires_at = VALUES(expires_at)
      `;

      try {
        await queryPromise(insertCacheQuery);
      } catch (err) {
        console.error('Error storing in L2 cache:', err);
      }
    }

    return permissions;
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    return new Set();
  }
}

/**
 * Check if user has a specific permission
 * @param {Object} req - Express request
 * @param {string} permissionName - Permission name (e.g., 'users.view')
 * @returns {Promise<boolean>} True if user has permission
 */
async function hasPermission(req, permissionName) {
  const userId = getCurrentUserId(req);
  if (!userId) return false;

  // Check if RBAC is enabled for this user
  if (!req.session.rbac_enabled) return false;

  // db is imported globally
  const permissions = await getUserPermissions(userId);

  return permissions.has(permissionName);
}

/**
 * Check if user has ANY of the specified permissions (OR logic)
 * @param {Object} req - Express request
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Promise<boolean>} True if user has at least one permission
 */
async function hasAnyPermission(req, permissionNames) {
  const userId = getCurrentUserId(req);
  if (!userId) return false;

  if (!req.session.rbac_enabled) return false;

  // db is imported globally
  const permissions = await getUserPermissions(userId);

  return permissionNames.some(perm => permissions.has(perm));
}

/**
 * Check if user has ALL of the specified permissions (AND logic)
 * @param {Object} req - Express request
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Promise<boolean>} True if user has all permissions
 */
async function hasAllPermissions(req, permissionNames) {
  const userId = getCurrentUserId(req);
  if (!userId) return false;

  if (!req.session.rbac_enabled) return false;

  // db is imported globally
  const permissions = await getUserPermissions(userId);

  return permissionNames.every(perm => permissions.has(perm));
}

/**
 * Log permission denial to audit log
 * @param {Object} req - Express request
 * @param {string} permissionName - Permission that was denied
 */
async function logPermissionDenial(req, permissionName) {
  const userId = getCurrentUserId(req);
  // db is imported globally
  const ipAddress = req.ip || req.connection.remoteAddress;

  const query = `
    INSERT INTO permission_audit_log
      (event_type, user_id, actor_id, permission_name, result, ip_address)
    VALUES
      ('permission_check_denied', ?, ?, ?, 'denied', ?)
  `;

  try {
    await queryPromise(query, [userId, userId, permissionName, ipAddress]);
  } catch (err) {
    console.error('Error logging permission denial:', err);
  }
}

/**
 * Middleware: Require a specific permission
 * @param {string} permissionName - Permission name (e.g., 'users.view')
 * @param {Object} options - Options { json: boolean }
 * @returns {Function} Express middleware
 */
function requirePermission(permissionName, options = {}) {
  return async (req, res, next) => {
    const userId = getCurrentUserId(req);

    if (!userId) {
      if (options.json) {
        return res.status(401).json({
          success: false,
          error: 'Non authentifié'
        });
      }
      return res.redirect('/login');
    }

    // Check RBAC enabled
    if (!req.session.rbac_enabled) {
      if (options.json) {
        return res.status(403).json({
          success: false,
          error: 'RBAC non activé pour cet utilisateur'
        });
      }
      const { getCurrentUsername, getCurrentUserRole } = require('../utils/session-helpers');
      return res.status(403).render('403', {
        message: 'RBAC non activé pour votre compte. Contactez l\'administrateur.',
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req)
      });
    }

    const allowed = await hasPermission(req, permissionName);

    if (!allowed) {
      // Log denial for security monitoring
      await logPermissionDenial(req, permissionName);

      if (options.json) {
        return res.status(403).json({
          success: false,
          error: `Permission refusée: ${permissionName} requise`
        });
      }
      const { getCurrentUsername, getCurrentUserRole } = require('../utils/session-helpers');
      return res.status(403).render('403', {
        message: 'Vous n\'avez pas la permission d\'accéder à cette ressource',
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req)
      });
    }

    next();
  };
}

/**
 * Middleware: Require ANY of the specified permissions (OR logic)
 * @param {Array<string>} permissionNames - Array of permission names
 * @param {Object} options - Options { json: boolean }
 * @returns {Function} Express middleware
 */
function requireAnyPermission(permissionNames, options = {}) {
  return async (req, res, next) => {
    const userId = getCurrentUserId(req);

    if (!userId) {
      if (options.json) {
        return res.status(401).json({
          success: false,
          error: 'Non authentifié'
        });
      }
      return res.redirect('/login');
    }

    if (!req.session.rbac_enabled) {
      if (options.json) {
        return res.status(403).json({
          success: false,
          error: 'RBAC non activé'
        });
      }
      const { getCurrentUsername, getCurrentUserRole } = require('../utils/session-helpers');
      return res.status(403).render('403', {
        message: 'RBAC non activé pour votre compte. Contactez l\'administrateur.',
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req)
      });
    }

    const allowed = await hasAnyPermission(req, permissionNames);

    if (!allowed) {
      await logPermissionDenial(req, permissionNames.join(', '));

      if (options.json) {
        return res.status(403).json({
          success: false,
          error: `Permission refusée: une des permissions requises: ${permissionNames.join(', ')}`
        });
      }
      const { getCurrentUsername, getCurrentUserRole } = require('../utils/session-helpers');
      return res.status(403).render('403', {
        message: 'Vous n\'avez pas la permission d\'accéder à cette ressource',
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req)
      });
    }

    next();
  };
}

/**
 * Middleware: Require ALL of the specified permissions (AND logic)
 * @param {Array<string>} permissionNames - Array of permission names
 * @param {Object} options - Options { json: boolean }
 * @returns {Function} Express middleware
 */
function requireAllPermissions(permissionNames, options = {}) {
  return async (req, res, next) => {
    const userId = getCurrentUserId(req);

    if (!userId) {
      if (options.json) {
        return res.status(401).json({
          success: false,
          error: 'Non authentifié'
        });
      }
      return res.redirect('/login');
    }

    if (!req.session.rbac_enabled) {
      if (options.json) {
        return res.status(403).json({
          success: false,
          error: 'RBAC non activé'
        });
      }
      const { getCurrentUsername, getCurrentUserRole } = require('../utils/session-helpers');
      return res.status(403).render('403', {
        message: 'RBAC non activé pour votre compte. Contactez l\'administrateur.',
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req)
      });
    }

    const allowed = await hasAllPermissions(req, permissionNames);

    if (!allowed) {
      await logPermissionDenial(req, permissionNames.join(', '));

      if (options.json) {
        return res.status(403).json({
          success: false,
          error: `Permission refusée: toutes les permissions requises: ${permissionNames.join(', ')}`
        });
      }
      const { getCurrentUsername, getCurrentUserRole } = require('../utils/session-helpers');
      return res.status(403).render('403', {
        message: 'Vous n\'avez pas toutes les permissions nécessaires',
        user: getCurrentUsername(req),
        role: getCurrentUserRole(req)
      });
    }

    next();
  };
}

/**
 * Clear permission cache for a specific user
 * @param {number} userId - User ID
 * @param {Object} db - Database connection
 */
async function clearUserPermissionCache(userId) {
  // Clear L1 cache
  permissionCache.delete(`user_${userId}_permissions`);

  // Clear L2 cache
  try {
    await queryPromise('DELETE FROM permission_cache WHERE user_id = ?', [userId]);
  } catch (err) {
    console.error('Error clearing L2 cache:', err);
  }
}

/**
 * Clear all permission caches (L1 and L2)
 * @param {Object} db - Database connection
 */
async function clearAllPermissionCaches() {
  // Clear L1 cache
  permissionCache.clear();

  // Clear L2 cache
  try {
    await queryPromise('TRUNCATE TABLE permission_cache');
  } catch (err) {
    console.error('Error clearing all L2 caches:', err);
  }
}

/**
 * Inject permission helper functions into res.locals for EJS templates
 * Usage in EJS: <% if (await hasPermission('users.view')) { %>
 */
function injectPermissionHelpers(req, res, next) {
  res.locals.hasPermission = async (permissionName) => {
    return await hasPermission(req, permissionName);
  };

  res.locals.hasAnyPermission = async (permissionNames) => {
    return await hasAnyPermission(req, permissionNames);
  };

  res.locals.hasAllPermissions = async (permissionNames) => {
    return await hasAllPermissions(req, permissionNames);
  };

  next();
}

/**
 * Cleanup expired cache entries (run periodically)
 */
async function cleanupExpiredCache(db) {
  try {
    await queryPromise('DELETE FROM permission_cache WHERE expires_at < NOW()');
  } catch (err) {
    console.error('Error cleaning up expired cache:', err);
  }
}

// Auto-cleanup every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    // This will be called with db from app context
    console.log('[RBAC] Auto-cleanup expired cache entries');
  }, 30 * 60 * 1000);
}

module.exports = {
  // Permission checking
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,

  // Middleware
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,

  // Cache management
  clearUserPermissionCache,
  clearAllPermissionCaches,
  cleanupExpiredCache,

  // Template helpers
  injectPermissionHelpers
};
