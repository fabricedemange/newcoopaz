const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/middleware");
const { hasAnyPermission } = require("../middleware/rbac.middleware");
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

// GET /api/catalogues - Liste des catalogues actifs
router.get("/catalogues", requireLogin, async (req, res) => {
  const orgId = req.session?.organization_id;

  try {
    const cataloguesQuery = `
      SELECT
        c.*,
        u.username,
        COUNT(CASE WHEN p.is_submitted = 0 THEN p.id END) AS nb_paniers_non_submis,
        COUNT(CASE WHEN p.is_submitted = 1 THEN p.id END) AS nb_paniers_submis,
        DATE_FORMAT(c.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(c.date_livraison, '%d/%m/%Y') as livraison_formatted,
        DATE_FORMAT(c.upload_date, '%d/%m/%Y à %H:%i') as upload_formatted
      FROM catalog_files c
      JOIN users u ON c.uploader_id = u.id
      LEFT JOIN paniers p ON p.catalog_file_id = c.id
      WHERE c.is_archived = 0 AND c.organization_id = ?
      GROUP BY c.id
      ORDER BY c.expiration_date ASC
    `;

    const catalogues = await queryPromise(cataloguesQuery, [orgId], req);

    res.json({
      success: true,
      catalogues: catalogues || []
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/catalogues:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des catalogues"
    });
  }
});

// GET /api/catalogues/:id/produits-commandes-recentes - Produits commandés par l'utilisateur (60 j), tous catalogues, mappés au catalogue courant
router.get("/catalogues/:id/produits-commandes-recentes", requireLogin, async (req, res) => {
  const catalogueId = req.params.id;
  const orgId = req.session?.organization_id;
  const userId = req.session?.userId;

  try {
    const checkCatalogueQuery = `
      SELECT id FROM catalog_files WHERE id = ? AND is_archived = 0 AND organization_id = ?
    `;
    const catalogCheck = await queryPromise(checkCatalogueQuery, [catalogueId, orgId], req);
    if (!catalogCheck || catalogCheck.length === 0) {
      return res.status(404).json({ success: false, error: "Catalogue non trouvé" });
    }

    // 1) Produits (product_id) commandés récemment par l'utilisateur, tous catalogues confondus
    const recentProductIdsQuery = `
      SELECT DISTINCT cp.product_id
      FROM panier_articles pa
      INNER JOIN paniers p ON pa.panier_id = p.id
      INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
      WHERE p.user_id = ?
        AND p.is_submitted = 1
        AND p.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
        AND pa.quantity > 0
    `;
    const productRows = await queryPromise(recentProductIdsQuery, [userId], req);
    const productIds = (productRows || []).map((r) => r.product_id).filter((id) => id != null);
    if (productIds.length === 0) {
      return res.json({ success: true, catalog_product_ids: [] });
    }

    // 2) catalog_product_id du catalogue courant pour ces product_id
    const placeholders = productIds.map(() => "?").join(",");
    const mapQuery = `
      SELECT id FROM catalog_products
      WHERE catalog_file_id = ? AND product_id IN (${placeholders})
    `;
    const mapRows = await queryPromise(mapQuery, [catalogueId, ...productIds], req);
    const catalog_product_ids = (mapRows || []).map((r) => r.id).filter((id) => id != null);

    res.json({ success: true, catalog_product_ids });
  } catch (error) {
    console.error("❌ ERREUR API /api/catalogues/:id/produits-commandes-recentes:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des produits commandés récemment"
    });
  }
});

// GET /api/catalogues/:id - Détail d'un catalogue avec ses produits
router.get("/catalogues/:id", requireLogin, async (req, res) => {
  const catalogueId = req.params.id;
  const orgId = req.session?.organization_id;
  const userId = req.session?.userId;
  const nouveauPanier = req.query.nouveau === '1';

  try {
    // Récupérer les infos du catalogue avec référent (uploader)
    const catalogueQuery = `
      SELECT c.*, u.username AS referent_username
      FROM catalog_files c
      LEFT JOIN users u ON c.uploader_id = u.id
      WHERE c.id = ? AND c.is_archived = 0 AND c.organization_id = ?
    `;
    const catalogueResults = await queryPromise(catalogueQuery, [catalogueId, orgId], req);

    if (!catalogueResults || catalogueResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Catalogue non trouvé"
      });
    }

    const catalogue = catalogueResults[0];

    // Récupérer les produits du catalogue
    const productsQuery = `
      SELECT
        cp.id,
        cp.catalog_file_id,
        cp.product_id,
        cp.prix,
        COALESCE(cp.unite, 1) as unite,
        p.nom as produit,
        p.description,
        p.image_filename,
        p.category_id,
        c.nom as categorie,
        c.couleur as categorie_couleur,
        c.ordre as categorie_ordre
      FROM catalog_products cp
      INNER JOIN products p ON cp.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE cp.catalog_file_id = ?
      ORDER BY c.ordre, p.nom
    `;
    const products = await queryPromise(productsQuery, [catalogueId], req);

    // Si nouveau=1, ne pas récupérer de panier existant (forcer un nouveau panier vide)
    let panier = null;
    let panierArticles = {};

    if (!nouveauPanier) {
      // Récupérer le panier de l'utilisateur pour ce catalogue (si existe), avec username du propriétaire
      const panierQuery = `
        SELECT p.*, u.username
        FROM paniers p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ? AND p.catalog_file_id = ? AND p.is_submitted = 0
        ORDER BY p.created_at DESC
        LIMIT 1
      `;
      const panierResults = await queryPromise(panierQuery, [userId, catalogueId], req);
      panier = panierResults && panierResults.length > 0 ? panierResults[0] : null;

      // Si un panier existe, récupérer ses articles
      if (panier) {
      const panierArticlesQuery = `
        SELECT id, catalog_product_id, quantity, note
        FROM panier_articles
        WHERE panier_id = ?
      `;
      const articlesResults = await queryPromise(panierArticlesQuery, [panier.id], req);

        articlesResults.forEach(row => {
          panierArticles[row.catalog_product_id] = {
            id: row.id,
            quantity: row.quantity,
            note: row.note
          };
        });
      }
    }

    // Vérifier si le catalogue est expiré
    const today = new Date();
    const hier = new Date(today);
    hier.setDate(today.getDate() - 1);
    const isExpired = catalogue.expiration_date && new Date(catalogue.expiration_date) < hier;

    // Déterminer si modifiable
    const canAdminPaniers = await hasAnyPermission(req, ["paniers.admin", "paniers.change_owner"]);
    const modifiable = canAdminPaniers || !isExpired;

    // Changement de propriétaire : pour ceux autorisés (paniers.admin / paniers.change_owner), dès la première fois
    let canChangeOwner = false;
    let users = [];
    canChangeOwner = await hasAnyPermission(req, ["paniers.admin", "paniers.change_owner"]);
    if (canChangeOwner) {
      const usersQuery = `
        SELECT id, username, email
        FROM users
        WHERE is_validated = 1
        ORDER BY username
      `;
      users = await queryPromise(usersQuery, [], req) || [];
    }

    res.json({
      success: true,
      catalogue: {
        ...catalogue,
        expiration_formatted: catalogue.expiration_date ?
          new Date(catalogue.expiration_date).toLocaleDateString('fr-FR') : null,
        livraison_formatted: catalogue.date_livraison ?
          new Date(catalogue.date_livraison).toLocaleDateString('fr-FR') : null,
        isExpired,
        modifiable
      },
      products: products || [],
      panier: panier || null,
      panierArticles: panierArticles,
      canChangeOwner: canChangeOwner,
      users: users
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/catalogues/:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement du catalogue"
    });
  }
});

module.exports = router;
