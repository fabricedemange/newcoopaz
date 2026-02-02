-- Migration RBAC: Vraiment macro - une seule permission par module
-- On supprime toutes les permissions granulaires et on garde une seule permission par module

-- 1. Supprimer toutes les anciennes permissions granulaires des role_permissions
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE
    name LIKE '%.view' OR
    name LIKE '%.create' OR
    name LIKE '%.edit' OR
    name LIKE '%.delete' OR
    name LIKE '%.manage' OR
    name LIKE '%.view_%' OR
    name LIKE '%.assign' OR
    name LIKE '%.export' OR
    name LIKE '%.import' OR
    name LIKE '%.validate'
);

-- 2. Désactiver toutes les anciennes permissions (on les garde pour historique mais inactives)
UPDATE permissions SET is_active = 0 WHERE
  name LIKE '%.view' OR
  name LIKE '%.create' OR
  name LIKE '%.edit' OR
  name LIKE '%.delete' OR
  name LIKE '%.manage' OR
  name LIKE '%.view_%' OR
  name LIKE '%.assign' OR
  name LIKE '%.export' OR
  name LIKE '%.import' OR
  name LIKE '%.validate';

-- 3. Créer les nouvelles permissions MACRO (une seule par module)
INSERT INTO permissions (name, display_name, description, module, is_active) VALUES
-- Modules principaux
('catalogues', 'Catalogues', 'Accès complet aux catalogues', 'catalogues', 1),
('products', 'Produits', 'Accès complet aux produits', 'products', 1),
('categories', 'Catégories', 'Accès complet aux catégories', 'categories', 1),
('suppliers', 'Fournisseurs', 'Accès complet aux fournisseurs', 'suppliers', 1),

-- Gestion utilisateurs et organisations
('users', 'Utilisateurs', 'Accès complet aux utilisateurs', 'users', 1),
('organizations', 'Organisations', 'Accès complet aux organisations', 'organizations', 1),
('roles', 'Rôles', 'Accès complet aux rôles et permissions', 'roles', 1),

-- Paniers et commandes - Admin
('paniers.admin', 'Paniers (Admin)', 'Gérer tous les paniers (validation, visualisation complète)', 'paniers', 1),
('commandes.admin', 'Commandes (Admin)', 'Gérer toutes les commandes', 'commandes', 1),

-- Paniers et commandes - Utilisateur
('paniers.user', 'Mes Paniers', 'Gérer ses propres paniers', 'paniers', 1),
('commandes.user', 'Mes Commandes', 'Voir ses propres commandes', 'commandes', 1),

-- Modules complémentaires
('reports', 'Rapports', 'Accès aux rapports et statistiques', 'reports', 1),
('bandeaux', 'Bandeaux', 'Gérer les bandeaux d\'information', 'bandeaux', 1),
('audit_logs', 'Logs', 'Voir les traces et logs système', 'audit_logs', 1),
('admin', 'Administration', 'Accès aux fonctions d\'administration système', 'admin', 1)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  is_active = VALUES(is_active);

-- 4. Affecter les permissions au rôle super_admin (tout)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.is_active = 1
  AND p.name NOT LIKE '%.user'
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 5. Affecter les permissions au rôle admin (tout sauf système)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.is_active = 1
  AND p.name IN (
    'catalogues',
    'products',
    'categories',
    'suppliers',
    'users',
    'organizations',
    'paniers.admin',
    'commandes.admin',
    'reports',
    'bandeaux'
  )
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 6. Affecter les permissions au rôle utilisateur (lecture + ses propres ressources)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'utilisateur'
  AND p.is_active = 1
  AND p.name IN (
    'paniers.user',
    'commandes.user',
    'reports'
  )
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 7. Vider le cache
TRUNCATE TABLE permission_cache;
