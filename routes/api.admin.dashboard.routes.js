const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const {
  getCurrentOrgId,
  getCurrentUserRole,
  getCurrentUserId,
} = require("../utils/session-helpers");

/**
 * GET /api/admin/dashboard
 * Retourne les données du dashboard (catalogues, commandes, paniers)
 */
router.get("/", requirePermission("catalogues", { json: true }), (req, res) => {
  const role = getCurrentUserRole(req);
  const isSuperAdmin = role === "SuperAdmin";
  const scopeToggleAvailable = !isSuperAdmin;
  const showAllScope = !scopeToggleAvailable || req.query.scope === "all";
  const orgId = getCurrentOrgId(req);
  const userId = getCurrentUserId(req);

  // Fonction pour construire les filtres selon le rôle et le scope
  const buildFilters = ({ alias }) => {
    const clauses = [];
    const params = [];

    if (!isSuperAdmin) {
      const organizationColumn =
        alias === "c" ? "c.organization_id" : `${alias}.organization_id`;
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

  // Requête pour les commandes validées
  const commandeQuery = `
    SELECT
      c.id,
      c.id AS panier_id,
      c.user_id,
      c.created_at,
      c.note,
      u.username,
      u.organization_id,
      o.name as organization_name,
      cf.originalname AS catalogue,
      cf.description,
      cf.id AS catalog_file_id,
      cf.id AS id2,
      cf.expiration_date,
      cf.is_archived,
      cf.date_livraison
    FROM paniers c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN organizations o ON u.organization_id = o.id
    JOIN catalog_files cf ON c.catalog_file_id = cf.id
    WHERE c.is_submitted = 1 AND cf.is_archived IN (0,2)${commandeFilter.clause}
    ORDER BY c.created_at DESC
  `;

  // Requête pour les paniers en cours
  const panierQuery = `
    SELECT
      p.id,
      p.user_id,
      p.created_at,
      p.note,
      u.username,
      u.organization_id,
      o.name as organization_name,
      cf.originalname AS catalogue,
      cf.description,
      cf.id AS catalog_file_id,
      cf.id AS id2,
      cf.expiration_date,
      cf.is_archived,
      cf.date_livraison
    FROM paniers p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN organizations o ON u.organization_id = o.id
    JOIN catalog_files cf ON p.catalog_file_id = cf.id
    WHERE p.is_submitted = 0 AND cf.is_archived IN (0,2)${panierFilter.clause}
    ORDER BY p.created_at DESC
  `;

  // Requête pour les catalogues ayant des commandes
  const catalogClauses = ["p.is_submitted = 1", "c.is_archived IN (0,2)"];
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
      c.organization_id,
      o.name as organization_name
    FROM paniers p
    JOIN catalog_files c ON p.catalog_file_id = c.id
    LEFT JOIN organizations o ON c.organization_id = o.id
    WHERE ${catalogClauses.join(" AND ")}
    ORDER BY c.id DESC
  `;

  // Exécuter toutes les requêtes en parallèle
  Promise.all([
    new Promise((resolve) =>
      db.query(commandeQuery, commandeFilter.params, (err, result) => {
        if (err) {
          console.error("Erreur requête commandes:", err);
          resolve([]);
        } else {
          resolve(result || []);
        }
      })
    ),
    new Promise((resolve) =>
      db.query(panierQuery, panierFilter.params, (err, result) => {
        if (err) {
          console.error("Erreur requête paniers:", err);
          resolve([]);
        } else {
          resolve(result || []);
        }
      })
    ),
    new Promise((resolve) =>
      db.query(catalogQuery, catalogParams, (err, result) => {
        if (err) {
          console.error("Erreur requête catalogues:", err);
          resolve([]);
        } else {
          resolve(result || []);
        }
      })
    ),
  ])
    .then(([commandes, paniers, catalogues]) => {
      // Calculer la modifiabilité des paniers
      const hier = new Date();
      hier.setDate(hier.getDate() - 1);

      paniers.forEach((panier) => {
        panier.modifiable =
          !panier.expiration_date || new Date(panier.expiration_date) >= hier;
      });

      // Retourner les données en JSON
      res.json({
        success: true,
        commandes: commandes || [],
        paniers: paniers || [],
        catalogues: catalogues || [],
        totalCommandes: (commandes || []).length,
        referentScopeActive: scopeToggleAvailable,
        showAllScope,
      });
    })
    .catch((error) => {
      console.error("Erreur dashboard:", error);
      res.json({
        success: false,
        error: "Erreur lors du chargement du dashboard",
      });
    });
});

module.exports = router;
