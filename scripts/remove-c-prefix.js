#!/usr/bin/env node

/**
 * Script pour retirer le préfixe "C_" des noms de produits, fournisseurs et catégories
 */

require('dotenv').config();
const { db } = require('../config/config');

async function removeCPrefix() {
  console.log('🔄 Début de la suppression du préfixe "C_"...\n');

  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) {
        console.error('❌ Erreur de connexion:', err);
        return reject(err);
      }

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          console.error('❌ Erreur de transaction:', err);
          return reject(err);
        }

        // Compteur des enregistrements mis à jour
        let results = {
          products: 0,
          suppliers: 0,
          categories: 0
        };

        // 1. Mise à jour des produits
        const updateProducts = `
          UPDATE products
          SET nom = SUBSTRING(nom, 3)
          WHERE nom LIKE 'C\\_%' ESCAPE '\\\\'
        `;

        connection.query(updateProducts, (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('❌ Erreur mise à jour produits:', err);
              reject(err);
            });
          }

          results.products = result.affectedRows;
          console.log(`✅ Produits mis à jour: ${results.products}`);

          // 2. Mise à jour des fournisseurs
          const updateSuppliers = `
            UPDATE suppliers
            SET nom = SUBSTRING(nom, 3)
            WHERE nom LIKE 'C\\_%' ESCAPE '\\\\'
          `;

          connection.query(updateSuppliers, (err, result) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('❌ Erreur mise à jour fournisseurs:', err);
                reject(err);
              });
            }

            results.suppliers = result.affectedRows;
            console.log(`✅ Fournisseurs mis à jour: ${results.suppliers}`);

            // 3. Mise à jour des catégories
            const updateCategories = `
              UPDATE categories
              SET nom = SUBSTRING(nom, 3)
              WHERE nom LIKE 'C\\_%' ESCAPE '\\\\'
            `;

            connection.query(updateCategories, (err, result) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('❌ Erreur mise à jour catégories:', err);
                  reject(err);
                });
              }

              results.categories = result.affectedRows;
              console.log(`✅ Catégories mis à jour: ${results.categories}`);

              // Commit de la transaction
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('❌ Erreur commit:', err);
                    reject(err);
                  });
                }

                connection.release();
                console.log('\n✅ Transaction terminée avec succès!');
                console.log('\n📊 Résumé:');
                console.log(`   - Produits: ${results.products} enregistrements mis à jour`);
                console.log(`   - Fournisseurs: ${results.suppliers} enregistrements mis à jour`);
                console.log(`   - Catégories: ${results.categories} enregistrements mis à jour`);
                console.log(`   - Total: ${results.products + results.suppliers + results.categories} enregistrements\n`);

                resolve(results);
              });
            });
          });
        });
      });
    });
  });
}

// Exécution
removeCPrefix()
  .then(() => {
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erreur durant l\'exécution:', err);
    process.exit(1);
  });
