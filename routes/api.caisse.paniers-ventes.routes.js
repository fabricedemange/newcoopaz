/**
 * API Routes: Paniers caisse utilisant ventes + lignes_vente
 *
 * Solution ultra-simple:
 * - Panier de côté = vente avec statut='draft'
 * - Vente validée = vente avec statut='complete'
 * - Avoirs = lignes_vente avec produit_id=NULL et prix négatif
 *
 * Avantages:
 * - Une seule table pour tout
 * - Cohérence totale
 * - Pas de duplication de données
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");

// Helper: Query with promise
function queryPromise(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

/**
 * GET /api/caisse/paniers
 * Liste des paniers de côté (statut='draft')
 */
router.get("/", async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);

    const query = `
      SELECT
        v.id,
        v.adherent_id,
        v.nom_client,
        v.created_at,
        v.montant_ttc,
        u.username as client_nom,
        COUNT(lv.id) as nb_articles
      FROM ventes v
      LEFT JOIN users u ON v.adherent_id = u.id
      LEFT JOIN lignes_vente lv ON lv.vente_id = v.id
      WHERE v.organization_id = ?
        AND v.statut = 'draft'
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `;

    const paniers = await queryPromise(query, [orgId]);

    res.json({
      success: true,
      paniers: paniers.map(p => ({
        ...p,
        total: parseFloat(p.montant_ttc) || 0,
        utilisateur_nom: p.client_nom || p.nom_client
      }))
    });
  } catch (error) {
    console.error('Error loading paniers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/caisse/paniers
 * Créer un panier de côté (draft)
 */
router.post("/", async (req, res) => {
  try {
    const { lignes, selectedUtilisateur } = req.body;
    const orgId = getCurrentOrgId(req);
    const currentUserId = getCurrentUserId(req);

    if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Le panier est vide'
      });
    }

    // Calculer total
    const total = lignes.reduce((sum, l) => {
      return sum + (l.quantite * l.prix_unitaire);
    }, 0);

    // Créer vente draft
    const numeroTicket = `DRAFT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const venteResult = await queryPromise(
      `INSERT INTO ventes (
        organization_id,
        adherent_id,
        nom_client,
        montant_ttc,
        numero_ticket,
        statut,
        created_by
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [
        orgId,
        selectedUtilisateur || null,
        'Panier de côté',
        total,
        numeroTicket,
        currentUserId
      ]
    );

    const venteId = venteResult.insertId;

    // Créer lignes
    for (const ligne of lignes) {
      await queryPromise(
        `INSERT INTO lignes_vente (
          vente_id,
          produit_id,
          nom_produit,
          quantite,
          prix_unitaire,
          montant_ttc
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          venteId,
          ligne.produit_id,
          ligne.nom_produit,
          ligne.quantite,
          ligne.prix_unitaire,
          ligne.quantite * ligne.prix_unitaire
        ]
      );
    }

    res.json({
      success: true,
      panier_id: venteId,
      message: 'Panier sauvegardé'
    });
  } catch (error) {
    console.error('Error creating panier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/paniers/:id
 * Charger un panier de côté
 */
router.get("/:id", async (req, res) => {
  try {
    const venteId = parseInt(req.params.id);
    const orgId = getCurrentOrgId(req);

    // Vérifier vente
    const ventes = await queryPromise(
      `SELECT * FROM ventes
       WHERE id = ? AND organization_id = ? AND statut = 'draft'`,
      [venteId, orgId]
    );

    if (ventes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Panier non trouvé'
      });
    }

    // Récupérer lignes
    const lignes = await queryPromise(
      `SELECT * FROM lignes_vente WHERE vente_id = ?`,
      [venteId]
    );

    res.json({
      success: true,
      panier: ventes[0],
      lignes: lignes.map(l => ({
        produit_id: l.produit_id,
        nom_produit: l.nom_produit,
        quantite: parseFloat(l.quantite),
        prix_unitaire: parseFloat(l.prix_unitaire),
        unite: '',
        quantite_min: 1,
        is_avoir: l.produit_id === null || l.produit_id === 0
      })),
      selectedUtilisateur: ventes[0].adherent_id
    });
  } catch (error) {
    console.error('Error loading panier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/caisse/paniers/:id
 * Mettre à jour un panier draft
 */
router.put("/:id", async (req, res) => {
  try {
    const venteId = parseInt(req.params.id);
    const { lignes, selectedUtilisateur } = req.body;
    const orgId = getCurrentOrgId(req);

    // Vérifier vente
    const ventes = await queryPromise(
      `SELECT * FROM ventes
       WHERE id = ? AND organization_id = ? AND statut = 'draft'`,
      [venteId, orgId]
    );

    if (ventes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Panier non trouvé'
      });
    }

    // Calculer nouveau total
    const total = lignes.reduce((sum, l) => {
      return sum + (l.quantite * l.prix_unitaire);
    }, 0);

    // Supprimer anciennes lignes
    await queryPromise(`DELETE FROM lignes_vente WHERE vente_id = ?`, [venteId]);

    // Réinsérer
    for (const ligne of lignes) {
      await queryPromise(
        `INSERT INTO lignes_vente (
          vente_id,
          produit_id,
          nom_produit,
          quantite,
          prix_unitaire,
          montant_ttc
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          venteId,
          ligne.produit_id,
          ligne.nom_produit,
          ligne.quantite,
          ligne.prix_unitaire,
          ligne.quantite * ligne.prix_unitaire
        ]
      );
    }

    // Mettre à jour vente
    await queryPromise(
      `UPDATE ventes
       SET montant_ttc = ?, adherent_id = ?
       WHERE id = ?`,
      [total, selectedUtilisateur, venteId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating panier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/caisse/paniers/:id
 * Supprimer un panier draft
 */
router.delete("/:id", async (req, res) => {
  try {
    const venteId = parseInt(req.params.id);
    const orgId = getCurrentOrgId(req);

    const ventes = await queryPromise(
      `SELECT * FROM ventes
       WHERE id = ? AND organization_id = ? AND statut = 'draft'`,
      [venteId, orgId]
    );

    if (ventes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Panier non trouvé'
      });
    }

    // Supprimer lignes puis vente
    await queryPromise(`DELETE FROM lignes_vente WHERE vente_id = ?`, [venteId]);
    await queryPromise(`DELETE FROM ventes WHERE id = ?`, [venteId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting panier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/caisse/paniers/:id/valider
 * Valider un panier draft → complete (+ décrémenter stock)
 */
router.post("/:id/valider", async (req, res) => {
  try {
    const venteId = parseInt(req.params.id);
    const { mode_paiement_id, montant } = req.body;
    const orgId = getCurrentOrgId(req);

    // Récupérer vente draft
    const ventes = await queryPromise(
      `SELECT * FROM ventes
       WHERE id = ? AND organization_id = ? AND statut = 'draft'`,
      [venteId, orgId]
    );

    if (ventes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Panier non trouvé'
      });
    }

    // Récupérer lignes
    const lignes = await queryPromise(
      `SELECT * FROM lignes_vente WHERE vente_id = ?`,
      [venteId]
    );

    // Décrémenter stock (sauf avoirs)
    for (const ligne of lignes) {
      const isAvoir = ligne.produit_id === null || ligne.produit_id === 0;
      if (!isAvoir && ligne.produit_id) {
        await queryPromise(
          `UPDATE products
           SET stock_disponible = GREATEST(0, stock_disponible - ?)
           WHERE id = ?`,
          [ligne.quantite, ligne.produit_id]
        );
      }
    }

    // Générer vrai numero_ticket
    const numeroTicket = `CAISSE-${Date.now()}`;

    // Passer en statut complete
    await queryPromise(
      `UPDATE ventes
       SET statut = 'complete', numero_ticket = ?, nom_client = 'Caisse'
       WHERE id = ?`,
      [numeroTicket, venteId]
    );

    // Créer paiement si fourni
    if (mode_paiement_id && montant) {
      await queryPromise(
        `INSERT INTO paiements (vente_id, mode_paiement_id, montant, date_paiement)
         VALUES (?, ?, ?, NOW())`,
        [venteId, mode_paiement_id, montant]
      );
    }

    res.json({
      success: true,
      vente_id: venteId,
      numero_ticket: numeroTicket
    });
  } catch (error) {
    console.error('Error validating panier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
