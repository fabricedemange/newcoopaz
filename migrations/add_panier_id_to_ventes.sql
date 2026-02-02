/**
 * Migration: Ajouter lien entre ventes et paniers
 *
 * Pour retrouver l'historique complet d'un passage en caisse:
 * - Si panier_id IS NOT NULL: la vente vient d'un panier sauvegardé (caisse ou catalogue)
 * - Si panier_id IS NULL: vente directe sans sauvegarde préalable
 */

-- Ajouter colonne panier_id dans ventes
ALTER TABLE ventes
  ADD COLUMN IF NOT EXISTS panier_id INT(11) NULL COMMENT 'Panier source (si vente issue d\'un panier)' AFTER adherent_id,
  ADD INDEX IF NOT EXISTS idx_ventes_panier (panier_id);

-- Ajouter FK vers paniers (ON DELETE SET NULL pour garder vente si panier supprimé)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ventes'
    AND COLUMN_NAME = 'panier_id'
    AND REFERENCED_TABLE_NAME = 'paniers'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE ventes ADD FOREIGN KEY (panier_id) REFERENCES paniers(id) ON DELETE SET NULL',
  'SELECT "FK already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
