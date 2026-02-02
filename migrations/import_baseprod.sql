-- ================================================================
-- IMPORT DES DONNÉES DE BASEPROD VERS COOPAZFR_COMMANDES
-- ================================================================
-- Date: 2026-01-30
-- Source: baseprod (ancienne structure - catalogues et articles)
-- Cible: coopazfr_commandes (nouvelle structure)
--
-- IMPORTANT: Ce script vide les tables catalog_files et articles
-- dans la base cible avant l'import
--
-- NE TOUCHE PAS: users, roles, permissions, suppliers, categories,
--                organizations, products, catalog_products
-- ================================================================

USE coopazfr_commandes;

-- ================================================================
-- ÉTAPE 1: VIDAGE DES TABLES CIBLES
-- ================================================================
SET FOREIGN_KEY_CHECKS = 0;

-- Vider les tables liées aux catalogues et articles (ancien système)
TRUNCATE TABLE panier_articles;
TRUNCATE TABLE paniers;
TRUNCATE TABLE articles;
TRUNCATE TABLE catalog_files;

SET FOREIGN_KEY_CHECKS = 1;

-- ================================================================
-- ÉTAPE 2: IMPORT CATALOG_FILES
-- ================================================================
INSERT INTO coopazfr_commandes.catalog_files
  (id, filename, originalname, upload_date, expiration_date, uploader_id,
   description, is_archived, date_livraison, organization_id,
   referent_order_reminder_enabled, referent_order_reminder_sent_at)
SELECT
  id, filename, originalname, upload_date, expiration_date, uploader_id,
  description, is_archived, date_livraison, organization_id,
  referent_order_reminder_enabled, referent_order_reminder_sent_at
FROM baseprod.catalog_files;

-- ================================================================
-- ÉTAPE 3: IMPORT ARTICLES
-- ================================================================
INSERT INTO coopazfr_commandes.articles
  (id, catalog_file_id, produit, description, prix, unite, image_filename)
SELECT
  id, catalog_file_id, produit, description, prix, unite, image_filename
FROM baseprod.articles;

-- ================================================================
-- ÉTAPE 4: VÉRIFICATIONS
-- ================================================================
-- Compter les enregistrements importés
SELECT
  'catalog_files importés' as resultat,
  COUNT(*) as nombre
FROM coopazfr_commandes.catalog_files
UNION ALL
SELECT
  'articles importés' as resultat,
  COUNT(*) as nombre
FROM coopazfr_commandes.articles;

-- Vérifier l'intégrité référentielle
SELECT
  'Articles orphelins (sans catalogue)' as verification,
  COUNT(*) as nombre
FROM coopazfr_commandes.articles a
LEFT JOIN coopazfr_commandes.catalog_files cf ON a.catalog_file_id = cf.id
WHERE cf.id IS NULL;

SELECT '✓ Import terminé avec succès' as statut;
