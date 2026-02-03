-- =============================================
-- MIGRATION: Commentaire par ligne d'inventaire (écart)
-- =============================================
-- Description: Ajout colonne comment dans inventaire_lignes
--              pour justifier ou expliquer un écart qté comptée / stock.
-- Date: 2026-02-04
-- =============================================

SET @dbname = DATABASE();
SET @tablename = 'inventaire_lignes';
SET @columnname = 'comment';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      table_schema = @dbname
      AND table_name = @tablename
      AND column_name = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE inventaire_lignes ADD COLUMN comment TEXT NULL COMMENT ''Commentaire ecart'' AFTER ecart'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 20260204_inventaire_lignes_comment.sql terminée.' AS message;
