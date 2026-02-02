// Script de diagnostic pour vérifier les produits
const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coopazfr_commandes'
});

connection.connect((err) => {
  if (err) {
    console.error('Erreur de connexion:', err);
    process.exit(1);
  }
  console.log('✅ Connecté à la base de données\n');

  // 1. Vérifier le nombre total de produits
  connection.query('SELECT COUNT(*) as total FROM products', (err, results) => {
    if (err) {
      console.error('Erreur requête products:', err);
      connection.end();
      return;
    }
    console.log(`📦 Total produits: ${results[0].total}`);

    // 2. Vérifier les produits par organization_id
    connection.query(`
      SELECT organization_id, COUNT(*) as total
      FROM products
      GROUP BY organization_id
    `, (err, results) => {
      if (err) {
        console.error('Erreur:', err);
        connection.end();
        return;
      }
      console.log('\n🏢 Produits par organisation:');
      results.forEach(row => {
        console.log(`  - Org ${row.organization_id}: ${row.total} produits`);
      });

      // 3. Vérifier combien ont un supplier_id
      connection.query(`
        SELECT
          COUNT(*) as total,
          COUNT(supplier_id) as avec_supplier,
          COUNT(category_id) as avec_category
        FROM products
      `, (err, results) => {
        if (err) {
          console.error('Erreur:', err);
          connection.end();
          return;
        }
        const r = results[0];
        console.log(`\n📊 État des produits:`);
        console.log(`  - Total: ${r.total}`);
        console.log(`  - Avec supplier: ${r.avec_supplier}`);
        console.log(`  - Avec catégorie: ${r.avec_category}`);

        // 4. Afficher quelques exemples
        connection.query(`
          SELECT id, nom, supplier_id, category_id, organization_id, is_active
          FROM products
          LIMIT 5
        `, (err, results) => {
          if (err) {
            console.error('Erreur:', err);
            connection.end();
            return;
          }
          console.log(`\n📝 Exemples de produits:`);
          results.forEach(p => {
            console.log(`  - [${p.id}] ${p.nom}`);
            console.log(`    Supplier: ${p.supplier_id || 'NULL'}, Catégorie: ${p.category_id || 'NULL'}`);
            console.log(`    Org: ${p.organization_id}, Active: ${p.is_active}`);
          });

          // 5. Vérifier les fournisseurs
          connection.query(`
            SELECT id, nom, organization_id, is_active
            FROM suppliers
            ORDER BY id
          `, (err, results) => {
            if (err) {
              console.error('Erreur:', err);
            } else {
              console.log(`\n🚚 Fournisseurs (${results.length}):`);
              results.forEach(s => {
                console.log(`  - [${s.id}] ${s.nom} (Org ${s.organization_id}, Active: ${s.is_active})`);
              });
            }

            connection.end();
            console.log('\n✅ Diagnostic terminé');
          });
        });
      });
    });
  });
});
