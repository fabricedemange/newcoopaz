const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middleware/middleware");
const { queryWithUser } = require("../config/db-trace-wrapper");
const { getCurrentUserId } = require("../utils/session-helpers");

// Convertir queryWithUser en promesse
const queryPromise = (sql, params, req) => {
  return new Promise((resolve, reject) => {
    queryWithUser(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    }, req);
  });
};

// GET /api/commandes - Liste des commandes de l'utilisateur
router.get("/commandes", requireLogin, async (req, res) => {
  const userId = req.session?.userId;

  try {
    const commandesQuery = `
      SELECT
        p.*,
        cf.expiration_date,
        cf.date_livraison,
        cf.originalname,
        cf.description as catalog_description,
        cf.is_archived,
        cf.id as catalog_filesID,
        DATE_FORMAT(p.created_at, '%d/%m/%Y à %H:%i') as created_formatted,
        DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(cf.date_livraison, '%d/%m/%Y') as livraison_formatted,
        (SELECT COUNT(DISTINCT pa.catalog_product_id)
         FROM panier_articles pa
         WHERE pa.panier_id = p.id AND pa.quantity > 0) as nb_produits,
        (SELECT COALESCE(SUM(pa.quantity * cp.prix * COALESCE(cp.unite, 1)), 0)
         FROM panier_articles pa
         INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
         WHERE pa.panier_id = p.id) as montant_total
      FROM paniers p
      JOIN catalog_files cf ON p.catalog_file_id = cf.id
      WHERE p.user_id = ? AND p.is_submitted = 1
      ORDER BY p.created_at DESC
    `;

    const commandes = await queryPromise(commandesQuery, [userId], req);

    // Calculer si chaque commande est modifiable
    const today = new Date();
    const hier = new Date(today);
    hier.setDate(today.getDate() - 1);

    const commandesWithModifiable = (commandes || []).map(c => ({
      ...c,
      modifiable: c.expiration_date && new Date(c.expiration_date) >= hier && !c.is_archived,
      isExpired: c.expiration_date && new Date(c.expiration_date) < hier
    }));

    res.json({
      success: true,
      commandes: commandesWithModifiable
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/commandes:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des commandes"
    });
  }
});

// GET /api/commandes/caisse - Liste des achats en caisse de l'utilisateur
router.get("/commandes/caisse", requireLogin, async (req, res) => {
  const userId = req.session?.userId;

  try {
    const ventesQuery = `
      SELECT
        v.id,
        v.numero_ticket,
        v.adherent_id,
        v.nom_client,
        v.montant_ttc,
        v.statut,
        v.source,
        v.created_at,
        v.created_by,
        DATE_FORMAT(v.created_at, '%d/%m/%Y à %H:%i') as created_formatted,
        (SELECT COUNT(*)
         FROM lignes_vente lv
         WHERE lv.vente_id = v.id) as nb_produits,
        (SELECT GROUP_CONCAT(CONCAT(lv.quantite, 'x ', lv.nom_produit) SEPARATOR ', ')
         FROM lignes_vente lv
         WHERE lv.vente_id = v.id
         LIMIT 3) as produits_preview,
        mp.nom as mode_paiement
      FROM ventes v
      LEFT JOIN paiements p ON p.vente_id = v.id
      LEFT JOIN modes_paiement mp ON p.mode_paiement_id = mp.id
      WHERE v.source = 'caisse'
        AND v.statut = 'complete'
        AND (v.adherent_id = ? OR v.created_by = ?)
      ORDER BY v.created_at DESC
    `;

    const ventes = await queryPromise(ventesQuery, [userId, userId], req);

    res.json({
      success: true,
      ventes: ventes || []
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/commandes/caisse:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des achats en caisse"
    });
  }
});

// GET /api/commandes/:id - Détail d'une commande
router.get("/commandes/:id", requireLogin, async (req, res) => {
  const userId = req.session?.userId;
  const commandeId = req.params.id;

  console.log(`📋 Chargement commande ${commandeId} pour user ${userId}`);

  try {
    // Récupérer la commande
    const commandeQuery = `
      SELECT
        p.*,
        u.username,
        cf.expiration_date,
        cf.date_livraison,
        cf.originalname,
        cf.description as catalog_description,
        cf.is_archived,
        cf.id as catalog_file_id,
        DATE_FORMAT(p.created_at, '%d/%m/%Y à %H:%i') as created_formatted,
        DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') as expiration_formatted,
        DATE_FORMAT(cf.date_livraison, '%d/%m/%Y') as livraison_formatted
      FROM paniers p
      JOIN catalog_files cf ON p.catalog_file_id = cf.id
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.user_id = ? AND p.is_submitted = 1
    `;

    const commandes = await queryPromise(commandeQuery, [commandeId, userId], req);
    console.log(`✅ Commandes trouvées:`, commandes?.length || 0);

    if (!commandes || commandes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Commande non trouvée"
      });
    }

    const commande = commandes[0];

    // Calculer si la commande est modifiable
    const today = new Date();
    const hier = new Date(today);
    hier.setDate(today.getDate() - 1);

    commande.modifiable = commande.expiration_date && new Date(commande.expiration_date) >= hier && !commande.is_archived;
    commande.isExpired = commande.expiration_date && new Date(commande.expiration_date) < hier;

    // Récupérer les articles de la commande
    const articlesQuery = `
      SELECT
        pa.id,
        pa.catalog_product_id,
        pa.quantity,
        pa.note,
        cp.prix,
        cp.unite,
        p.nom as produit,
        p.description,
        p.image_filename,
        c.nom as categorie,
        c.couleur as categorie_couleur,
        c.ordre as categorie_ordre,
        s.nom as fournisseur
      FROM panier_articles pa
      INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
      INNER JOIN products p ON cp.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE pa.panier_id = ?
      ORDER BY c.ordre, p.nom
    `;

    const articles = await queryPromise(articlesQuery, [commandeId], req);
    console.log(`✅ Articles trouvés:`, articles?.length || 0);

    res.json({
      success: true,
      commande: commande,
      articles: articles || []
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/commandes/:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement de la commande"
    });
  }
});

// POST /api/commandes/:id/note - Modifier la note d'une commande
router.post("/commandes/:id/note", requireLogin, async (req, res) => {
  const commandeId = req.params.id;
  const { note } = req.body;
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  try {
    // Vérifier que la commande existe
    const commandeQuery = `SELECT * FROM paniers WHERE id = ?`;
    const commandes = await queryPromise(commandeQuery, [commandeId], req);

    if (!commandes || commandes.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Commande non trouvée"
      });
    }

    const commande = commandes[0];

    // Vérifier les droits d'accès
    if (
      commande.user_id !== userId &&
      !["admin", "epicier", "referent", "SuperAdmin"].includes(userRole)
    ) {
      return res.status(403).json({
        success: false,
        error: "Non autorisé"
      });
    }

    // Mettre à jour la note
    const updateQuery = `UPDATE paniers SET note = ? WHERE id = ?`;
    await queryPromise(updateQuery, [note, commandeId], req);

    res.json({
      success: true,
      message: "Note mise à jour avec succès"
    });
  } catch (error) {
    console.error("❌ ERREUR API /api/commandes/:id/note:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour de la note"
    });
  }
});

// Helper pour récupérer les détails de la vente
async function getVenteDetails(venteId, orgId, db) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        v.*,
        u.username as caissier_nom,
        u2.username as nom_client
      FROM ventes v
      LEFT JOIN users u ON v.created_by = u.id
      LEFT JOIN users u2 ON v.adherent_id = u2.id
      WHERE v.id = ? AND v.organization_id = ?
    `;

    db.query(query, [venteId, orgId], async (err, ventes) => {
      if (err) return reject(err);
      if (ventes.length === 0) return resolve(null);

      const vente = ventes[0];

      // Récupérer les lignes
      const lignesQuery = `
        SELECT * FROM lignes_vente
        WHERE vente_id = ?
        ORDER BY id
      `;

      db.query(lignesQuery, [venteId], (err, lignes) => {
        if (err) return reject(err);

        // Récupérer les paiements
        const paiementsQuery = `
          SELECT p.*, mp.nom as mode_paiement_nom
          FROM paiements p
          LEFT JOIN modes_paiement mp ON p.mode_paiement_id = mp.id
          WHERE p.vente_id = ?
        `;

        db.query(paiementsQuery, [venteId], (err, paiements) => {
          if (err) return reject(err);

          resolve({
            vente,
            lignes: lignes.map(l => ({
              ...l,
              is_avoir: l.produit_id === null
            })),
            paiements
          });
        });
      });
    });
  });
}

// Helper pour récupérer l'email de l'utilisateur
async function getUserEmail(userId, db) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT email FROM users WHERE id = ?',
      [userId],
      (err, results) => {
        if (err) return reject(err);
        if (results.length === 0) return reject(new Error('Utilisateur non trouvé'));
        resolve(results[0].email);
      }
    );
  });
}

// GET /api/commandes/:id/send-pdf - Envoyer le ticket par email en PDF
router.get("/:id/send-pdf", requireLogin, async (req, res) => {
  const venteId = parseInt(req.params.id);
  const userId = getCurrentUserId(req);
  const orgId = req.session?.organizationId;
  const { db } = require('../config/config');
  const { generateTicketPdf } = require('../utils/ticket-pdf');
  const { envoimail } = require('../utils/exports');

  try {
    // 1. Récupérer les détails de la vente
    const venteDetails = await getVenteDetails(venteId, orgId, db);

    if (!venteDetails) {
      return res.status(404).json({ success: false, error: 'Vente non trouvée' });
    }

    // Vérifier que la vente appartient à l'utilisateur connecté
    if (venteDetails.vente.adherent_id !== userId) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // 2. Générer le PDF du ticket
    const pdfBuffer = await generateTicketPdf(venteDetails);

    // 3. Récupérer l'email de l'utilisateur
    const userEmail = await getUserEmail(userId, db);

    // 4. Envoyer l'email avec le PDF
    const subject = `Ticket de caisse n°${venteDetails.vente.numero_ticket}`;
    const text = `Bonjour,\n\nVeuillez trouver ci-joint votre ticket de caisse.\n\nMontant total: ${parseFloat(venteDetails.vente.montant_ttc).toFixed(2)}€`;

    await envoimail(
      userEmail,
      subject,
      text,
      pdfBuffer,
      { initiatedBy: req.session?.username || 'system' }
    );

    res.json({ success: true, message: 'Email envoyé avec succès' });

  } catch (error) {
    console.error('Erreur envoi PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
