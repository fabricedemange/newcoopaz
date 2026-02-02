-- Ajout d'une image par catalogue
-- Stocke uniquement le nom de fichier (servi via /uploads/catalogue-images/<filename>)

ALTER TABLE catalog_files
  ADD COLUMN image_filename VARCHAR(255) NULL;
