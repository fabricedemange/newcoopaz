const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/middleware");
const { requireAnyPermission } = require("../middleware/rbac.middleware");
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

// GET /api/panier/:id - Détail d'un panier avec ses articles
router.get("/panier/:id", requireLogin, async (req, res) => {
  const panierId = req.params.id;
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  try {
    // Vérifier que l'utilisateur a accès à ce panier
    const accessCheckQuery = `
      SELECT * FROM paniers
      WHERE id = ? AND (user_id = ? OR ? IN (SELECT id FROM users WHERE role <> 'utilisateur'))
    `;
    const accessResults = await queryPromise(accessCheckQuery, [panierId, userId, userId], req);

    if (!accessResults || accessResults.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès interdit à ce panier"
      });
    }

    // Récupérer les infos du panier
    const panierQuery = `
      SELECT
        p.*,
        u.username,
        cf.originalname as catalogue_nom,
        cf.expiration_date,
        cf.date_livraison,
        DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(cf.date_livraison, '%d/%m/%Y') as livraison_formatted
      FROM paniers p
      JOIN users u ON p.user_id = u.id
      JOIN catalog_files cf ON p.catalog_file_id = cf.id
      WHERE p.id = ? AND p.is_submitted = 0
    `;
    const panierResults = await queryPromise(panierQuery, [panierId], req);

    if (!panierResults || panierResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Panier non trouvé ou déjà soumis"
      });
    }

    const panier = panierResults[0];

    // Récupérer tous les produits du catalogue
    const catalogProductsQuery = `
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
    const allProducts = await queryPromise(catalogProductsQuery, [panier.catalog_file_id], req);

    // Récupérer les articles du panier
    const panierArticlesQuery = `
      SELECT
        pa.id,
        pa.catalog_product_id,
        pa.quantity,
        pa.note
      FROM panier_articles pa
      WHERE pa.panier_id = ?
    `;
    const panierArticlesResults = await queryPromise(panierArticlesQuery, [panierId], req);

    // Construire un objet avec les quantités et notes par catalog_product_id
    const panierArticlesMap = {};
    panierArticlesResults.forEach(article => {
      panierArticlesMap[article.catalog_product_id] = {
        id: article.id,
        quantity: article.quantity,
        note: article.note
      };
    });

    // Trier les produits : d'abord ceux dans le panier (quantity > 0), puis les autres
    const sortedProducts = allProducts.sort((a, b) => {
      const qtyA = panierArticlesMap[a.id]?.quantity || 0;
      const qtyB = panierArticlesMap[b.id]?.quantity || 0;

      // Si l'un est dans le panier et l'autre non
      if (qtyA > 0 && qtyB === 0) return -1;
      if (qtyA === 0 && qtyB > 0) return 1;

      // Sinon trier par catégorie puis nom
      if (a.categorie_ordre !== b.categorie_ordre) {
        return a.categorie_ordre - b.categorie_ordre;
      }
      return a.produit.localeCompare(b.produit);
    });

    // Vérifier si le catalogue est expiré
    const today = new Date();
    const hier = new Date(today);
    hier.setDate(today.getDate() - 1);
    const isExpired = panier.expiration_date && new Date(panier.expiration_date) < hier;

    // Déterminer si modifiable
    const isAdminRole = ["admin", "referent", "epicier", "SuperAdmin"].includes(userRole);
    const modifiable = isAdminRole || !isExpired;

    // Peut changer le propriétaire (RBAC: paniers.admin ou paniers.change_owner, ex. rôle referent)
    const canChangeOwner = await hasAnyPermission(req, ["paniers.admin", "paniers.change_owner"]);

    // Créer un tableau d'articles enrichis avec les infos produit
    const articlesEnrichis = sortedProducts.map(product => {
      const panierData = panierArticlesMap[product.id];
      return {
        id: panierData?.id || null,
        catalog_product_id: product.id,
        quantity: panierData?.quantity || 0,
        note: panierData?.note || null,
        prix: product.prix,
        unite: product.unite,
        produit: product.produit,
        description: product.description,
        image_filename: product.image_filename,
        categorie: product.categorie,
        categorie_couleur: product.categorie_couleur,
        categorie_ordre: product.categorie_ordre
      };
    });

    res.json({
      success: true,
      panier: {
        id: panier.id,
        user_id: panier.user_id,
        username: panier.username,
        catalog_file_id: panier.catalog_file_id,
        catalogue_nom: panier.catalogue_nom,
        note: panier.note,
        expiration_date: panier.expiration_date,
        date_livraison: panier.date_livraison,
        expiration_formatted: panier.expiration_formatted,
        livraison_formatted: panier.livraison_formatted,
        isExpired,
        modifiable,
        canChangeOwner
      },
      articles: articlesEnrichis,
      allProducts: sortedProducts,
      panierArticlesMap: panierArticlesMap
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/panier/:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement du panier"
    });
  }
});

// GET /api/paniers - Liste des paniers de l'utilisateur (non soumis)
router.get("/paniers", requireLogin, async (req, res) => {
  const userId = req.session?.userId;

  console.log(`📋 Chargement paniers pour user ${userId}`);

  try {
    const paniersQuery = `
      SELECT
        p.id,
        p.user_id,
        p.catalog_file_id,
        p.is_submitted,
        p.created_at,
        p.note as panier_note,
        cf.expiration_date,
        cf.date_livraison,
        cf.originalname as catalogue_nom,
        cf.description as catalog_description,
        cf.is_archived,
        DATE_FORMAT(p.created_at, '%d/%m/%Y à %H:%i') as created_formatted,
        DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(cf.date_livraison, '%d/%m/%Y') as livraison_formatted,
        (SELECT COUNT(*) FROM panier_articles WHERE panier_id = p.id) as nb_articles,
        (SELECT SUM(pa.quantity * cp.prix)
         FROM panier_articles pa
         INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
         WHERE pa.panier_id = p.id) as total,
        (SELECT GROUP_CONCAT(pa.note SEPARATOR ' ')
         FROM panier_articles pa
         WHERE pa.panier_id = p.id AND pa.note IS NOT NULL) as articles_notes
      FROM paniers p
      JOIN catalog_files cf ON p.catalog_file_id = cf.id
      WHERE p.user_id = ? AND p.is_submitted = 0
      ORDER BY p.created_at DESC
    `;

    let paniers = await queryPromise(paniersQuery, [userId], req);
    console.log(`✅ Paniers trouvés:`, paniers?.length || 0);

    // Supprimer en base les paniers sans aucun article avant l'affichage
    const emptyPanierIds = (paniers || []).filter(p => Number(p.nb_articles) === 0).map(p => p.id);
    if (emptyPanierIds.length > 0) {
      const placeholders = emptyPanierIds.map(() => "?").join(",");
      await queryPromise(
        `DELETE FROM paniers WHERE id IN (${placeholders}) AND user_id = ? AND is_submitted = 0`,
        [...emptyPanierIds, userId],
        req
      );
      paniers = (paniers || []).filter(p => Number(p.nb_articles) > 0);
    }

    // Calculer si chaque panier est modifiable
    const today = new Date();
    const hier = new Date(today);
    hier.setDate(today.getDate() - 1);

    const paniersWithModifiable = (paniers || []).map(p => ({
      ...p,
      modifiable: p.expiration_date && new Date(p.expiration_date) >= hier && !p.is_archived,
      isExpired: p.expiration_date && new Date(p.expiration_date) < hier
    }));

    res.json({
      success: true,
      paniers: paniersWithModifiable
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/paniers:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des paniers"
    });
  }
});

// GET /api/users - Liste des utilisateurs (pour changement de propriétaire)
router.get("/users", requireLogin, requireAnyPermission(["paniers.admin", "paniers.change_owner"], { json: true }), async (req, res) => {
  try {
    const usersQuery = `
      SELECT id, username, email
      FROM users
      WHERE is_validated = 1
      ORDER BY username
    `;
    const users = await queryPromise(usersQuery, [], req);

    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/users:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des utilisateurs"
    });
  }
});

// POST /api/panier/:id/change-owner - Changer le propriétaire d'un panier (RBAC: paniers.admin ou paniers.change_owner, ex. rôle referent)
router.post("/panier/:id/change-owner", requireLogin, requireAnyPermission(["paniers.admin", "paniers.change_owner"], { json: true }), async (req, res) => {
  const panierId = req.params.id;
  const newUserId = req.body.user_id;

  try {
    // Vérifier que le panier existe
    const panierQuery = `SELECT id FROM paniers WHERE id = ?`;
    const panierResults = await queryPromise(panierQuery, [panierId], req);

    if (!panierResults || panierResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Panier non trouvé"
      });
    }

    // Mettre à jour le propriétaire
    const updateQuery = `UPDATE paniers SET user_id = ? WHERE id = ?`;
    await queryPromise(updateQuery, [newUserId, panierId], req);

    res.json({
      success: true,
      message: "Propriétaire changé avec succès"
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/panier/:id/change-owner:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du changement de propriétaire"
    });
  }
});

// POST /api/panier/:id/note - Modifier la note d'un panier
router.post("/panier/:id/note", requireLogin, async (req, res) => {
  const panierId = req.params.id;
  const { note } = req.body;
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  try {
    // Vérifier que l'utilisateur a accès à ce panier
    const accessCheckQuery = `
      SELECT * FROM paniers
      WHERE id = ? AND (user_id = ? OR ? IN (SELECT id FROM users WHERE role <> 'utilisateur'))
    `;
    const accessResults = await queryPromise(accessCheckQuery, [panierId, userId, userId], req);

    if (!accessResults || accessResults.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès interdit à ce panier"
      });
    }

    // Mettre à jour la note
    const updateQuery = `UPDATE paniers SET note = ? WHERE id = ?`;
    await queryPromise(updateQuery, [note, panierId], req);

    res.json({
      success: true,
      message: "Note mise à jour avec succès"
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/panier/:id/note:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour de la note"
    });
  }
});

// DELETE /api/panier/:id - Supprimer un panier vide
router.delete("/panier/:id", requireLogin, async (req, res) => {
  const panierId = req.params.id;
  const userId = req.session?.userId;

  try {
    // Vérifier que l'utilisateur a accès à ce panier
    const accessCheckQuery = `
      SELECT * FROM paniers
      WHERE id = ? AND (user_id = ? OR ? IN (SELECT id FROM users WHERE role <> 'utilisateur'))
    `;
    const accessResults = await queryPromise(accessCheckQuery, [panierId, userId, userId], req);

    if (!accessResults || accessResults.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès interdit à ce panier"
      });
    }

    // Supprimer le panier
    const deleteQuery = `DELETE FROM paniers WHERE id = ?`;
    await queryPromise(deleteQuery, [panierId], req);

    res.json({
      success: true,
      message: "Panier supprimé avec succès"
    });
  } catch (error) {
    console.error("❌ ERREUR API DELETE /api/panier/:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression du panier"
    });
  }
});

module.exports = router;
