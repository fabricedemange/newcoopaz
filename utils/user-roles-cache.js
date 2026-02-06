/**
 * Cache des rôles utilisateur (display_name) pour l'affichage
 * Évite une requête SQL à chaque requête HTTP (voir ANALYSE_PERFORMANCES.md § 3.1)
 */

const NodeCache = require("node-cache");
const { db } = require("../config/config");

// TTL 5 minutes, vérification toutes les 60 s
const userRolesCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const USER_ROLES_PREFIX = "user_roles_";

/**
 * Récupère les noms affichables des rôles d'un utilisateur (cache ou DB)
 * @param {number} userId - ID utilisateur
 * @returns {Promise<string[]>} Liste de display_name
 */
function getDisplayRoles(userId) {
  if (!userId) return Promise.resolve([]);

  if (process.env.NODE_ENV === "test") {
    return Promise.resolve([]);
  }

  const cacheKey = USER_ROLES_PREFIX + userId;
  const cached = userRolesCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const sql = `
      SELECT r.display_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.display_name
    `;
    db.query(sql, [userId], (err, results) => {
      if (err) return reject(err);
      const roles = (results && results.length > 0)
        ? results.map((r) => r.display_name)
        : [];
      userRolesCache.set(cacheKey, roles);
      resolve(roles);
    });
  });
}

/**
 * Invalide le cache des rôles pour un utilisateur (à appeler après modification des user_roles)
 * @param {number} userId - ID utilisateur
 */
function invalidateUserRolesCache(userId) {
  if (!userId) return;
  userRolesCache.del(USER_ROLES_PREFIX + userId);
}

/**
 * Invalide le cache pour plusieurs utilisateurs (ex. bulk assign)
 * @param {number[]} userIds - IDs utilisateurs
 */
function invalidateUserRolesCacheMany(userIds) {
  if (!Array.isArray(userIds)) return;
  userIds.forEach((id) => invalidateUserRolesCache(id));
}

module.exports = {
  getDisplayRoles,
  invalidateUserRolesCache,
  invalidateUserRolesCacheMany,
};
