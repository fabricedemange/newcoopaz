const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/rbac.middleware");
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

// GET /api/admin/catalogues - Liste des catalogues
router.get("/admin/catalogues", requirePermission("catalogues", { json: true }), async (req, res) => {
  const orgId = getCurrentOrgId(req);
  const role = getCurrentUserRole(req);
  const userId = getCurrentUserId(req);
  const isSuperAdmin = role === "SuperAdmin";
  const scopeToggleAvailable = !isSuperAdmin;

  // Gestion du scope
  const mineScopeActive = scopeToggleAvailable && req.query.scope === "referent";
  const showAllScope = !scopeToggleAvailable || !mineScopeActive;

  try {
    // DEBUG: Log des paramètres de filtrage
    console.log("🔍 DEBUG API /api/admin/catalogues:");
    console.log("  - role:", role);
    console.log("  - userId:", userId);
    console.log("  - orgId:", orgId);
    console.log("  - isSuperAdmin:", isSuperAdmin);
    console.log("  - scopeToggleAvailable:", scopeToggleAvailable);
    console.log("  - mineScopeActive:", mineScopeActive);
    console.log("  - showAllScope:", showAllScope);
    console.log("  - req.query.scope:", req.query.scope);

    // Requête pour les catalogues actifs (non archivés)
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
        ${!isSuperAdmin ? "AND c.organization_id = ?" : ""}
        ${scopeToggleAvailable && mineScopeActive ? "AND c.uploader_id = ?" : ""}
      ORDER BY c.expiration_date DESC
    `;

    // Requête pour les catalogues archivés
    const archivedCataloguesQuery = `
      SELECT
        c.*,
        u.username,
        o.name as organization_name,
        (SELECT COUNT(DISTINCT p.id) FROM paniers p WHERE p.catalog_file_id = c.id AND p.is_submitted = 1) as nb_paniers
      FROM catalog_files c
      JOIN users u ON c.uploader_id = u.id
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE c.is_archived = 3
        ${!isSuperAdmin ? "AND c.organization_id = ?" : ""}
        ${scopeToggleAvailable && mineScopeActive ? "AND c.uploader_id = ?" : ""}
      ORDER BY c.expiration_date DESC
    `;

    const params = [];
    if (!isSuperAdmin) {
      params.push(orgId);
    }
    if (scopeToggleAvailable && mineScopeActive) {
      params.push(userId);
    }

    console.log("  - params:", params);
    console.log("  - activeCataloguesQuery:", activeCataloguesQuery.trim());
    console.log("  - archivedCataloguesQuery:", archivedCataloguesQuery.trim());

    // Exécuter les deux requêtes en parallèle
    const [activeCatalogues, archivedCatalogues] = await Promise.all([
      queryPromise(activeCataloguesQuery, params, req),
      queryPromise(archivedCataloguesQuery, params, req)
    ]);

    console.log("  - activeCatalogues count:", activeCatalogues?.length || 0);
    console.log("  - archivedCatalogues count:", archivedCatalogues?.length || 0);

    // DEBUG: Vérifier nb_paniers
    if (activeCatalogues && activeCatalogues.length > 0) {
      console.log("  - DEBUG premier catalogue actif:", {
        id: activeCatalogues[0].id,
        originalname: activeCatalogues[0].originalname,
        nb_paniers: activeCatalogues[0].nb_paniers,
        nb_paniers_type: typeof activeCatalogues[0].nb_paniers
      });
    }

    // Fonction pour ajouter des informations calculées côté serveur
    const now = new Date();
    const addMetadata = (catalogues) => (catalogues || []).map(catalogue => {
      const expirationDate = catalogue.expiration_date ? new Date(catalogue.expiration_date) : null;
      const livraisonDate = catalogue.date_livraison ? new Date(catalogue.date_livraison) : null;

      // Calcul des métadonnées
      const isExpired = expirationDate ? expirationDate < now : false;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const showPrevoirCommande = expirationDate
        ? ((now - expirationDate) >= ONE_DAY_MS && (now - expirationDate) <= THREE_DAYS_MS)
        : false;

      // Formatage des dates
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        return d.toLocaleDateString('fr-FR');
      };

      const getDayName = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        return dayNames[d.getDay()];
      };

      return {
        ...catalogue,
        isExpired,
        showPrevoirCommande,
        expiration_formatted: formatDate(catalogue.expiration_date),
        expiration_day: getDayName(catalogue.expiration_date),
        livraison_formatted: formatDate(catalogue.date_livraison),
        livraison_day: getDayName(catalogue.date_livraison),
      };
    });

    const activeCataloguesWithMeta = addMetadata(activeCatalogues);
    const archivedCataloguesWithMeta = addMetadata(archivedCatalogues);

    // DEBUG: Vérifier nb_paniers après addMetadata
    if (activeCataloguesWithMeta && activeCataloguesWithMeta.length > 0) {
      console.log("  - DEBUG premier catalogue APRÈS addMetadata:", {
        id: activeCataloguesWithMeta[0].id,
        originalname: activeCataloguesWithMeta[0].originalname,
        nb_paniers: activeCataloguesWithMeta[0].nb_paniers,
        nb_paniers_type: typeof activeCataloguesWithMeta[0].nb_paniers
      });
    }

    res.json({
      success: true,
      catalogues: activeCataloguesWithMeta,
      archivedCatalogues: archivedCataloguesWithMeta,
      referentScopeActive: scopeToggleAvailable,
      showAllScope,
      role,
      organization_id: orgId
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/admin/catalogues:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des catalogues"
    });
  }
});

// GET /api/admin/catalogues/:id/synthese - Synthèse simple d'un catalogue
router.get("/admin/catalogues/:id/synthese", requirePermission("catalogues", { json: true }), async (req, res) => {
  const catalogueId = req.params.id;

  try {
    // Récupérer les informations du catalogue et de l'organisation
    const [catalogueInfo] = await queryPromise(
      `SELECT c.originalname, o.name AS organization_name, o.email AS organization_email
       FROM catalog_files c
       LEFT JOIN organizations o ON c.organization_id = o.id
       WHERE c.id = ?`,
      [catalogueId],
      req
    );

    if (!catalogueInfo) {
      return res.status(404).json({ success: false, error: "Catalogue non trouvé" });
    }

    // Récupérer les données de synthèse
    const synthese = await queryPromise(
      `SELECT prod.nom as produit, prod.description, cp.prix,
              COALESCE(NULLIF(pan.note, ''), '') AS note,
              COALESCE(NULLIF(pa.note, ''), '') AS note_article,
              SUM(pa.quantity) AS total_commande,
              cat.nom as categorie,
              cat.couleur as categorie_couleur
       FROM catalog_products cp
       INNER JOIN products prod ON cp.product_id = prod.id
       LEFT JOIN categories cat ON prod.category_id = cat.id
       JOIN panier_articles pa ON pa.catalog_product_id = cp.id
       JOIN paniers pan ON pa.panier_id = pan.id
       WHERE cp.catalog_file_id = ? AND pan.is_submitted = 1
       GROUP BY cp.id, note, note_article
       ORDER BY cat.ordre, prod.nom`,
      [catalogueId],
      req
    );

    res.json({
      success: true,
      catalogueId,
      catalogueName: catalogueInfo.originalname || '',
      organizationName: catalogueInfo.organization_name || '',
      organizationEmail: catalogueInfo.organization_email || '',
      synthese
    });
  } catch (error) {
    console.error("❌ ERREUR API synthèse:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement de la synthèse"
    });
  }
});

// GET /api/admin/catalogues/:id/synthese-detaillee - Synthèse détaillée d'un catalogue
router.get("/admin/catalogues/:id/synthese-detaillee", requirePermission("catalogues", { json: true }), async (req, res) => {
  const catalogueId = req.params.id;

  try {
    // Récupérer les informations du catalogue et de l'organisation
    const [catalogueInfo] = await queryPromise(
      `SELECT c.originalname, o.name AS organization_name, o.email AS organization_email
       FROM catalog_files c
       LEFT JOIN organizations o ON c.organization_id = o.id
       WHERE c.id = ?`,
      [catalogueId],
      req
    );

    if (!catalogueInfo) {
      return res.status(404).json({ success: false, error: "Catalogue non trouvé" });
    }

    // Récupérer les données détaillées
    const details = await queryPromise(
      `SELECT
        CONCAT(u.username, ' (panier N°', pan.id, ')') as username2,
        prod.nom as produit,
        prod.description,
        cp.prix,
        SUM(pa.quantity) as quantite,
        ROUND(SUM(pa.quantity * cp.prix), 2) as montant_utilisateur,
        pan.note, pa.note as note_article,
        cat.nom as categorie
       FROM paniers pan
       JOIN panier_articles pa ON pa.panier_id = pan.id
       JOIN catalog_products cp ON pa.catalog_product_id = cp.id
       JOIN products prod ON cp.product_id = prod.id
       LEFT JOIN categories cat ON prod.category_id = cat.id
       JOIN users u ON pan.user_id = u.id
       WHERE cp.catalog_file_id = ? and pan.is_submitted = 1
       GROUP BY u.id, cp.id, pan.id
       ORDER BY username2 ASC, cat.ordre, prod.nom ASC`,
      [catalogueId],
      req
    );

    res.json({
      success: true,
      catalogueId,
      catalogueName: catalogueInfo.originalname || '',
      organizationName: catalogueInfo.organization_name || '',
      organizationEmail: catalogueInfo.organization_email || '',
      details
    });
  } catch (error) {
    console.error("❌ ERREUR API synthèse détaillée:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement de la synthèse détaillée"
    });
  }
});

module.exports = router;
