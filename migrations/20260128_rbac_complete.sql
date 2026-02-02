-- ============================================================================
-- PURE RBAC SYSTEM - COMPLETE MIGRATION
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-28
-- Description: Complete RBAC setup with tables, permissions, roles, and mappings
-- Estimated time: 30-60 seconds
-- ============================================================================

START TRANSACTION;

-- ============================================================================
-- STEP 1: Create RBAC Tables
-- ============================================================================

-- Table 1: roles
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT 0 COMMENT '1=système, 0=custom',
  is_active BOOLEAN DEFAULT 1 COMMENT '1=actif, 0=désactivé',
  organization_id INT NULL COMMENT 'NULL=système, X=custom pour org',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_per_org (name, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_org (organization_id),
  INDEX idx_system_active (is_system, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: permissions
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL COMMENT 'Format: module.action',
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_permission_name (name),
  INDEX idx_module (module),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: role_permissions (Rôle → Permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  INDEX idx_role (role_id),
  INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 4: user_roles (Utilisateur → Rôles) - NOUVELLE TABLE PRINCIPALE
CREATE TABLE IF NOT EXISTS user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_by INT NOT NULL COMMENT 'ID de l''admin qui a assigné',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL COMMENT 'NULL = permanent, date = temporaire',
  reason TEXT COMMENT 'Raison de l''assignation',
  UNIQUE KEY unique_user_role (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_role (role_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 5: permission_cache (Performance)
CREATE TABLE IF NOT EXISTS permission_cache (
  user_id INT NOT NULL,
  permission_name VARCHAR(150) NOT NULL,
  has_permission BOOLEAN NOT NULL,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  PRIMARY KEY (user_id, permission_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_expires (user_id, expires_at),
  INDEX idx_expires (expires_at)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 6: permission_audit_log
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('role_created', 'role_updated', 'role_deleted',
                   'role_assigned', 'role_removed',
                   'permission_check_denied') NOT NULL,
  user_id INT COMMENT 'Utilisateur affecté',
  actor_id INT NOT NULL COMMENT 'Qui a fait l''action',
  role_id INT,
  permission_name VARCHAR(150),
  result ENUM('success', 'denied', 'error') DEFAULT 'success',
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_actor (actor_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at),
  INDEX idx_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- STEP 2: Modify Users Table for Migration
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS legacy_role VARCHAR(50) COMMENT 'Ancien rôle pour rollback',
  ADD COLUMN IF NOT EXISTS rbac_enabled TINYINT(1) DEFAULT 0 COMMENT '1=RBAC actif, 0=legacy',
  ADD INDEX IF NOT EXISTS idx_rbac_enabled (rbac_enabled);

-- ============================================================================
-- STEP 3: Seed System Roles
-- ============================================================================

INSERT INTO roles (name, display_name, description, organization_id, is_system, is_active) VALUES
('super_admin', 'Super Administrateur', 'Accès complet toutes organisations', NULL, 1, 1),
('admin', 'Administrateur', 'Gestion complète de son organisation', NULL, 1, 1),
('referent', 'Référent', 'Gestion catalogues et commandes', NULL, 1, 1),
('epicier', 'Épicier', 'Consultation et gestion panier', NULL, 1, 1),
('utilisateur', 'Utilisateur', 'Consultation et commande', NULL, 1, 1)
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- ============================================================================
-- STEP 4: Seed All 78 Permissions
-- ============================================================================

-- Module: users (7 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('users.view', 'Voir les utilisateurs', 'Consulter la liste des utilisateurs', 'users'),
('users.create', 'Créer un utilisateur', 'Ajouter un nouvel utilisateur', 'users'),
('users.edit', 'Modifier un utilisateur', 'Modifier les informations d\'un utilisateur', 'users'),
('users.delete', 'Supprimer un utilisateur', 'Supprimer un utilisateur', 'users'),
('users.validate', 'Valider un utilisateur', 'Valider un compte utilisateur', 'users'),
('users.impersonate', 'Se faire passer pour un utilisateur', 'Impersonate un utilisateur (SuperAdmin)', 'users'),
('users.view_all_orgs', 'Voir utilisateurs toutes orgs', 'Voir les utilisateurs de toutes les organisations', 'users')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: organizations (5 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('organizations.view', 'Voir les organisations', 'Consulter les informations d\'organisation', 'organizations'),
('organizations.create', 'Créer une organisation', 'Créer une nouvelle organisation (SuperAdmin)', 'organizations'),
('organizations.edit', 'Modifier une organisation', 'Modifier les informations d\'organisation', 'organizations'),
('organizations.delete', 'Supprimer une organisation', 'Supprimer une organisation (SuperAdmin)', 'organizations'),
('organizations.view_settings', 'Voir paramètres organisation', 'Consulter les paramètres de l\'organisation', 'organizations')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: catalogues (7 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('catalogues.view', 'Voir les catalogues', 'Consulter la liste des catalogues', 'catalogues'),
('catalogues.create', 'Créer un catalogue', 'Créer un nouveau catalogue', 'catalogues'),
('catalogues.edit', 'Modifier un catalogue', 'Modifier un catalogue existant', 'catalogues'),
('catalogues.delete', 'Supprimer un catalogue', 'Supprimer un catalogue', 'catalogues'),
('catalogues.view_synthese', 'Voir synthèse catalogue', 'Consulter la synthèse d\'un catalogue', 'catalogues'),
('catalogues.view_synthese_detaillee', 'Voir synthèse détaillée', 'Consulter la synthèse détaillée d\'un catalogue', 'catalogues'),
('catalogues.export', 'Exporter un catalogue', 'Exporter un catalogue (Excel, PDF)', 'catalogues')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: products (5 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('products.view', 'Voir les produits', 'Consulter la liste des produits', 'products'),
('products.create', 'Créer un produit', 'Ajouter un nouveau produit', 'products'),
('products.edit', 'Modifier un produit', 'Modifier un produit existant', 'products'),
('products.delete', 'Supprimer un produit', 'Supprimer un produit', 'products'),
('products.import', 'Importer des produits', 'Importer des produits depuis un fichier CSV', 'products')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: categories (4 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('categories.view', 'Voir les catégories', 'Consulter la liste des catégories', 'categories'),
('categories.create', 'Créer une catégorie', 'Ajouter une nouvelle catégorie', 'categories'),
('categories.edit', 'Modifier une catégorie', 'Modifier une catégorie existante', 'categories'),
('categories.delete', 'Supprimer une catégorie', 'Supprimer une catégorie', 'categories')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: paniers (7 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('paniers.view_own', 'Voir ses propres paniers', 'Consulter ses propres paniers', 'paniers'),
('paniers.view_all', 'Voir tous les paniers', 'Consulter tous les paniers de l\'organisation', 'paniers'),
('paniers.create', 'Créer un panier', 'Créer un nouveau panier', 'paniers'),
('paniers.edit', 'Modifier un panier', 'Modifier un panier existant', 'paniers'),
('paniers.delete', 'Supprimer un panier', 'Supprimer un panier', 'paniers'),
('paniers.submit', 'Soumettre un panier', 'Valider et soumettre un panier', 'paniers'),
('paniers.validate', 'Valider un panier', 'Valider un panier soumis (Référent/Épicier)', 'paniers')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: commandes (3 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('commandes.view_own', 'Voir ses commandes', 'Consulter ses propres commandes', 'commandes'),
('commandes.view_all', 'Voir toutes les commandes', 'Consulter toutes les commandes', 'commandes'),
('commandes.export', 'Exporter les commandes', 'Exporter les commandes (Excel)', 'commandes')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: suppliers (4 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('suppliers.view', 'Voir les fournisseurs', 'Consulter la liste des fournisseurs', 'suppliers'),
('suppliers.create', 'Créer un fournisseur', 'Ajouter un nouveau fournisseur', 'suppliers'),
('suppliers.edit', 'Modifier un fournisseur', 'Modifier un fournisseur existant', 'suppliers'),
('suppliers.delete', 'Supprimer un fournisseur', 'Supprimer un fournisseur', 'suppliers')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: settings (2 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('settings.view', 'Voir les paramètres', 'Consulter les paramètres de l\'application', 'settings'),
('settings.edit', 'Modifier les paramètres', 'Modifier les paramètres de l\'application', 'settings')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: reports (3 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('reports.view_dashboard', 'Voir le tableau de bord', 'Consulter le tableau de bord de reporting', 'reports'),
('reports.view_analytics', 'Voir les analyses', 'Consulter les analyses et statistiques', 'reports'),
('reports.export', 'Exporter les rapports', 'Exporter les rapports', 'reports')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: audit_logs (1 permission)
INSERT INTO permissions (name, display_name, description, module) VALUES
('audit_logs.view', 'Voir les logs d\'audit', 'Consulter les logs d\'audit système', 'audit_logs')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: roles (4 permissions)
INSERT INTO permissions (name, display_name, description, module) VALUES
('roles.view', 'Voir les rôles', 'Consulter la liste des rôles', 'roles'),
('roles.create', 'Créer un rôle', 'Créer un nouveau rôle personnalisé', 'roles'),
('roles.edit', 'Modifier un rôle', 'Modifier un rôle personnalisé', 'roles'),
('roles.delete', 'Supprimer un rôle', 'Supprimer un rôle personnalisé', 'roles')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: pos - Point de Vente (6 permissions - FUTUR)
INSERT INTO permissions (name, display_name, description, module) VALUES
('pos.view', 'Voir interface POS', 'Accéder à l\'interface point de vente', 'pos'),
('pos.create_sale', 'Créer une vente', 'Enregistrer une vente en caisse', 'pos'),
('pos.cancel_sale', 'Annuler une vente', 'Annuler une vente en caisse', 'pos'),
('pos.view_history', 'Voir historique ventes', 'Consulter l\'historique des ventes', 'pos'),
('pos.manage_cash', 'Gérer la caisse', 'Gérer les mouvements de caisse', 'pos'),
('pos.print_receipt', 'Imprimer ticket', 'Imprimer un ticket de caisse', 'pos')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: inventory - Inventaire (6 permissions - FUTUR)
INSERT INTO permissions (name, display_name, description, module) VALUES
('inventory.view', 'Voir les inventaires', 'Consulter les inventaires', 'inventory'),
('inventory.create', 'Créer un inventaire', 'Créer un nouvel inventaire', 'inventory'),
('inventory.edit', 'Modifier un inventaire', 'Modifier un inventaire en cours', 'inventory'),
('inventory.delete', 'Supprimer un inventaire', 'Supprimer un inventaire', 'inventory'),
('inventory.approve', 'Approuver un inventaire', 'Approuver et finaliser un inventaire', 'inventory'),
('inventory.view_history', 'Voir historique inventaires', 'Consulter l\'historique des inventaires', 'inventory')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- Module: stock - Gestion Stock (6 permissions - FUTUR)
INSERT INTO permissions (name, display_name, description, module) VALUES
('stock.view', 'Voir le stock', 'Consulter les niveaux de stock', 'stock'),
('stock.adjust', 'Ajuster le stock', 'Effectuer des ajustements de stock', 'stock'),
('stock.view_movements', 'Voir mouvements stock', 'Consulter les mouvements de stock', 'stock'),
('stock.export', 'Exporter le stock', 'Exporter les données de stock', 'stock'),
('stock.set_alerts', 'Configurer alertes stock', 'Configurer les alertes de stock bas', 'stock'),
('stock.transfer', 'Transférer du stock', 'Transférer du stock entre emplacements', 'stock')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description);

-- ============================================================================
-- STEP 5: Assign Permissions to System Roles
-- ============================================================================

-- SuperAdmin: TOUTES les permissions (78)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'super_admin'),
  id
FROM permissions
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id);

-- Admin: Toutes permissions sauf impersonate, view_all_orgs, create/delete org (54 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions
WHERE name NOT IN (
  'users.impersonate',
  'users.view_all_orgs',
  'organizations.create',
  'organizations.delete'
)
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id);

-- Referent: Gestion catalogues, produits, catégories, fournisseurs, paniers, commandes (35 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'referent'),
  id
FROM permissions
WHERE name IN (
  -- Catalogues
  'catalogues.view', 'catalogues.create', 'catalogues.edit', 'catalogues.delete',
  'catalogues.view_synthese', 'catalogues.view_synthese_detaillee', 'catalogues.export',
  -- Produits
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import',
  -- Catégories
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  -- Fournisseurs
  'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete',
  -- Paniers
  'paniers.view_own', 'paniers.view_all', 'paniers.create', 'paniers.edit',
  'paniers.delete', 'paniers.submit', 'paniers.validate',
  -- Commandes
  'commandes.view_own', 'commandes.view_all', 'commandes.export',
  -- Reports
  'reports.view_dashboard', 'reports.view_analytics', 'reports.export',
  -- Settings
  'settings.view'
)
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id);

-- Epicier: Validation paniers + consultation (10 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'epicier'),
  id
FROM permissions
WHERE name IN (
  'paniers.view_own', 'paniers.view_all', 'paniers.validate',
  'commandes.view_own', 'commandes.view_all',
  'products.view', 'categories.view',
  'catalogues.view', 'catalogues.view_synthese',
  'settings.view'
)
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id);

-- Utilisateur: Consultation + création panier (12 permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'utilisateur'),
  id
FROM permissions
WHERE name IN (
  'paniers.view_own', 'paniers.create', 'paniers.edit', 'paniers.submit',
  'commandes.view_own',
  'catalogues.view', 'products.view', 'categories.view',
  'suppliers.view',
  'settings.view',
  'reports.view_dashboard'
)
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id);

-- ============================================================================
-- STEP 6: Create Stored Procedures
-- ============================================================================

DROP PROCEDURE IF EXISTS migrate_user_to_rbac;
DROP PROCEDURE IF EXISTS migrate_all_users_to_rbac;
DROP PROCEDURE IF EXISTS check_user_has_permission;

DELIMITER //

-- Procédure: Migrer un utilisateur vers RBAC
CREATE PROCEDURE migrate_user_to_rbac(IN p_user_id INT)
BEGIN
  DECLARE v_current_role VARCHAR(50);
  DECLARE v_role_id INT;
  DECLARE v_role_normalized VARCHAR(100);

  -- Récupérer rôle actuel
  SELECT role INTO v_current_role FROM users WHERE id = p_user_id;

  -- Normaliser le nom (SuperAdmin → super_admin)
  SET v_role_normalized = CASE
    WHEN v_current_role = 'SuperAdmin' THEN 'super_admin'
    WHEN v_current_role = 'admin' THEN 'admin'
    WHEN v_current_role = 'referent' THEN 'referent'
    WHEN v_current_role = 'epicier' THEN 'epicier'
    WHEN v_current_role = 'utilisateur' THEN 'utilisateur'
    ELSE LOWER(v_current_role)
  END;

  -- Trouver le rôle système correspondant
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = v_role_normalized AND is_system = 1;

  IF v_role_id IS NOT NULL THEN
    -- Sauvegarder ancien rôle
    UPDATE users SET legacy_role = role WHERE id = p_user_id;

    -- Assigner rôle dans RBAC
    INSERT IGNORE INTO user_roles (user_id, role_id, assigned_by, reason)
    VALUES (p_user_id, v_role_id, 1, 'Migration automatique');

    -- Activer RBAC
    UPDATE users SET rbac_enabled = 1 WHERE id = p_user_id;

    -- Vider le cache
    DELETE FROM permission_cache WHERE user_id = p_user_id;

    SELECT CONCAT('User ', p_user_id, ' migrated to RBAC with role: ', v_role_normalized) as message;
  ELSE
    SELECT CONCAT('ERROR: Role not found for user ', p_user_id, ': ', v_current_role) as message;
  END IF;
END//

-- Procédure: Migrer TOUS les utilisateurs
CREATE PROCEDURE migrate_all_users_to_rbac()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_user_id INT;
  DECLARE v_count INT DEFAULT 0;
  DECLARE cur CURSOR FOR SELECT id FROM users WHERE rbac_enabled = 0;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_user_id;
    IF done THEN LEAVE read_loop; END IF;

    CALL migrate_user_to_rbac(v_user_id);
    SET v_count = v_count + 1;
  END LOOP;
  CLOSE cur;

  SELECT CONCAT('Migrated ', v_count, ' users to RBAC') as message;
END//

-- Procédure: Vérifier permission d'un utilisateur (pour debugging)
CREATE PROCEDURE check_user_has_permission(
  IN p_user_id INT,
  IN p_permission_name VARCHAR(150)
)
BEGIN
  SELECT DISTINCT p.name, p.display_name, r.name as role_name
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN user_roles ur ON rp.role_id = ur.role_id
  INNER JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
    AND p.name = p_permission_name
    AND p.is_active = 1
    AND r.is_active = 1
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END//

DELIMITER ;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

SELECT '=== RBAC Migration Complete! ===' as status;
SELECT COUNT(*) as total_permissions FROM permissions;
SELECT COUNT(*) as total_system_roles FROM roles WHERE is_system = 1;
SELECT COUNT(*) as total_role_permission_mappings FROM role_permissions;
SELECT 'Tables created: roles, permissions, role_permissions, user_roles, permission_cache, permission_audit_log' as info;
SELECT 'Stored procedures: migrate_user_to_rbac, migrate_all_users_to_rbac, check_user_has_permission' as procedures;
