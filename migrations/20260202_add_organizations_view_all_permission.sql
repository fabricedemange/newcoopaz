-- Permission RBAC: Voir toutes les organisations (remplace les checks "SuperAdmin" en dur)
-- À exécuter après les migrations RBAC macro (20260129_rbac_truly_macro.sql).
-- Cette permission permet de ne plus dépendre du libellé de rôle pour "voir toutes les orgs / bypass filtre org".

-- 1. Créer la permission organizations.view_all
INSERT INTO permissions (name, display_name, description, module, is_active) VALUES
('organizations.view_all', 'Voir toutes les organisations', 'Accès sans filtre organisation (ex-SuperAdmin)', 'organizations', 1)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  is_active = VALUES(is_active);

-- 2. Assigner la permission au rôle super_admin uniquement
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'organizations.view_all'
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 3. Vider le cache des permissions
TRUNCATE TABLE permission_cache;

SELECT 'Migration 20260202_add_organizations_view_all_permission.sql terminée.' AS message;
