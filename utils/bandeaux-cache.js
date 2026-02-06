/**
 * Cache optimisé pour les bandeaux d'information
 * Réduit les requêtes SQL répétitives et le travail JS (pré-filtrage par organisation)
 * Voir ANALYSE_PERFORMANCES.md § 3.2
 */

const NodeCache = require("node-cache");
const { db } = require("../config/config");

// Cache avec TTL de 5 minutes
const bandeauxCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const CACHE_KEY_PREFIX = "bandeaux_org_";

/**
 * Récupère les bandeaux depuis le cache ou la DB, pré-filtrés par organisation.
 * @param {number|null} orgId - ID organisation (null = visiteur, on ne charge que les bandeaux globaux org 0)
 * @param {Function} callback - (err, bandeaux)
 */
function getBandeaux(orgId, callback) {
  // En test : pas de DB, retourner une liste vide sans requête
  if (process.env.NODE_ENV === "test") {
    return callback(null, []);
  }

  // Visiteur ou org non définie : uniquement bandeaux globaux (organization_id = 0)
  const orgParam = orgId ?? 0;
  const cacheKey = CACHE_KEY_PREFIX + orgParam;

  // Vérifier le cache
  const cached = bandeauxCache.get(cacheKey);
  if (cached) {
    return callback(null, cached);
  }

  // Requête DB : pré-filtrage par organisation (réduit volume en cache et filtre JS)
  db.query(
    `SELECT * FROM bandeaux
     WHERE (expiration_date IS NULL OR expiration_date >= CURDATE())
       AND (organization_id = ? OR organization_id = 0)
     ORDER BY expiration_date ASC`,
    [orgParam],
    (err, results) => {
      if (err) {
        return callback(err);
      }

      bandeauxCache.set(cacheKey, results);
      callback(null, results);
    }
  );
}

/**
 * Invalide le cache des bandeaux (à appeler après création/modification/suppression).
 * Invalide toutes les entrées par org car un bandeau global (org 0) apparaît dans chaque cache.
 */
function invalidateBandeauxCache() {
  const keys = bandeauxCache.keys().filter((k) => k.startsWith(CACHE_KEY_PREFIX));
  keys.forEach((k) => bandeauxCache.del(k));
}

module.exports = {
  getBandeaux,
  invalidateBandeauxCache
};