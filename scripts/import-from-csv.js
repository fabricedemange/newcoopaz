/**
 * Script d'importation depuis fichiers CSV (alternative à Google Sheets)
 * Importe les données par petits lots pour limiter l'usage mémoire
 *
 * Usage:
 *   node scripts/import-from-csv.js
 *
 * Fichiers requis:
 *   - data/suppliers.csv
 *   - data/products.csv
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================
// CONFIGURATION
// ============================================

const ORGANIZATION_ID = 1;
const BATCH_SIZE = 50; // Traiter 50 lignes à la fois
const dataDir = path.join(__dirname, '..', 'data');

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
// PARSING CSV
// ============================================

/**
 * Parse une ligne CSV en respectant les guillemets
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Guillemet échappé ""
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Fin de colonne
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Ajouter la dernière colonne
  result.push(current.trim());

  return result;
}

/**
 * Lit un fichier CSV ligne par ligne et retourne les données
 */
async function readCsvFile(filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(dataDir, filename);

    if (!fs.existsSync(filepath)) {
      reject(new Error(`Fichier non trouvé: ${filepath}`));
      return;
    }

    const fileStream = fs.createReadStream(filepath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const rows = [];
    let headers = null;
    let lineNum = 0;

    rl.on('line', (line) => {
      lineNum++;
      if (lineNum === 1) {
        headers = parseCsvLine(line);
      } else {
        const values = parseCsvLine(line);
        if (values.length > 0 && values[0]) {
          rows.push(values);
        }
      }
    });

    rl.on('close', () => {
      resolve({ headers, data: rows });
    });

    rl.on('error', reject);
  });
}

// ============================================
// IMPORT FOURNISSEURS
// ============================================

async function importSuppliers(db) {
  console.log('\n🏭 === IMPORT DES FOURNISSEURS ===');

  try {
    const { headers, data } = await readCsvFile('suppliers.csv');

    if (!data || data.length === 0) {
      console.log('⚠️  Aucun fournisseur à importer');
      return;
    }

    console.log(`📦 ${data.length} fournisseurs à importer`);

    // Trouver les index des colonnes
    const nomIdx = headers.findIndex(h => h.toLowerCase() === 'nom');

    if (nomIdx === -1) {
      throw new Error('Colonne "nom" non trouvée dans suppliers.csv');
    }

    // Colonnes optionnelles
    const contactIdx = headers.findIndex(h => h.toLowerCase() === 'contact');
    const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
    const telephoneIdx = headers.findIndex(h => h.toLowerCase() === 'telephone' || h.toLowerCase() === 'téléphone');
    const adresseIdx = headers.findIndex(h => h.toLowerCase() === 'adresse');
    const codePostalIdx = headers.findIndex(h => h.toLowerCase() === 'code_postal' || h.toLowerCase() === 'code postal');
    const villeIdx = headers.findIndex(h => h.toLowerCase() === 'ville');
    const siretIdx = headers.findIndex(h => h.toLowerCase() === 'siret');
    const notesIdx = headers.findIndex(h => h.toLowerCase() === 'notes');

    let imported = 0;
    let skipped = 0;

    // Traiter par lots
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const nom = row[nomIdx];

        if (!nom || nom.trim() === '') {
          skipped++;
          continue;
        }

        // Préfixer avec C_ pour les tests
        const prefixedNom = `C_${nom}`;

        const supplierData = {
          nom: prefixedNom,
          contact: contactIdx >= 0 ? row[contactIdx] : null,
          email: emailIdx >= 0 ? row[emailIdx] : null,
          telephone: telephoneIdx >= 0 ? row[telephoneIdx] : null,
          adresse: adresseIdx >= 0 ? row[adresseIdx] : null,
          code_postal: codePostalIdx >= 0 ? row[codePostalIdx] : null,
          ville: villeIdx >= 0 ? row[villeIdx] : null,
          siret: siretIdx >= 0 ? row[siretIdx] : null,
          notes: notesIdx >= 0 ? row[notesIdx] : null,
          organization_id: ORGANIZATION_ID
        };

        // Vérifier si existe déjà
        const [existing] = await db.query(
          'SELECT id FROM suppliers WHERE nom = ? AND organization_id = ?',
          [supplierData.nom, ORGANIZATION_ID]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Insérer
        await db.query(
          `INSERT INTO suppliers (nom, contact, email, telephone, adresse, code_postal, ville, siret, notes, organization_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            supplierData.nom,
            supplierData.contact,
            supplierData.email,
            supplierData.telephone,
            supplierData.adresse,
            supplierData.code_postal,
            supplierData.ville,
            supplierData.siret,
            supplierData.notes,
            supplierData.organization_id
          ]
        );

        imported++;
      }

      // Afficher progression
      const progress = Math.min(i + BATCH_SIZE, data.length);
      console.log(`   Progression: ${progress}/${data.length} (${imported} importés, ${skipped} ignorés)`);
    }

    console.log(`✅ Import terminé: ${imported} fournisseurs importés, ${skipped} ignorés`);

  } catch (error) {
    console.error('❌ Erreur import fournisseurs:', error);
    throw error;
  }
}

// ============================================
// AUTO-CRÉATION DES CATÉGORIES
// ============================================

async function autoCreateCategories(db, productData) {
  console.log('\n📂 === AUTO-CRÉATION DES CATÉGORIES ===');

  try {
    // Extraire les catégories uniques depuis products.csv
    const { headers, data } = productData;

    const categorieIdx = headers.findIndex(h => h.toLowerCase() === 'categorie' || h.toLowerCase() === 'catégorie');

    if (categorieIdx === -1) {
      console.log('⚠️  Aucune colonne "categorie" trouvée, skip');
      return;
    }

    // Collecter les catégories uniques
    const categoriesSet = new Set();
    data.forEach(row => {
      const cat = row[categorieIdx];
      if (cat && cat.trim() !== '') {
        categoriesSet.add(cat.trim());
      }
    });

    console.log(`📦 ${categoriesSet.size} catégories uniques trouvées`);

    let created = 0;
    let existing = 0;

    for (const categoryName of categoriesSet) {
      // Vérifier si existe déjà
      const [existingCat] = await db.query(
        'SELECT id FROM categories WHERE nom = ? AND organization_id = ?',
        [categoryName, ORGANIZATION_ID]
      );

      if (existingCat.length > 0) {
        existing++;
        continue;
      }

      // Créer la catégorie
      await db.query(
        'INSERT INTO categories (nom, organization_id) VALUES (?, ?)',
        [categoryName, ORGANIZATION_ID]
      );

      created++;
    }

    console.log(`✅ Catégories: ${created} créées, ${existing} existaient déjà`);

  } catch (error) {
    console.error('❌ Erreur auto-création catégories:', error);
    throw error;
  }
}

// ============================================
// IMPORT PRODUITS
// ============================================

async function importProducts(db) {
  console.log('\n📦 === IMPORT DES PRODUITS ===');

  try {
    const { headers, data } = await readCsvFile('products.csv');

    if (!data || data.length === 0) {
      console.log('⚠️  Aucun produit à importer');
      return;
    }

    console.log(`📦 ${data.length} produits à importer`);

    // Trouver les index des colonnes
    const nomIdx = headers.findIndex(h => h.toLowerCase() === 'nom');

    if (nomIdx === -1) {
      throw new Error('Colonne "nom" non trouvée dans products.csv');
    }

    // Colonnes optionnelles
    const descriptionIdx = headers.findIndex(h => h.toLowerCase() === 'description');
    const fournisseurIdx = headers.findIndex(h => h.toLowerCase() === 'fournisseur');
    const categorieIdx = headers.findIndex(h => h.toLowerCase() === 'categorie' || h.toLowerCase() === 'catégorie');
    const referenceIdx = headers.findIndex(h => h.toLowerCase() === 'reference' || h.toLowerCase() === 'référence');
    const eanIdx = headers.findIndex(h => h.toLowerCase() === 'ean');
    const conditionnementIdx = headers.findIndex(h => h.toLowerCase() === 'conditionnement');
    const dlcIdx = headers.findIndex(h => h.toLowerCase() === 'dlc_jours' || h.toLowerCase() === 'dlc jours');
    const allergenesIdx = headers.findIndex(h => h.toLowerCase() === 'allergenes' || h.toLowerCase() === 'allergènes');
    const origineIdx = headers.findIndex(h => h.toLowerCase() === 'origine');
    const labelIdx = headers.findIndex(h => h.toLowerCase() === 'label');

    // Charger les mappings fournisseurs et catégories
    const [suppliers] = await db.query('SELECT id, nom FROM suppliers WHERE organization_id = ?', [ORGANIZATION_ID]);
    const [categories] = await db.query('SELECT id, nom FROM categories WHERE organization_id = ?', [ORGANIZATION_ID]);

    const supplierMap = new Map();
    suppliers.forEach(s => supplierMap.set(s.nom.toLowerCase(), s.id));

    const categoryMap = new Map();
    categories.forEach(c => categoryMap.set(c.nom.toLowerCase(), c.id));

    let imported = 0;
    let skipped = 0;

    // Traiter par lots
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const nom = row[nomIdx];

        if (!nom || nom.trim() === '') {
          skipped++;
          continue;
        }

        // Préfixer avec C_
        const prefixedNom = `C_${nom}`;

        // Trouver supplier_id et category_id
        let supplierId = null;
        let categoryId = null;

        if (fournisseurIdx >= 0 && row[fournisseurIdx]) {
          const supplierName = `C_${row[fournisseurIdx]}`.toLowerCase();
          supplierId = supplierMap.get(supplierName) || null;
        }

        if (categorieIdx >= 0 && row[categorieIdx]) {
          const categoryName = row[categorieIdx].toLowerCase();
          categoryId = categoryMap.get(categoryName) || null;
        }

        const productData = {
          nom: prefixedNom,
          description: descriptionIdx >= 0 ? row[descriptionIdx] : null,
          supplier_id: supplierId,
          category_id: categoryId,
          reference: referenceIdx >= 0 ? row[referenceIdx] : null,
          ean: eanIdx >= 0 ? row[eanIdx] : null,
          conditionnement: conditionnementIdx >= 0 ? row[conditionnementIdx] : null,
          dlc_jours: dlcIdx >= 0 ? parseInt(row[dlcIdx]) || null : null,
          allergenes: allergenesIdx >= 0 ? row[allergenesIdx] : null,
          origine: origineIdx >= 0 ? row[origineIdx] : null,
          label: labelIdx >= 0 ? row[labelIdx] : null,
          organization_id: ORGANIZATION_ID,
          is_active: 1
        };

        // Vérifier si existe déjà
        const [existing] = await db.query(
          'SELECT id FROM products WHERE nom = ? AND organization_id = ?',
          [productData.nom, ORGANIZATION_ID]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Insérer
        await db.query(
          `INSERT INTO products (nom, description, supplier_id, category_id, reference, ean, conditionnement, dlc_jours, allergenes, origine, label, organization_id, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            productData.nom,
            productData.description,
            productData.supplier_id,
            productData.category_id,
            productData.reference,
            productData.ean,
            productData.conditionnement,
            productData.dlc_jours,
            productData.allergenes,
            productData.origine,
            productData.label,
            productData.organization_id,
            productData.is_active
          ]
        );

        imported++;
      }

      // Afficher progression
      const progress = Math.min(i + BATCH_SIZE, data.length);
      console.log(`   Progression: ${progress}/${data.length} (${imported} importés, ${skipped} ignorés)`);
    }

    console.log(`✅ Import terminé: ${imported} produits importés, ${skipped} ignorés`);

  } catch (error) {
    console.error('❌ Erreur import produits:', error);
    throw error;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 Import depuis fichiers CSV');
  console.log(`📁 Dossier: ${dataDir}`);
  console.log(`🏢 Organization ID: ${ORGANIZATION_ID}`);
  console.log(`📦 Taille des lots: ${BATCH_SIZE}`);

  let db;

  try {
    console.log('\n🔌 Connexion à la base de données...');
    db = await createDbConnection();
    console.log('✅ Connexion établie');

    // Import fournisseurs
    await importSuppliers(db);

    // Lire les produits pour extraire les catégories
    const productData = await readCsvFile('products.csv');

    // Auto-créer les catégories depuis les produits
    await autoCreateCategories(db, productData);

    // Import produits
    await importProducts(db);

    console.log('\n✅ Import terminé avec succès !');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

main();
