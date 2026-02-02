const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/middleware");
const { renderAdminView } = require("../utils/view-helpers");
const { queryWithUser } = require("../config/db-trace-wrapper");

// Convertir queryWithUser en promesse
const queryPromise = (sql, params, req) => {
  return new Promise((resolve, reject) => {
    queryWithUser(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    }, req);
  });
};

// GET / - Redirection vers la page d'accueil Vue+Vite
router.get("/", requireLogin, (req, res) => {
  return res.redirect("/vue");
});

// GET /legacy-home - Ancienne page d'accueil EJS (conservée pour rollback si besoin)
router.get("/legacy-home", requireLogin, async (req, res, next) => {
  const orgId = req.session?.organization_id;
  const userId = req.session?.userId;

  try {
    // Récupérer le nombre de paniers non validés avec catalogues encore valides
    const paniersQuery = `
      SELECT COUNT(DISTINCT p.id) as nb_paniers
      FROM paniers p
      JOIN catalog_files c ON p.catalog_file_id = c.id
      WHERE p.user_id = ?
        AND p.is_submitted = 0
        AND c.expiration_date >= CURDATE()
        AND c.organization_id = ?
    `;

    // Récupérer le nombre de commandes (paniers soumis) en attente de livraison
    const commandesQuery = `
      SELECT COUNT(DISTINCT p.id) as nb_commandes
      FROM paniers p
      JOIN catalog_files c ON p.catalog_file_id = c.id
      WHERE p.user_id = ?
        AND p.is_submitted = 1
        AND c.date_livraison >= CURDATE()
        AND c.organization_id = ?
    `;

    // Récupérer le nombre de catalogues actifs disponibles
    const cataloguesQuery = `
      SELECT COUNT(*) as nb_catalogues
      FROM catalog_files
      WHERE organization_id = ?
        AND is_archived = 0
        AND expiration_date >= CURDATE()
    `;

    // Récupérer les paniers en cours avec détails
    const paniersDetailsQuery = `
      SELECT p.id, c.originalname as catalogue_nom, c.id as catalogue_id,
             DATE_FORMAT(c.expiration_date, '%d/%m/%Y') as expiration,
             c.expiration_date as expiration_commande,
             (SELECT COUNT(*) FROM panier_articles pa WHERE pa.panier_id = p.id) as nb_articles
      FROM paniers p
      JOIN catalog_files c ON p.catalog_file_id = c.id
      WHERE p.user_id = ?
        AND p.is_submitted = 0
        AND c.expiration_date >= CURDATE()
        AND c.organization_id = ?
      ORDER BY c.expiration_date ASC
      LIMIT 5
    `;

    // Récupérer les commandes (paniers soumis) en cours avec détails
    const commandesDetailsQuery = `
      SELECT p.id, c.originalname as catalogue_nom, c.id as catalogue_id,
             DATE_FORMAT(c.date_livraison, '%d/%m/%Y') as livraison,
             c.date_livraison,
             'validee' as statut,
             (SELECT COUNT(*) FROM panier_articles pa WHERE pa.panier_id = p.id) as nb_articles
      FROM paniers p
      JOIN catalog_files c ON p.catalog_file_id = c.id
      WHERE p.user_id = ?
        AND p.is_submitted = 1
        AND c.date_livraison >= CURDATE()
        AND c.organization_id = ?
      ORDER BY c.date_livraison ASC
      LIMIT 5
    `;

    // Récupérer les nouveaux catalogues (créés dans les 7 derniers jours)
    const nouveauxCataloguesQuery = `
      SELECT id, originalname, description,
             DATE_FORMAT(expiration_date, '%d/%m/%Y') as expiration,
             DATE_FORMAT(date_livraison, '%d/%m/%Y') as livraison,
             expiration_date as expiration_commande, date_livraison,
             DATE_FORMAT(upload_date, '%d/%m/%Y') as date_creation
      FROM catalog_files
      WHERE organization_id = ?
        AND is_archived = 0
        AND expiration_date >= CURDATE()
        AND upload_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY upload_date DESC
      LIMIT 3
    `;

    const paniersResults = await queryPromise(paniersQuery, [userId, orgId], req);
    const commandesResults = await queryPromise(commandesQuery, [userId, orgId], req);
    const cataloguesResults = await queryPromise(cataloguesQuery, [orgId], req);
    const paniersDetails = await queryPromise(paniersDetailsQuery, [userId, orgId], req);
    const commandesDetails = await queryPromise(commandesDetailsQuery, [userId, orgId], req);
    const nouveauxCatalogues = await queryPromise(nouveauxCataloguesQuery, [orgId], req);

    const paniersResult = paniersResults[0];
    const commandesResult = commandesResults[0];
    const cataloguesResult = cataloguesResults[0];

    console.log("✅ Données récupérées avec succès");
    console.log("   - Paniers:", paniersResult?.nb_paniers || 0);
    console.log("   - Commandes:", commandesResult?.nb_commandes || 0);
    console.log("   - Catalogues:", cataloguesResult?.nb_catalogues || 0);

    res.render("index", {
      hideSidebar: false,
      stats: {
        paniers: paniersResult?.nb_paniers || 0,
        commandes: commandesResult?.nb_commandes || 0,
        catalogues: cataloguesResult?.nb_catalogues || 0
      },
      paniersDetails: paniersDetails || [],
      commandesDetails: commandesDetails || [],
      nouveauxCatalogues: nouveauxCatalogues || []
    });
    console.log("📄 Page index.ejs rendue avec succès");
  } catch (error) {
    console.error("❌ ERREUR lors du chargement des statistiques:", error);
    console.error("   Stack:", error.stack);

    try {
      res.render("index", {
        hideSidebar: false,
        stats: {
          paniers: 0,
          commandes: 0,
          catalogues: 0
        },
        paniersDetails: [],
        commandesDetails: [],
        nouveauxCatalogues: []
      });
    } catch (renderError) {
      console.error("❌ ERREUR lors du rendu de la page d'erreur:", renderError);
      next(error);
    }
  }
});

// GET /test-vue - Page de test Vue.js simple
router.get("/test-vue", requireLogin, (req, res) => {
  res.render("test_vue");
});

// GET /vue - Page d'accueil version Vue.js (bundle buildé)
router.get("/vue", requireLogin, (req, res) => {
  res.render("index_vue", {
    title: "COOPAZ",
    hideSidebar: false,
  });
});

// GET /vue-dev - Même page avec menu, mais app chargée depuis Vite (3200) pour HMR
router.get("/vue-dev", requireLogin, (req, res) => {
  renderAdminView(res, "vue_dev", {
    title: "COOPAZ",
    hideSidebar: false,
    hideSidebarInHeader: true, // sidebar inclus explicitement dans vue_dev.ejs
  });
});

// GET /session-temps-restant - Vérifier le temps restant de la session
router.get("/session-temps-restant", (req, res) => {
  if (!req.session || !req.session.cookie) {
    return res.send("Session introuvable.");
  }

  const expires = req.session.cookie._expires
    ? new Date(req.session.cookie._expires)
    : null;

  if (!expires) {
    return res.send("Session n'a pas de date d'expiration définie.");
  }

  const now = new Date();
  const diffMs = expires - now;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec <= 0) {
    return res.send("Session expirée ou expiration imminente.");
  }

  res.send(
    `Temps restant avant expiration de la session : ${diffSec} secondes`
  );
});

module.exports = router;
