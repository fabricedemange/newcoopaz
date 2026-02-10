-- =============================================
-- MIGRATION: Réceptions - mémoriser la précommande (catalogue) utilisée
-- =============================================
-- Ajoute catalog_file_id sur receptions pour enregistrer quel catalogue
-- a servi à préremplir les lignes (précommande utilisée).
-- Date: 2026-02-06
-- =============================================

ALTER TABLE receptions
  ADD COLUMN catalog_file_id INT NULL COMMENT 'Catalogue (précommande) utilisé pour préremplir les lignes' AFTER is_from_preorder,
  ADD INDEX idx_receptions_catalog (catalog_file_id),
  ADD CONSTRAINT fk_receptions_catalog_file
    FOREIGN KEY (catalog_file_id) REFERENCES catalog_files(id) ON DELETE SET NULL;

-- FIN
SELECT 'Migration 20260206_receptions_catalog_file_id.sql terminée.' AS message;
