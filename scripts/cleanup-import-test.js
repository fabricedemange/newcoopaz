/**
 * Script de nettoyage des données de test importées
 * Supprime toutes les données avec le préfixe C_
 *
 * Usage:
 *   node scripts/cleanup-import-test.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const readline = require('readline');

async function createDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'coopazfr_commandes'
  });
}

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'oui' || answer.toLowerCase() === 'o');
    });
  });
}

async function main() {
  console.log('🧹 Script de nettoyage des données de test\n');

  let db;

  try {
    db = await createDbConnection();
    console.log('✅ Connexion à la base de données établie\n');

    // Compter les enregistrements à supprimer
    const [productsCount] = await db.execute(
      'SELECT COUNT(*) as count FROM products WHERE nom LIKE "C_%"'
    );
    const [suppliersCount] = await db.execute(
      'SELECT COUNT(*) as count FROM suppliers WHERE nom LIKE "C_%"'
    );
    const [categoriesCount] = await db.execute(
      'SELECT COUNT(*) as count FROM categories WHERE nom LIKE "C_%"'
    );

    console.log('📊 Données à supprimer:');
    console.log(`  - ${productsCount[0].count} produits`);
    console.log(`  - ${suppliersCount[0].count} fournisseurs`);
    console.log(`  - ${categoriesCount[0].count} catégories\n`);

    const total = productsCount[0].count + suppliersCount[0].count + categoriesCount[0].count;

    if (total === 0) {
      console.log('✅ Aucune donnée de test à supprimer');
      return;
    }

    const confirmed = await askConfirmation(
      `⚠️  Êtes-vous sûr de vouloir supprimer ${total} enregistrements ? (oui/non): `
    );

    if (!confirmed) {
      console.log('\n❌ Opération annulée');
      return;
    }

    console.log('\n🗑️  Suppression en cours...\n');

    // Supprimer dans l'ordre inverse (products -> categories -> suppliers)
    const [productsResult] = await db.execute(
      'DELETE FROM products WHERE nom LIKE "C_%"'
    );
    console.log(`✅ ${productsResult.affectedRows} produits supprimés`);

    const [categoriesResult] = await db.execute(
      'DELETE FROM categories WHERE nom LIKE "C_%"'
    );
    console.log(`✅ ${categoriesResult.affectedRows} catégories supprimées`);

    const [suppliersResult] = await db.execute(
      'DELETE FROM suppliers WHERE nom LIKE "C_%"'
    );
    console.log(`✅ ${suppliersResult.affectedRows} fournisseurs supprimés`);

    console.log('\n🎉 Nettoyage terminé avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.end();
      console.log('\n✅ Connexion fermée');
    }
  }
}

main().catch(console.error);
