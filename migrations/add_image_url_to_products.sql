-- =============================================
-- MIGRATION: Ajout de la colonne image_url dans products
-- =============================================
-- Description: Ajouter une colonne pour stocker l'URL des images de produits
-- Date: 2026-01-31
-- =============================================

-- Ajouter la colonne image_url si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'image_url';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) NULL AFTER stock')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- FIN MIGRATION
SELECT 'Migration add_image_url_to_products.sql terminée avec succès!' as message;
