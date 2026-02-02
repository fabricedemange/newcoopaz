const express = require("express");
const router = express.Router();
const { requireAnyPermission, requirePermission } = require("../middleware/rbac.middleware");
const { queryWithUser } = require("../config/db-trace-wrapper");
const { getCurrentUserId, getCurrentUserRole, getCurrentOrgId } = require("../utils/session-helpers");

// Convertir queryWithUser en promesse
const queryPromise = (sql, params, req) => {
  return new Promise((resolve, reject) => {
    queryWithUser(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    }, req);
  });
};

// GET /api/admin/dashboard - Données du dashboard admin
router.get("/admin/dashboard", requireAnyPermission(["paniers.admin", "commandes.admin"], { json: true }), async (req, res) => {
  const role = getCurrentUserRole(req);
  const isSuperAdmin = role === "SuperAdmin";
  const scopeToggleAvailable = !isSuperAdmin;
  const showAllScope = !scopeToggleAvailable || req.query.scope === "all";
  const orgId = getCurrentOrgId(req);
  const userId = getCurrentUserId(req);

  try {
    const buildFilters = ({ alias }) => {
      const clauses = [];
      const params = [];

      if (!isSuperAdmin) {
        const organizationColumn = alias === "c" ? "c.organization_id" : `${alias}.organization_id`;
        clauses.push(`${organizationColumn} = ?`);
        params.push(orgId);
      }

      if (scopeToggleAvailable && !showAllScope) {
        clauses.push("cf.uploader_id = ?");
        params.push(userId);
      }

      return {
        clause: clauses.length ? ` AND ${clauses.join(" AND ")}` : "",
        params,
      };
    };

    const commandeFilter = buildFilters({ alias: "u" });
    const panierFilter = buildFilters({ alias: "u" });

    // Requête du nombre total de commandes
    const countCommandeQuery = `
      SELECT COUNT(*) as total
      FROM paniers c
      JOIN users u ON c.user_id = u.id
      JOIN catalog_files cf ON c.catalog_file_id = cf.id
      WHERE c.is_submitted = 1 AND cf.is_archived = 0 ${commandeFilter.clause}
    `;

    // Requête des commandes avec nombre de produits et montant
    const commandeQuery = `
      SELECT
        c.id,
        c.user_id,
        c.created_at,
        c.note,
        c.catalog_file_id,
        u.username,
        cf.originalname as catalogue,
        cf.expiration_date,
        cf.date_livraison,
        DATE_FORMAT(c.created_at, '%d/%m/%Y à %H:%i') as created_formatted,
        DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(cf.date_livraison, '%d/%m/%Y') as livraison_formatted,
        COALESCE(SUM(pa.quantity), 0) as nb_produits,
        COALESCE(SUM(pa.quantity * cp.prix), 0) as montant_total
      FROM paniers c
      JOIN users u ON c.user_id = u.id
      JOIN catalog_files cf ON c.catalog_file_id = cf.id
      LEFT JOIN panier_articles pa ON c.id = pa.panier_id
      LEFT JOIN catalog_products cp ON pa.catalog_product_id = cp.id
      WHERE c.is_submitted = 1 AND cf.is_archived = 0 ${commandeFilter.clause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 50
    `;

    // Requête des paniers
    const panierQuery = `
      SELECT
        c.id,
        c.user_id,
        c.created_at,
        c.note,
        u.username,
        cf.originalname as catalogue,
        cf.expiration_date,
        cf.date_livraison,
        cf.id as catalog_file_id,
        DATE_FORMAT(c.created_at, '%d/%m/%Y à %H:%i') as created_formatted,
        DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(cf.date_livraison, '%d/%m/%Y') as livraison_formatted
      FROM paniers c
      JOIN users u ON c.user_id = u.id
      JOIN catalog_files cf ON c.catalog_file_id = cf.id
      WHERE c.is_submitted = 0 AND cf.is_archived = 0 ${panierFilter.clause}
      ORDER BY c.created_at DESC
      LIMIT 50
    `;

    // Construire les clauses pour les catalogues
    const catalogClauses = ["p.is_submitted = 1", "c.is_archived = 0"];
    const catalogParams = [];

    if (!isSuperAdmin) {
      catalogClauses.push("c.organization_id = ?");
      catalogParams.push(orgId);
    }

    if (scopeToggleAvailable && !showAllScope) {
      catalogClauses.push("c.uploader_id = ?");
      catalogParams.push(userId);
    }

    const catalogQuery = `
      SELECT DISTINCT
        c.id,
        c.originalname,
        c.description,
        c.expiration_date,
        c.date_livraison,
        DATE_FORMAT(c.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(c.date_livraison, '%d/%m/%Y') as livraison_formatted
      FROM paniers p
      JOIN catalog_files c ON p.catalog_file_id = c.id
      WHERE ${catalogClauses.join(" AND ")}
      ORDER BY c.id DESC
      LIMIT 50
    `;

    // Exécuter toutes les requêtes en parallèle
    const [countCommandeResult, commandes, paniers, catalogues] = await Promise.all([
      queryPromise(countCommandeQuery, commandeFilter.params, req),
      queryPromise(commandeQuery, commandeFilter.params, req),
      queryPromise(panierQuery, panierFilter.params, req),
      queryPromise(catalogQuery, catalogParams, req)
    ]);

    const totalCommandes = countCommandeResult?.[0]?.total || 0;

    // Calculer si modifiable pour les paniers
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    const paniersWithModifiable = (paniers || []).map(panier => ({
      ...panier,
      modifiable: !panier.expiration_date || new Date(panier.expiration_date) >= hier,
      isExpired: panier.expiration_date && new Date(panier.expiration_date) < hier
    }));

    // Calculer si expiré pour les catalogues
    const cataloguesWithExpired = (catalogues || []).map(catalogue => ({
      ...catalogue,
      isExpired: catalogue.expiration_date && new Date(catalogue.expiration_date) < hier
    }));

    res.json({
      success: true,
      commandes: commandes || [],
      totalCommandes: totalCommandes,
      paniers: paniersWithModifiable,
      catalogues: cataloguesWithExpired,
      referentScopeActive: scopeToggleAvailable,
      showAllScope
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/admin/dashboard:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement du dashboard"
    });
  }
});

module.exports = router;
