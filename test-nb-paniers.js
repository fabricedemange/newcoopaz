const mysql = require('mysql2');

// Configuration de la connexion MySQL
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'coopazfr_commandes',
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
});

const activeCataloguesQuery = `
  SELECT
    c.*,
    u.username,
    o.name as organization_name,
    (SELECT COUNT(DISTINCT p.id) FROM paniers p WHERE p.catalog_file_id = c.id AND p.is_submitted = 1) as nb_paniers
  FROM catalog_files c
  JOIN users u ON c.uploader_id = u.id
  LEFT JOIN organizations o ON c.organization_id = o.id
  WHERE c.is_archived < 3
    AND c.organization_id = ?
  ORDER BY c.expiration_date DESC
  LIMIT 5
`;

console.log("Testing query with organization_id = 1...\n");

db.query(activeCataloguesQuery, [1], (err, results) => {
  if (err) {
    console.error("Error:", err);
    db.end();
    process.exit(1);
  }

  console.log("Number of results:", results.length);
  console.log("\n=== Results ===");

  results.forEach((cat, index) => {
    console.log(`\n[${index + 1}] Catalogue:`);
    console.log(`  ID: ${cat.id}`);
    console.log(`  Name: ${cat.originalname}`);
    console.log(`  nb_paniers: ${cat.nb_paniers}`);
    console.log(`  nb_paniers type: ${typeof cat.nb_paniers}`);
    console.log(`  nb_paniers value (raw): ${JSON.stringify(cat.nb_paniers)}`);
  });

  db.end();
  process.exit(0);
});
