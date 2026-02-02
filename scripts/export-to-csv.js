/**
 * Script pour exporter les données Google Sheets en fichiers CSV locaux
 * À exécuter EN LOCAL (pas sur le serveur de prod)
 *
 * Usage:
 *   node scripts/export-to-csv.js
 *
 * Crée les fichiers:
 *   - data/suppliers.csv
 *   - data/products.csv
 */

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const SPREADSHEET_ID = '1okI49-rXJ9tXF0Ztbw2_3RVHSkIJGsMNEs95ygOsMYc';

const RANGES = {
  suppliers: 'fournisseur!A1:M200',
  products: 'produits!A1:L3000'
  // Note: Pas d'onglet "catégories" - les catégories seront extraites de la colonne "categorie" dans produits
};

// Créer le dossier data s'il n'existe pas
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============================================
// CONNEXION GOOGLE SHEETS
// ============================================

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ============================================
// FONCTIONS
// ============================================

/**
 * Convertit une ligne en CSV en échappant les guillemets et virgules
 */
function toCsvLine(row) {
  return row.map(cell => {
    const str = (cell || '').toString();
    // Échapper les guillemets et entourer de guillemets si nécessaire
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

/**
 * Récupère et exporte une plage en CSV
 */
async function exportToCsv(range, filename) {
  console.log(`\n📥 Export de ${range} vers ${filename}`);

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = result.data.values;

    if (!rows || rows.length < 1) {
      console.log(`⚠️  Aucune donnée trouvée dans ${range}`);
      return;
    }

    // Écrire le CSV
    const csvPath = path.join(dataDir, filename);
    const csvContent = rows.map(row => toCsvLine(row)).join('\n');

    fs.writeFileSync(csvPath, csvContent, 'utf8');

    console.log(`✅ ${rows.length} lignes exportées vers ${csvPath}`);
    console.log(`   Taille: ${(csvContent.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error(`❌ Erreur lors de l'export de ${range}:`, error.message);
    throw error;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 Export Google Sheets vers CSV');
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`📁 Dossier de sortie: ${dataDir}`);

  try {
    // Exporter les fournisseurs
    await exportToCsv(RANGES.suppliers, 'suppliers.csv');

    // Exporter les produits
    await exportToCsv(RANGES.products, 'products.csv');

    console.log('\n✅ Export terminé avec succès !');
    console.log('\n📤 Étapes suivantes:');
    console.log('   1. Transférer les fichiers CSV vers le serveur de prod:');
    console.log('      scp data/*.csv user@server:/path/to/coopazv13/data/');
    console.log('   2. Sur le serveur, lancer l\'import:');
    console.log('      node scripts/import-from-csv.js');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
