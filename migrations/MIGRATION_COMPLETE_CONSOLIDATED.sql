-- ============================================================================
-- MIGRATION COMPLÈTE: Modèle historique → Nouveau modèle avec Fournisseurs/Catégories
-- ============================================================================
-- Date: 2026-01-26
-- Description: Script consolidé complet pour migrer de l'ancien modèle (table articles)
--              vers le nouveau modèle (suppliers, categories, products, catalog_products)
--
-- PRÉREQUIS:
-- - Base de données avec les tables existantes: articles, catalog_files, paniers, panier_articles
-- - Table organizations déjà créée
--
-- STRUCTURE HISTORIQUE:
-- - articles(id, catalog_file_id, produit, description, prix, unite, image_filename)
-- - panier_articles(id, panier_id, article_id, quantity, note)
--
-- NOUVELLE STRUCTURE:
-- - suppliers(id, organization_id, nom, contact_nom, email, telephone, adresse, ...)
-- - categories(id, organization_id, nom, description, parent_id, ordre, couleur, icon, ...)
-- - products(id, organization_id, supplier_id, category_id, nom, description, image_filename, ...)
-- - catalog_products(id, catalog_file_id, product_id, prix, unite, ordre, notes)
-- - panier_articles aura catalog_product_id à la place de article_id
--
-- AVERTISSEMENT: Ce script modifie la structure de la base de données.
--                 Faire un backup complet AVANT d'exécuter!
--
-- DURÉE ESTIMÉE: Dépend du nombre d'articles (quelques secondes à quelques minutes)
-- ============================================================================

START TRANSACTION;

-- ============================================================================
-- PHASE 1: CRÉATION DES TABLES FOURNISSEURS ET CATÉGORIES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table suppliers (fournisseurs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  contact_nom VARCHAR(255) DEFAULT NULL COMMENT 'Nom du contact principal',
  email VARCHAR(255) DEFAULT NULL,
  telephone VARCHAR(50) DEFAULT NULL,
  adresse TEXT DEFAULT NULL COMMENT 'Adresse complète du fournisseur',
  code_postal VARCHAR(20) DEFAULT NULL,
  ville VARCHAR(100) DEFAULT NULL,
  siret VARCHAR(50) DEFAULT NULL COMMENT 'Numéro SIRET',
  notes TEXT DEFAULT NULL COMMENT 'Notes internes sur le fournisseur',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=actif, 0=désactivé',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_organization_id (organization_id),
  KEY idx_nom (nom),
  KEY idx_is_active (is_active),
  CONSTRAINT fk_suppliers_organization FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Table des fournisseurs par organisation';

-- ---------------------------------------------------------------------------
-- Table categories (catégories de produits)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  parent_id INT(11) DEFAULT NULL COMMENT 'Pour les sous-catégories (hiérarchie)',
  ordre INT(11) DEFAULT 0 COMMENT 'Ordre d\'affichage dans l\'interface',
  couleur VARCHAR(20) DEFAULT NULL COMMENT 'Code couleur hex (#RRGGBB) pour l\'UI',
  icon VARCHAR(50) DEFAULT NULL COMMENT 'Icône Bootstrap (bi-xxx) ou emoji',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=actif, 0=désactivé',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_organization_id (organization_id),
  KEY idx_nom (nom),
  KEY idx_parent_id (parent_id),
  KEY idx_ordre (ordre),
  KEY idx_is_active (is_active),
  CONSTRAINT fk_categories_organization FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Table des catégories de produits (hiérarchique)';

-- ============================================================================
-- PHASE 2: INSERTION DES CATÉGORIES PAR DÉFAUT (pour chaque organisation)
-- ============================================================================

-- Boucle pour chaque organisation existante
INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Boulangerie',
  'Pains, viennoiseries, pâtisseries',
  NULL,
  1,
  '#D2691E',
  'bi-cake2',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Boulangerie'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Fromagerie',
  'Fromages frais, affinés, de chèvre, de brebis',
  NULL,
  2,
  '#FFD700',
  'bi-egg-fried',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Fromagerie'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Viandes',
  'Viandes fraîches et transformées',
  NULL,
  3,
  '#8B0000',
  'bi-egg',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Viandes'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Charcuterie',
  'Saucissons, jambons, pâtés, terrines',
  NULL,
  4,
  '#CD5C5C',
  'bi-award',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Charcuterie'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Volailles',
  'Poulets, canards, pintades',
  NULL,
  5,
  '#FF6347',
  'bi-egg',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Volailles'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Poissons',
  'Poissons frais et transformés',
  NULL,
  6,
  '#4682B4',
  'bi-water',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Poissons'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Fruits & Légumes',
  'Fruits et légumes frais',
  NULL,
  7,
  '#32CD32',
  'bi-apple',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Fruits & Légumes'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Épicerie',
  'Produits secs, conserves, huiles',
  NULL,
  8,
  '#DAA520',
  'bi-cart3',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Épicerie'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Boissons',
  'Vins, jus, boissons',
  NULL,
  9,
  '#8B008B',
  'bi-cup-straw',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Boissons'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Produits laitiers',
  'Lait, yaourts, crèmes',
  NULL,
  10,
  '#F0F8FF',
  'bi-droplet',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Produits laitiers'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Biscuits',
  'Biscuits, cookies, gâteaux secs',
  NULL,
  11,
  '#CD853F',
  'bi-cookie',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Biscuits'
);

INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
SELECT
  o.id,
  'Autres',
  'Produits divers',
  NULL,
  99,
  '#808080',
  'bi-three-dots',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.organization_id = o.id AND c.nom = 'Autres'
);

-- ============================================================================
-- PHASE 3: INSERTION DES FOURNISSEURS PAR DÉFAUT
-- ============================================================================

INSERT INTO suppliers (organization_id, nom, notes, is_active)
SELECT
  o.id,
  'Fournisseur général',
  'Fournisseur par défaut pour les produits sans fournisseur spécifique',
  1
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers s
  WHERE s.organization_id = o.id AND s.nom = 'Fournisseur général'
);

-- ============================================================================
-- PHASE 4: CRÉATION DE LA TABLE PRODUCTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  supplier_id INT(11) DEFAULT NULL COMMENT 'Fournisseur principal du produit',
  category_id INT(11) DEFAULT NULL COMMENT 'Catégorie du produit',
  nom VARCHAR(255) NOT NULL COMMENT 'Nom du produit',
  description VARCHAR(1000) DEFAULT NULL COMMENT 'Description détaillée',
  image_filename VARCHAR(255) DEFAULT NULL COMMENT 'Nom du fichier image',
  reference_fournisseur VARCHAR(100) DEFAULT NULL COMMENT 'Référence chez le fournisseur',
  code_ean VARCHAR(50) DEFAULT NULL COMMENT 'Code-barres EAN',
  conditionnement VARCHAR(100) DEFAULT NULL COMMENT 'Ex: sachet de 500g, carton de 12',
  dlc_jours INT(11) DEFAULT NULL COMMENT 'Durée de vie en jours',
  allergenes TEXT DEFAULT NULL COMMENT 'Liste des allergènes',
  origine VARCHAR(100) DEFAULT NULL COMMENT 'Pays/région d\'origine',
  label VARCHAR(100) DEFAULT NULL COMMENT 'Label (Bio, AOP, IGP, etc.)',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=actif, 0=archivé',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Table des produits réutilisables entre catalogues';

-- ============================================================================
-- PHASE 5: CRÉATION DE LA TABLE CATALOG_PRODUCTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  catalog_file_id INT(11) NOT NULL COMMENT 'Catalogue auquel appartient cette déclinaison',
  product_id INT(11) NOT NULL COMMENT 'Produit de référence',
  prix DOUBLE DEFAULT NULL COMMENT 'Prix pour ce catalogue spécifique',
  unite DOUBLE NOT NULL DEFAULT 1 COMMENT 'Unité de vente (ex: 1, 0.5, 2)',
  ordre INT(11) DEFAULT 0 COMMENT 'Ordre d\'affichage dans le catalogue',
  notes VARCHAR(500) DEFAULT NULL COMMENT 'Notes spécifiques pour ce catalogue',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_catalog_file_id (catalog_file_id),
  KEY idx_product_id (product_id),
  UNIQUE KEY unique_catalog_product (catalog_file_id, product_id) COMMENT 'Un produit ne peut apparaître qu\'une fois par catalogue',
  CONSTRAINT fk_catalog_products_catalog FOREIGN KEY (catalog_file_id)
    REFERENCES catalog_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_products_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Table de liaison entre catalogues et produits avec prix/unité spécifiques';

-- ============================================================================
-- PHASE 6: MIGRATION DES DONNÉES (ARTICLES → PRODUCTS)
-- ============================================================================

-- Créer un produit unique pour chaque combinaison (organization_id, nom, description)
-- avec catégorisation automatique et récupération de la première image disponible
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
  -- Catégorisation automatique basée sur des mots-clés
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
  -- Récupérer la première image disponible pour ce produit
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
-- PHASE 7: CRÉATION DES LIAISONS CATALOG_PRODUCTS
-- ============================================================================

-- Créer une entrée catalog_products pour chaque article historique
-- en le liant au produit correspondant
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
-- PHASE 8: MIGRATION DE PANIER_ARTICLES
-- ============================================================================

-- Créer une table de mapping temporaire pour la migration
CREATE TABLE IF NOT EXISTS _migration_article_mapping (
  old_article_id INT(11) NOT NULL,
  new_catalog_product_id INT(11) NOT NULL,
  PRIMARY KEY (old_article_id),
  KEY idx_new_catalog_product_id (new_catalog_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Table temporaire de mapping pour la migration';

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

-- Ajouter la colonne catalog_product_id à panier_articles si elle n'existe pas
ALTER TABLE panier_articles
  ADD COLUMN IF NOT EXISTS catalog_product_id INT(11) DEFAULT NULL AFTER article_id;

-- Mettre à jour panier_articles avec les nouveaux catalog_product_id
UPDATE panier_articles pa
INNER JOIN _migration_article_mapping m ON pa.article_id = m.old_article_id
SET pa.catalog_product_id = m.new_catalog_product_id;

-- ============================================================================
-- PHASE 9: INDEX ET OPTIMISATIONS
-- ============================================================================

-- Index sur panier_articles
CREATE INDEX IF NOT EXISTS idx_panier_catalog_product ON panier_articles(catalog_product_id);

-- Index supplémentaires pour catalog_products (si pas déjà créés)
CREATE INDEX IF NOT EXISTS idx_catalog_products_catalog ON catalog_products(catalog_file_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_product ON catalog_products(product_id);

-- ============================================================================
-- PHASE 10: VÉRIFICATIONS ET STATISTIQUES
-- ============================================================================

SELECT '========================================'  AS '---------------';
SELECT 'MIGRATION TERMINÉE - STATISTIQUES'        AS 'Résultat';
SELECT '========================================'  AS '---------------';

-- Compteurs généraux
SELECT 'Products créés' AS Métrique, COUNT(*) AS Valeur FROM products
UNION ALL
SELECT 'Catalog_products créés', COUNT(*) FROM catalog_products
UNION ALL
SELECT 'Panier_articles migrés', COUNT(*) FROM panier_articles WHERE catalog_product_id IS NOT NULL
UNION ALL
SELECT 'Panier_articles NON migrés (doit être 0!)', COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL;

-- Distribution par catégorie
SELECT '-- Distribution par catégorie --' AS 'Résultat';

SELECT
  COALESCE(c.nom, 'Sans catégorie') AS Catégorie,
  COUNT(p.id) AS Nombre_produits
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY c.nom
ORDER BY Nombre_produits DESC;

-- Vérification des orphelins (ne devrait pas exister)
SELECT '-- Vérification des orphelins --' AS 'Résultat';

SELECT
  'Articles sans mapping' AS Type,
  COUNT(*) AS Nombre
FROM articles a
WHERE NOT EXISTS (
  SELECT 1 FROM _migration_article_mapping m WHERE m.old_article_id = a.id
)
UNION ALL
SELECT
  'Panier_articles sans catalog_product_id',
  COUNT(*)
FROM panier_articles
WHERE catalog_product_id IS NULL;

-- ============================================================================
-- PHASE 11: NETTOYAGE (OPTIONNEL - À DÉCOMMENTER SI SOUHAITÉ)
-- ============================================================================

-- ATTENTION: Ne décommenter ces lignes que si vous êtes CERTAIN que la migration est réussie!
-- Ces commandes sont IRRÉVERSIBLES sans backup!

-- Supprimer la table de mapping temporaire
-- DROP TABLE IF EXISTS _migration_article_mapping;

-- Renommer la table articles en articles_old (pour backup)
-- RENAME TABLE articles TO articles_old;

-- Ou supprimer complètement la table articles (DANGER!)
-- DROP TABLE IF EXISTS articles;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

COMMIT;

SELECT '✅ Migration complète terminée avec succès!' AS 'Statut';
SELECT 'Vérifiez les statistiques ci-dessus pour vous assurer que tout est correct.' AS 'Note';
SELECT 'Les anciennes tables (articles) sont conservées pour backup.' AS 'Note';
SELECT 'Vous pouvez les supprimer manuellement après avoir vérifié que tout fonctionne.' AS 'Note';
