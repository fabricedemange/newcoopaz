/**
 * Migration: Support paniers caisse avec produits directs et avoirs
 *
 * Cette migration permet:
 * 1. D'utiliser les paniers pour la caisse (pas seulement catalogues)
 * 2. D'avoir des lignes avec product_id direct (pas seulement catalog_product_id)
 * 3. De sauvegarder le prix au moment de l'ajout (prix_unitaire)
 * 4. D'ajouter des avoirs (lignes négatives)
 */

-- Modifier panier_articles pour supporter produits directs
ALTER TABLE panier_articles
  MODIFY COLUMN catalog_product_id INT(11) NULL COMMENT 'ID produit catalogue (si source=catalogue)',
  ADD COLUMN product_id INT(11) NULL COMMENT 'ID produit direct (si source=caisse)' AFTER catalog_product_id,
  ADD COLUMN prix_unitaire DECIMAL(10,2) NULL COMMENT 'Prix snapshot pour produits directs et avoirs' AFTER quantity,
  ADD COLUMN nom_produit VARCHAR(255) NULL COMMENT 'Nom snapshot pour avoirs' AFTER product_id,
  ADD FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- Ajouter contrainte: soit catalog_product_id, soit product_id, mais pas les deux
-- (sauf pour les avoirs où les deux sont NULL)
ALTER TABLE panier_articles
  ADD CONSTRAINT check_product_source
    CHECK (
      (catalog_product_id IS NOT NULL AND product_id IS NULL) OR
      (catalog_product_id IS NULL AND product_id IS NOT NULL) OR
      (catalog_product_id IS NULL AND product_id IS NULL)
    );

-- Modifier paniers pour supporter source caisse
ALTER TABLE paniers
  ADD COLUMN source ENUM('catalogue', 'caisse') DEFAULT 'catalogue' COMMENT 'Source du panier' AFTER is_submitted,
  ADD COLUMN saved_at TIMESTAMP NULL COMMENT 'Date de mise de côté (seulement caisse)' AFTER source,
  MODIFY COLUMN catalog_file_id INT(11) NULL COMMENT 'Optionnel pour paniers caisse';

-- Index pour performance
CREATE INDEX idx_paniers_source ON paniers(source, is_submitted);
CREATE INDEX idx_paniers_user_caisse ON paniers(user_id, source, is_submitted);
CREATE INDEX idx_panier_articles_product ON panier_articles(product_id);

-- Note: Les avoirs sont représentés par des lignes avec:
-- - catalog_product_id = NULL
-- - product_id = NULL
-- - nom_produit = 'Avoir: {commentaire}'
-- - prix_unitaire < 0 (NÉGATIF)
