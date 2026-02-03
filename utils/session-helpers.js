/**
 * Session management helpers for secure access to session data
 */

/**
 * Get current organization ID from session with validation
 * @param {Object} req - Request object
 * @returns {number|null} Organization ID or null if invalid
 * @throws {Error} If session is invalid or user not authenticated
 */
function getCurrentOrgId(req) {
  if (!req.session || !req.session.userId) {
    throw new Error("Utilisateur non authentifié");
  }

  const orgId = req.session.organization_id;
  if (orgId === undefined || orgId === null) {
    throw new Error("Organisation non définie pour cet utilisateur");
  }

  return orgId;
}

/**
 * Get current user ID from session with validation
 * @param {Object} req - Request object
 * @returns {number} User ID
 * @throws {Error} If session is invalid
 */
function getCurrentUserId(req) {
  if (!req.session || !req.session.userId) {
    throw new Error("Utilisateur non authentifié");
  }

  return req.session.userId;
}

/**
 * Get current user role from session with validation
 * @param {Object} req - Request object
 * @returns {string} User role
 * @throws {Error} If session is invalid
 */
function getCurrentUserRole(req) {
  if (!req.session || !req.session.role) {
    throw new Error("Rôle utilisateur non défini");
  }

  return req.session.role;
}

/**
 * Get current username from session with validation
 * @param {Object} req - Request object
 * @returns {string} Username
 * @throws {Error} If session is invalid
 */
function getCurrentUsername(req) {
  if (!req.session || !req.session.username) {
    throw new Error("Nom d'utilisateur non défini");
  }

  return req.session.username;
}

/**
 * Retrieve the original user context when impersonating
 * @param {Object} req - Request object
 * @returns {Object|null} Original user data or null
 */
function getOriginalUser(req) {
  if (!req.session) {
    return null;
  }
  return req.session.originalUser || null;
}

/**
 * Check if the current session is impersonating another user
 * @param {Object} req - Request object
 * @returns {boolean} True when impersonating
 */
function isImpersonating(req) {
  return Boolean(req.session && req.session.originalUser);
}

module.exports = {
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentUsername,
  getOriginalUser,
  isImpersonating,
};
