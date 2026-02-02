/**
 * Migration: Réutiliser article_id pour les paniers caisse
 *
 * On change la FK article_id de articles → products
 * Comme ça:
 * - Paniers catalogue: catalog_product_id renseigné
 * - Paniers caisse: article_id renseigné (pointe vers products)
 * - Avoirs: utiliser note = 'AVOIR: commentaire', quantity = montant négatif
 */

-- 1. Drop l'ancienne FK article_id → articles
ALTER TABLE panier_articles DROP FOREIGN KEY panier_articles_ibfk_2;

-- 2. Créer nouvelle FK article_id → products
ALTER TABLE panier_articles
  ADD CONSTRAINT panier_articles_ibfk_2
  FOREIGN KEY (article_id) REFERENCES products(id) ON DELETE RESTRICT;

-- 3. Modifier catalog_file_id pour être nullable (optionnel pour caisse)
ALTER TABLE paniers
  MODIFY COLUMN catalog_file_id INT(11) NULL;

-- Note: Pour les avoirs dans paniers caisse:
-- - article_id = NULL
-- - catalog_product_id = NULL
-- - quantity = montant négatif
-- - note = 'AVOIR: commentaire'
