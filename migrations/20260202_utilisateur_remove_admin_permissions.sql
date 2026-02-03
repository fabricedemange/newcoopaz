-- ============================================================================
-- Migration: Retirer les permissions admin du rôle Utilisateur
-- ============================================================================
-- Le rôle "Utilisateur" ne doit pas voir : Admin Site, Statistiques,
-- Administration (dashboard, gestion catalogues, produits, catégories, fournisseurs).
-- Cette migration retire les permissions macro/admin qui ont pu lui être
-- assignées (ex. par 20260129_rbac_truly_macro qui donnait "reports").
-- ============================================================================

-- Retirer du rôle "utilisateur" les permissions réservées aux admins
DELETE rp FROM role_permissions rp
INNER JOIN roles r ON r.id = rp.role_id
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'utilisateur'
  AND p.name IN (
    'reports',
    'catalogues',
    'paniers.admin',
    'commandes.admin',
    'products',
    'categories',
    'suppliers'
  );

-- Vider le cache des permissions pour prise en compte immédiate
TRUNCATE TABLE permission_cache;

SELECT 'Migration 20260202_utilisateur_remove_admin_permissions.sql terminée.' AS message;
