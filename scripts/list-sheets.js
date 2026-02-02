/**
 * Script pour lister les onglets d'un Google Spreadsheet
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1okI49-rXJ9tXF0Ztbw2_3RVHSkIJGsMNEs95ygOsMYc';

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function listSheets() {
  console.log('📊 Lecture des onglets du Google Sheet...\n');

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetsList = response.data.sheets;

    console.log(`✅ Trouvé ${sheetsList.length} onglet(s):\n`);

    sheetsList.forEach((sheet, index) => {
      const title = sheet.properties.title;
      const sheetId = sheet.properties.sheetId;
      const rowCount = sheet.properties.gridProperties.rowCount;
      const colCount = sheet.properties.gridProperties.columnCount;

      console.log(`${index + 1}. "${title}"`);
      console.log(`   - ID: ${sheetId}`);
      console.log(`   - Taille: ${rowCount} lignes × ${colCount} colonnes\n`);
    });

    console.log('💡 Pour utiliser ces onglets dans le script d\'import:');
    console.log('   Modifiez les RANGES dans import-from-googlesheets.js\n');

    console.log('Exemple de configuration:');
    console.log('const RANGES = {');
    sheetsList.slice(0, 3).forEach((sheet, index) => {
      const title = sheet.properties.title;
      const key = index === 0 ? 'suppliers' : index === 1 ? 'categories' : 'products';
      console.log(`  ${key}: '${title}!A1:Z1000',`);
    });
    console.log('};\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message.includes('permission')) {
      console.log('\n⚠️  Vérifiez que:');
      console.log('   1. Le Google Sheet est partagé avec: coopaz@coopaz-464213.iam.gserviceaccount.com');
      console.log('   2. Les permissions sont en "Lecteur" ou "Éditeur"');
    }
  }
}

listSheets().catch(console.error);
