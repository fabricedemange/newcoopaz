-- Migration: Refactorisation pour produits réutilisables (V2 SIMPLIFIÉ - sans fonction)
-- Date: 2026-01-23
-- Description: Version simplifiée sans stored procedure
--
-- PRÉREQUIS: Avoir exécuté 20260123_create_suppliers_categories.sql

-- ============================================================================
-- ÉTAPE 1: Création de la table products
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  supplier_id INT(11) DEFAULT NULL COMMENT 'Fournisseur principal du produit',
  category_id INT(11) DEFAULT NULL COMMENT 'Catégorie du produit',
  nom VARCHAR(255) NOT NULL,
  description VARCHAR(1000) DEFAULT NULL,
  image_filename VARCHAR(255) DEFAULT NULL,
  reference_fournisseur VARCHAR(100) DEFAULT NULL,
  code_ean VARCHAR(50) DEFAULT NULL,
  conditionnement VARCHAR(100) DEFAULT NULL,
  dlc_jours INT(11) DEFAULT NULL,
  allergenes TEXT DEFAULT NULL,
  origine VARCHAR(100) DEFAULT NULL,
  label VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_organization_id (organization_id),
  KEY idx_supplier_id (supplier_id),
  KEY idx_category_id (category_id),
  KEY idx_nom (nom),
  KEY idx_is_active (is_active),
  CONSTRAINT fk_products_organization FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- ÉTAPE 2: Création de la table catalog_products
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  catalog_file_id INT(11) NOT NULL,
  product_id INT(11) NOT NULL,
  prix DOUBLE DEFAULT NULL,
  unite DOUBLE NOT NULL DEFAULT 1,
  ordre INT(11) DEFAULT 0,
  notes VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_catalog_file_id (catalog_file_id),
  KEY idx_product_id (product_id),
  UNIQUE KEY unique_catalog_product (catalog_file_id, product_id),
  CONSTRAINT fk_catalog_products_catalog FOREIGN KEY (catalog_file_id)
    REFERENCES catalog_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_products_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- ÉTAPE 3: Migration des produits avec catégorisation automatique
-- ============================================================================

INSERT INTO products (
  organization_id,
  category_id,
  nom,
  description,
  image_filename,
  created_at
)
SELECT
  cf.organization_id,
  -- Catégorisation automatique par CASE
  CASE
    -- Boulangerie / Pains
    WHEN LOWER(a.produit) LIKE '%pain%' OR LOWER(a.produit) LIKE '%baguette%'
         OR LOWER(a.produit) LIKE '%miche%' OR LOWER(a.produit) LIKE '%banneton%'
         OR LOWER(a.produit) LIKE '%focaccia%' OR LOWER(a.produit) LIKE '%brioche%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Boulangerie' LIMIT 1)

    -- Cookies, biscuits
    WHEN LOWER(a.produit) LIKE '%cookie%' OR LOWER(a.produit) LIKE '%biscuit%'
         OR LOWER(a.produit) LIKE '%canistrell%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Biscuits' LIMIT 1)

    -- Fromages
    WHEN LOWER(a.produit) LIKE '%fromage%' OR LOWER(a.produit) LIKE '%comté%'
         OR LOWER(a.produit) LIKE '%bleu%' OR LOWER(a.produit) LIKE '%morbier%'
         OR LOWER(a.produit) LIKE '%raclette%' OR LOWER(a.produit) LIKE '%tomme%'
         OR LOWER(a.produit) LIKE '%tome%' OR LOWER(a.produit) LIKE '%brebis%'
         OR LOWER(a.produit) LIKE '%chèvre%' OR LOWER(a.produit) LIKE '%gex%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Fromagerie' LIMIT 1)

    -- Viandes
    WHEN LOWER(a.produit) LIKE '%boeuf%' OR LOWER(a.produit) LIKE '%bœuf%'
         OR LOWER(a.produit) LIKE '%steak%' OR LOWER(a.produit) LIKE '%viande%'
         OR LOWER(a.produit) LIKE '%porc%' OR LOWER(a.produit) LIKE '%agneau%'
         OR LOWER(a.produit) LIKE '%veau%' OR LOWER(a.produit) LIKE '%gigot%'
         OR LOWER(a.produit) LIKE '%côte%' OR LOWER(a.produit) LIKE '%cote%'
         OR LOWER(a.produit) LIKE '%araignee%' OR LOWER(a.produit) LIKE '%araignée%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Viandes' LIMIT 1)

    -- Charcuterie
    WHEN LOWER(a.produit) LIKE '%sauciss%' OR LOWER(a.produit) LIKE '%jambon%'
         OR LOWER(a.produit) LIKE '%pâté%' OR LOWER(a.produit) LIKE '%terrine%'
         OR LOWER(a.produit) LIKE '%rillette%' OR LOWER(a.produit) LIKE '%chipolata%'
         OR LOWER(a.produit) LIKE '%lardon%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Charcuterie' LIMIT 1)

    -- Volailles
    WHEN LOWER(a.produit) LIKE '%poulet%' OR LOWER(a.produit) LIKE '%canard%'
         OR LOWER(a.produit) LIKE '%pintade%' OR LOWER(a.produit) LIKE '%coquelet%'
         OR LOWER(a.produit) LIKE '%foie gras%' OR LOWER(a.produit) LIKE '%magret%'
         OR LOWER(a.produit) LIKE '%confit%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Volailles' LIMIT 1)

    -- Poissons
    WHEN LOWER(a.produit) LIKE '%poisson%' OR LOWER(a.produit) LIKE '%truite%'
         OR LOWER(a.produit) LIKE '%saumon%' OR LOWER(a.produit) LIKE '%filet%'
         OR LOWER(a.produit) LIKE '%pavé%' OR LOWER(a.produit) LIKE '%pave%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Poissons' LIMIT 1)

    -- Fruits & Légumes
    WHEN LOWER(a.produit) LIKE '%fruit%' OR LOWER(a.produit) LIKE '%légume%'
         OR LOWER(a.produit) LIKE '%orange%' OR LOWER(a.produit) LIKE '%citron%'
         OR LOWER(a.produit) LIKE '%pomme%' OR LOWER(a.produit) LIKE '%banane%'
         OR LOWER(a.produit) LIKE '%tomate%' OR LOWER(a.produit) LIKE '%avocat%'
         OR LOWER(a.produit) LIKE '%agrume%' OR LOWER(a.produit) LIKE '%clémentine%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Fruits & Légumes' LIMIT 1)

    -- Boissons
    WHEN LOWER(a.produit) LIKE '%vin%' OR LOWER(a.produit) LIKE '%bib%'
         OR LOWER(a.produit) LIKE '%jus%' OR LOWER(a.produit) LIKE '%boisson%'
    THEN (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Boissons' LIMIT 1)

    -- Par défaut: Autres
    ELSE (SELECT id FROM categories WHERE organization_id = cf.organization_id AND nom = 'Autres' LIMIT 1)
  END AS category_id,
  a.produit AS nom,
  a.description,
  (SELECT a2.image_filename
   FROM articles a2
   INNER JOIN catalog_files cf2 ON a2.catalog_file_id = cf2.id
   WHERE a2.produit = a.produit
     AND COALESCE(a2.description, '') = COALESCE(a.description, '')
     AND cf2.organization_id = cf.organization_id
     AND a2.image_filename IS NOT NULL
   LIMIT 1) AS image_filename,
  MIN(cf.upload_date) AS created_at
FROM articles a
INNER JOIN catalog_files cf ON a.catalog_file_id = cf.id
GROUP BY cf.organization_id, a.produit, a.description
ORDER BY cf.organization_id, a.produit;

-- ============================================================================
-- ÉTAPE 4: Créer les liaisons catalog_products
-- ============================================================================

INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite, ordre, created_at)
SELECT
  a.catalog_file_id,
  p.id AS product_id,
  a.prix,
  a.unite,
  a.id AS ordre,
  cf.upload_date AS created_at
FROM articles a
INNER JOIN catalog_files cf ON a.catalog_file_id = cf.id
INNER JOIN products p ON (
  p.nom = a.produit
  AND COALESCE(p.description, '') = COALESCE(a.description, '')
  AND p.organization_id = cf.organization_id
);

-- ============================================================================
-- ÉTAPE 5: Table de mapping pour panier_articles
-- ============================================================================

CREATE TABLE IF NOT EXISTS _migration_article_mapping (
  old_article_id INT(11) NOT NULL,
  new_catalog_product_id INT(11) NOT NULL,
  PRIMARY KEY (old_article_id),
  KEY idx_new_catalog_product_id (new_catalog_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO _migration_article_mapping (old_article_id, new_catalog_product_id)
SELECT
  a.id AS old_article_id,
  cp.id AS new_catalog_product_id
FROM articles a
INNER JOIN catalog_files cf ON a.catalog_file_id = cf.id
INNER JOIN products p ON (
  p.nom = a.produit
  AND COALESCE(p.description, '') = COALESCE(a.description, '')
  AND p.organization_id = cf.organization_id
)
INNER JOIN catalog_products cp ON (
  cp.catalog_file_id = a.catalog_file_id
  AND cp.product_id = p.id
);

-- ============================================================================
-- ÉTAPE 6: Mise à jour de panier_articles
-- ============================================================================

ALTER TABLE panier_articles
  ADD COLUMN catalog_product_id INT(11) DEFAULT NULL AFTER article_id;

UPDATE panier_articles pa
INNER JOIN _migration_article_mapping m ON pa.article_id = m.old_article_id
SET pa.catalog_product_id = m.new_catalog_product_id;

-- ============================================================================
-- ÉTAPE 7: Index et optimisations
-- ============================================================================

CREATE INDEX idx_panier_catalog_product ON panier_articles(catalog_product_id);
CREATE INDEX idx_catalog_products_catalog ON catalog_products(catalog_file_id);
CREATE INDEX idx_catalog_products_product ON catalog_products(product_id);

-- ============================================================================
-- ÉTAPE 8: Statistiques
-- ============================================================================

SELECT '========================================' as result;
SELECT 'MIGRATION TERMINÉE - STATISTIQUES' as result;
SELECT '========================================' as result;

SELECT 'Products créés' AS metric, COUNT(*) AS value FROM products
UNION ALL
SELECT 'Catalog_products créés', COUNT(*) FROM catalog_products
UNION ALL
SELECT 'Panier_articles migrés', COUNT(*) FROM panier_articles WHERE catalog_product_id IS NOT NULL
UNION ALL
SELECT 'Paniers NON migrés (devrait être 0!)', COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL;

SELECT '-- Distribution par catégorie --' as result;

SELECT
  COALESCE(c.nom, 'Sans catégorie') as categorie,
  COUNT(p.id) as nombre_produits
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY c.nom
ORDER BY nombre_produits DESC;

SELECT '✅ Migration V2 terminée!' as result;
