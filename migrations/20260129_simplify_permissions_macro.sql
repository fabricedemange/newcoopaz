-- Migration: Simplifier les permissions en mode "macro"
-- Au lieu d'avoir view/create/edit/delete pour chaque ressource,
-- on a une seule permission "manage" pour tout le module

-- Créer les nouvelles permissions "macro"
INSERT INTO permissions (name, display_name, description, module) VALUES
-- Gestion complète par module
('catalogues.manage', 'Gérer catalogues', 'Gérer les catalogues (créer, modifier, supprimer, voir)', 'catalogues'),
('products.manage', 'Gérer produits', 'Gérer les produits (créer, modifier, supprimer, voir)', 'products'),
('categories.manage', 'Gérer catégories', 'Gérer les catégories (créer, modifier, supprimer, voir)', 'categories'),
('suppliers.manage', 'Gérer fournisseurs', 'Gérer les fournisseurs (créer, modifier, supprimer, voir)', 'suppliers'),
('users.manage', 'Gérer utilisateurs', 'Gérer les utilisateurs (créer, modifier, supprimer, voir)', 'users'),
('organizations.manage', 'Gérer organisations', 'Gérer les organisations (créer, modifier, supprimer, voir)', 'organizations'),
('paniers.manage', 'Gérer paniers', 'Gérer tous les paniers (voir tous, valider, modifier)', 'paniers'),
('commandes.manage', 'Gérer commandes', 'Gérer toutes les commandes (voir toutes, annuler)', 'commandes'),
('roles.manage', 'Gérer rôles', 'Gérer les rôles et permissions', 'roles'),
('reports.access', 'Accès rapports', 'Accéder aux rapports et statistiques', 'reports'),
('bandeaux.manage', 'Gérer bandeaux', 'Gérer les bandeaux d\'information', 'bandeaux'),

-- Permissions utilisateur (pour les ressources propres)
('paniers.own', 'Mes paniers', 'Gérer ses propres paniers (créer, voir, modifier, soumettre)', 'paniers'),
('commandes.own', 'Mes commandes', 'Voir ses propres commandes', 'commandes')
ON DUPLICATE KEY UPDATE description = VALUES(description), display_name = VALUES(display_name);

-- Affecter les permissions macro au rôle super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'catalogues.manage',
    'products.manage',
    'categories.manage',
    'suppliers.manage',
    'users.manage',
    'organizations.manage',
    'paniers.manage',
    'commandes.manage',
    'roles.manage',
    'reports.access',
    'bandeaux.manage'
  )
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Affecter les permissions macro au rôle admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'catalogues.manage',
    'products.manage',
    'categories.manage',
    'suppliers.manage',
    'users.manage',
    'organizations.manage',
    'paniers.manage',
    'commandes.manage',
    'reports.access'
  )
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Affecter les permissions appropriées au rôle utilisateur
-- L'utilisateur peut seulement gérer ses propres paniers et voir ses commandes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'utilisateur'
  AND p.name IN (
    'catalogues.view',
    'categories.view',
    'products.view',
    'paniers.own',
    'commandes.own',
    'reports.view_dashboard'
  )
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Note: On garde les anciennes permissions pour compatibilité temporaire
-- Elles pourront être supprimées plus tard après vérification complète
