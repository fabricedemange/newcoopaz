-- ============================================================================
-- VÉRIFICATION DES CONTRAINTES DE BASE DE DONNÉES
-- ============================================================================
-- Date: 2026-02-05
-- Description: Script complet pour vérifier toutes les contraintes appliquées
--              dans la base de données MySQL/InnoDB
-- 
-- IMPORTANT: Avant d'exécuter ce script dans phpMyAdmin :
-- 1. Sélectionnez d'abord votre base de données (ex: coopazfr_new_commandes) dans le menu de gauche
-- 2. OU modifiez le nom de la base ci-dessous dans la variable @db_name
-- ============================================================================

-- Définir le nom de la base de données (modifiez si nécessaire)
SET @db_name = 'coopazfr_new_commandes';  -- Changez ce nom si votre base a un nom différent

-- OU utiliser la base actuellement sélectionnée (si vous avez sélectionné la bonne base dans phpMyAdmin)
-- SET @db_name = COALESCE(DATABASE(), 'coopazfr_new_commandes');

-- ============================================================================
-- 1. LISTE DE TOUTES LES CONTRAINTES DE CLÉS ÉTRANGÈRES (FOREIGN KEYS)
-- ============================================================================

SELECT 
    '=== CONTRAINTES DE CLÉS ÉTRANGÈRES ===' AS section;

SELECT 
    kcu.TABLE_NAME AS 'Table',
    kcu.CONSTRAINT_NAME AS 'Nom de la contrainte',
    kcu.COLUMN_NAME AS 'Colonne',
    kcu.REFERENCED_TABLE_NAME AS 'Table référencée',
    kcu.REFERENCED_COLUMN_NAME AS 'Colonne référencée',
    rc.UPDATE_RULE AS 'Règle UPDATE',
    rc.DELETE_RULE AS 'Règle DELETE'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY 
    kcu.TABLE_NAME, kcu.CONSTRAINT_NAME;

-- ============================================================================
-- 2. LISTE DE TOUTES LES CONTRAINTES DE CLÉS PRIMAIRES (PRIMARY KEYS)
-- ============================================================================

SELECT 
    '=== CONTRAINTES DE CLÉS PRIMAIRES ===' AS section;

SELECT 
    TABLE_NAME AS 'Table',
    CONSTRAINT_NAME AS 'Nom de la contrainte',
    COLUMN_NAME AS 'Colonne(s)',
    ORDINAL_POSITION AS 'Position'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = @db_name
    AND CONSTRAINT_NAME = 'PRIMARY'
ORDER BY 
    TABLE_NAME, ORDINAL_POSITION;

-- ============================================================================
-- 3. LISTE DE TOUTES LES CONTRAINTES UNIQUE
-- ============================================================================

SELECT 
    '=== CONTRAINTES UNIQUE ===' AS section;

SELECT 
    TABLE_NAME AS 'Table',
    CONSTRAINT_NAME AS 'Nom de la contrainte',
    COLUMN_NAME AS 'Colonne(s)',
    ORDINAL_POSITION AS 'Position'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = @db_name
    AND CONSTRAINT_NAME != 'PRIMARY'
    AND CONSTRAINT_NAME IN (
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = @db_name
        AND CONSTRAINT_TYPE = 'UNIQUE'
    )
ORDER BY 
    TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;

-- ============================================================================
-- 4. VÉRIFICATION DE L'INTÉGRITÉ RÉFÉRENTIELLE
--    (Détection des données orphelines)
--    Cette section génère dynamiquement les requêtes SQL à exécuter
--    basées sur les contraintes de clés étrangères existantes
-- ============================================================================

SELECT 
    '=== VÉRIFICATION INTÉGRITÉ RÉFÉRENTIELLE ===' AS section;

-- Liste des contraintes de clés étrangères à vérifier
-- Cette requête génère les instructions SQL pour chaque contrainte FK existante
SELECT 
    '=== REQUÊTES SQL À EXÉCUTER ===' AS info,
    CONCAT(
        'SELECT ''', 
        kcu.TABLE_NAME, '.', kcu.COLUMN_NAME, 
        ''' AS ''Contrainte vérifiée'', COUNT(*) AS ''Enregistrements orphelins'' FROM ',
        kcu.TABLE_NAME, ' t LEFT JOIN ',
        kcu.REFERENCED_TABLE_NAME, ' r ON t.', kcu.COLUMN_NAME, ' = r.', kcu.REFERENCED_COLUMN_NAME,
        ' WHERE r.', kcu.REFERENCED_COLUMN_NAME, ' IS NULL;'
    ) AS 'Requête SQL à exécuter'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
INNER JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_SCHEMA = @db_name
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY 
    kcu.TABLE_NAME, kcu.COLUMN_NAME;

-- ============================================================================
-- ALTERNATIVE: Vérification manuelle par contrainte
-- Copiez-collez les requêtes générées ci-dessus et exécutez-les une par une
-- ============================================================================

SELECT 
    '=== INSTRUCTIONS ===' AS info,
    '1. Copiez les requêtes SQL générées ci-dessus' AS etape1,
    '2. Exécutez-les une par une dans phpMyAdmin ou votre client MySQL' AS etape2,
    '3. Si une requête génère une erreur (table inexistante), ignorez-la simplement' AS etape3,
    '4. Les résultats vous indiqueront le nombre d''enregistrements orphelins' AS etape4;

-- ============================================================================
-- NOTE IMPORTANTE
-- ============================================================================
-- Si vous préférez utiliser un script automatisé qui gère automatiquement
-- les tables manquantes, utilisez plutôt le script Node.js :
-- 
--   node scripts/verify-constraints.js
--
-- Ce script vérifie automatiquement l'existence des tables et n'exécute
-- que les vérifications pertinentes, sans générer d'erreurs.
-- ============================================================================

-- ============================================================================
-- 5. VÉRIFICATION DES CONTRAINTES NOT NULL
-- ============================================================================

SELECT 
    '=== CONTRAINTES NOT NULL ===' AS section;

SELECT 
    TABLE_NAME AS 'Table',
    COLUMN_NAME AS 'Colonne',
    IS_NULLABLE AS 'Nullable',
    COLUMN_TYPE AS 'Type',
    COLUMN_DEFAULT AS 'Valeur par défaut'
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = @db_name
    AND IS_NULLABLE = 'NO'
ORDER BY 
    TABLE_NAME, COLUMN_NAME;

-- ============================================================================
-- 6. VÉRIFICATION DES CONTRAINTES CHECK (MySQL 8.0+)
-- ============================================================================

SELECT 
    '=== CONTRAINTES CHECK ===' AS section;

SELECT 
    TABLE_NAME AS 'Table',
    CONSTRAINT_NAME AS 'Nom de la contrainte',
    CHECK_CLAUSE AS 'Condition'
FROM 
    INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE 
    CONSTRAINT_SCHEMA = @db_name
ORDER BY 
    TABLE_NAME, CONSTRAINT_NAME;

-- ============================================================================
-- 7. STATISTIQUES PAR TABLE
-- ============================================================================

SELECT 
    '=== STATISTIQUES PAR TABLE ===' AS section;

SELECT 
    TABLE_NAME AS 'Table',
    ENGINE AS 'Moteur',
    TABLE_ROWS AS 'Nombre de lignes',
    DATA_LENGTH AS 'Taille données (bytes)',
    INDEX_LENGTH AS 'Taille index (bytes)',
    (DATA_LENGTH + INDEX_LENGTH) AS 'Taille totale (bytes)'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_SCHEMA = @db_name
    AND TABLE_TYPE = 'BASE TABLE'
ORDER BY 
    TABLE_NAME;

-- ============================================================================
-- 8. VÉRIFICATION DES INDEX ET CONTRAINTES PAR TABLE
-- ============================================================================

SELECT 
    '=== INDEX ET CONTRAINTES PAR TABLE ===' AS section;

SELECT 
    TABLE_NAME AS 'Table',
    INDEX_NAME AS 'Nom index/contrainte',
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS 'Colonnes',
    INDEX_TYPE AS 'Type',
    CASE 
        WHEN INDEX_NAME = 'PRIMARY' THEN 'PRIMARY KEY'
        WHEN NON_UNIQUE = 0 THEN 'UNIQUE'
        WHEN INDEX_NAME LIKE 'fk_%' THEN 'FOREIGN KEY'
        ELSE 'INDEX'
    END AS 'Type de contrainte'
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = @db_name
GROUP BY 
    TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY 
    TABLE_NAME, 
    CASE 
        WHEN INDEX_NAME = 'PRIMARY' THEN 1
        WHEN NON_UNIQUE = 0 THEN 2
        WHEN INDEX_NAME LIKE 'fk_%' THEN 3
        ELSE 4
    END,
    INDEX_NAME;

-- ============================================================================
-- 9. RÉSUMÉ DES CONTRAINTES PAR TYPE
-- ============================================================================

SELECT 
    '=== RÉSUMÉ DES CONTRAINTES ===' AS section;

SELECT 
    'Clés primaires' AS 'Type de contrainte',
    COUNT(DISTINCT TABLE_NAME) AS 'Nombre de tables avec PK'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = @db_name
    AND CONSTRAINT_NAME = 'PRIMARY'

UNION ALL

SELECT 
    'Clés étrangères',
    COUNT(DISTINCT CONSTRAINT_NAME)
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE 
    TABLE_SCHEMA = @db_name
    AND REFERENCED_TABLE_NAME IS NOT NULL

UNION ALL

SELECT 
    'Contraintes UNIQUE',
    COUNT(DISTINCT CONSTRAINT_NAME)
FROM 
    INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE 
    TABLE_SCHEMA = @db_name
    AND CONSTRAINT_TYPE = 'UNIQUE'
    AND CONSTRAINT_NAME != 'PRIMARY'

UNION ALL

SELECT 
    'Contraintes CHECK',
    COUNT(DISTINCT CONSTRAINT_NAME)
FROM 
    INFORMATION_SCHEMA.CHECK_CONSTRAINTS
WHERE 
    CONSTRAINT_SCHEMA = @db_name;

-- ============================================================================
-- FIN DU RAPPORT
-- ============================================================================

SELECT 
    '=== VÉRIFICATION TERMINÉE ===' AS section;
