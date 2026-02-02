const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId, getCurrentUserRole } = require("../utils/session-helpers");
const { logger } = require("../config/logger");

// ============================================================================
// API: Statistiques générales
// ============================================================================
router.get("/", requirePermission('reports', { json: true }), (req, res) => {
  const role = getCurrentUserRole(req);
  const orgId = getCurrentOrgId(req);

  let sql;
  let params = [];

  if (role === "SuperAdmin") {
    sql = `SELECT
      (SELECT COUNT(*) FROM paniers WHERE is_submitted = 1) as total_commandes,
      (SELECT COUNT(*) FROM users) as total_utilisateurs,
      (SELECT COUNT(*) FROM catalog_files) as total_catalogues`;
  } else {
    sql = `SELECT
      (SELECT COUNT(*) FROM paniers p JOIN users u ON p.user_id = u.id WHERE p.is_submitted = 1 AND u.organization_id = ?) as total_commandes,
      (SELECT COUNT(*) FROM users WHERE organization_id = ?) as total_utilisateurs,
      (SELECT COUNT(*) FROM catalog_files WHERE organization_id = ?) as total_catalogues`;
    params = [orgId, orgId, orgId];
  }

  db.query(sql, params, (err, counters) => {
    if (err) {
      logger.error("Erreur lors de la récupération des compteurs", {
        error: err,
      });
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des statistiques"
      });
    }

    const stats = counters[0] || {
      total_commandes: 0,
      total_utilisateurs: 0,
      total_catalogues: 0,
    };

    res.json({
      success: true,
      stats
    });
  });
});

// ============================================================================
// API: Statistiques - Commandes
// ============================================================================
router.get("/commandes", requirePermission('catalogues', { json: true }), (req, res) => {
  const role = getCurrentUserRole(req);
  const orgId = getCurrentOrgId(req);

  let orgFilter = "";
  let orgParams = [];

  if (role !== "SuperAdmin") {
    orgFilter = " AND users.organization_id = ? ";
    orgParams = [orgId];
  }

  db.query(
    `SELECT paniers.id as commande_id, concat(users.username, ' (id:', users.id, ', ') as username, concat(catalog_files.originalname, ' (', catalog_files.id, ')') as catalogue,  paniers.created_at, organizations.name AS organization_name
     FROM paniers
     JOIN users ON paniers.user_id = users.id
     JOIN catalog_files ON paniers.catalog_file_id = catalog_files.id
     LEFT JOIN organizations ON users.organization_id = organizations.id
     WHERE paniers.is_submitted = 1` +
      orgFilter +
      ` ORDER BY paniers.created_at DESC`,
    orgParams,
    (err, rows) => {
      if (err) {
        logger.error("Erreur lors de la récupération des commandes", { error: err });
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la récupération des commandes"
        });
      }
      res.json({
        success: true,
        commandes: rows || []
      });
    }
  );
});

// ============================================================================
// API: Statistiques - Utilisateurs
// ============================================================================
router.get("/utilisateurs", requirePermission('catalogues', { json: true }), (req, res) => {
  const role = getCurrentUserRole(req);
  const orgId = getCurrentOrgId(req);

  let orgFilter = "";
  let orgParams = [];

  if (role !== "SuperAdmin") {
    orgFilter = " WHERE users.organization_id = ? ";
    orgParams = [orgId];
  }

  db.query(
    `SELECT users.id, users.username, users.email, users.role, users.last_login, organizations.name AS organization_name
     FROM users
     LEFT JOIN organizations ON users.organization_id = organizations.id` +
      orgFilter +
      ` ORDER BY users.username ASC`,
    orgParams,
    (err, rows) => {
      if (err) {
        logger.error("Erreur lors de la récupération des utilisateurs", { error: err });
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la récupération des utilisateurs"
        });
      }
      res.json({
        success: true,
        utilisateurs: rows || []
      });
    }
  );
});

// ============================================================================
// API: Statistiques - Catalogues
// ============================================================================
router.get("/catalogues", requirePermission('catalogues', { json: true }), (req, res) => {
  const role = getCurrentUserRole(req);
  const orgId = getCurrentOrgId(req);

  let orgFilter = "";
  let orgParams = [];

  if (role !== "SuperAdmin") {
    orgFilter = " WHERE c.organization_id = ? ";
    orgParams = [orgId];
  }

  db.query(
    `SELECT c.id as catalogue_id, c.originalname as originalname_id, c.expiration_date,
          COUNT(DISTINCT p.id) as nombre_commandes,
          COALESCE(SUM(pa.quantity * a.prix), 0) as montant_total,
          organizations.name AS organization_name
   FROM catalog_files c
   LEFT JOIN organizations ON c.organization_id = organizations.id
   LEFT JOIN paniers p ON p.catalog_file_id = c.id AND p.is_submitted = 1
   LEFT JOIN panier_articles pa ON pa.panier_id = p.id
   LEFT JOIN articles a ON pa.article_id = a.id
   ` +
      orgFilter +
      `
   GROUP BY c.id
   ORDER BY c.expiration_date DESC`,
    orgParams,
    (err, rows) => {
      if (err) {
        logger.error("Erreur lors de la récupération des catalogues", { error: err });
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la récupération des catalogues"
        });
      }
      res.json({
        success: true,
        catalogues: rows || []
      });
    }
  );
});

// ============================================================================
// API: Statistiques - Commandes par période
// ============================================================================
router.get("/commandes-periode", requirePermission('catalogues', { json: true }), (req, res) => {
  const role = getCurrentUserRole(req);
  const orgId = getCurrentOrgId(req);

  let orgFilter = "";
  let orgParams = [];

  if (role !== "SuperAdmin") {
    orgFilter = " AND users.organization_id = ? ";
    orgParams = [orgId, orgId];
  }

  const sql = `
    SELECT
      'mois' as periode_type,
      DATE_FORMAT(paniers.created_at, '%Y-%m') as periode_label,
      MIN(DATE(paniers.created_at)) as date_debut,
      MAX(DATE(paniers.created_at)) as date_fin,
      COUNT(*) as nombre_commandes
    FROM paniers
    JOIN users ON paniers.user_id = users.id
    WHERE paniers.is_submitted = 1 ${orgFilter}
    GROUP BY DATE_FORMAT(paniers.created_at, '%Y-%m')

    UNION ALL

    SELECT
      'semaine' as periode_type,
      CONCAT(YEAR(paniers.created_at), '-', LPAD(WEEK(paniers.created_at, 1), 2, '0')) as periode_label,
      MIN(DATE(paniers.created_at)) as date_debut,
      MAX(DATE(paniers.created_at)) as date_fin,
      COUNT(*) as nombre_commandes
    FROM paniers
    JOIN users ON paniers.user_id = users.id
    WHERE paniers.is_submitted = 1 ${orgFilter}
    GROUP BY YEAR(paniers.created_at), WEEK(paniers.created_at, 1)

    ORDER BY periode_type DESC, periode_label DESC
  `;

  db.query(sql, orgParams, (err, rows) => {
    if (err) {
      logger.error("Erreur lors de la récupération des commandes par période", { error: err });
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des commandes par période"
      });
    }
    res.json({
      success: true,
      periodes: rows || []
    });
  });
});

module.exports = router;
