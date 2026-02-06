-- ============================================================================
-- DIAGNOSTIC : Pourquoi la table ventes n'est pas détectée ?
-- ============================================================================

-- 1. Vérifier le nom de la base de données actuelle
SELECT 
    '=== BASE DE DONNÉES ACTUELLE ===' AS section;

SELECT 
    DATABASE() AS 'Base de données actuelle',
    SCHEMA() AS 'Schéma actuel';

-- 2. Lister toutes les tables dans la base actuelle
SELECT 
    '=== TOUTES LES TABLES DANS LA BASE ===' AS section;

SELECT 
    TABLE_NAME AS 'Nom de la table',
    TABLE_TYPE AS 'Type',
    ENGINE AS 'Moteur'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_SCHEMA = DATABASE()
ORDER BY 
    TABLE_NAME;

-- 3. Rechercher spécifiquement la table ventes (insensible à la casse)
SELECT 
    '=== RECHERCHE TABLE ventes ===' AS section;

SELECT 
    TABLE_SCHEMA AS 'Base de données',
    TABLE_NAME AS 'Nom de la table',
    TABLE_TYPE AS 'Type',
    ENGINE AS 'Moteur'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_NAME LIKE '%ventes%'
    OR TABLE_NAME LIKE '%Ventes%'
    OR TABLE_NAME LIKE '%VENTES%'
ORDER BY 
    TABLE_SCHEMA, TABLE_NAME;

-- 4. Vérifier si la table existe avec SHOW TABLES
SELECT 
    '=== VÉRIFICATION AVEC SHOW TABLES ===' AS section,
    'Exécutez manuellement: SHOW TABLES LIKE ''ventes%'';' AS instruction;

-- 5. Si la table existe, vérifier ses contraintes FK
SELECT 
    '=== CONTRAINTES FK SUR ventes (si la table existe) ===' AS section;

SELECT 
    kcu.TABLE_SCHEMA AS 'Base',
    kcu.TABLE_NAME AS 'Table',
    kcu.CONSTRAINT_NAME AS 'Contrainte',
    kcu.COLUMN_NAME AS 'Colonne',
    kcu.REFERENCED_TABLE_NAME AS 'Table référencée',
    rc.DELETE_RULE AS 'Règle DELETE'
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
LEFT JOIN 
    INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE 
    kcu.TABLE_NAME LIKE '%ventes%'
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY 
    kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.CONSTRAINT_NAME;
