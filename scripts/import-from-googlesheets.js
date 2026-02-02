/**
 * Script temporaire d'importation depuis Google Sheets
 * Importe les données dans products, suppliers et categories avec préfixe C_
 *
 * Usage:
 *   node scripts/import-from-googlesheets.js
 *
 * Configuration requise:
 *   - credentials.json dans le dossier racine
 *   - SPREADSHEET_ID et RANGES à définir ci-dessous
 */

require('dotenv').config();
const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const { CATEGORIES, categorizeProduct } = require('./auto-categorize');

// ============================================
// CONFIGURATION
// ============================================

const SPREADSHEET_ID = '1okI49-rXJ9tXF0Ztbw2_3RVHSkIJGsMNEs95ygOsMYc';
const ORGANIZATION_ID = 1; // ID de l'organisation par défaut

// Définir les plages pour chaque onglet
const RANGES = {
  suppliers: 'fournisseur!A1:M200',     // Onglet fournisseurs (142 lignes)
  products: 'produits!A1:L3000'         // Onglet produits (2612 lignes)
};

// Note: Pas d'onglet catégories détecté dans le Google Sheet
// Les catégories seront créées manuellement ou via un autre moyen

// ============================================
// CONNEXION GOOGLE SHEETS
// ============================================

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ============================================
// CONNEXION BASE DE DONNÉES
// ============================================

async function createDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'coopazfr_commandes'
  });
}

// ============================================
// FONCTIONS D'IMPORT
// ============================================

/**
 * Récupère les données d'une plage Google Sheets
 */
async function fetchSheetData(range) {
  console.log(`📥 Récupération des données: ${range}`);

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = result.data.values;

    if (!rows || rows.length < 2) {
      console.log(`⚠️  Aucune donnée trouvée dans ${range}`);
      return { headers: [], data: [] };
    }

    const headers = rows[0];
    const data = rows.slice(1);

    console.log(`✅ ${data.length} lignes récupérées`);

    return { headers, data };
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture de ${range}:`, error.message);
    throw error;
  }
}

/**
 * Trouve l'index d'une colonne par son nom (insensible à la casse)
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

/**
 * Importe les fournisseurs
 */
async function importSuppliers(db) {
  console.log('\n🏭 === IMPORT DES FOURNISSEURS ===');

  const { headers, data } = await fetchSheetData(RANGES.suppliers);

  if (data.length === 0) {
    console.log('⚠️  Aucun fournisseur à importer');
    return;
  }

  console.log('📋 Colonnes détectées:', headers.join(', '));

  // Mapper les colonnes
  const nomIdx = findColumnIndex(headers, 'nom', 'name', 'fournisseur', 'supplier');
  const contactIdx = findColumnIndex(headers, 'contact', 'contact_nom', 'contact_name');
  const emailIdx = findColumnIndex(headers, 'email', 'mail');
  const telIdx = findColumnIndex(headers, 'telephone', 'tel', 'phone');
  const adresseIdx = findColumnIndex(headers, 'adresse', 'address');
  const cpIdx = findColumnIndex(headers, 'code_postal', 'cp', 'postal_code');
  const villeIdx = findColumnIndex(headers, 'ville', 'city');
  const siretIdx = findColumnIndex(headers, 'siret', 'siren');
  const notesIdx = findColumnIndex(headers, 'notes', 'remarques', 'comments');

  if (nomIdx === -1) {
    console.error('❌ Colonne "nom" obligatoire non trouvée');
    return;
  }

  let imported = 0;
  let errors = 0;

  for (const row of data) {
    const nom = row[nomIdx]?.trim();

    if (!nom) {
      errors++;
      continue;
    }

    try {
      await db.execute(
        `INSERT INTO suppliers (organization_id, nom, contact_nom, email, telephone, adresse, code_postal, ville, siret, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          ORGANIZATION_ID,
          'C_' + nom,
          contactIdx !== -1 ? row[contactIdx]?.trim() : null,
          emailIdx !== -1 ? row[emailIdx]?.trim() : null,
          telIdx !== -1 ? row[telIdx]?.trim() : null,
          adresseIdx !== -1 ? row[adresseIdx]?.trim() : null,
          cpIdx !== -1 ? row[cpIdx]?.trim() : null,
          villeIdx !== -1 ? row[villeIdx]?.trim() : null,
          siretIdx !== -1 ? row[siretIdx]?.trim() : null,
          notesIdx !== -1 ? row[notesIdx]?.trim() : null
        ]
      );
      imported++;
      console.log(`  ✓ Fournisseur importé: C_${nom}`);
    } catch (error) {
      console.error(`  ✗ Erreur pour ${nom}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✅ ${imported} fournisseurs importés, ${errors} erreurs`);
}

/**
 * Crée automatiquement les catégories prédéfinies
 */
async function createPredefinedCategories(db) {
  console.log('\n📂 === CRÉATION DES CATÉGORIES AUTOMATIQUES ===');

  let imported = 0;
  let errors = 0;

  for (const category of CATEGORIES) {
    try {
      await db.execute(
        `INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 1)`,
        [
          ORGANIZATION_ID,
          'C_' + category.nom,
          `Catégorie auto-générée: ${category.nom}`,
          category.ordre,
          category.couleur,
          category.icon
        ]
      );
      imported++;
      console.log(`  ✓ Catégorie créée: C_${category.nom}`);
    } catch (error) {
      // Ignorer si la catégorie existe déjà
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`  ⚠️  Catégorie déjà existante: C_${category.nom}`);
      } else {
        console.error(`  ✗ Erreur pour ${category.nom}:`, error.message);
        errors++;
      }
    }
  }

  console.log(`\n✅ ${imported} catégories créées, ${errors} erreurs`);
}

/**
 * Importe les catégories (ancienne fonction, gardée pour compatibilité)
 */
async function importCategories(db) {
  console.log('\n📂 === IMPORT DES CATÉGORIES ===');

  const { headers, data } = await fetchSheetData(RANGES.categories);

  if (data.length === 0) {
    console.log('⚠️  Aucune catégorie à importer');
    return;
  }

  console.log('📋 Colonnes détectées:', headers.join(', '));

  // Mapper les colonnes
  const nomIdx = findColumnIndex(headers, 'nom', 'name', 'categorie', 'category');
  const descIdx = findColumnIndex(headers, 'description', 'desc');
  const parentIdx = findColumnIndex(headers, 'parent', 'parent_id', 'categorie_parente');
  const ordreIdx = findColumnIndex(headers, 'ordre', 'order', 'position');
  const couleurIdx = findColumnIndex(headers, 'couleur', 'color');
  const iconIdx = findColumnIndex(headers, 'icon', 'icone');

  if (nomIdx === -1) {
    console.error('❌ Colonne "nom" obligatoire non trouvée');
    return;
  }

  let imported = 0;
  let errors = 0;

  for (const row of data) {
    const nom = row[nomIdx]?.trim();

    if (!nom) {
      errors++;
      continue;
    }

    try {
      await db.execute(
        `INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur, icon, is_active)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 1)`,
        [
          ORGANIZATION_ID,
          'C_' + nom,
          descIdx !== -1 ? row[descIdx]?.trim() : null,
          ordreIdx !== -1 ? parseInt(row[ordreIdx]) || 0 : 0,
          couleurIdx !== -1 ? row[couleurIdx]?.trim() : null,
          iconIdx !== -1 ? row[iconIdx]?.trim() : null
        ]
      );
      imported++;
      console.log(`  ✓ Catégorie importée: C_${nom}`);
    } catch (error) {
      console.error(`  ✗ Erreur pour ${nom}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✅ ${imported} catégories importées, ${errors} erreurs`);
}

/**
 * Importe les produits
 */
async function importProducts(db) {
  console.log('\n📦 === IMPORT DES PRODUITS ===');

  const { headers, data } = await fetchSheetData(RANGES.products);

  if (data.length === 0) {
    console.log('⚠️  Aucun produit à importer');
    return;
  }

  console.log('📋 Colonnes détectées:', headers.join(', '));

  // Mapper les colonnes
  const nomIdx = findColumnIndex(headers, 'nom', 'name', 'produit', 'product');
  const descIdx = findColumnIndex(headers, 'description', 'desc');
  const supplierIdx = findColumnIndex(headers, 'fournisseur', 'supplier');
  const categoryIdx = findColumnIndex(headers, 'categorie', 'category');
  const refIdx = findColumnIndex(headers, 'reference', 'ref', 'reference_fournisseur');
  const eanIdx = findColumnIndex(headers, 'ean', 'code_ean', 'code_barre', 'barcode');
  const conditIdx = findColumnIndex(headers, 'conditionnement', 'packaging', 'unite');
  const dlcIdx = findColumnIndex(headers, 'dlc', 'dlc_jours', 'duree_conservation');
  const allergenesIdx = findColumnIndex(headers, 'allergenes', 'allergens');
  const origineIdx = findColumnIndex(headers, 'origine', 'origin');
  const labelIdx = findColumnIndex(headers, 'label', 'labels', 'certification');

  if (nomIdx === -1) {
    console.error('❌ Colonne "nom" obligatoire non trouvée');
    return;
  }

  // Créer des maps pour les fournisseurs et catégories
  const [suppliers] = await db.execute(
    'SELECT id, nom FROM suppliers WHERE organization_id = ? AND nom LIKE "C_%"',
    [ORGANIZATION_ID]
  );

  const [categories] = await db.execute(
    'SELECT id, nom FROM categories WHERE organization_id = ? AND nom LIKE "C_%"',
    [ORGANIZATION_ID]
  );

  const supplierMap = new Map(suppliers.map(s => [s.nom.replace('C_', ''), s.id]));
  const categoryMap = new Map(categories.map(c => [c.nom.replace('C_', ''), c.id]));

  console.log(`📋 ${supplierMap.size} fournisseurs disponibles`);
  console.log(`📋 ${categoryMap.size} catégories disponibles`);

  let imported = 0;
  let errors = 0;

  for (const row of data) {
    const nom = row[nomIdx]?.trim();

    if (!nom) {
      errors++;
      continue;
    }

    // Trouver l'ID du fournisseur
    let supplierId = null;
    if (supplierIdx !== -1 && row[supplierIdx]) {
      supplierId = supplierMap.get(row[supplierIdx].trim()) || null;
    }

    // Déterminer automatiquement la catégorie basée sur le nom du produit
    let categoryId = null;
    const autoCategory = categorizeProduct(nom);
    if (autoCategory) {
      categoryId = categoryMap.get(autoCategory.nom) || null;
      if (!categoryId) {
        console.warn(`  ⚠️  Catégorie "${autoCategory.nom}" non trouvée pour "${nom}"`);
      }
    }

    try {
      await db.execute(
        `INSERT INTO products (organization_id, supplier_id, category_id, nom, description, reference_fournisseur,
         code_ean, conditionnement, dlc_jours, allergenes, origine, label, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          ORGANIZATION_ID,
          supplierId,
          categoryId,
          'C_' + nom,
          descIdx !== -1 ? row[descIdx]?.trim() : null,
          refIdx !== -1 ? row[refIdx]?.trim() : null,
          eanIdx !== -1 ? row[eanIdx]?.trim() : null,
          conditIdx !== -1 ? row[conditIdx]?.trim() : null,
          dlcIdx !== -1 ? parseInt(row[dlcIdx]) || null : null,
          allergenesIdx !== -1 ? row[allergenesIdx]?.trim() : null,
          origineIdx !== -1 ? row[origineIdx]?.trim() : null,
          labelIdx !== -1 ? row[labelIdx]?.trim() : null
        ]
      );
      imported++;
      console.log(`  ✓ Produit importé: C_${nom}`);
    } catch (error) {
      console.error(`  ✗ Erreur pour ${nom}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✅ ${imported} produits importés, ${errors} erreurs`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de l\'import depuis Google Sheets');
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`🏢 Organization ID: ${ORGANIZATION_ID}\n`);

  if (SPREADSHEET_ID === 'VOTRE_SPREADSHEET_ID_ICI') {
    console.error('❌ ERREUR: Veuillez configurer SPREADSHEET_ID dans le script');
    process.exit(1);
  }

  let db;

  try {
    // Connexion à la base de données
    db = await createDbConnection();
    console.log('✅ Connexion à la base de données établie\n');

    // Import dans l'ordre: suppliers -> catégories auto -> products
    await importSuppliers(db);
    await createPredefinedCategories(db);
    await importProducts(db);

    console.log('\n🎉 Import terminé avec succès!');
    console.log('\n⚠️  Note: Toutes les données importées ont le préfixe "C_"');
    console.log('Pour les supprimer plus tard, exécutez:');
    console.log('  DELETE FROM products WHERE nom LIKE "C_%";');
    console.log('  DELETE FROM suppliers WHERE nom LIKE "C_%";');
    console.log('  DELETE FROM categories WHERE nom LIKE "C_%";');

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n✅ Connexion à la base de données fermée');
    }
  }
}

// Exécuter le script
main().catch(console.error);
