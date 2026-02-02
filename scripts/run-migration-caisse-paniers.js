/**
 * Script pour exécuter la migration add_caisse_paniers_support.sql
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Exécution de la migration caisse paniers...\n');

  let connection;

  try {
    // Connexion BDD
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Connexion BDD établie\n');

    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, '../migrations/add_caisse_paniers_support.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Exécuter la migration
    console.log('📝 Exécution de la migration...');
    await connection.query(sql);

    console.log('\n✅ Migration exécutée avec succès !');
    console.log('\n📋 Modifications appliquées:');
    console.log('  - panier_articles: ajout de product_id, prix_unitaire, nom_produit');
    console.log('  - panier_articles: catalog_product_id maintenant nullable');
    console.log('  - panier_articles: contrainte check_product_source ajoutée');
    console.log('  - paniers: ajout de source (catalogue/caisse), saved_at');
    console.log('  - paniers: catalog_file_id maintenant nullable');
    console.log('  - Index créés pour performance\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);

    // Si la colonne existe déjà, c'est probablement déjà migré
    if (error.message.includes('Duplicate column name')) {
      console.log('\n⚠️  Certaines colonnes existent déjà - migration probablement déjà appliquée');
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Connexion BDD fermée\n');
    }
  }
}

runMigration().catch(console.error);
