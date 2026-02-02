-- Ajout d'une image par produit (article)
-- Stocke uniquement le nom de fichier (servi via /uploads/article-images/<filename>)

ALTER TABLE articles
  ADD COLUMN image_filename VARCHAR(255) NULL;
