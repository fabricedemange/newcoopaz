-- ================================================================
-- Recréation de la table catalog_files (structure pour import_baseprod)
-- ================================================================
-- Date: 2026-02-01
-- Structure déduite exactement des colonnes de l'INSERT dans
-- migrations/import_baseprod.sql (id, filename, originalname, upload_date,
-- expiration_date, uploader_id, description, is_archived, date_livraison,
-- organization_id, referent_order_reminder_enabled, referent_order_reminder_sent_at,
-- image_filename).
--
-- Prérequis : table organizations doit exister.
-- ================================================================

CREATE TABLE IF NOT EXISTS catalog_files (
  id INT(11) NOT NULL AUTO_INCREMENT,
  filename VARCHAR(255) DEFAULT NULL,
  originalname VARCHAR(255) DEFAULT NULL,
  upload_date DATETIME DEFAULT NULL,
  expiration_date DATETIME DEFAULT NULL,
  uploader_id INT(11) DEFAULT NULL,
  description VARCHAR(1024) DEFAULT NULL,
  is_archived INT(11) DEFAULT 0 COMMENT '0 pas archivé, 1 archivé, 2 masqué user, 3 masqué complet(equivalent supprimé)',
  date_livraison DATE NULL DEFAULT NULL,
  organization_id INT(11) DEFAULT NULL,
  referent_order_reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
  referent_order_reminder_sent_at DATETIME DEFAULT NULL,
  image_filename VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY uploader_id (uploader_id),
  KEY fk_catalog_files_organization (organization_id),
  CONSTRAINT fk_catalog_files_organization FOREIGN KEY (organization_id) REFERENCES organizations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
