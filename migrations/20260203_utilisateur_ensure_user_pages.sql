-- ============================================================================
-- Migration: S'assurer que le rôle Utilisateur a les permissions pour les
--            pages utilisateur (Catalogues, Paniers, Commandes)
-- ============================================================================
-- À exécuter si les utilisateurs avec le rôle "utilisateur" ont 403 sur
-- Catalogues / Paniers / Commandes alors que l'Accueil fonctionne.
-- N'ajoute que les permissions manquantes (sans supprimer les autres).
-- ============================================================================

-- Permissions nécessaires pour les pages utilisateur (routes requireAnyPermission) :
--   Catalogues : catalogues.view (ou catalogues, paniers.user)
--   Paniers    : paniers.own (ou paniers.user, paniers.admin)
--   Commandes  : commandes.own (ou commandes.user, commandes.admin)

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'utilisateur'
  AND p.name IN (
    'catalogues.view',
    'paniers.own',
    'commandes.own'
  );

-- Vider le cache des permissions pour prise en compte immédiate
TRUNCATE TABLE permission_cache;

SELECT 'Migration 20260203_utilisateur_ensure_user_pages.sql terminée.' AS message;
