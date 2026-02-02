-- Migration: Refactorisation pour produits réutilisables (V2 avec suppliers et categories)
-- Date: 2026-01-23
-- Description: Création d'une table products avec références fournisseurs et catégories
--
-- PRÉREQUIS: Exécuter d'abord 20260123_create_suppliers_categories.sql
--
-- IMPORTANT: Faire un backup complet avant d'exécuter cette migration!
-- mysqldump -u root coopazfr_commandes > backup_before_products_refactor_$(date +%Y%m%d_%H%M%S).sql

-- ============================================================================
-- ÉTAPE 1: Création de la table products (produits réutilisables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  supplier_id INT(11) DEFAULT NULL COMMENT 'Fournisseur principal du produit',
  category_id INT(11) DEFAULT NULL COMMENT 'Catégorie du produit',
  nom VARCHAR(255) NOT NULL,
  description VARCHAR(1000) DEFAULT NULL,
  image_filename VARCHAR(255) DEFAULT NULL,
  reference_fournisseur VARCHAR(100) DEFAULT NULL COMMENT 'Référence produit chez le fournisseur',
  code_ean VARCHAR(50) DEFAULT NULL COMMENT 'Code-barres EAN/UPC',
  conditionnement VARCHAR(100) DEFAULT NULL COMMENT 'Ex: "Par 6", "Au kilo", "Unité"',
  dlc_jours INT(11) DEFAULT NULL COMMENT 'Durée de vie en jours (DLC/DDM)',
  allergenes TEXT DEFAULT NULL COMMENT 'Liste des allergènes',
  origine VARCHAR(100) DEFAULT NULL COMMENT 'Origine géographique',
  label VARCHAR(100) DEFAULT NULL COMMENT 'Label (Bio, AOP, IGP, etc.)',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_organization_id (organization_id),
  KEY idx_supplier_id (supplier_id),
  KEY idx_category_id (category_id),
  KEY idx_nom (nom),
  KEY idx_is_active (is_active),
  KEY idx_code_ean (code_ean),
  CONSTRAINT fk_products_organization FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Table des produits réutilisables avec références fournisseur et catégorie';

-- ============================================================================
-- ÉTAPE 2: Création de la table catalog_products (liaison catalogue-produit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  catalog_file_id INT(11) NOT NULL,
  product_id INT(11) NOT NULL,
  prix DOUBLE DEFAULT NULL,
  unite DOUBLE NOT NULL DEFAULT 1,
  ordre INT(11) DEFAULT 0,
  notes VARCHAR(500) DEFAULT NULL COMMENT 'Notes spécifiques à ce catalogue',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_catalog_file_id (catalog_file_id),
  KEY idx_product_id (product_id),
  UNIQUE KEY unique_catalog_product (catalog_file_id, product_id),
  CONSTRAINT fk_catalog_products_catalog FOREIGN KEY (catalog_file_id)
    REFERENCES catalog_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_products_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Liaison entre catalogues et produits avec prix spécifiques';

-- ============================================================================
-- ÉTAPE 3: Fonction helper pour détecter la catégorie automatiquement
-- ============================================================================

-- Cette fonction aide à assigner automatiquement une catégorie basée sur le nom du produit
-- Elle sera utilisée lors de la migration des données existantes

DELIMITER //

DROP FUNCTION IF EXISTS detect_category_id//

CREATE FUNCTION detect_category_id(
  p_org_id INT,
  p_product_name VARCHAR(255)
) RETURNS INT
DETERMINISTIC
BEGIN
  DECLARE v_category_id INT DEFAULT NULL;
  DECLARE v_product_lower VARCHAR(255);

  SET v_product_lower = LOWER(p_product_name);

  -- Boulangerie / Pains
  IF v_product_lower LIKE '%pain%' OR v_product_lower LIKE '%baguette%'
     OR v_product_lower LIKE '%miche%' OR v_product_lower LIKE '%banneton%'
     OR v_product_lower LIKE '%focaccia%' OR v_product_lower LIKE '%brioche%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Boulangerie' LIMIT 1;

  -- Cookies, biscuits
  ELSEIF v_product_lower LIKE '%cookie%' OR v_product_lower LIKE '%biscuit%'
         OR v_product_lower LIKE '%canistrell%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Biscuits' LIMIT 1;

  -- Fromages
  ELSEIF v_product_lower LIKE '%fromage%' OR v_product_lower LIKE '%comté%'
         OR v_product_lower LIKE '%bleu%' OR v_product_lower LIKE '%morbier%'
         OR v_product_lower LIKE '%raclette%' OR v_product_lower LIKE '%tomme%'
         OR v_product_lower LIKE '%tome%' OR v_product_lower LIKE '%brebis%'
         OR v_product_lower LIKE '%chèvre%' OR v_product_lower LIKE '%gex%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Fromagerie' LIMIT 1;

  -- Viandes (bœuf, veau, porc, agneau)
  ELSEIF v_product_lower LIKE '%boeuf%' OR v_product_lower LIKE '%bœuf%'
         OR v_product_lower LIKE '%steak%' OR v_product_lower LIKE '%viande%'
         OR v_product_lower LIKE '%porc%' OR v_product_lower LIKE '%agneau%'
         OR v_product_lower LIKE '%veau%' OR v_product_lower LIKE '%gigot%'
         OR v_product_lower LIKE '%côte%' OR v_product_lower LIKE '%cote%'
         OR v_product_lower LIKE '%araignee%' OR v_product_lower LIKE '%araignée%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Viandes' LIMIT 1;

  -- Charcuterie
  ELSEIF v_product_lower LIKE '%sauciss%' OR v_product_lower LIKE '%jambon%'
         OR v_product_lower LIKE '%pâté%' OR v_product_lower LIKE '%terrine%'
         OR v_product_lower LIKE '%rillette%' OR v_product_lower LIKE '%chipolata%'
         OR v_product_lower LIKE '%lardon%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Charcuterie' LIMIT 1;

  -- Volailles
  ELSEIF v_product_lower LIKE '%poulet%' OR v_product_lower LIKE '%canard%'
         OR v_product_lower LIKE '%pintade%' OR v_product_lower LIKE '%coquelet%'
         OR v_product_lower LIKE '%foie gras%' OR v_product_lower LIKE '%magret%'
         OR v_product_lower LIKE '%confit%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Volailles' LIMIT 1;

  -- Poissons
  ELSEIF v_product_lower LIKE '%poisson%' OR v_product_lower LIKE '%truite%'
         OR v_product_lower LIKE '%saumon%' OR v_product_lower LIKE '%filet%'
         OR v_product_lower LIKE '%pavé%' OR v_product_lower LIKE '%pave%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Poissons' LIMIT 1;

  -- Fruits & Légumes
  ELSEIF v_product_lower LIKE '%fruit%' OR v_product_lower LIKE '%légume%'
         OR v_product_lower LIKE '%orange%' OR v_product_lower LIKE '%citron%'
         OR v_product_lower LIKE '%pomme%' OR v_product_lower LIKE '%banane%'
         OR v_product_lower LIKE '%tomate%' OR v_product_lower LIKE '%avocat%'
         OR v_product_lower LIKE '%agrume%' OR v_product_lower LIKE '%clémentine%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Fruits & Légumes' LIMIT 1;

  -- Boissons (vins, jus)
  ELSEIF v_product_lower LIKE '%vin%' OR v_product_lower LIKE '%bib%'
         OR v_product_lower LIKE '%jus%' OR v_product_lower LIKE '%boisson%' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Boissons' LIMIT 1;

  -- Par défaut: Autres
  ELSE
    SELECT id INTO v_category_id FROM categories
    WHERE organization_id = p_org_id AND nom = 'Autres' LIMIT 1;
  END IF;

  RETURN v_category_id;
END//

DELIMITER ;

-- ============================================================================
-- ÉTAPE 4: Migration des données existantes
-- ============================================================================

-- 4.1: Insérer les produits uniques depuis articles vers products
-- On regroupe par (organization_id, produit, description) pour identifier les produits uniques
-- La catégorie est détectée automatiquement basée sur le nom du produit

INSERT INTO products (
  organization_id,
  category_id,
  supplier_id,
  nom,
  description,
  image_filename,
  created_at
)
SELECT
  cf.organization_id,
  detect_category_id(cf.organization_id, a.produit) AS category_id,
  NULL AS supplier_id, -- À compléter manuellement après migration
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

-- 4.2: Créer les liaisons catalog_products depuis les articles existants

INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite, ordre, created_at)
SELECT
  a.catalog_file_id,
  p.id AS product_id,
  a.prix,
  a.unite,
  a.id AS ordre,  -- On utilise l'ancien ID comme ordre pour préserver l'ordre actuel
  cf.upload_date AS created_at
FROM articles a
INNER JOIN catalog_files cf ON a.catalog_file_id = cf.id
INNER JOIN products p ON (
  p.nom = a.produit
  AND COALESCE(p.description, '') = COALESCE(a.description, '')
  AND p.organization_id = cf.organization_id
);

-- ============================================================================
-- ÉTAPE 5: Création de la table temporaire pour mapper les anciens IDs
-- ============================================================================

CREATE TABLE IF NOT EXISTS _migration_article_mapping (
  old_article_id INT(11) NOT NULL,
  new_catalog_product_id INT(11) NOT NULL,
  PRIMARY KEY (old_article_id),
  KEY idx_new_catalog_product_id (new_catalog_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Remplir la table de mapping
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

-- 6.1: Ajouter la nouvelle colonne catalog_product_id
ALTER TABLE panier_articles
  ADD COLUMN catalog_product_id INT(11) DEFAULT NULL AFTER article_id;

-- 6.2: Migrer les références
UPDATE panier_articles pa
INNER JOIN _migration_article_mapping m ON pa.article_id = m.old_article_id
SET pa.catalog_product_id = m.new_catalog_product_id;

-- 6.3: Vérification - Afficher les paniers non migrés (devrait être vide)
SELECT COUNT(*) as paniers_non_migres
FROM panier_articles
WHERE article_id IS NOT NULL AND catalog_product_id IS NULL;

-- ============================================================================
-- ÉTAPE 7: Index et optimisations
-- ============================================================================

CREATE INDEX idx_panier_catalog_product ON panier_articles(catalog_product_id);
CREATE INDEX idx_catalog_products_catalog ON catalog_products(catalog_file_id);
CREATE INDEX idx_catalog_products_product ON catalog_products(product_id);

-- ============================================================================
-- ÉTAPE 8: Statistiques post-migration
-- ============================================================================

SELECT '========================================' as '';
SELECT 'STATISTIQUES POST-MIGRATION' as '';
SELECT '========================================' as '';

SELECT
  'Products créés' AS metric,
  COUNT(*) AS value
FROM products
UNION ALL
SELECT
  'Catalog_products créés',
  COUNT(*)
FROM catalog_products
UNION ALL
SELECT
  'Panier_articles migrés',
  COUNT(*)
FROM panier_articles
WHERE catalog_product_id IS NOT NULL
UNION ALL
SELECT
  'Ratio de compression',
  CONCAT(
    ROUND((1 - (SELECT COUNT(*) FROM products) / (SELECT COUNT(*) FROM articles)) * 100, 1),
    '%'
  );

-- Distribution par catégorie
SELECT '-- Distribution par catégorie --' as '';

SELECT
  COALESCE(c.nom, 'Sans catégorie') as categorie,
  COUNT(p.id) as nombre_produits
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY c.nom
ORDER BY nombre_produits DESC;

-- Produits sans catégorie (à vérifier)
SELECT '-- Produits sans catégorie (à réviser) --' as '';

SELECT
  p.id,
  p.nom,
  SUBSTRING(p.description, 1, 50) as description
FROM products p
WHERE p.category_id IS NULL
LIMIT 10;

-- ============================================================================
-- ÉTAPE 9: Finalisation (À FAIRE APRÈS TESTS COMPLETS!)
-- ============================================================================

-- ATTENTION: Ces commandes sont destructives!
-- À exécuter UNIQUEMENT après avoir testé que tout fonctionne correctement!
-- Décommenter les lignes ci-dessous quand vous êtes prêt:

-- 9.1: Supprimer la contrainte FK sur article_id
-- ALTER TABLE panier_articles DROP FOREIGN KEY IF EXISTS panier_articles_ibfk_2;
-- ALTER TABLE panier_articles DROP FOREIGN KEY IF EXISTS fk_panier_articles_article;

-- 9.2: Supprimer l'ancienne colonne article_id
-- ALTER TABLE panier_articles DROP COLUMN article_id;

-- 9.3: Ajouter la contrainte FK sur catalog_product_id
-- ALTER TABLE panier_articles
--   ADD CONSTRAINT fk_panier_articles_catalog_product
--   FOREIGN KEY (catalog_product_id)
--   REFERENCES catalog_products(id) ON DELETE RESTRICT;

-- 9.4: Rendre catalog_product_id NOT NULL
-- ALTER TABLE panier_articles MODIFY catalog_product_id INT(11) NOT NULL;

-- 9.5: Renommer l'ancienne table articles (pour historique/backup)
-- RENAME TABLE articles TO _old_articles_backup;

-- 9.6: Supprimer la table de mapping temporaire
-- DROP TABLE _migration_article_mapping;

-- 9.7: Supprimer la fonction helper
-- DROP FUNCTION IF EXISTS detect_category_id;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration terminée avec succès!' as status;
SELECT 'Prochaines étapes:' as '';
SELECT '1. Vérifier les statistiques ci-dessus' as etape1;
SELECT '2. Exécuter 20260123_verify_migration.sql' as etape2;
SELECT '3. Assigner manuellement les fournisseurs aux produits' as etape3;
SELECT '4. Corriger les catégories si nécessaire' as etape4;
SELECT '5. Adapter le code applicatif' as etape5;
SELECT '6. Tester intensivement' as etape6;
SELECT '7. Finaliser (étape 9, irréversible!)' as etape7;
