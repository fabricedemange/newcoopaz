-- ================================================================
-- IMPORT PANIERS ET PANIER_ARTICLES DE BASEPROD
-- ================================================================
-- Date: 2026-01-30
-- Complément du script import_baseprod.sql
-- Import des paniers et articles de paniers
-- ================================================================

USE coopazfr_commandes;

-- ================================================================
-- ÉTAPE 1: IMPORT PANIERS
-- ================================================================
INSERT INTO coopazfr_commandes.paniers
  (id, user_id, catalog_file_id, created_at, is_submitted, note)
SELECT
  id, user_id, catalog_file_id, created_at, is_submitted, note
FROM baseprod.paniers;

-- ================================================================
-- ÉTAPE 2: IMPORT PANIER_ARTICLES
-- ================================================================
INSERT INTO coopazfr_commandes.panier_articles
  (id, panier_id, article_id, quantity, note)
SELECT
  id, panier_id, article_id, quantity, note
FROM baseprod.panier_articles;

-- ================================================================
-- ÉTAPE 3: VÉRIFICATIONS
-- ================================================================
SELECT
  'paniers importés' as resultat,
  COUNT(*) as nombre
FROM coopazfr_commandes.paniers
UNION ALL
SELECT
  'panier_articles importés' as resultat,
  COUNT(*) as nombre
FROM coopazfr_commandes.panier_articles;

-- Vérifier paniers orphelins (sans catalogue)
SELECT
  'Paniers orphelins (sans catalogue)' as verification,
  COUNT(*) as nombre
FROM coopazfr_commandes.paniers p
LEFT JOIN coopazfr_commandes.catalog_files cf ON p.catalog_file_id = cf.id
WHERE cf.id IS NULL;

-- Vérifier panier_articles orphelins
SELECT
  'Articles panier orphelins (sans panier)' as verification,
  COUNT(*) as nombre
FROM coopazfr_commandes.panier_articles pa
LEFT JOIN coopazfr_commandes.paniers p ON pa.panier_id = p.id
WHERE p.id IS NULL;

SELECT
  'Articles panier orphelins (sans article)' as verification,
  COUNT(*) as nombre
FROM coopazfr_commandes.panier_articles pa
LEFT JOIN coopazfr_commandes.articles a ON pa.article_id = a.id
WHERE a.id IS NULL;

SELECT '✓ Import paniers terminé avec succès' as statut;
