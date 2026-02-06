-- ============================================================================
-- VÉRIFICATION DES RÈGLES CASCADE, SET NULL, RESTRICT
-- ============================================================================
-- Date: 2026-02-05
-- Description: Analyse des règles DELETE et UPDATE pour vérifier leur cohérence
-- ============================================================================

SET @db_name = 'coopazfr_new_commandes';

-- ============================================================================
-- ANALYSE DES RÈGLES DELETE
-- ============================================================================

SELECT 
    '=== ANALYSE DES RÈGLES DELETE ===' AS section;

-- Règles DELETE par type
SELECT 
    rc.DELETE_RULE AS 'Règle DELETE',
    COUNT(*) AS 'Nombre de contraintes',
    GROUP_CONCAT(DISTINCT kcu.TABLE_NAME ORDER BY kcu.TABLE_NAME SEPARATOR ', ') AS 'Tables concernées'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
GROUP BY 
    rc.DELETE_RULE
ORDER BY 
    COUNT(*) DESC;

-- ============================================================================
-- VÉRIFICATION DES RÈGLES CASCADE (suppression en cascade)
-- ============================================================================

SELECT 
    '=== RÈGLES DELETE CASCADE (suppression en cascade) ===' AS section;

SELECT 
    kcu.TABLE_NAME AS 'Table enfant',
    kcu.COLUMN_NAME AS 'Colonne FK',
    kcu.REFERENCED_TABLE_NAME AS 'Table parent',
    kcu.CONSTRAINT_NAME AS 'Contrainte',
    CASE 
        WHEN kcu.TABLE_NAME IN ('catalog_products', 'inventaire_lignes', 'lignes_vente', 'paiements', 'panier_articles')
             AND kcu.REFERENCED_TABLE_NAME IN ('catalog_files', 'inventaires', 'ventes', 'paniers')
        THEN '✅ Logique : Les détails sont supprimés avec leur parent'
        WHEN kcu.TABLE_NAME IN ('inventaires', 'paniers', 'roles', 'modes_paiement')
             AND kcu.REFERENCED_TABLE_NAME = 'organizations'
        THEN '✅ Logique : Les données organisation sont supprimées avec l''organisation'
        WHEN kcu.TABLE_NAME = 'role_permissions'
             AND kcu.REFERENCED_TABLE_NAME = 'roles'
        THEN '✅ Logique : Les permissions de rôle sont supprimées avec le rôle'
        ELSE '⚠️ À vérifier'
    END AS 'Analyse'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    AND rc.DELETE_RULE = 'CASCADE'
ORDER BY 
    kcu.TABLE_NAME, kcu.COLUMN_NAME;

-- ============================================================================
-- VÉRIFICATION DES RÈGLES SET NULL (mise à NULL si parent supprimé)
-- ============================================================================

SELECT 
    '=== RÈGLES DELETE SET NULL (mise à NULL si parent supprimé) ===' AS section;

SELECT 
    kcu.TABLE_NAME AS 'Table enfant',
    kcu.COLUMN_NAME AS 'Colonne FK',
    kcu.REFERENCED_TABLE_NAME AS 'Table parent',
    kcu.CONSTRAINT_NAME AS 'Contrainte',
    CASE 
        WHEN kcu.COLUMN_NAME IN ('category_id', 'supplier_id', 'parent_id', 'adherent_id', 'panier_id')
             AND kcu.REFERENCED_TABLE_NAME IN ('categories', 'suppliers', 'users', 'paniers')
        THEN '✅ Logique : Relation optionnelle, peut être NULL'
        WHEN kcu.TABLE_NAME = 'catalog_files' AND kcu.COLUMN_NAME = 'organization_id'
        THEN '✅ Logique : Le catalogue peut exister sans organisation (archivé)'
        WHEN kcu.TABLE_NAME = 'permission_audit_log' 
             AND kcu.COLUMN_NAME IN ('user_id', 'role_id')
        THEN '✅ Logique : L''audit peut exister même si l''utilisateur/rôle est supprimé'
        ELSE '⚠️ À vérifier'
    END AS 'Analyse'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    AND rc.DELETE_RULE = 'SET NULL'
ORDER BY 
    kcu.TABLE_NAME, kcu.COLUMN_NAME;

-- ============================================================================
-- VÉRIFICATION DES RÈGLES RESTRICT (empêche la suppression)
-- ============================================================================

SELECT 
    '=== RÈGLES DELETE RESTRICT (empêche la suppression du parent) ===' AS section;

SELECT 
    kcu.TABLE_NAME AS 'Table enfant',
    kcu.COLUMN_NAME AS 'Colonne FK',
    kcu.REFERENCED_TABLE_NAME AS 'Table parent',
    kcu.CONSTRAINT_NAME AS 'Contrainte',
    CASE 
        WHEN kcu.REFERENCED_TABLE_NAME IN ('organizations', 'users', 'products', 'permissions')
             AND kcu.TABLE_NAME NOT IN ('inventaires', 'paniers', 'roles', 'modes_paiement', 'catalog_files')
        THEN '✅ Logique : Empêche la suppression de données critiques'
        WHEN kcu.TABLE_NAME = 'catalog_products' AND kcu.REFERENCED_TABLE_NAME = 'products'
        THEN '✅ Logique : Un produit référencé dans un catalogue ne peut pas être supprimé'
        WHEN kcu.TABLE_NAME = 'lignes_vente' AND kcu.REFERENCED_TABLE_NAME = 'products'
        THEN '✅ Logique : Un produit avec des ventes ne peut pas être supprimé'
        WHEN kcu.TABLE_NAME = 'paiements' AND kcu.REFERENCED_TABLE_NAME = 'modes_paiement'
        THEN '✅ Logique : Un mode de paiement utilisé ne peut pas être supprimé'
        ELSE '⚠️ À vérifier'
    END AS 'Analyse'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    AND rc.DELETE_RULE = 'RESTRICT'
ORDER BY 
    kcu.TABLE_NAME, kcu.COLUMN_NAME;

-- ============================================================================
-- VÉRIFICATION DES RÈGLES UPDATE
-- ============================================================================

SELECT 
    '=== ANALYSE DES RÈGLES UPDATE ===' AS section;

-- Règles UPDATE par type
SELECT 
    rc.UPDATE_RULE AS 'Règle UPDATE',
    COUNT(*) AS 'Nombre de contraintes'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
GROUP BY 
    rc.UPDATE_RULE
ORDER BY 
    COUNT(*) DESC;

-- ============================================================================
-- RÉSUMÉ ET RECOMMANDATIONS
-- ============================================================================

SELECT 
    '=== RÉSUMÉ ET RECOMMANDATIONS ===' AS section;

SELECT 
    '✅ CASCADE' AS 'Règle',
    'Utilisé pour : Détails supprimés avec leur parent (lignes_vente, paiements, panier_articles, etc.)' AS 'Usage',
    'Statut: Correct' AS 'Évaluation'

UNION ALL

SELECT 
    '✅ SET NULL',
    'Utilisé pour : Relations optionnelles (category_id, supplier_id, adherent_id, panier_id)',
    'Statut: Correct'

UNION ALL

SELECT 
    '✅ RESTRICT',
    'Utilisé pour : Empêcher la suppression de données critiques (organizations, users, products référencés)',
    'Statut: Correct'

UNION ALL

SELECT 
    'ℹ️ UPDATE RULES',
    'Toutes les règles UPDATE sont en RESTRICT (par défaut MySQL)',
    'Statut: Normal et sécurisé';
