#!/usr/bin/env node

/**
 * Script de vérification des contraintes de base de données
 * 
 * Ce script exécute une série de requêtes SQL pour vérifier que toutes
 * les contraintes (clés primaires, clés étrangères, UNIQUE, NOT NULL)
 * sont bien appliquées dans la base de données.
 * 
 * Usage:
 *   node scripts/verify-constraints.js
 * 
 * Ou avec variables d'environnement personnalisées:
 *   DB_HOST=localhost DB_USER=root DB_PASS=password DB_NAME=mydb node scripts/verify-constraints.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'coopazfr_commandes',
  charset: 'utf8mb4',
  multipleStatements: true
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

function printSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

function printTable(data) {
  if (!data || data.length === 0) {
    console.log('  (aucune donnée)\n');
    return;
  }

  // Obtenir les clés de la première ligne
  const keys = Object.keys(data[0]);
  
  // Calculer la largeur maximale pour chaque colonne
  const widths = keys.map(key => {
    const headerWidth = key.length;
    const dataWidth = Math.max(...data.map(row => String(row[key] || '').length));
    return Math.max(headerWidth, dataWidth, 10);
  });

  // Afficher l'en-tête
  const header = keys.map((key, i) => key.padEnd(widths[i])).join(' | ');
  console.log('  ' + header);
  console.log('  ' + '-'.repeat(header.length));

  // Afficher les données
  data.forEach(row => {
    const line = keys.map((key, i) => String(row[key] || '').padEnd(widths[i])).join(' | ');
    console.log('  ' + line);
  });
  
  console.log('');
}

// ============================================================================
// REQUÊTES DE VÉRIFICATION
// ============================================================================

async function checkForeignKeys(connection) {
  printSection('1. CONTRAINTES DE CLÉS ÉTRANGÈRES');

  const [rows] = await connection.execute(`
    SELECT 
      kcu.TABLE_NAME AS table_name,
      kcu.CONSTRAINT_NAME AS constraint_name,
      kcu.COLUMN_NAME AS column_name,
      kcu.REFERENCED_TABLE_NAME AS referenced_table_name,
      kcu.REFERENCED_COLUMN_NAME AS referenced_column_name,
      rc.UPDATE_RULE AS update_rule,
      rc.DELETE_RULE AS delete_rule
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    INNER JOIN 
      INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE 
      kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY 
      kcu.TABLE_NAME, kcu.CONSTRAINT_NAME
  `);

  printTable(rows);
  return rows.length;
}

async function checkPrimaryKeys(connection) {
  printSection('2. CONTRAINTES DE CLÉS PRIMAIRES');

  const [rows] = await connection.execute(`
    SELECT 
      TABLE_NAME AS table_name,
      COLUMN_NAME AS column_name,
      ORDINAL_POSITION AS position
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE 
      TABLE_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = 'PRIMARY'
    ORDER BY 
      TABLE_NAME, ORDINAL_POSITION
  `);

  // Grouper par table
  const grouped = {};
  rows.forEach(row => {
    if (!grouped[row.table_name]) {
      grouped[row.table_name] = [];
    }
    grouped[row.table_name].push(row.column_name);
  });

  const formatted = Object.entries(grouped).map(([table, columns]) => ({
    table_name: table,
    columns: columns.join(', ')
  }));

  printTable(formatted);
  return Object.keys(grouped).length;
}

async function checkUniqueConstraints(connection) {
  printSection('3. CONTRAINTES UNIQUE');

  const [rows] = await connection.execute(`
    SELECT 
      TABLE_NAME AS table_name,
      CONSTRAINT_NAME AS constraint_name,
      COLUMN_NAME AS column_name,
      ORDINAL_POSITION AS position
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE 
      TABLE_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME != 'PRIMARY'
      AND CONSTRAINT_NAME IN (
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND CONSTRAINT_TYPE = 'UNIQUE'
      )
    ORDER BY 
      TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION
  `);

  // Grouper par contrainte
  const grouped = {};
  rows.forEach(row => {
    const key = `${row.table_name}.${row.constraint_name}`;
    if (!grouped[key]) {
      grouped[key] = {
        table_name: row.table_name,
        constraint_name: row.constraint_name,
        columns: []
      };
    }
    grouped[key].columns.push(row.column_name);
  });

  const formatted = Object.values(grouped).map(item => ({
    table_name: item.table_name,
    constraint_name: item.constraint_name,
    columns: item.columns.join(', ')
  }));

  printTable(formatted);
  return formatted.length;
}

async function checkReferentialIntegrity(connection) {
  printSection('4. VÉRIFICATION DE L\'INTÉGRITÉ RÉFÉRENTIELLE');

  const checks = [
    {
      name: 'products.organization_id',
      query: `SELECT COUNT(*) AS count FROM products p LEFT JOIN organizations o ON p.organization_id = o.id WHERE o.id IS NULL`
    },
    {
      name: 'products.supplier_id',
      query: `SELECT COUNT(*) AS count FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.supplier_id IS NOT NULL AND s.id IS NULL`
    },
    {
      name: 'products.category_id',
      query: `SELECT COUNT(*) AS count FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id IS NOT NULL AND c.id IS NULL`
    },
    {
      name: 'catalog_products.catalog_file_id',
      query: `SELECT COUNT(*) AS count FROM catalog_products cp LEFT JOIN catalog_files cf ON cp.catalog_file_id = cf.id WHERE cf.id IS NULL`
    },
    {
      name: 'catalog_products.product_id',
      query: `SELECT COUNT(*) AS count FROM catalog_products cp LEFT JOIN products p ON cp.product_id = p.id WHERE p.id IS NULL`
    },
    {
      name: 'role_permissions.role_id',
      query: `SELECT COUNT(*) AS count FROM role_permissions rp LEFT JOIN roles r ON rp.role_id = r.id WHERE r.id IS NULL`
    },
    {
      name: 'role_permissions.permission_id',
      query: `SELECT COUNT(*) AS count FROM role_permissions rp LEFT JOIN permissions p ON rp.permission_id = p.id WHERE p.id IS NULL`
    },
    {
      name: 'user_roles.user_id',
      query: `SELECT COUNT(*) AS count FROM user_roles ur LEFT JOIN utilisateurs u ON ur.user_id = u.id WHERE u.id IS NULL`
    },
    {
      name: 'user_roles.role_id',
      query: `SELECT COUNT(*) AS count FROM user_roles ur LEFT JOIN roles r ON ur.role_id = r.id WHERE r.id IS NULL`
    },
    {
      name: 'roles.organization_id',
      query: `SELECT COUNT(*) AS count FROM roles r LEFT JOIN organizations o ON r.organization_id = o.id WHERE r.organization_id IS NOT NULL AND o.id IS NULL`
    }
  ];

  const results = [];
  let hasErrors = false;

  for (const check of checks) {
    try {
      const [rows] = await connection.execute(check.query);
      const count = rows[0].count;
      results.push({
        constraint: check.name,
        orphaned_records: count,
        status: count === 0 ? '✅ OK' : '❌ ERREUR'
      });
      if (count > 0) {
        hasErrors = true;
      }
    } catch (err) {
      // Table n'existe peut-être pas encore
      results.push({
        constraint: check.name,
        orphaned_records: 'N/A',
        status: '⚠️  Table non trouvée'
      });
    }
  }

  printTable(results);

  if (hasErrors) {
    console.log('  ⚠️  ATTENTION: Des enregistrements orphelins ont été détectés!');
    console.log('     Cela signifie que des contraintes de clés étrangères ne sont pas respectées.\n');
  } else {
    console.log('  ✅ Toutes les vérifications d\'intégrité référentielle sont OK.\n');
  }

  return hasErrors ? 1 : 0;
}

async function checkNotNullConstraints(connection) {
  printSection('5. CONTRAINTES NOT NULL');

  const [rows] = await connection.execute(`
    SELECT 
      TABLE_NAME AS table_name,
      COLUMN_NAME AS column_name,
      IS_NULLABLE AS nullable,
      COLUMN_TYPE AS column_type,
      COLUMN_DEFAULT AS default_value
    FROM 
      INFORMATION_SCHEMA.COLUMNS
    WHERE 
      TABLE_SCHEMA = DATABASE()
      AND IS_NULLABLE = 'NO'
    ORDER BY 
      TABLE_NAME, COLUMN_NAME
  `);

  printTable(rows);
  return rows.length;
}

async function checkCheckConstraints(connection) {
  printSection('6. CONTRAINTES CHECK');

  try {
    const [rows] = await connection.execute(`
      SELECT 
        TABLE_NAME AS table_name,
        CONSTRAINT_NAME AS constraint_name,
        CHECK_CLAUSE AS check_clause
      FROM 
        INFORMATION_SCHEMA.CHECK_CONSTRAINTS
      WHERE 
        CONSTRAINT_SCHEMA = DATABASE()
      ORDER BY 
        TABLE_NAME, CONSTRAINT_NAME
    `);

    if (rows.length === 0) {
      console.log('  (aucune contrainte CHECK trouvée)\n');
      console.log('  Note: Les contraintes CHECK sont disponibles à partir de MySQL 8.0.19+\n');
    } else {
      printTable(rows);
    }
    return rows.length;
  } catch (err) {
    console.log('  ⚠️  Les contraintes CHECK ne sont pas disponibles dans cette version de MySQL.\n');
    return 0;
  }
}

async function getSummary(connection) {
  printSection('7. RÉSUMÉ DES CONTRAINTES');

  const [pkRows] = await connection.execute(`
    SELECT COUNT(DISTINCT TABLE_NAME) AS count
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY'
  `);

  const [fkRows] = await connection.execute(`
    SELECT COUNT(DISTINCT CONSTRAINT_NAME) AS count
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
  `);

  const [uniqueRows] = await connection.execute(`
    SELECT COUNT(DISTINCT CONSTRAINT_NAME) AS count
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() 
    AND CONSTRAINT_TYPE = 'UNIQUE'
    AND CONSTRAINT_NAME != 'PRIMARY'
  `);

  const summary = [
    {
      type: 'Clés primaires',
      count: pkRows[0].count
    },
    {
      type: 'Clés étrangères',
      count: fkRows[0].count
    },
    {
      type: 'Contraintes UNIQUE',
      count: uniqueRows[0].count
    }
  ];

  printTable(summary);
}

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

async function main() {
  console.log('\n🔍 VÉRIFICATION DES CONTRAINTES DE BASE DE DONNÉES\n');
  console.log(`Base de données: ${config.database}`);
  console.log(`Serveur: ${config.host}\n`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connexion à la base de données établie\n');

    await checkForeignKeys(connection);
    await checkPrimaryKeys(connection);
    await checkUniqueConstraints(connection);
    const integrityErrors = await checkReferentialIntegrity(connection);
    await checkNotNullConstraints(connection);
    await checkCheckConstraints(connection);
    await getSummary(connection);

    printSection('FIN DU RAPPORT');

    if (integrityErrors > 0) {
      console.log('⚠️  Des problèmes d\'intégrité référentielle ont été détectés.');
      console.log('    Veuillez les corriger avant de continuer.\n');
      process.exit(1);
    } else {
      console.log('✅ Toutes les contraintes sont correctement appliquées.\n');
      process.exit(0);
    }

  } catch (err) {
    console.error('\n❌ Erreur lors de la vérification:', err.message);
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error(`   La base de données "${config.database}" n'existe pas.`);
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Accès refusé. Vérifiez vos identifiants de connexion.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { main };
