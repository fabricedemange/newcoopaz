/**
 * Script de synchronisation des fournisseurs depuis Google Sheets vers products.supplier_id
 *
 * Usage:
 *   node scripts/sync-suppliers-from-googlesheets.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const mysql = require('mysql2/promise');

// Configuration
const SPREADSHEET_ID = '1okI49-rXJ9tXF0Ztbw2_3RVHSkIJGsMNEs95ygOsMYc';
const ORGANIZATION_ID = 1;
const PRODUCTS_RANGE = 'produits!A1:L3000';

// Connexion Google Sheets
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Connexion BDD
async function createDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
}

/**
 * Trouve l'index d'une colonne par son nom
 */
function findColumnIndex(headers, ...possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h =>
      h && h.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (index !== -1) return index;
  }
  return -1;
}

async function main() {
  console.log('🚀 Synchronisation des fournisseurs depuis Google Sheets');
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`🏢 Organization ID: ${ORGANIZATION_ID}\n`);

  let db;

  try {
    // Connexion BDD
    db = await createDbConnection();
    console.log('✅ Connexion BDD établie\n');

    // Récupération des données Google Sheets
    console.log('📥 Récupération des produits depuis Google Sheets...');
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: PRODUCTS_RANGE,
    });

    const rows = result.data.values;
    if (!rows || rows.length < 2) {
      console.error('❌ Aucune donnée trouvée dans la feuille');
      process.exit(1);
    }

    const headers = rows[0];
    const data = rows.slice(1);

    console.log(`📋 Colonnes: ${headers.join(', ')}`);
    console.log(`📊 ${data.length} lignes récupérées\n`);

    // Identifier les colonnes
    const nomIdx = findColumnIndex(headers, 'nom', 'name', 'produit', 'product');
    const fournisseurIdx = findColumnIndex(headers, 'fournisseur', 'supplier');

    if (nomIdx === -1) {
      console.error('❌ Colonne "nom" non trouvée');
      process.exit(1);
    }

    if (fournisseurIdx === -1) {
      console.error('❌ Colonne "fournisseur" non trouvée');
      console.error('📋 Colonnes disponibles:', headers);
      process.exit(1);
    }

    console.log(`✅ Colonne nom: index ${nomIdx}`);
    console.log(`✅ Colonne fournisseur: index ${fournisseurIdx}\n`);

    // Charger tous les fournisseurs en mémoire pour matching rapide
    console.log('📦 Chargement des fournisseurs depuis la BDD...');
    const [suppliers] = await db.execute(
      'SELECT id, nom FROM suppliers WHERE organization_id = ?',
      [ORGANIZATION_ID]
    );

    const supplierMap = new Map();
    suppliers.forEach(s => {
      // Normaliser le nom pour le matching (minuscules, sans accents, sans C_ prefix)
      const normalizedName = s.nom
        .replace(/^C_/, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      supplierMap.set(normalizedName, s.id);
    });

    console.log(`✅ ${supplierMap.size} fournisseurs chargés\n`);

    // Synchronisation
    let updated = 0;
    let notFound = 0;
    let noSupplierInSheet = 0;
    let supplierNotInDb = 0;
    let errors = 0;

    const missingSuppliers = new Set();

    for (const row of data) {
      const nom = row[nomIdx]?.trim();
      const fournisseurName = row[fournisseurIdx]?.trim();

      if (!nom) continue;

      if (!fournisseurName) {
        noSupplierInSheet++;
        continue;
      }

      // Normaliser le nom du fournisseur pour le matching
      const normalizedSupplier = fournisseurName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      const supplierId = supplierMap.get(normalizedSupplier);

      if (!supplierId) {
        supplierNotInDb++;
        missingSuppliers.add(fournisseurName);
        continue;
      }

      try {
        // Matcher par nom (avec ou sans préfixe C_)
        const [result] = await db.execute(
          `UPDATE products
           SET supplier_id = ?, updated_at = NOW()
           WHERE organization_id = ?
             AND (nom = ? OR nom = ? OR nom LIKE ? OR nom LIKE ?)
           LIMIT 1`,
          [supplierId, ORGANIZATION_ID, nom, `C_${nom}`, `${nom}%`, `C_${nom}%`]
        );

        if (result.affectedRows > 0) {
          updated++;
          if (updated % 100 === 0) {
            console.log(`  📊 ${updated} produits mis à jour...`);
          }
        } else {
          notFound++;
          if (notFound <= 10) {
            console.log(`  ⚠️  Produit non trouvé: "${nom}" (fournisseur: ${fournisseurName})`);
          }
        }
      } catch (error) {
        errors++;
        console.error(`  ✗ Erreur pour "${nom}":`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSULTATS:');
    console.log(`  ✅ ${updated} produits mis à jour avec fournisseur`);
    console.log(`  ⚠️  ${notFound} produits non trouvés en base`);
    console.log(`  ⚠️  ${noSupplierInSheet} lignes sans fournisseur dans Google Sheets`);
    console.log(`  ⚠️  ${supplierNotInDb} produits avec fournisseur non trouvé en BDD`);
    console.log(`  ❌ ${errors} erreurs`);
    console.log('='.repeat(60));

    if (missingSuppliers.size > 0) {
      console.log('\n⚠️  Fournisseurs dans Google Sheets mais absents en BDD:');
      Array.from(missingSuppliers).sort().forEach(s => {
        console.log(`  - ${s}`);
      });
    }

    if (notFound > 10) {
      console.log(`\n⚠️  ${notFound - 10} autres produits non trouvés (non affichés)`);
    }

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n✅ Connexion BDD fermée');
    }
  }
}

main().catch(console.error);
