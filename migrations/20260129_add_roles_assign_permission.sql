-- Add missing roles.assign permission
-- This permission is needed for bulk role assignment functionality

-- Insert the permission
INSERT INTO permissions (name, display_name, description, module, is_active)
VALUES (
  'roles.assign',
  'Assigner des rôles',
  'Permet d\'assigner des rôles aux utilisateurs',
  'roles',
  1
);

-- Assign this permission to super_admin, admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.name = 'roles.assign'
  AND r.name IN ('super_admin', 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp2
    WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
  );

-- Also link roles.assign to users.edit permission (they should go together)
-- Any role that can edit users should be able to assign roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
INNER JOIN permissions p2 ON rp.permission_id = p2.id
CROSS JOIN permissions p
WHERE p2.name = 'users.edit'
  AND p.name = 'roles.assign'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp3
    WHERE rp3.role_id = rp.role_id AND rp3.permission_id = p.id
  );
