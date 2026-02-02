-- Permission RBAC: Changer le propriétaire d'un panier (référent et au-dessus)
-- À exécuter après les migrations RBAC macro (20260129_rbac_truly_macro.sql).

-- 1. Créer la permission paniers.change_owner
INSERT INTO permissions (name, display_name, description, module, is_active) VALUES
('paniers.change_owner', 'Changer le propriétaire d\'un panier', 'Changer le propriétaire d\'un panier (référent)', 'paniers', 1)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  is_active = VALUES(is_active);

-- 2. Assigner la permission au rôle referent
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'referent'
  AND p.name = 'paniers.change_owner'
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 3. Vider le cache des permissions
TRUNCATE TABLE permission_cache;
