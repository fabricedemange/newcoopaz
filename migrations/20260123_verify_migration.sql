-- Script de vérification post-migration
-- Date: 2026-01-23
-- Description: Vérifie que la migration s'est bien déroulée

-- ============================================================================
-- RAPPORT DE VÉRIFICATION POST-MIGRATION
-- ============================================================================

SELECT '========================================' as '';
SELECT 'RAPPORT DE VÉRIFICATION POST-MIGRATION' as '';
SELECT '========================================' as '';
SELECT '' as '';

-- ============================================================================
-- 1. VÉRIFICATION DES TABLES
-- ============================================================================

SELECT '1. TABLES CRÉÉES' as '';
SELECT '---------------' as '';

SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ products existe' ELSE '❌ products manquante' END as status
FROM information_schema.tables
WHERE table_schema = 'coopazfr_commandes' AND table_name = 'products';

SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ catalog_products existe' ELSE '❌ catalog_products manquante' END as status
FROM information_schema.tables
WHERE table_schema = 'coopazfr_commandes' AND table_name = 'catalog_products';

SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ _migration_article_mapping existe' ELSE '❌ mapping manquante' END as status
FROM information_schema.tables
WHERE table_schema = 'coopazfr_commandes' AND table_name = '_migration_article_mapping';

SELECT '' as '';

-- ============================================================================
-- 2. STATISTIQUES DES DONNÉES
-- ============================================================================

SELECT '2. STATISTIQUES' as '';
SELECT '---------------' as '';

-- Nombre de produits créés
SELECT
  CONCAT('✅ ', COUNT(*), ' produits créés') as resultat
FROM products;

-- Nombre de liaisons créées
SELECT
  CONCAT('✅ ', COUNT(*), ' catalog_products créés') as resultat
FROM catalog_products;

-- Nombre d'articles originaux
SELECT
  CONCAT('📊 ', COUNT(*), ' articles dans l\'ancienne table') as resultat
FROM articles;

-- Ratio de compression
SELECT
  CONCAT(
    '📈 Compression: ',
    ROUND((1 - (SELECT COUNT(*) FROM products) / (SELECT COUNT(*) FROM articles)) * 100, 1),
    '% de réduction'
  ) as resultat;

SELECT '' as '';

-- ============================================================================
-- 3. VÉRIFICATION CRITIQUE: PANIERS MIGRÉS
-- ============================================================================

SELECT '3. MIGRATION DES PANIERS (CRITIQUE!)' as '';
SELECT '-------------------------------------' as '';

SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ TOUS les paniers ont été migrés'
    ELSE CONCAT('❌ ERREUR: ', COUNT(*), ' paniers NON MIGRÉS!')
  END as status,
  COUNT(*) as nombre_non_migres
FROM panier_articles
WHERE article_id IS NOT NULL AND catalog_product_id IS NULL;

-- Nombre total de paniers
SELECT
  CONCAT('📊 ', COUNT(*), ' lignes de panier au total') as resultat
FROM panier_articles;

-- Paniers avec la nouvelle structure
SELECT
  CONCAT('✅ ', COUNT(*), ' paniers avec catalog_product_id') as resultat
FROM panier_articles
WHERE catalog_product_id IS NOT NULL;

SELECT '' as '';

-- ============================================================================
-- 4. INTÉGRITÉ DES DONNÉES
-- ============================================================================

SELECT '4. INTÉGRITÉ DES DONNÉES' as '';
SELECT '-------------------------' as '';

-- Vérifier les produits sans organisation
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Tous les produits ont une organization_id'
    ELSE CONCAT('⚠️  ', COUNT(*), ' produits sans organization_id')
  END as status
FROM products
WHERE organization_id IS NULL;

-- Vérifier les catalog_products orphelins (sans produit)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Toutes les liaisons ont un produit valide'
    ELSE CONCAT('❌ ERREUR: ', COUNT(*), ' liaisons orphelines')
  END as status
FROM catalog_products cp
LEFT JOIN products p ON cp.product_id = p.id
WHERE p.id IS NULL;

-- Vérifier les catalog_products orphelins (sans catalogue)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Toutes les liaisons ont un catalogue valide'
    ELSE CONCAT('❌ ERREUR: ', COUNT(*), ' liaisons sans catalogue')
  END as status
FROM catalog_products cp
LEFT JOIN catalog_files cf ON cp.catalog_file_id = cf.id
WHERE cf.id IS NULL;

-- Vérifier les doublons dans catalog_products
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Pas de doublons dans catalog_products'
    ELSE CONCAT('⚠️  ', COUNT(*), ' doublons trouvés')
  END as status,
  COUNT(*) as nombre_doublons
FROM (
  SELECT catalog_file_id, product_id, COUNT(*) as nb
  FROM catalog_products
  GROUP BY catalog_file_id, product_id
  HAVING COUNT(*) > 1
) as doublons;

SELECT '' as '';

-- ============================================================================
-- 5. VÉRIFICATION DES IMAGES
-- ============================================================================

SELECT '5. MIGRATION DES IMAGES' as '';
SELECT '-----------------------' as '';

-- Images dans products
SELECT
  CONCAT('📷 ', COUNT(*), ' produits avec image') as resultat
FROM products
WHERE image_filename IS NOT NULL;

-- Images dans articles
SELECT
  CONCAT('📊 ', COUNT(*), ' articles avaient une image') as resultat
FROM articles
WHERE image_filename IS NOT NULL;

-- Produits sans image mais articles avec image
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Toutes les images ont été migrées'
    ELSE CONCAT('⚠️  ', COUNT(*), ' images potentiellement perdues')
  END as status
FROM (
  SELECT DISTINCT p.id
  FROM products p
  INNER JOIN catalog_products cp ON cp.product_id = p.id
  INNER JOIN articles a ON (
    a.catalog_file_id = cp.catalog_file_id
    AND a.produit = p.nom
    AND a.image_filename IS NOT NULL
  )
  WHERE p.image_filename IS NULL
) as missing_images;

SELECT '' as '';

-- ============================================================================
-- 6. DISTRIBUTION DES DONNÉES
-- ============================================================================

SELECT '6. DISTRIBUTION' as '';
SELECT '---------------' as '';

-- Produits par organisation
SELECT
  CONCAT('📊 ', organization_id, ': ', COUNT(*), ' produits') as resultat
FROM products
GROUP BY organization_id
ORDER BY organization_id;

-- Top 5 des produits les plus utilisés
SELECT
  CONCAT('🏆 "', p.nom, '" dans ', COUNT(*), ' catalogues') as top_produits
FROM catalog_products cp
INNER JOIN products p ON cp.product_id = p.id
GROUP BY p.id, p.nom
ORDER BY COUNT(*) DESC
LIMIT 5;

SELECT '' as '';

-- ============================================================================
-- 7. COHÉRENCE DES PRIX
-- ============================================================================

SELECT '7. COHÉRENCE DES PRIX' as '';
SELECT '---------------------' as '';

-- Produits avec variation de prix importante (>50%)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Pas de variation de prix anormale'
    ELSE CONCAT('⚠️  ', COUNT(*), ' produits avec variation >50%')
  END as status
FROM (
  SELECT
    p.nom,
    MIN(cp.prix) as prix_min,
    MAX(cp.prix) as prix_max,
    (MAX(cp.prix) - MIN(cp.prix)) / NULLIF(MIN(cp.prix), 0) * 100 as variation_pct
  FROM catalog_products cp
  INNER JOIN products p ON cp.product_id = p.id
  WHERE cp.prix IS NOT NULL
  GROUP BY p.id, p.nom
  HAVING variation_pct > 50
) as variations;

-- Produits sans prix
SELECT
  CONCAT('⚠️  ', COUNT(*), ' liaisons sans prix') as resultat
FROM catalog_products
WHERE prix IS NULL;

SELECT '' as '';

-- ============================================================================
-- 8. TABLE DE MAPPING
-- ============================================================================

SELECT '8. TABLE DE MAPPING' as '';
SELECT '-------------------' as '';

-- Vérifier que tous les articles ont un mapping
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ Tous les articles ont un mapping'
    ELSE CONCAT('❌ ERREUR: ', COUNT(*), ' articles sans mapping')
  END as status
FROM articles a
LEFT JOIN _migration_article_mapping m ON a.id = m.old_article_id
WHERE m.old_article_id IS NULL;

-- Nombre de mappings créés
SELECT
  CONCAT('📊 ', COUNT(*), ' mappings créés') as resultat
FROM _migration_article_mapping;

SELECT '' as '';

-- ============================================================================
-- 9. RECOMMANDATIONS
-- ============================================================================

SELECT '9. RECOMMANDATIONS' as '';
SELECT '-----------------' as '';

-- Si tout est OK
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL) = 0
      AND (SELECT COUNT(*) FROM catalog_products cp LEFT JOIN products p ON cp.product_id = p.id WHERE p.id IS NULL) = 0
      AND (SELECT COUNT(*) FROM articles a LEFT JOIN _migration_article_mapping m ON a.id = m.old_article_id WHERE m.old_article_id IS NULL) = 0
    THEN '✅ Migration réussie! Vous pouvez:'
    ELSE '❌ Des erreurs ont été détectées! Ne pas continuer.'
  END as status;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL) = 0
    THEN '   1. Adapter le code applicatif (voir CODE_EXAMPLES_refactor.md)'
    ELSE ''
  END as etape1;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL) = 0
    THEN '   2. Tester intensivement l\'application'
    ELSE ''
  END as etape2;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL) = 0
    THEN '   3. Finaliser la migration (étape 6 du script principal)'
    ELSE ''
  END as etape3;

SELECT '' as '';

-- ============================================================================
-- 10. RÉSUMÉ FINAL
-- ============================================================================

SELECT '10. RÉSUMÉ FINAL' as '';
SELECT '----------------' as '';

SELECT
  'Articles originaux' as metrique,
  COUNT(*) as valeur
FROM articles
UNION ALL
SELECT
  'Produits uniques créés',
  COUNT(*)
FROM products
UNION ALL
SELECT
  'Catalog_products créés',
  COUNT(*)
FROM catalog_products
UNION ALL
SELECT
  'Paniers migrés',
  COUNT(*)
FROM panier_articles
WHERE catalog_product_id IS NOT NULL
UNION ALL
SELECT
  'Paniers NON migrés (devrait être 0!)',
  COUNT(*)
FROM panier_articles
WHERE catalog_product_id IS NULL
UNION ALL
SELECT
  'Taux de compression',
  ROUND((1 - (SELECT COUNT(*) FROM products) / (SELECT COUNT(*) FROM articles)) * 100, 1);

SELECT '' as '';
SELECT '========================================' as '';
SELECT 'FIN DU RAPPORT' as '';
SELECT '========================================' as '';
