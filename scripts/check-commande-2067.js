/**
 * Vérifie les données en base pour la commande 2067 (panier + articles).
 * Usage: node scripts/check-commande-2067.js
 */
require("dotenv").config();
const mysql = require("mysql2/promise");

const ID = 2067;

async function main() {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || "coopazfr_commandes",
    charset: "utf8mb4",
  };

  const conn = await mysql.createConnection(config);

  try {
    // 1. Panier 2067 (commande = is_submitted = 1)
    const [paniers] = await conn.query(
      "SELECT id, user_id, catalog_file_id, is_submitted, created_at FROM paniers WHERE id = ?",
      [ID]
    );
    console.log("--- Panier", ID, "---");
    console.log(paniers.length ? paniers[0] : "Aucun panier trouvé");

    if (paniers.length === 0) {
      // Existe-t-il des paniers soumis avec des IDs proches ?
      const [proches] = await conn.query(
        "SELECT id, user_id, catalog_file_id, is_submitted FROM paniers WHERE is_submitted = 1 ORDER BY id DESC LIMIT 5"
      );
      console.log("\n--- Derniers paniers soumis (is_submitted=1) ---");
      console.log(proches);
      await conn.end();
      return;
    }

    const p = paniers[0];
    const catalogFileId = p.catalog_file_id;

    // 2. catalog_files pour ce panier
    const [catalogFiles] = await conn.query(
      "SELECT id, originalname FROM catalog_files WHERE id = ?",
      [catalogFileId]
    );
    console.log("\n--- catalog_files pour ce panier ---");
    console.log(catalogFiles.length ? catalogFiles[0] : "Aucun catalog_files (FK manquante?)");

    // 3. panier_articles pour panier 2067 (colonnes article_id vs catalog_product_id)
    const [paRows] = await conn.query(
      "SELECT id, panier_id, article_id, catalog_product_id, quantity, note FROM panier_articles WHERE panier_id = ?",
      [ID]
    );
    console.log("\n--- panier_articles pour panier", ID, "---");
    console.log("Nombre de lignes:", paRows.length);
    if (paRows.length > 0) {
      console.log("Exemple première ligne:", paRows[0]);
      const avecArticleId = paRows.filter((r) => r.article_id != null).length;
      const avecCatalogProductId = paRows.filter((r) => r.catalog_product_id != null).length;
      console.log("Lignes avec article_id:", avecArticleId, "| avec catalog_product_id:", avecCatalogProductId);
    }

    // 4. catalog_products pour ce catalogue (pour voir si mapping existe)
    const [cpRows] = await conn.query(
      "SELECT id, catalog_file_id, product_id, prix FROM catalog_products WHERE catalog_file_id = ? LIMIT 3",
      [catalogFileId]
    );
    console.log("\n--- catalog_products pour catalog_file_id", catalogFileId, "---");
    console.log("Nombre (total):", (await conn.query("SELECT COUNT(*) as n FROM catalog_products WHERE catalog_file_id = ?", [catalogFileId]))[0][0].n);
    if (cpRows.length > 0) console.log("Exemple:", cpRows[0]);

    // 5. articles pour ce catalogue (modèle ancien)
    const [articlesRows] = await conn.query(
      "SELECT id, catalog_file_id, produit, prix FROM articles WHERE catalog_file_id = ? LIMIT 3",
      [catalogFileId]
    );
    console.log("\n--- articles pour catalog_file_id", catalogFileId, "(ancien modèle) ---");
    const [[{ n: nbArticles }]] = await conn.query("SELECT COUNT(*) as n FROM articles WHERE catalog_file_id = ?", [catalogFileId]);
    console.log("Nombre (total):", nbArticles);
    if (articlesRows.length > 0) console.log("Exemple:", articlesRows[0]);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
