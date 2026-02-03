-- Migration RBAC: permission Inventaire et stock (une seule zone)
-- Utilisée pour les pages Inventaire, Mouvements stock, Historique inventaires (menu Administration).

INSERT INTO permissions (name, display_name, description, module, is_active) VALUES
('inventory_stock', 'Inventaire et stock', 'Inventaires et mouvements de stock (sessions, appliquer, historique)', 'inventory_stock', 1)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  module = VALUES(module),
  is_active = VALUES(is_active);

-- Optionnel: donner la permission au rôle admin (pour les orgs qui utilisent déjà l'inventaire)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.name = 'inventory_stock'
ON DUPLICATE KEY UPDATE role_id = role_id;

TRUNCATE TABLE permission_cache;

SELECT 'Migration 20260204_rbac_inventory_stock_permission.sql terminée.' AS message;
