const { queryWithUser } = require("../config/db-trace-wrapper");
const { getCurrentOrgId } = require("./session-helpers");

/**
 * Utility function to insert a catalog file with organization_id
 * @param {Object} file - The uploaded file object
 * @par  db.query(sql, [], callback);
}

/**
 * Get dashboard statistics for admin
 * @param {number|null} orgId - Organization ID (null for SuperAdmin)
 * @param {Function} callback - Callback function
 */
function getDashboardStats(orgId, callback) {
  const orgFilter = orgId ? "WHERE p.organization_id = ?" : "";
  const params = orgId ? [orgId] : [];

  const sql = `
    SELECT
      p.id,
      p.user_id,
      p.catalog_file_id,
      p.created_at,
      p.is_submitted,
      p.note,
      u.username,
      c.originalname as catalogue_name,
      c.expiration_date,
      c.is_archived,
      o.name as organization_name,
      COALESCE(SUM(pa.quantity * a.prix), 0) as montant_total,
      COUNT(pa.id) as nombre_articles
    FROM paniers p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN catalog_files c ON p.catalog_file_id = c.id
    LEFT JOIN organizations o ON p.organization_id = o.id
    LEFT JOIN panier_articles pa ON p.id = pa.panier_id
    LEFT JOIN articles a ON pa.article_id = a.id
    ${orgFilter}
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  db.query(sql, params, callback);
}

/**
 * Get catalog order summary (simple synthesis)
 * @param {number} catalogId - Catalog ID
 * @param {Function} callback - Callback function
 */
function getCatalogOrderSummary(catalogId, callback) {
  const sql = `
    SELECT
      a.produit,
      substring(a.description, 1, 100) as description,
      a.prix,
      COALESCE(NULLIF(p.note, ''), '') AS note,
      pa.note as note_article,
      SUM(pa.quantity) AS total_commande
    FROM articles a
    JOIN panier_articles pa ON pa.article_id = a.id
    JOIN paniers p ON pa.panier_id = p.id
    WHERE a.catalog_file_id = ? AND p.is_submitted = 1
    GROUP BY a.id, note, note_article
    ORDER BY a.produit ASC
  `;

  db.query(sql, [catalogId], callback);
}

/**
 * Get detailed order summary by user
 * @param {number} catalogId - Catalog ID
 * @param {Function} callback - Callback function
 */
function getDetailedOrderSummary(catalogId, callback) {
  const sql = `
    SELECT
      CONCAT(u.username, ' (panier N°', c.id, ')') as username,
      a.produit,
      substring(a.description, 1, 100) as description,
      a.prix,
      SUM(pa.quantity) as quantite,
      ROUND(SUM(pa.quantity * a.prix), 2) as montant_utilisateur,
      COALESCE(c.note, '') AS note,
      pa.note as note_article
    FROM paniers c
    JOIN panier_articles pa ON pa.panier_id = c.id
    JOIN articles a ON pa.article_id = a.id
    JOIN users u ON c.user_id = u.id
    WHERE a.catalog_file_id = ? and c.is_submitted=1
    GROUP BY u.id, a.id, c.id
    ORDER BY c.id ASC, a.produit ASC
  `;

  db.query(sql, [catalogId], callback);
}

module.exports = {
  insertCatalog,
  insertArticle,
  insertUser,
  insertPanier,
  insertPanierArticle,
  getCatalogsByOrg,
  getAllCatalogs,
  getUsersByOrg,
  getAllUsers,
  getAllOrganizations,
  getDashboardStats,
  getCatalogOrderSummary,
  getDetailedOrderSummary,
};

function insertCatalog(
  file,
  expirationDate,
  uploaderId,
  description,
  req,
  callback
) {
  queryWithUser(
    "INSERT INTO catalog_files (filename, originalname, upload_date, expiration_date, uploader_id, description, organization_id) VALUES (?, ?, NOW(), ?, ?, ?, ?)",
    [
      file.filename,
      file.originalname,
      expirationDate,
      uploaderId,
      description,
      getCurrentOrgId(req),
    ],
    callback,
    req
  );
}

/**
 * Utility function to insert an article with organization_id (if needed, but articles are linked to catalog)
 * @param {number} catalogFileId - Catalog file ID
 * @param {string} produit - Product name
 * @param {string} description - Description
 * @param {number} prix - Price
 * @param {Object} req - Request object
 * @param {Function} callback - Callback function
 */
function insertArticle(
  catalogFileId,
  produit,
  description,
  prix,
  req,
  callback
) {
  queryWithUser(
    "INSERT INTO articles (catalog_file_id, produit, description, prix) VALUES (?, ?, ?, ?)",
    [catalogFileId, produit, description, prix],
    callback,
    req
  );
}

/**
 * Utility function to insert a user with organization_id
 * @param {string} username - Username
 * @param {string} hashedPassword - Hashed password
 * @param {string} role - Role
 * @param {string} email - Email
 * @param {string} description - Description
 * @param {number|null} organizationId - Organization ID
 * @param {Object} req - Request object
 * @param {Function} callback - Callback function
 */
function insertUser(
  username,
  hashedPassword,
  role,
  email,
  description,
  emailCatalogue,
  organizationId,
  req,
  callback
) {
  queryWithUser(
    "INSERT INTO users (username, password, role, email, description, email_catalogue, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      username,
      hashedPassword,
      role,
      email,
      description,
      emailCatalogue,
      organizationId,
    ],
    callback,
    req
  );
}

/**
 * Utility function to insert a panier
 * @param {number} userId - User ID
 * @param {number} catalogFileId - Catalog file ID
 * @param {Object} req - Request object
 * @param {Function} callback - Callback function
 */
function insertPanier(userId, catalogFileId, req, callback) {
  queryWithUser(
    "INSERT INTO paniers (user_id, created_at, catalog_file_id) VALUES (?, NOW(), ?)",
    [userId, catalogFileId],
    callback,
    req
  );
}

/**
 * Utility function to insert a panier article
 * @param {number} panierId - Panier ID
 * @param {number} catalogProductId - Catalog Product ID (from catalog_products table)
 * @param {number} quantity - Quantity
 * @param {Object} req - Request object
 * @param {Function} callback - Callback function
 */
function insertPanierArticle(panierId, catalogProductId, quantity, req, callback) {
  queryWithUser(
    "INSERT INTO panier_articles (panier_id, catalog_product_id, quantity) VALUES (?, ?, GREATEST(0, ?))",
    [panierId, catalogProductId, quantity],
    callback,
    req
  );
}

const { db } = require("../config/config");

/**
 * Get catalogs by organization
 * @param {number} orgId - Organization ID
 * @param {Function} callback - Callback function
 */
function getCatalogsByOrg(orgId, callback) {
  const sql = `SELECT
    c.*, 
    u.username,
    o.name AS organization_name,
    SUM(p.is_submitted = 1) AS nb_soumis,
    SUM(p.is_submitted = 0) AS nb_non_soumis
  FROM catalog_files c
  JOIN users u ON u.id = c.uploader_id
  LEFT JOIN organizations o ON c.organization_id = o.id
  LEFT JOIN paniers p ON p.catalog_file_id = c.id
  WHERE c.organization_id = ?
  GROUP BY c.id
  ORDER BY c.is_archived ASC, c.expiration_date ASC`;
  db.query(sql, [orgId], callback);
}

/**
 * Get all catalogs for SuperAdmin
 * @param {Function} callback - Callback function
 */
function getAllCatalogs(callback) {
  const sql = `SELECT
    c.*, 
    u.username,
    o.name AS organization_name,
    SUM(p.is_submitted = 1) AS nb_soumis,
    SUM(p.is_submitted = 0) AS nb_non_soumis
  FROM catalog_files c
  JOIN users u ON u.id = c.uploader_id
  LEFT JOIN organizations o ON c.organization_id = o.id
  LEFT JOIN paniers p ON p.catalog_file_id = c.id
  GROUP BY c.id
  ORDER BY c.is_archived ASC, c.expiration_date ASC`;
  db.query(sql, [], callback);
}

/**
 * Get users by organization
 * @param {number} orgId - Organization ID
 * @param {Function} callback - Callback function
 */
function getUsersByOrg(orgId, callback) {
  db.query(
    "SELECT id, username, role, email, description, is_validated FROM users WHERE organization_id = ?",
    [orgId],
    callback
  );
}

/**
 * Get all users for SuperAdmin
 * @param {Function} callback - Callback function
 */
function getAllUsers(callback) {
  const sql = `SELECT users.id, users.username, users.role, users.email, users.description, users.is_validated, users.organization_id, organizations.name AS organization_name
       FROM users
       LEFT JOIN organizations ON users.organization_id = organizations.id`;
  db.query(sql, [], callback);
}

/**
 * Get all organizations
 * @param {Function} callback - Callback function
 */
function getAllOrganizations(callback) {
  db.query("SELECT id, name FROM organizations", [], callback);
}

module.exports = {
  insertCatalog,
  insertArticle,
  insertUser,
  insertPanier,
  insertPanierArticle,
  getCatalogsByOrg,
  getAllCatalogs,
  getUsersByOrg,
  getAllUsers,
  getAllOrganizations,
  getDashboardStats,
  getCatalogOrderSummary,
  getDetailedOrderSummary,
};
