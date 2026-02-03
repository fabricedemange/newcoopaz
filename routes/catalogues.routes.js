const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission, requireAnyPermission } = require("../middleware/rbac.middleware");
const { logger } = require("../config/logger");
const { queryWithUser } = require("../config/db-trace-wrapper");
const {
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUserRole,
} = require("../utils/session-helpers");
const {
  handleDatabaseError,
  handleQueryError,
} = require("../utils/error-helpers");
const { debugLog } = require("../utils/logger-helpers");

// Requête SQL pour récupérer les produits d'un catalogue
const GET_CATALOG_PRODUCTS_SQL = `
  SELECT
    cp.id,
    cp.catalog_file_id,
    cp.product_id,
    cp.prix,
    COALESCE(cp.unite, 1) as unite,
    p.nom as produit,
    p.description,
    p.image_filename,
    c.nom as categorie,
    c.couleur as categorie_couleur,
    c.ordre as categorie_ordre
  FROM catalog_products cp
  INNER JOIN products p ON cp.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE cp.catalog_file_id = ?
  ORDER BY c.ordre, p.nom
`;

// POST /catalogues/invisible-utilisateurs - Rendre invisibles aux utilisateurs les catalogues expirés depuis plus d'un jour
router.post(
  "/invisible-utilisateurs",
  requirePermission("catalogues"),
  (req, res) => {
    const orgId = getCurrentOrgId(req);
    queryWithUser(
      `UPDATE catalog_files SET is_archived = 2
       WHERE is_archived = 0 
         AND expiration_date < (NOW() - INTERVAL 1 DAY)
         AND organization_id = ?`,
      [orgId],
      (err, result) => {
        if (err)
          return handleDatabaseError(
            err,
            res,
            "Erreur lors de la mise à jour des catalogues"
          );
        res.redirect("/admin/catalogues/vue");
      },
      req
    );
  }
);

// POST /catalogues/invisible-tous - Rendre totalement invisibles les catalogues livrés depuis plus de 5 jours
router.post(
  "/invisible-tous",
  requirePermission("catalogues"),
  (req, res) => {
    const orgId = getCurrentOrgId(req);
    queryWithUser(
      `UPDATE catalog_files SET is_archived = 3
       WHERE  date_livraison < (NOW() - INTERVAL 5 DAY)
         AND organization_id = ?`,
      [orgId],
      (err, result) => {
        if (err)
          return handleDatabaseError(
            err,
            res,
            "Erreur lors de l'archivage des catalogues"
          );
        res.redirect("/admin/catalogues/vue");
      },
      req
    );
  }
);

// GET /catalogues/vue - Version Vue.js des catalogues (pour test)
router.get(
  "/vue",
  requireAnyPermission(["catalogues", "paniers.user", "catalogues.view"]),
  (req, res) => {
    res.render("catalogues_vue", {
      title: "Catalogues",
      hideSidebar: false,
    });
  }
);

// GET /catalogues - Redirection vers la liste Vue+Vite
router.get(
  "/",
  requireAnyPermission(["catalogues", "paniers.user", "catalogues.view"]),
  (req, res) => {
    res.redirect("/catalogues/vue");
  }
);

// GET /catalogues/:id - Redirection vers le détail catalogue Vue+Vite
router.get(
  "/:id",
  requireAnyPermission(["catalogues", "paniers.user", "catalogues.view"]),
  (req, res) => {
    const qs = req.query.panier ? `?panier=${req.query.panier}` : "";
    res.redirect(`/catalogues/${req.params.id}/vue${qs}`);
  }
);

// GET /catalogues/:id/vue - Version Vue.js du détail d'un catalogue (pour test)
router.get(
  "/:id/vue",
  requireAnyPermission(["catalogues", "paniers.user", "catalogues.view"]),
  (req, res) => {
    res.render("catalogue_articles_vue", {
      title: "Détail du catalogue",
      hideSidebar: false,
    });
  }
);

module.exports = router;
