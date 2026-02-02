/**
 * Migration V2: Support paniers caisse (version simplifiée)
 *
 * On garde article_id pour l'historique (deprecated mais utilisé dans les anciens paniers)
 * On ajoute juste product_id pour les nouveaux paniers caisse
 *
 * Logique:
 * - Paniers catalogues: catalog_product_id NOT NULL (déjà existant)
 * - Paniers caisse: product_id NOT NULL (nouveau)
 * - Avoirs: product_id = NULL, catalog_product_id = NULL, nom_produit renseigné
 */

-- 1. Ajouter product_id pour pointer directement vers products (paniers caisse)
ALTER TABLE panier_articles
  ADD COLUMN IF NOT EXISTS product_id INT(11) NULL COMMENT 'ID produit direct (pour paniers caisse)' AFTER catalog_product_id,
  ADD COLUMN IF NOT EXISTS prix_unitaire DECIMAL(10,2) NULL COMMENT 'Prix snapshot au moment ajout' AFTER quantity,
  ADD COLUMN IF NOT EXISTS nom_produit VARCHAR(255) NULL COMMENT 'Nom pour avoirs ou snapshot' AFTER product_id;

-- 2. Ajouter FK vers products si pas déjà existante
SET @fk_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'panier_articles'
    AND COLUMN_NAME = 'product_id'
    AND REFERENCED_TABLE_NAME = 'products'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE panier_articles ADD FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT',
  'SELECT "FK already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Ajouter source et saved_at dans paniers
ALTER TABLE paniers
  ADD COLUMN IF NOT EXISTS source ENUM('catalogue', 'caisse') DEFAULT 'catalogue' COMMENT 'Source du panier' AFTER is_submitted,
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP NULL COMMENT 'Date de mise de côté' AFTER source;

-- 4. Rendre catalog_file_id nullable (pas obligatoire pour paniers caisse)
ALTER TABLE paniers
  MODIFY COLUMN catalog_file_id INT(11) NULL COMMENT 'Optionnel pour paniers caisse';

-- 5. Index pour performance
CREATE INDEX IF NOT EXISTS idx_paniers_source ON paniers(source, is_submitted);
CREATE INDEX IF NOT EXISTS idx_paniers_user_caisse ON paniers(user_id, source, is_submitted);
CREATE INDEX IF NOT EXISTS idx_panier_articles_product ON panier_articles(product_id);

-- 6. Mettre à jour les paniers existants comme 'catalogue'
UPDATE paniers SET source = 'catalogue' WHERE source IS NULL;
