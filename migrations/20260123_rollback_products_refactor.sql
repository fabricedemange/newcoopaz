-- Rollback: Annulation de la refactorisation des produits
-- Date: 2026-01-23
-- Description: Restaure la structure originale en cas de problème
--
-- ATTENTION: Ce script annule la migration mais restaure depuis _old_articles_backup
-- Si cette table n'existe pas, vous devrez restaurer depuis votre backup mysqldump!

-- ============================================================================
-- VÉRIFICATION PRÉALABLE
-- ============================================================================

-- Vérifier que la sauvegarde existe
SELECT COUNT(*) as articles_backup_count
FROM _old_articles_backup;

-- ============================================================================
-- ÉTAPE 1: Restaurer panier_articles (si migration pas finalisée)
-- ============================================================================

-- Si l'ancienne colonne article_id existe encore:
UPDATE panier_articles pa
SET pa.article_id = (
  SELECT old_article_id
  FROM _migration_article_mapping m
  WHERE m.new_catalog_product_id = pa.catalog_product_id
)
WHERE pa.catalog_product_id IS NOT NULL AND pa.article_id IS NULL;

-- Supprimer catalog_product_id
ALTER TABLE panier_articles DROP COLUMN IF EXISTS catalog_product_id;

-- ============================================================================
-- ÉTAPE 2: Restaurer la table articles (si elle a été renommée)
-- ============================================================================

-- Si articles a été renommée, la restaurer
-- RENAME TABLE articles TO _articles_new_structure;
-- RENAME TABLE _old_articles_backup TO articles;

-- ============================================================================
-- ÉTAPE 3: Supprimer les nouvelles tables
-- ============================================================================

-- Supprimer les tables dans l'ordre (contraintes FK)
DROP TABLE IF EXISTS catalog_products;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS _migration_article_mapping;

-- ============================================================================
-- ÉTAPE 4: Restaurer les contraintes FK originales
-- ============================================================================

-- Restaurer la FK entre panier_articles et articles
ALTER TABLE panier_articles
  ADD CONSTRAINT fk_panier_articles_article
  FOREIGN KEY (article_id)
  REFERENCES articles(id) ON DELETE CASCADE;

-- ============================================================================
-- VÉRIFICATION POST-ROLLBACK
-- ============================================================================

SELECT
  'Articles restaurés' AS metric,
  COUNT(*) AS value
FROM articles
UNION ALL
SELECT
  'Panier_articles avec article_id',
  COUNT(*)
FROM panier_articles
WHERE article_id IS NOT NULL
UNION ALL
SELECT
  'Panier_articles orphelins',
  COUNT(*)
FROM panier_articles
WHERE article_id IS NULL;

-- ============================================================================
-- FIN DU ROLLBACK
-- ============================================================================

SELECT 'Rollback terminé. Vérifiez les métriques ci-dessus.' AS status;
