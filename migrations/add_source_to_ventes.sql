-- =============================================
-- MIGRATION: Ajout du champ source dans ventes
-- =============================================
-- Description: Distinguer les ventes de caisse ('caisse') des ventes de catalogue ('catalogue')
-- Date: 2026-01-31
-- =============================================

-- Ajouter la colonne source si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'ventes';
SET @columnname = 'source';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20) DEFAULT ''caisse'' AFTER statut')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ajouter index sur source
SET @indexname = 'idx_source';
SET @preparedStatement2 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX ', @indexname, ' (source)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement2;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- Mettre à jour les ventes existantes pour qu'elles soient marquées 'caisse' par défaut
UPDATE ventes SET source = 'caisse' WHERE source IS NULL OR source = '';

-- FIN MIGRATION
SELECT 'Migration add_source_to_ventes.sql terminée avec succès!' as message;
