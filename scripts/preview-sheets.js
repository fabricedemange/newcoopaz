/**
 * Script pour prévisualiser les en-têtes des onglets
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1okI49-rXJ9tXF0Ztbw2_3RVHSkIJGsMNEs95ygOsMYc';

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function previewHeaders() {
  console.log('📋 Prévisualisation des en-têtes...\n');

  const sheetsToCheck = ['produits', 'fournisseur'];

  for (const sheetName of sheetsToCheck) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Onglet: "${sheetName}"`);
    console.log('='.repeat(60));

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:Z5`, // Première ligne (en-têtes) + 4 lignes d'exemple
      });

      const rows = response.data.values;

      if (!rows || rows.length === 0) {
        console.log('⚠️  Aucune donnée trouvée\n');
        continue;
      }

      const headers = rows[0];
      console.log(`\n✅ ${headers.length} colonnes détectées:\n`);

      headers.forEach((header, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C...
        console.log(`   ${letter}: "${header}"`);
      });

      console.log(`\n📊 Aperçu des données (4 premières lignes):`);
      if (rows.length > 1) {
        const dataRows = rows.slice(1, 5);
        dataRows.forEach((row, idx) => {
          console.log(`\n   Ligne ${idx + 2}:`);
          headers.forEach((header, colIdx) => {
            const value = row[colIdx] || '(vide)';
            const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
            console.log(`      ${header}: ${displayValue}`);
          });
        });
      }

    } catch (error) {
      console.error(`❌ Erreur pour "${sheetName}":`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

previewHeaders().catch(console.error);
