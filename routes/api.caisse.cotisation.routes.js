/**
 * API: Vérification cotisation mensuelle (5-15 €) en caisse
 * Une fois par mois, l'utilisateur doit s'acquitter d'une cotisation lors d'un passage.
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { requireLogin } = require("../middleware/middleware");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");

/**
 * GET /api/caisse/cotisation/check?adherent_id=
 * Retourne si l'adhérent doit payer la cotisation du mois courant.
 * Si adherent_id est vide/null, doit_cotiser = false (client anonyme).
 */
router.get("/check", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const adherentId = req.query.adherent_id ? parseInt(req.query.adherent_id, 10) : null;
  const orgId = getCurrentOrgId(req);

  if (!adherentId) {
    return res.json({
      success: true,
      doit_cotiser: false,
      mois_courant: null,
      message: "Client non identifié : pas de cotisation requise",
    });
  }

  // Détection cotisation sans exiger la colonne is_cotisation (compatible avant migration)
    const sql = `
    SELECT 1
    FROM ventes v
    INNER JOIN lignes_vente l ON l.vente_id = v.id
    WHERE v.adherent_id = ?
      AND v.organization_id = ?
      AND v.statut = 'complete'
      AND l.produit_id IS NULL
      AND l.nom_produit LIKE 'Cotisation mensuelle%'
      AND YEAR(v.created_at) = YEAR(CURDATE())
      AND MONTH(v.created_at) = MONTH(CURDATE())
    LIMIT 1
  `;

  db.query(sql, [adherentId, orgId], (err, rows) => {
    if (err) {
      console.error("Erreur check cotisation:", err);
      return res.status(500).json({
        success: false,
        error: err.message,
        doit_cotiser: false,
      });
    }
    const aDejaPaye = Array.isArray(rows) && rows.length > 0;
    const now = new Date();
    const moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    res.json({
      success: true,
      doit_cotiser: !aDejaPaye,
      mois_courant: moisCourant,
      message: aDejaPaye
        ? "Cotisation du mois déjà réglée"
        : "Cotisation mensuelle (5-15 €) à ajouter pour ce mois",
    });
  });
});

/**
 * GET /api/caisse/cotisation/mon-historique
 * Historique des cotisations de l'utilisateur connecté (pour la page "Mon historique de cotisation").
 * Query: date_debut (YYYY-MM-DD), date_fin (YYYY-MM-DD), limit (défaut 200)
 */
router.get("/mon-historique", requireLogin, (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Non authentifié" });
  }
  const orgId = getCurrentOrgId(req);
  const dateDebut = req.query.date_debut || null;
  const dateFin = req.query.date_fin || null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

  let sql = `
    SELECT
      v.id AS vente_id,
      v.numero_ticket,
      v.nom_client,
      v.created_at AS date_cotisation,
      l.montant_ttc AS montant_cotisation
    FROM ventes v
    INNER JOIN lignes_vente l ON l.vente_id = v.id
    WHERE v.organization_id = ?
      AND v.adherent_id = ?
      AND v.statut = 'complete'
      AND l.produit_id IS NULL
      AND l.nom_produit LIKE 'Cotisation mensuelle%'
  `;
  const params = [orgId, userId];

  if (dateDebut) {
    sql += " AND DATE(v.created_at) >= ?";
    params.push(dateDebut);
  }
  if (dateFin) {
    sql += " AND DATE(v.created_at) <= ?";
    params.push(dateFin);
  }

  sql += " ORDER BY v.created_at DESC LIMIT ?";
  params.push(limit);

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Erreur mon-historique cotisations:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    const cotisations = (rows || []).map((r) => ({
      vente_id: r.vente_id,
      numero_ticket: r.numero_ticket,
      nom_client: r.nom_client,
      date_cotisation: r.date_cotisation,
      montant_cotisation: parseFloat(r.montant_cotisation) || 0,
    }));
    res.json({
      success: true,
      cotisations,
      total: cotisations.length,
    });
  });
});

/**
 * GET /api/caisse/cotisation/historique
 * Historique des cotisations (5-15 €) enregistrées.
 * Query: adherent_id (optionnel), date_debut (YYYY-MM-DD), date_fin (YYYY-MM-DD), limit (défaut 200)
 */
router.get("/historique", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const orgId = getCurrentOrgId(req);
  const adherentId = req.query.adherent_id ? parseInt(req.query.adherent_id, 10) : null;
  const dateDebut = req.query.date_debut || null;
  const dateFin = req.query.date_fin || null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

  let sql = `
    SELECT
      v.id AS vente_id,
      v.numero_ticket,
      v.adherent_id,
      v.nom_client,
      u.username AS adherent_username,
      v.created_at AS date_cotisation,
      l.montant_ttc AS montant_cotisation
    FROM ventes v
    INNER JOIN lignes_vente l ON l.vente_id = v.id
    LEFT JOIN users u ON v.adherent_id = u.id
    WHERE v.organization_id = ?
      AND v.statut = 'complete'
      AND l.produit_id IS NULL
      AND l.nom_produit LIKE 'Cotisation mensuelle%'
  `;
  const params = [orgId];

  if (adherentId) {
    sql += " AND v.adherent_id = ?";
    params.push(adherentId);
  }
  if (dateDebut) {
    sql += " AND DATE(v.created_at) >= ?";
    params.push(dateDebut);
  }
  if (dateFin) {
    sql += " AND DATE(v.created_at) <= ?";
    params.push(dateFin);
  }

  sql += " ORDER BY v.created_at DESC LIMIT ?";
  params.push(limit);

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Erreur historique cotisations:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    const cotisations = (rows || []).map((r) => ({
      vente_id: r.vente_id,
      numero_ticket: r.numero_ticket,
      adherent_id: r.adherent_id,
      nom_client: r.nom_client,
      adherent_username: r.adherent_username || null,
      date_cotisation: r.date_cotisation,
      montant_cotisation: parseFloat(r.montant_cotisation) || 0,
    }));
    res.json({
      success: true,
      cotisations,
      total: cotisations.length,
    });
  });
});

module.exports = router;
