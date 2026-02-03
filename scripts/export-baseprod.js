/**
 * Export des données depuis la base source (baseprod / baserpod) vers CSV et JSON.
 * À exécuter en local avec une base source accessible.
 *
 * Usage:
 *   DB_SOURCE_NAME=baseprod node scripts/export-baseprod.js
 *   # ou DB_SOURCE_NAME=baserpod si c'est le nom exact de la base
 *
 * Variables d'environnement:
 *   DB_SOURCE_NAME  - Nom de la base source (défaut: baseprod)
 *   DB_HOST, DB_USER, DB_PASS - Mêmes que pour la base actuelle
 *
 * Crée dans data/export-baseprod/ :
 *   catalog_files.csv, articles.csv, paniers.csv, panier_articles.csv
 *   catalog_files.json, articles.json, paniers.json, panier_articles.json
 *   commandes.csv, commandes.json (paniers avec is_submitted = 1)
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const SOURCE_DB = process.env.DB_SOURCE_NAME || "baseprod";
const OUT_DIR = path.join(__dirname, "..", "data", "export-baseprod");

// Structure catalog_files (alignée sur 20260201_recreate_catalog_files.sql / docs/EVOLUTION_CATALOG_FILES.md)
const CATALOG_FILES_COLUMNS = [
  "id", "filename", "originalname", "upload_date", "expiration_date", "uploader_id",
  "description", "is_archived", "date_livraison", "organization_id",
  "referent_order_reminder_enabled", "referent_order_reminder_sent_at", "image_filename",
];

const TABLES = [
  { name: "catalog_files", label: "Catalogues", columns: CATALOG_FILES_COLUMNS },
  { name: "articles", label: "Articles catalogues", columns: null },
  { name: "paniers", label: "Paniers", columns: null },
  { name: "panier_articles", label: "Lignes panier", columns: null },
];

function toCsvLine(row) {
  return row.map((cell) => {
    const str = cell === null || cell === undefined ? "" : String(cell);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(",");
}

async function main() {
  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: SOURCE_DB,
    charset: "utf8mb4",
  };

  if (!config.host || !config.user) {
    console.error("❌ Définir DB_HOST, DB_USER, DB_PASS (et optionnellement DB_SOURCE_NAME) dans .env");
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`\n📂 Base source: ${SOURCE_DB}`);
  console.log(`📁 Sortie: ${OUT_DIR}\n`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
  } catch (err) {
    console.error("❌ Connexion impossible à la base source:", err.message);
    if (err.code === "ER_BAD_DB_ERROR") {
      console.error(`   Vérifiez que la base "${SOURCE_DB}" existe (ou utilisez DB_SOURCE_NAME=baserpod si besoin).`);
    }
    process.exit(1);
  }

  try {
    for (const { name, label, columns } of TABLES) {
      let arr;
      if (columns && columns.length > 0) {
        // Export catalog_files avec colonnes explicites (structure cible)
        const colList = columns.map((c) => "`" + c + "`").join(", ");
        try {
          const [rows] = await connection.query(`SELECT ${colList} FROM \`${name}\``);
          arr = Array.isArray(rows) ? rows : [];
        } catch (colErr) {
          // Si une colonne manque en source (ex. image_filename), fallback SELECT *
          if (colErr.code === "ER_BAD_FIELD_ERROR") {
            const [rows] = await connection.query(`SELECT * FROM \`${name}\``);
            arr = Array.isArray(rows) ? rows : [];
            if (arr.length > 0) {
              const have = Object.keys(arr[0]);
              arr = arr.map((r) => {
                const out = {};
                for (const k of columns) out[k] = have.includes(k) ? r[k] : null;
                return out;
              });
            }
          } else throw colErr;
        }
      } else {
        const [rows] = await connection.query(`SELECT * FROM \`${name}\``);
        arr = Array.isArray(rows) ? rows : [];
      }

      const csvPath = path.join(OUT_DIR, `${name}.csv`);
      const jsonPath = path.join(OUT_DIR, `${name}.json`);

      if (arr.length > 0) {
        const headers = Object.keys(arr[0]);
        const csvLines = [headers.join(","), ...arr.map((r) => toCsvLine(headers.map((h) => r[h])))];
        fs.writeFileSync(csvPath, "\uFEFF" + csvLines.join("\n"), "utf8");
        fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2), "utf8");
        console.log(`✅ ${label} (${name}): ${arr.length} lignes → ${name}.csv, ${name}.json`);
      } else {
        fs.writeFileSync(csvPath, "", "utf8");
        fs.writeFileSync(jsonPath, "[]", "utf8");
        console.log(`⚠️  ${label} (${name}): 0 lignes → fichiers vides créés`);
      }
    }

    // Export "commandes" = paniers avec is_submitted = 1
    const [commandes] = await connection.query(
      "SELECT * FROM paniers WHERE is_submitted = 1"
    );
    const cmdRows = Array.isArray(commandes) ? commandes : [];
    const cmdCsv = path.join(OUT_DIR, "commandes.csv");
    const cmdJson = path.join(OUT_DIR, "commandes.json");
    if (cmdRows.length > 0) {
      const headers = Object.keys(cmdRows[0]);
      const csvLines = [headers.join(","), ...cmdRows.map((r) => toCsvLine(headers.map((h) => r[h])))];
      fs.writeFileSync(cmdCsv, "\uFEFF" + csvLines.join("\n"), "utf8");
      fs.writeFileSync(cmdJson, JSON.stringify(cmdRows, null, 2), "utf8");
      console.log(`✅ Commandes (paniers soumis): ${cmdRows.length} lignes → commandes.csv, commandes.json`);
    } else {
      fs.writeFileSync(cmdCsv, "", "utf8");
      fs.writeFileSync(cmdJson, "[]", "utf8");
      console.log(`⚠️  Commandes: 0 lignes → fichiers vides créés`);
    }

    console.log("\n✓ Export terminé.");
  } catch (err) {
    console.error("❌ Erreur lors de l'export:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
