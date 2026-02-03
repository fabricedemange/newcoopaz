/**
 * Cache optimisé pour les bandeaux d'information
 * Réduit les requêtes SQL répétitives
 */

const NodeCache = require("node-cache");
const { db } = require("../config/config");

// Cache avec TTL de 5 minutes
const bandeauxCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Récupère les bandeaux depuis le cache ou la DB
 */
function getBandeaux(callback) {
  // En test : pas de DB, retourner une liste vide sans requête
  if (process.env.NODE_ENV === "test") {
    return callback(null, []);
  }

  const cacheKey = "bandeaux";

  // Vérifier le cache
  const cached = bandeauxCache.get(cacheKey);
  if (cached) {
    return callback(null, cached);
  }

  // Requête DB si pas en cache
  db.query(
    `SELECT * FROM bandeaux
     WHERE (expiration_date IS NULL OR expiration_date >= CURDATE())
     ORDER BY expiration_date ASC`,
    (err, results) => {
      if (err) {
        return callback(err);
      }

      // Mettre en cache
      bandeauxCache.set(cacheKey, results);
      callback(null, results);
    }
  );
}

/**
 * Invalide le cache des bandeaux (à appeler après modification)
 */
function invalidateBandeauxCache() {
  bandeauxCache.del('bandeaux');
}

module.exports = {
  getBandeaux,
  invalidateBandeauxCache
};