const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/middleware");
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

// GET /api/home - Données pour la page d'accueil (API)
router.get("/home", requireLogin, async (req, res) => {
  const orgId = req.session?.organization_id;
  const userId = req.session?.userId;

  if (orgId == null || userId == null) {
    return res.status(400).json({
      success: false,
      error: "Session incomplète (organisation ou utilisateur manquant)",
    });
  }

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

    // Retourner les données en JSON
    res.json({
      success: true,
      user: {
        username: req.session.username,
        role: req.session.role
      },
      stats: {
        paniers: paniersResult?.nb_paniers || 0,
        commandes: commandesResult?.nb_commandes || 0,
        catalogues: cataloguesResult?.nb_catalogues || 0
      },
      paniersDetails: paniersDetails || [],
      commandesDetails: commandesDetails || [],
      nouveauxCatalogues: nouveauxCatalogues || []
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/home:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des données"
    });
  }
});

module.exports = router;
