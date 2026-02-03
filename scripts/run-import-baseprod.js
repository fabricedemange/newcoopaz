/**
 * Exécute l'import baseprod → base cible (coopazfr_commandes).
 *
 * Par défaut : option complète (nouveau modèle uniquement)
 *   - catalog_files, products, catalog_products, paniers, panier_articles
 *   - Pas de table articles ; panier_articles avec catalog_product_id
 *   - Dédoublonnage produits, catégorisation automatique
 *
 * Pour l'ancien import (catalog_files + articles + paniers + panier_articles avec article_id) :
 *   USE_LEGACY_IMPORT=1 node scripts/run-import-baseprod.js
 *
 * Usage:
 *   node scripts/run-import-baseprod.js
 *
 * Variables d'environnement: DB_HOST, DB_USER, DB_PASS, DB_NAME (base cible)
 * La base source doit s'appeler "baseprod" et être sur le même serveur.
 */

if (process.env.USE_LEGACY_IMPORT === "1") {
  require("./run-import-baseprod-legacy.js");
} else {
  require("./run-import-baseprod-complet.js");
}
