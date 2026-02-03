/**
 * Import baseprod → base cible (nouveau modèle uniquement).
 *
 * N'écrit que dans : catalog_files, products, catalog_products, paniers, panier_articles.
 * Ne touche pas à la table articles. Les panier_articles sont créés avec catalog_product_id
 * (mapping article_id baseprod → catalog_product_id cible).
 *
 * Ordre :
 *   1. Créer catalog_files si besoin (migration)
 *   2. Vider panier_articles, paniers, catalog_products (catalog_files importés), catalog_files
 *   3. Insérer catalog_files depuis baseprod
 *   4. S'assurer catégories/fournisseurs par défaut (Autres, Fournisseur général) par org
 *   5. Lire baseprod.articles → dédupliquer (org, produit, description) → créer/trouver products
 *   6. Pour chaque article baseprod → créer catalog_product, map (catalog_file_id, article_id) → catalog_product_id
 *   7. Insérer paniers depuis baseprod
 *   8. Insérer panier_articles avec catalog_product_id depuis la map
 *
 * Usage: node scripts/run-import-baseprod-complet.js
 * Variables d'environnement: DB_HOST, DB_USER, DB_PASS, DB_NAME (base cible)
 * La base source doit s'appeler "baseprod" sur le même serveur.
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const TARGET_DB = process.env.DB_NAME || "coopazfr_commandes";
const SOURCE_DB = "baseprod";
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

/** Retourne le nom de catégorie selon le nom du produit (même logique que MIGRATION_COMPLETE) */
function categoryFromProductName(produit) {
  const p = (produit || "").toLowerCase();
  if (/pain|baguette|miche|banneton|focaccia|brioche/.test(p)) return "Boulangerie";
  if (/cookie|biscuit|canistrell/.test(p)) return "Biscuits";
  if (/fromage|comté|bleu|morbier|raclette|tomme|tome|brebis|chèvre|gex/.test(p)) return "Fromagerie";
  if (/boeuf|bœuf|steak|viande|porc|agneau|veau|gigot|côte|cote|araignee|araignée/.test(p)) return "Viandes";
  if (/sauciss|jambon|pâté|terrine|rillette|chipolata|lardon/.test(p)) return "Charcuterie";
  if (/poulet|canard|pintade|coquelet|foie gras|magret|confit/.test(p)) return "Volailles";
  if (/poisson|truite|saumon|filet|pavé|pave/.test(p)) return "Poissons";
  if (/fruit|légume|orange|citron|pomme|banane|tomate|avocat|agrume|clémentine/.test(p)) return "Fruits & Légumes";
  if (/vin|bib|jus|boisson/.test(p)) return "Boissons";
  return "Autres";
}

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

  console.log("\n📥 Import baseprod (option complète) →", TARGET_DB);
  console.log("   Nouveau modèle uniquement : catalog_files, products, catalog_products, paniers, panier_articles.\n");

  let conn;
  try {
    conn = await mysql.createConnection(config);
  } catch (err) {
    console.error("❌ Connexion impossible:", err.message);
    process.exit(1);
  }

  try {
    // 0. Créer catalog_files si nécessaire
    const migrationPath = path.join(MIGRATIONS_DIR, "20260201_catalog_files_from_import_baseprod.sql");
    if (fs.existsSync(migrationPath)) {
      console.log("0. Création table catalog_files si nécessaire…");
      const sql = fs.readFileSync(migrationPath, "utf8");
      await conn.query(sql);
      console.log("   ✓ Table catalog_files prête.\n");
    }

    // 1. IDs des catalog_files à importer (depuis baseprod)
    const [sourceCatalogIds] = await conn.query(
      `SELECT id FROM ${SOURCE_DB}.catalog_files ORDER BY id`
    );
    const catalogIds = sourceCatalogIds.map((r) => r.id);
    if (catalogIds.length === 0) {
      console.log("⚠ Aucun catalogue dans baseprod. Rien à importer.");
      return;
    }
    console.log("1. Catalogues baseprod à importer:", catalogIds.length);

    // 2. Vider les tables cibles (ordre FK)
    console.log("2. Vidage des tables cibles…");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("TRUNCATE TABLE panier_articles");
    await conn.query("TRUNCATE TABLE paniers");
    await conn.query(
      `DELETE FROM catalog_products WHERE catalog_file_id IN (${catalogIds.join(",")})`
    );
    await conn.query("TRUNCATE TABLE catalog_files");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("   ✓ Tables vidées.\n");

    // 3. Insérer catalog_files depuis baseprod
    console.log("3. Import catalog_files depuis baseprod…");
    await conn.query(`
      INSERT INTO catalog_files
        (id, filename, originalname, upload_date, expiration_date, uploader_id,
         description, is_archived, date_livraison, organization_id,
         referent_order_reminder_enabled, referent_order_reminder_sent_at, image_filename)
      SELECT
        id, filename, originalname, upload_date, expiration_date, uploader_id,
        description, is_archived, date_livraison, organization_id,
        referent_order_reminder_enabled, referent_order_reminder_sent_at,
        NULL
      FROM ${SOURCE_DB}.catalog_files
    `);
    const [cfCount] = await conn.query("SELECT COUNT(*) AS n FROM catalog_files");
    console.log("   ✓ catalog_files:", cfCount[0].n, "lignes.\n");

    // 4. Catégories / fournisseurs par défaut (par org des catalogues)
    const [orgs] = await conn.query(
      `SELECT DISTINCT organization_id FROM catalog_files WHERE organization_id IS NOT NULL`
    );
    for (const { organization_id } of orgs) {
      const [cat] = await conn.query(
        "SELECT id FROM categories WHERE organization_id = ? AND nom = 'Autres' LIMIT 1",
        [organization_id]
      );
      if (cat.length === 0) {
        await conn.query(
          `INSERT INTO categories (organization_id, nom, description, ordre, couleur, icon, is_active)
           VALUES (?, 'Autres', 'Produits divers', 99, '#808080', 'bi-three-dots', 1)`,
          [organization_id]
        );
      }
      const [sup] = await conn.query(
        "SELECT id FROM suppliers WHERE organization_id = ? AND nom = 'Fournisseur général' LIMIT 1",
        [organization_id]
      );
      if (sup.length === 0) {
        await conn.query(
          `INSERT INTO suppliers (organization_id, nom, notes, is_active) VALUES (?, 'Fournisseur général', 'Par défaut', 1)`,
          [organization_id]
        );
      }
    }
    console.log("4. Catégories/fournisseurs par défaut OK.\n");

    // 5. Lire articles baseprod avec organization_id
    const [articles] = await conn.query(`
      SELECT a.id AS article_id, a.catalog_file_id, a.produit, a.description, a.prix, a.unite, a.image_filename,
             cf.organization_id
      FROM ${SOURCE_DB}.articles a
      INNER JOIN ${SOURCE_DB}.catalog_files cf ON a.catalog_file_id = cf.id
      ORDER BY a.catalog_file_id, a.id
    `);

    // Produits uniques (organization_id, nom, description) → product_id
    const productKey = (orgId, nom, desc) =>
      `${orgId}|${(nom || "").trim()}|${(desc || "").trim()}`;
    const productCache = {}; // key -> product_id

    const getOrCreateProduct = async (organization_id, nom, description, image_filename) => {
      const key = productKey(organization_id, nom, description);
      if (productCache[key] != null) return productCache[key];
      const [existing] = await conn.query(
        "SELECT id FROM products WHERE organization_id = ? AND nom = ? AND (COALESCE(description,'') = COALESCE(?,'')) LIMIT 1",
        [organization_id, (nom || "").trim(), description]
      );
      let productId;
      if (existing.length > 0) {
        productId = existing[0].id;
      } else {
        const catName = categoryFromProductName(nom);
        const [catRow] = await conn.query(
          "SELECT id FROM categories WHERE organization_id = ? AND nom = ? LIMIT 1",
          [organization_id, catName]
        );
        const [supRow] = await conn.query(
          "SELECT id FROM suppliers WHERE organization_id = ? AND nom = 'Fournisseur général' LIMIT 1",
          [organization_id]
        );
        const [ins] = await conn.query(
          `INSERT INTO products (organization_id, supplier_id, category_id, nom, description, image_filename, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            organization_id,
            supRow.length ? supRow[0].id : null,
            catRow.length ? catRow[0].id : null,
            (nom || "").trim(),
            description || null,
            image_filename || null,
          ]
        );
        productId = ins.insertId;
      }
      productCache[key] = productId;
      return productId;
    };

    // 6. Créer catalog_products et map (catalog_file_id, article_id) -> catalog_product_id
    // Un seul catalog_product par (catalog_file_id, product_id) : réutiliser si déjà créé
    const articleToCatalogProduct = {}; // `${catalog_file_id}:${article_id}` -> catalog_product_id
    const cpByFileProduct = {}; // `${catalog_file_id}:${product_id}` -> catalog_product_id
    console.log("5–6. Articles → products + catalog_products (dédoublonnage + catégorisation)…");

    for (const a of articles) {
      const productId = await getOrCreateProduct(
        a.organization_id,
        a.produit,
        a.description,
        a.image_filename
      );
      const cpKey = `${a.catalog_file_id}:${productId}`;
      let catalogProductId = cpByFileProduct[cpKey];
      if (catalogProductId == null) {
        const [cpIns] = await conn.query(
          `INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite) VALUES (?, ?, ?, ?)`,
          [a.catalog_file_id, productId, a.prix ?? null, a.unite ?? 1]
        );
        catalogProductId = cpIns.insertId;
        cpByFileProduct[cpKey] = catalogProductId;
      }
      articleToCatalogProduct[`${a.catalog_file_id}:${a.article_id}`] = catalogProductId;
    }
    console.log("   ✓ products (dédoublonnés):", Object.keys(productCache).length);
    console.log("   ✓ catalog_products:", articles.length, "lignes.\n");

    // 7. Insérer paniers depuis baseprod
    console.log("7. Import paniers depuis baseprod…");
    await conn.query(`
      INSERT INTO paniers (id, user_id, catalog_file_id, created_at, is_submitted, note)
      SELECT id, user_id, catalog_file_id, created_at, is_submitted, note
      FROM ${SOURCE_DB}.paniers
    `);
    const [panCount] = await conn.query("SELECT COUNT(*) AS n FROM paniers");
    console.log("   ✓ paniers:", panCount[0].n, "lignes.\n");

    // 8. Insérer panier_articles avec catalog_product_id (pas article_id)
    console.log("8. Import panier_articles (catalog_product_id)…");
    const [paRows] = await conn.query(`
      SELECT pa.id, pa.panier_id, pa.article_id, pa.quantity, pa.note, p.catalog_file_id
      FROM ${SOURCE_DB}.panier_articles pa
      INNER JOIN ${SOURCE_DB}.paniers p ON pa.panier_id = p.id
    `);
    let inserted = 0;
    let skipped = 0;
    for (const pa of paRows) {
      const catalogProductId = articleToCatalogProduct[`${pa.catalog_file_id}:${pa.article_id}`];
      if (catalogProductId == null) {
        skipped++;
        continue;
      }
      await conn.query(
        `INSERT INTO panier_articles (panier_id, catalog_product_id, quantity, note) VALUES (?, ?, ?, ?)`,
        [pa.panier_id, catalogProductId, pa.quantity ?? 0, pa.note ?? null]
      );
      inserted++;
    }
    console.log("   ✓ panier_articles:", inserted, "lignes (ignorés:", skipped, ").\n");

    console.log("✓ Import complet terminé avec succès.");
  } catch (err) {
    console.error("\n❌ Erreur:", err.message);
    if (err.sql) console.error("   SQL:", err.sql.slice(0, 300));
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
