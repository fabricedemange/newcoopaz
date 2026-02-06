-- ============================================================================
-- VÉRIFICATION DES CONTRAINTES DE CLÉS ÉTRANGÈRES POUR LA TABLE `ventes`
-- ============================================================================
-- Date: 2026-02-05
-- Description: Vérifie que toutes les contraintes FK de la table ventes sont bien appliquées
-- 
-- IMPORTANT: Avant d'exécuter ce script dans phpMyAdmin :
-- 1. Sélectionnez d'abord votre base de données (ex: coopazfr_commandes) dans le menu de gauche
-- 2. OU modifiez le nom de la base ci-dessous dans la variable @db_name
-- ============================================================================

-- Définir le nom de la base de données (modifiez si nécessaire)
SET @db_name = 'coopazfr_commandes';  -- Changez ce nom si votre base a un nom différent

-- OU utiliser la base actuellement sélectionnée (si vous avez sélectionné la bonne base dans phpMyAdmin)
-- SET @db_name = COALESCE(DATABASE(), 'coopazfr_commandes');

-- ============================================================================
-- VÉRIFICATION DE L'EXISTENCE DE LA TABLE
-- ============================================================================

SELECT 
    '=== VÉRIFICATION TABLE ventes ===' AS section;

SELECT 
    @db_name AS 'Base de données utilisée';

-- Vérifier l'existence de la table (insensible à la casse)
SELECT 
    TABLE_SCHEMA AS 'Base',
    TABLE_NAME AS 'Nom de la table trouvée',
    TABLE_TYPE AS 'Type',
    ENGINE AS 'Moteur'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_SCHEMA = @db_name
    AND LOWER(TABLE_NAME) = 'ventes';

-- Statut de la vérification
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = @db_name
            AND LOWER(TABLE_NAME) = 'ventes'
        )
        THEN CONCAT('✅ Table ventes existe dans la base ', @db_name)
        ELSE CONCAT('❌ Table ventes n''existe pas dans la base ', @db_name, ' - Vérifiez le nom de la base')
    END AS statut_table;

-- ============================================================================
-- VÉRIFICATION DES CONTRAINTES DE CLÉS ÉTRANGÈRES
-- ============================================================================

SELECT 
    '=== CONTRAINTES DE CLÉS ÉTRANGÈRES SUR ventes ===' AS section;

SELECT 
    kcu.CONSTRAINT_NAME AS 'Nom de la contrainte',
    kcu.COLUMN_NAME AS 'Colonne',
    kcu.REFERENCED_TABLE_NAME AS 'Table référencée',
    kcu.REFERENCED_COLUMN_NAME AS 'Colonne référencée',
    rc.UPDATE_RULE AS 'Règle UPDATE',
    rc.DELETE_RULE AS 'Règle DELETE',
    CASE 
        WHEN kcu.CONSTRAINT_NAME = 'ventes_ibfk_1' AND kcu.COLUMN_NAME = 'organization_id' 
             AND kcu.REFERENCED_TABLE_NAME = 'organizations' AND rc.DELETE_RULE = 'CASCADE'
        THEN '✅ Conforme'
        WHEN kcu.CONSTRAINT_NAME = 'ventes_ibfk_2' AND kcu.COLUMN_NAME = 'created_by' 
             AND kcu.REFERENCED_TABLE_NAME = 'users'
        THEN '✅ Conforme'
        WHEN kcu.CONSTRAINT_NAME = 'ventes_ibfk_3' AND kcu.COLUMN_NAME = 'adherent_id' 
             AND kcu.REFERENCED_TABLE_NAME = 'users' AND rc.DELETE_RULE = 'SET NULL'
        THEN '✅ Conforme'
        WHEN kcu.CONSTRAINT_NAME = 'ventes_ibfk_4' AND kcu.COLUMN_NAME = 'panier_id' 
             AND kcu.REFERENCED_TABLE_NAME = 'paniers' AND rc.DELETE_RULE = 'SET NULL'
        THEN '✅ Conforme'
        ELSE '⚠️ À vérifier'
    END AS 'Statut'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND LOWER(kcu.TABLE_NAME) = 'ventes'
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY 
    kcu.CONSTRAINT_NAME;

-- ============================================================================
-- VÉRIFICATION DÉTAILLÉE PAR CONTRAINTE ATTENDUE
-- ============================================================================

SELECT 
    '=== VÉRIFICATION DÉTAILLÉE ===' AS section;

-- Vérification ventes_ibfk_1: organization_id -> organizations.id (CASCADE)
SELECT 
    'ventes_ibfk_1' AS 'Contrainte attendue',
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
            WHERE kcu.TABLE_SCHEMA = @db_name
            AND LOWER(kcu.TABLE_NAME) = 'ventes'
            AND kcu.CONSTRAINT_NAME = 'ventes_ibfk_1'
            AND kcu.COLUMN_NAME = 'organization_id'
            AND kcu.REFERENCED_TABLE_NAME = 'organizations'
            AND kcu.REFERENCED_COLUMN_NAME = 'id'
            AND rc.DELETE_RULE = 'CASCADE'
        )
        THEN '✅ Présente et correcte'
        ELSE '❌ Absente ou incorrecte'
    END AS 'Statut',
    'organization_id -> organizations.id ON DELETE CASCADE' AS 'Détails attendus'

UNION ALL

-- Vérification ventes_ibfk_2: created_by -> users.id
SELECT 
    'ventes_ibfk_2',
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
            WHERE kcu.TABLE_SCHEMA = @db_name
            AND LOWER(kcu.TABLE_NAME) = 'ventes'
            AND kcu.CONSTRAINT_NAME = 'ventes_ibfk_2'
            AND kcu.COLUMN_NAME = 'created_by'
            AND kcu.REFERENCED_TABLE_NAME = 'users'
            AND kcu.REFERENCED_COLUMN_NAME = 'id'
        )
        THEN '✅ Présente et correcte'
        ELSE '❌ Absente ou incorrecte'
    END,
    'created_by -> users.id (règle DELETE par défaut)' AS 'Détails attendus'

UNION ALL

-- Vérification ventes_ibfk_3: adherent_id -> users.id (SET NULL)
SELECT 
    'ventes_ibfk_3',
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
            WHERE kcu.TABLE_SCHEMA = @db_name
            AND LOWER(kcu.TABLE_NAME) = 'ventes'
            AND kcu.CONSTRAINT_NAME = 'ventes_ibfk_3'
            AND kcu.COLUMN_NAME = 'adherent_id'
            AND kcu.REFERENCED_TABLE_NAME = 'users'
            AND kcu.REFERENCED_COLUMN_NAME = 'id'
            AND rc.DELETE_RULE = 'SET NULL'
        )
        THEN '✅ Présente et correcte'
        ELSE '❌ Absente ou incorrecte'
    END,
    'adherent_id -> users.id ON DELETE SET NULL' AS 'Détails attendus'

UNION ALL

-- Vérification ventes_ibfk_4: panier_id -> paniers.id (SET NULL)
SELECT 
    'ventes_ibfk_4',
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
            WHERE kcu.TABLE_SCHEMA = @db_name
            AND LOWER(kcu.TABLE_NAME) = 'ventes'
            AND kcu.CONSTRAINT_NAME = 'ventes_ibfk_4'
            AND kcu.COLUMN_NAME = 'panier_id'
            AND kcu.REFERENCED_TABLE_NAME = 'paniers'
            AND kcu.REFERENCED_COLUMN_NAME = 'id'
            AND rc.DELETE_RULE = 'SET NULL'
        )
        THEN '✅ Présente et correcte'
        ELSE '❌ Absente ou incorrecte'
    END,
    'panier_id -> paniers.id ON DELETE SET NULL' AS 'Détails attendus';

-- ============================================================================
-- VÉRIFICATION DE L'INTÉGRITÉ RÉFÉRENTIELLE
-- (Détection des données orphelines)
-- ============================================================================

SELECT 
    '=== VÉRIFICATION INTÉGRITÉ RÉFÉRENTIELLE ===' AS section;

-- Vérifier d'abord si la table ventes existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = @db_name AND LOWER(TABLE_NAME) = 'ventes'
        )
        THEN CONCAT('✅ Table ventes existe dans ', @db_name, ' - Vous pouvez exécuter les requêtes ci-dessous')
        ELSE CONCAT('❌ Table ventes n''existe pas dans ', @db_name, ' - Ignorez la section ci-dessous')
    END AS 'Statut de la table ventes';

-- ============================================================================
-- REQUÊTES SQL À EXÉCUTER (seulement si la table ventes existe)
-- ============================================================================
-- ⚠️ ATTENTION: Exécutez ces requêtes UNIQUEMENT si la table ventes existe !
-- Remplacez @db_name par le nom de votre base si nécessaire

-- Requête 1: Vérification ventes.organization_id
SELECT 
    '=== REQUÊTE 1: ventes.organization_id ===' AS info,
    CONCAT('SELECT ''ventes.organization_id'' AS ''Contrainte vérifiée'', COUNT(*) AS ''Enregistrements orphelins'' FROM ', @db_name, '.ventes v LEFT JOIN ', @db_name, '.organizations o ON v.organization_id = o.id WHERE o.id IS NULL;') AS 'SQL à exécuter';

-- Requête 2: Vérification ventes.created_by
SELECT 
    '=== REQUÊTE 2: ventes.created_by ===' AS info,
    CONCAT('SELECT ''ventes.created_by'' AS ''Contrainte vérifiée'', COUNT(*) AS ''Enregistrements orphelins'' FROM ', @db_name, '.ventes v LEFT JOIN ', @db_name, '.users u ON v.created_by = u.id WHERE v.created_by IS NOT NULL AND u.id IS NULL;') AS 'SQL à exécuter';

-- Requête 3: Vérification ventes.adherent_id
SELECT 
    '=== REQUÊTE 3: ventes.adherent_id ===' AS info,
    CONCAT('SELECT ''ventes.adherent_id'' AS ''Contrainte vérifiée'', COUNT(*) AS ''Enregistrements orphelins'' FROM ', @db_name, '.ventes v LEFT JOIN ', @db_name, '.users u ON v.adherent_id = u.id WHERE v.adherent_id IS NOT NULL AND u.id IS NULL;') AS 'SQL à exécuter';

-- Requête 4: Vérification ventes.panier_id
SELECT 
    '=== REQUÊTE 4: ventes.panier_id ===' AS info,
    CONCAT('SELECT ''ventes.panier_id'' AS ''Contrainte vérifiée'', COUNT(*) AS ''Enregistrements orphelins'' FROM ', @db_name, '.ventes v LEFT JOIN ', @db_name, '.paniers p ON v.panier_id = p.id WHERE v.panier_id IS NOT NULL AND p.id IS NULL;') AS 'SQL à exécuter';

-- ============================================================================
-- RÉSUMÉ FINAL
-- ============================================================================

SELECT 
    '=== RÉSUMÉ ===' AS section;

SELECT 
    COUNT(*) AS 'Nombre total de contraintes FK sur ventes',
    SUM(CASE WHEN CONSTRAINT_NAME IN ('ventes_ibfk_1', 'ventes_ibfk_2', 'ventes_ibfk_3', 'ventes_ibfk_4') THEN 1 ELSE 0 END) AS 'Contraintes attendues trouvées'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = @db_name
    AND LOWER(TABLE_NAME) = 'ventes'
    AND REFERENCED_TABLE_NAME IS NOT NULL;
