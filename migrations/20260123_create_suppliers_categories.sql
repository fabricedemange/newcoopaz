-- Migration: Création des tables Suppliers et Categories
-- Date: 2026-01-23
-- Description: Ajout des tables de référence pour fournisseurs et catégories
--
-- IMPORTANT: Ce script doit être exécuté AVANT 20260123_refactor_products_structure.sql

-- ============================================================================
-- ÉTAPE 1: Création de la table suppliers (fournisseurs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  contact_nom VARCHAR(255) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  telephone VARCHAR(50) DEFAULT NULL,
  adresse TEXT DEFAULT NULL,
  code_postal VARCHAR(20) DEFAULT NULL,
  ville VARCHAR(100) DEFAULT NULL,
  siret VARCHAR(50) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
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

-- ============================================================================
-- ÉTAPE 2: Création de la table categories (catégories de produits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id INT(11) NOT NULL AUTO_INCREMENT,
  organization_id INT(11) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  parent_id INT(11) DEFAULT NULL COMMENT 'Pour les sous-catégories',
  ordre INT(11) DEFAULT 0 COMMENT 'Ordre d\'affichage',
  couleur VARCHAR(20) DEFAULT NULL COMMENT 'Code couleur hex pour l\'interface',
  icon VARCHAR(50) DEFAULT NULL COMMENT 'Icône Bootstrap ou emoji',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
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
COMMENT='Table des catégories de produits';

-- ============================================================================
-- ÉTAPE 3: Insertion de catégories par défaut
-- ============================================================================

-- Note: Ces catégories seront créées pour chaque organisation
-- Adapter les organization_id selon votre base

-- Récupérer les IDs d'organisations (vous devrez adapter cette partie)
-- Pour l'exemple, on utilise organization_id = 1

SET @org_id = 1;

-- Catégories principales
INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
VALUES
  (@org_id, 'Boulangerie', 'Pains, viennoiseries, pâtisseries', NULL, 1, '#D2691E', 'bi-cake2', 1),
  (@org_id, 'Fromagerie', 'Fromages frais, affinés, de chèvre, de brebis', NULL, 2, '#FFD700', 'bi-egg-fried', 1),
  (@org_id, 'Viandes', 'Viandes fraîches et transformées', NULL, 3, '#8B0000', 'bi-egg', 1),
  (@org_id, 'Charcuterie', 'Saucissons, jambons, pâtés', NULL, 4, '#CD5C5C', 'bi-award', 1),
  (@org_id, 'Volailles', 'Poulets, canards, pintades', NULL, 5, '#FF6347', 'bi-egg', 1),
  (@org_id, 'Poissons', 'Poissons frais et transformés', NULL, 6, '#4682B4', 'bi-water', 1),
  (@org_id, 'Fruits & Légumes', 'Fruits et légumes frais', NULL, 7, '#32CD32', 'bi-apple', 1),
  (@org_id, 'Épicerie', 'Produits secs, conserves, huiles', NULL, 8, '#DAA520', 'bi-cart3', 1),
  (@org_id, 'Boissons', 'Vins, jus, boissons', NULL, 9, '#8B008B', 'bi-cup-straw', 1),
  (@org_id, 'Produits laitiers', 'Lait, yaourts, crèmes', NULL, 10, '#F0F8FF', 'bi-droplet', 1),
  (@org_id, 'Autres', 'Produits divers', NULL, 99, '#808080', 'bi-three-dots', 1);

-- Sous-catégories pour Viandes
INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
VALUES
  (@org_id, 'Bœuf', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Viandes' AND organization_id = @org_id LIMIT 1) AS tmp), 1, NULL, NULL, 1),
  (@org_id, 'Porc', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Viandes' AND organization_id = @org_id LIMIT 1) AS tmp), 2, NULL, NULL, 1),
  (@org_id, 'Agneau', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Viandes' AND organization_id = @org_id LIMIT 1) AS tmp), 3, NULL, NULL, 1),
  (@org_id, 'Veau', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Viandes' AND organization_id = @org_id LIMIT 1) AS tmp), 4, NULL, NULL, 1);

-- Sous-catégories pour Fromagerie
INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
VALUES
  (@org_id, 'Fromages à pâte dure', 'Comté, Gruyère, etc.', (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Fromagerie' AND organization_id = @org_id LIMIT 1) AS tmp), 1, NULL, NULL, 1),
  (@org_id, 'Fromages à pâte molle', 'Brie, Camembert, etc.', (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Fromagerie' AND organization_id = @org_id LIMIT 1) AS tmp), 2, NULL, NULL, 1),
  (@org_id, 'Fromages de chèvre', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Fromagerie' AND organization_id = @org_id LIMIT 1) AS tmp), 3, NULL, NULL, 1),
  (@org_id, 'Fromages de brebis', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Fromagerie' AND organization_id = @org_id LIMIT 1) AS tmp), 4, NULL, NULL, 1),
  (@org_id, 'Fromages bleus', 'Bleu, Roquefort, etc.', (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Fromagerie' AND organization_id = @org_id LIMIT 1) AS tmp), 5, NULL, NULL, 1);

-- Sous-catégories pour Boulangerie
INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
VALUES
  (@org_id, 'Pains', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Boulangerie' AND organization_id = @org_id LIMIT 1) AS tmp), 1, NULL, NULL, 1),
  (@org_id, 'Viennoiseries', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Boulangerie' AND organization_id = @org_id LIMIT 1) AS tmp), 2, NULL, NULL, 1),
  (@org_id, 'Pâtisseries', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Boulangerie' AND organization_id = @org_id LIMIT 1) AS tmp), 3, NULL, NULL, 1),
  (@org_id, 'Biscuits', NULL, (SELECT id FROM (SELECT id FROM categories WHERE nom = 'Boulangerie' AND organization_id = @org_id LIMIT 1) AS tmp), 4, NULL, NULL, 1);

-- ============================================================================
-- ÉTAPE 4: Insertion de fournisseurs d'exemple
-- ============================================================================

-- Ces fournisseurs sont des exemples, à adapter selon votre situation

INSERT INTO suppliers (organization_id, nom, contact_nom, email, telephone, ville, notes, is_active)
VALUES
  (@org_id, 'Le Pain d''Ici', NULL, NULL, NULL, NULL, 'Boulangerie locale', 1),
  (@org_id, 'Fromagerie du Jura', NULL, NULL, NULL, NULL, 'Fromages AOP', 1),
  (@org_id, 'Ferme d''Arracq', NULL, NULL, NULL, NULL, 'Viandes et charcuterie', 1),
  (@org_id, 'Élevage Bio Local', NULL, NULL, NULL, NULL, 'Volailles bio', 1),
  (@org_id, 'Pisciculture de la Vallée', NULL, NULL, NULL, NULL, 'Poissons frais', 1),
  (@org_id, 'Maraîchage Bio', NULL, NULL, NULL, NULL, 'Fruits et légumes', 1),
  (@org_id, 'Épicerie Fine', NULL, NULL, NULL, NULL, 'Produits d''épicerie', 1),
  (@org_id, 'Cave & Vignobles', NULL, NULL, NULL, NULL, 'Vins et spiritueux', 1),
  (@org_id, 'Autre fournisseur', NULL, NULL, NULL, NULL, 'Fournisseur générique', 1);

-- ============================================================================
-- ÉTAPE 5: Vérifications
-- ============================================================================

-- Afficher les catégories créées
SELECT
  c.id,
  c.nom,
  CASE WHEN c.parent_id IS NULL THEN 'Principale' ELSE 'Sous-catégorie' END as type,
  COALESCE(p.nom, '-') as categorie_parente,
  c.couleur,
  c.icon
FROM categories c
LEFT JOIN categories p ON c.parent_id = p.id
WHERE c.organization_id = @org_id
ORDER BY COALESCE(p.ordre, c.ordre), c.ordre;

-- Afficher les fournisseurs créés
SELECT
  id,
  nom,
  ville,
  notes,
  is_active
FROM suppliers
WHERE organization_id = @org_id
ORDER BY nom;

-- Statistiques
SELECT
  'Catégories principales' as type,
  COUNT(*) as nombre
FROM categories
WHERE organization_id = @org_id AND parent_id IS NULL
UNION ALL
SELECT
  'Sous-catégories',
  COUNT(*)
FROM categories
WHERE organization_id = @org_id AND parent_id IS NOT NULL
UNION ALL
SELECT
  'Fournisseurs',
  COUNT(*)
FROM suppliers
WHERE organization_id = @org_id;

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================

-- 1. Adaptation multi-organisations:
--    Si vous avez plusieurs organisations, exécutez les INSERT dans une boucle
--    ou créez un script pour chaque organization_id

-- 2. Les catégories peuvent être hiérarchiques (parent_id)
--    Exemple: Viandes > Bœuf > Bœuf haché

-- 3. Les couleurs et icônes sont optionnelles mais améliorent l'UX
--    Codes couleur hex: #RRGGBB
--    Icônes Bootstrap: bi-nom-icone

-- 4. is_active permet de désactiver temporairement un fournisseur/catégorie
--    sans le supprimer (pour l'historique)

-- 5. Pour ajouter ces références aux produits, voir le script de migration
--    principal qui sera mis à jour

-- ============================================================================
-- FIN
-- ============================================================================

SELECT '✅ Tables suppliers et categories créées avec succès!' as status;
SELECT 'Prochaine étape: Exécuter 20260123_refactor_products_structure_v2.sql' as next_step;
