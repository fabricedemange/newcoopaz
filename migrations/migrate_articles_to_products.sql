-- ================================================================
-- MIGRATION ARTICLES → PRODUCTS + CATALOG_PRODUCTS
-- ================================================================
-- Date: 2026-01-30
-- Objectif: Migrer tous les articles importés vers le système products
-- Conserver les products existants (2833)
-- ================================================================

USE coopazfr_commandes;

-- ================================================================
-- ÉTAPE 1: Créer products pour chaque article unique (par nom)
-- ================================================================
-- Insertion des articles comme products s'ils n'existent pas déjà
-- On utilise organization_id du catalogue pour chaque article
INSERT INTO products (organization_id, nom, description, category_id, supplier_id, image_filename)
SELECT DISTINCT
  cf.organization_id,
  a.produit as nom,
  a.description,
  NULL as category_id,  -- Pas de catégorie pour les articles importés
  NULL as supplier_id,  -- Pas de fournisseur pour les articles importés
  a.image_filename
FROM articles a
INNER JOIN catalog_files cf ON cf.id = a.catalog_file_id
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.nom = a.produit
  AND p.organization_id = cf.organization_id
  AND (p.description = a.description OR (p.description IS NULL AND a.description IS NULL))
);

-- ================================================================
-- ÉTAPE 2: Créer catalog_products pour lier articles aux catalogues
-- ================================================================
-- Pour chaque article, créer une entrée catalog_product
INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite, ordre)
SELECT DISTINCT
  a.catalog_file_id,
  p.id as product_id,
  a.prix,
  a.unite,
  a.id as ordre  -- Utiliser l'ID article comme ordre pour conserver l'ordre original
FROM articles a
INNER JOIN catalog_files cf ON cf.id = a.catalog_file_id
INNER JOIN products p ON p.nom = a.produit
  AND p.organization_id = cf.organization_id
  AND (p.description = a.description OR (p.description IS NULL AND a.description IS NULL))
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_products cp
  WHERE cp.catalog_file_id = a.catalog_file_id
  AND cp.product_id = p.id
);

-- ================================================================
-- ÉTAPE 3: Créer table de mapping article_id → catalog_product_id
-- ================================================================
DROP TABLE IF EXISTS _migration_article_to_catalog_product;
CREATE TABLE _migration_article_to_catalog_product (
  article_id INT NOT NULL,
  catalog_product_id INT NOT NULL,
  PRIMARY KEY (article_id),
  KEY (catalog_product_id)
);

INSERT INTO _migration_article_to_catalog_product (article_id, catalog_product_id)
SELECT
  a.id as article_id,
  MIN(cp.id) as catalog_product_id
FROM articles a
INNER JOIN catalog_files cf ON cf.id = a.catalog_file_id
INNER JOIN products p ON p.nom = a.produit
  AND p.organization_id = cf.organization_id
  AND (p.description = a.description OR (p.description IS NULL AND a.description IS NULL))
INNER JOIN catalog_products cp ON cp.catalog_file_id = a.catalog_file_id
  AND cp.product_id = p.id
GROUP BY a.id;

-- ================================================================
-- ÉTAPE 4: Mettre à jour panier_articles pour utiliser catalog_product_id
-- ================================================================
UPDATE panier_articles pa
INNER JOIN _migration_article_to_catalog_product m ON m.article_id = pa.article_id
SET pa.catalog_product_id = m.catalog_product_id
WHERE pa.catalog_product_id IS NULL;

-- ================================================================
-- ÉTAPE 5: VÉRIFICATIONS
-- ================================================================
SELECT 'Nouveaux products créés' as resultat,
  (SELECT COUNT(*) FROM products) as nombre;

SELECT 'catalog_products créés' as resultat,
  (SELECT COUNT(*) FROM catalog_products) as nombre;

SELECT 'panier_articles migrés (avec catalog_product_id)' as resultat,
  COUNT(*) as nombre
FROM panier_articles
WHERE catalog_product_id IS NOT NULL;

SELECT 'panier_articles NON migrés (sans catalog_product_id)' as resultat,
  COUNT(*) as nombre
FROM panier_articles
WHERE article_id IS NOT NULL AND catalog_product_id IS NULL;

SELECT '✓ Migration terminée' as statut;
