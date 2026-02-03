/**
 * Import baseprod → base cible (ancien modèle : catalog_files + articles + paniers + panier_articles).
 * Utilisé quand USE_LEGACY_IMPORT=1.
 * Les panier_articles sont importés avec article_id (fallback nécessaire dans le code).
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const TARGET_DB = process.env.DB_NAME || "coopazfr_commandes";
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function main() {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: TARGET_DB,
    charset: "utf8mb4",
    multipleStatements: true,
  };

  if (!config.host || !config.user) {
    console.error("❌ Définir DB_HOST, DB_USER, DB_PASS (et optionnellement DB_NAME) dans .env");
    process.exit(1);
  }

  console.log("\n📥 Import baseprod (legacy) →", TARGET_DB);
  console.log("   catalog_files + articles + paniers + panier_articles (article_id).\n");

  let connection;
  try {
    connection = await mysql.createConnection(config);
  } catch (err) {
    console.error("❌ Connexion impossible:", err.message);
    process.exit(1);
  }

  try {
    const catalogFilesMigration = path.join(MIGRATIONS_DIR, "20260201_catalog_files_from_import_baseprod.sql");
    const sql0 = fs.existsSync(catalogFilesMigration)
      ? fs.readFileSync(catalogFilesMigration, "utf8")
      : null;
    const sql1 = fs.readFileSync(path.join(MIGRATIONS_DIR, "import_baseprod.sql"), "utf8");
    const sql2 = fs.readFileSync(path.join(MIGRATIONS_DIR, "import_paniers_baseprod.sql"), "utf8");

    if (sql0) {
      console.log("0/3 Création de la table catalog_files si nécessaire…");
      await connection.query(sql0);
      console.log("   ✓ Table catalog_files prête.");
    }

    console.log((sql0 ? "1/3" : "1/2") + " Exécution de import_baseprod.sql (vidage + catalog_files + articles)…");
    const [res1] = await connection.query(sql1);
    console.log("   ✓ import_baseprod.sql terminé.");

    console.log((sql0 ? "2/3" : "2/2") + " Exécution de import_paniers_baseprod.sql (paniers + panier_articles)…");
    const [res2] = await connection.query(sql2);
    console.log("   ✓ import_paniers_baseprod.sql terminé.");

    const logResults = (r) => {
      if (Array.isArray(r) && r.length > 0 && r[0] && Array.isArray(r[0])) {
        r[0].forEach((row) => {
          const line = Object.values(row).join(" : ");
          if (line) console.log("   ", line);
        });
      }
    };
    if (Array.isArray(res1)) logResults(res1);
    if (Array.isArray(res2)) logResults(res2);

    console.log("\n✓ Import legacy terminé avec succès.");
  } catch (err) {
    console.error("\n❌ Erreur lors de l'import:", err.message);
    if (err.sql) console.error("   SQL:", err.sql.slice(0, 200) + "...");
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
