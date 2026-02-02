-- Migration: Refactorisation pour produits réutilisables
-- Date: 2026-01-23
-- Description: Création d'une table products pour éviter la duplication des produits entre catalogues
--
-- IMPORTANT: Faire un backup complet avant d'exécuter cette migration!
-- mysqldump -u root coopazfr_commandes > backup_before_products_refactor_$(date +%Y%m%d_%H%M%S).sql

-- ============================================================================
-- ÉTAPE 1: Création de la table products (produits réutilisables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  description VARCHAR(1000) DEFAULT NULL,
  image_filename VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_organization_id (organization_id),
  KEY idx_nom (nom),
  CONSTRAINT fk_products_organization FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_catalog_file_id (catalog_file_id),
  KEY idx_product_id (product_id),
  UNIQUE KEY unique_catalog_product (catalog_file_id, product_id),
  CONSTRAINT fk_catalog_products_catalog FOREIGN KEY (catalog_file_id)
    REFERENCES catalog_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_products_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ÉTAPE 3: Migration des données existantes
-- ============================================================================

-- 3.1: Insérer les produits uniques depuis articles vers products
-- On regroupe par (organization_id, produit, description) pour identifier les produits uniques
-- On prend la première image trouvée pour chaque produit unique

INSERT INTO products (organization_id, nom, description, image_filename, created_at)
SELECT
  cf.organization_id,
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

-- 3.2: Créer les liaisons catalog_products depuis les articles existants

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
-- ÉTAPE 4: Création de la table temporaire pour mapper les anciens IDs
-- ============================================================================

-- Cette table permet de faire la correspondance entre ancien article_id et nouveau catalog_product_id
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
-- ÉTAPE 5: Mise à jour de panier_articles
-- ============================================================================

-- 5.1: Ajouter la nouvelle colonne catalog_product_id
ALTER TABLE panier_articles
  ADD COLUMN catalog_product_id INT(11) DEFAULT NULL AFTER article_id;

-- 5.2: Migrer les références
UPDATE panier_articles pa
INNER JOIN _migration_article_mapping m ON pa.article_id = m.old_article_id
SET pa.catalog_product_id = m.new_catalog_product_id;

-- 5.3: Vérification - Afficher les paniers non migrés (devrait être vide)
SELECT COUNT(*) as paniers_non_migres
FROM panier_articles
WHERE article_id IS NOT NULL AND catalog_product_id IS NULL;

-- Si tout est OK, on peut continuer...
-- ATTENTION: Ne pas exécuter les étapes suivantes avant d'avoir vérifié!

-- ============================================================================
-- ÉTAPE 6: Finalisation (À FAIRE APRÈS TESTS COMPLETS!)
-- ============================================================================

-- ATTENTION: Ces commandes sont destructives!
-- À exécuter UNIQUEMENT après avoir testé que tout fonctionne correctement!

-- 6.1: Supprimer la contrainte FK sur article_id
-- ALTER TABLE panier_articles DROP FOREIGN KEY IF EXISTS panier_articles_ibfk_2;
-- ALTER TABLE panier_articles DROP FOREIGN KEY IF EXISTS fk_panier_articles_article;

-- 6.2: Supprimer l'ancienne colonne article_id
-- ALTER TABLE panier_articles DROP COLUMN article_id;

-- 6.3: Ajouter la contrainte FK sur catalog_product_id
-- ALTER TABLE panier_articles
--   ADD CONSTRAINT fk_panier_articles_catalog_product
--   FOREIGN KEY (catalog_product_id)
--   REFERENCES catalog_products(id) ON DELETE RESTRICT;

-- 6.4: Rendre catalog_product_id NOT NULL
-- ALTER TABLE panier_articles MODIFY catalog_product_id INT(11) NOT NULL;

-- 6.5: Renommer l'ancienne table articles (pour historique/backup)
-- RENAME TABLE articles TO _old_articles_backup;

-- 6.6: Supprimer la table de mapping temporaire
-- DROP TABLE _migration_article_mapping;

-- ============================================================================
-- ÉTAPE 7: Index et optimisations
-- ============================================================================

-- Ces index améliorent les performances des requêtes fréquentes
CREATE INDEX idx_panier_catalog_product ON panier_articles(catalog_product_id);
CREATE INDEX idx_catalog_products_catalog ON catalog_products(catalog_file_id);
CREATE INDEX idx_catalog_products_product ON catalog_products(product_id);

-- ============================================================================
-- FIN DE LA MIGRATION AUTOMATIQUE
-- ============================================================================

-- Statistiques post-migration:
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
