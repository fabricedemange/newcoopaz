/**
 * API Routes: Historique des ventes caisse
 *
 * Permet de rechercher et consulter l'historique complet des passages en caisse
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { getCurrentOrgId } = require("../utils/session-helpers");
const { requirePermission } = require("../middleware/rbac.middleware");

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
 * Récupère le détail d'une vente pour affichage ou PDF (vente, lignes, paiements).
 * @returns {Promise<{ vente, lignes, paiements }|null>}
 */
async function getVenteDetailForPdf(venteId, orgId) {
  const ventes = await queryPromise(
    `SELECT
      v.*,
      u_caissier.username as caissier_nom,
      u_client.username as client_nom
    FROM ventes v
    LEFT JOIN users u_caissier ON v.created_by = u_caissier.id
    LEFT JOIN users u_client ON v.adherent_id = u_client.id
    WHERE v.id = ? AND v.organization_id = ? AND v.statut = 'complete'`,
    [venteId, orgId]
  );
  if (ventes.length === 0) return null;

  const vente = ventes[0];
  const lignes = await queryPromise(
    `SELECT lv.*, p.nom as product_nom_actuel
     FROM lignes_vente lv
     LEFT JOIN products p ON lv.produit_id = p.id
     WHERE lv.vente_id = ? ORDER BY lv.id`,
    [venteId]
  );
  const paiements = await queryPromise(
    `SELECT pai.*, mp.nom as mode_paiement_nom
     FROM paiements pai
     LEFT JOIN modes_paiement mp ON pai.mode_paiement_id = mp.id
     WHERE pai.vente_id = ?`,
    [venteId]
  );

  return {
    vente: {
      ...vente,
      montant_ttc: parseFloat(vente.montant_ttc) || 0
    },
    lignes: lignes.map(l => {
      const isCotisation = !!(l.is_cotisation || (l.produit_id == null && (l.nom_produit || '').includes('Cotisation mensuelle')));
      return {
        ...l,
        quantite: parseFloat(l.quantite) || 0,
        prix_unitaire: parseFloat(l.prix_unitaire) || 0,
        montant_ttc: parseFloat(l.montant_ttc) || 0,
        is_cotisation: isCotisation,
        is_avoir: (l.produit_id === null || l.produit_id === 0) && !isCotisation
      };
    }),
    paiements: paiements.map(p => ({
      ...p,
      montant: parseFloat(p.montant) || 0
    }))
  };
}

/**
 * GET /api/caisse/ventes-historique
 * Liste des ventes avec filtres (date, numéro ticket, client, caissier)
 */
router.get("/", requirePermission("caisse.sell", { json: true }), async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const {
      date_debut,
      date_fin,
      numero_ticket,
      caissier_id,
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        v.id,
        v.numero_ticket,
        v.created_at,
        v.montant_ttc,
        v.statut,
        v.adherent_id,
        v.nom_client,
        v.panier_id,
        v.created_by,
        v.source,
        u_caissier.username as caissier_nom,
        u_client.username as client_nom,
        COUNT(DISTINCT lv.id) as nb_lignes,
        MAX(CASE WHEN lv.nom_produit LIKE '%(cde #%' AND lv.nom_produit LIKE '%cat #%' THEN 1 ELSE 0 END) AS catalogues_oui
      FROM ventes v
      LEFT JOIN users u_caissier ON v.created_by = u_caissier.id
      LEFT JOIN users u_client ON v.adherent_id = u_client.id
      LEFT JOIN lignes_vente lv ON lv.vente_id = v.id
      WHERE v.organization_id = ?
        AND v.statut = 'complete'
    `;

    const params = [orgId];

    // Filtre date début
    if (date_debut) {
      query += ` AND v.created_at >= ?`;
      params.push(date_debut);
    }

    // Filtre date fin
    if (date_fin) {
      query += ` AND v.created_at <= ?`;
      params.push(date_fin + ' 23:59:59');
    }

    // Filtre numéro ticket
    if (numero_ticket) {
      query += ` AND v.numero_ticket LIKE ?`;
      params.push(`%${numero_ticket}%`);
    }

    // Filtre caissier
    if (caissier_id) {
      query += ` AND v.created_by = ?`;
      params.push(parseInt(caissier_id));
    }

    query += `
      GROUP BY v.id
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));

    const ventes = await queryPromise(query, params);

    // Compter le total pour pagination
    let countQuery = `
      SELECT COUNT(DISTINCT v.id) as total
      FROM ventes v
      WHERE v.organization_id = ?
        AND v.statut = 'complete'
    `;

    const countParams = [orgId];
    if (date_debut) {
      countQuery += ` AND v.created_at >= ?`;
      countParams.push(date_debut);
    }
    if (date_fin) {
      countQuery += ` AND v.created_at <= ?`;
      countParams.push(date_fin + ' 23:59:59');
    }
    if (numero_ticket) {
      countQuery += ` AND v.numero_ticket LIKE ?`;
      countParams.push(`%${numero_ticket}%`);
    }
    if (caissier_id) {
      countQuery += ` AND v.created_by = ?`;
      countParams.push(parseInt(caissier_id));
    }

    const countResult = await queryPromise(countQuery, countParams);

    res.json({
      success: true,
      ventes: ventes.map(v => ({
        ...v,
        montant_ttc: parseFloat(v.montant_ttc) || 0
      })),
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error loading ventes historique:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/ventes-historique/:id/pdf
 * Télécharge le PDF détail de la vente (identique à la modale)
 */
router.get("/:id/pdf", requirePermission("caisse.sell", { json: true }), async (req, res) => {
  try {
    const venteId = parseInt(req.params.id);
    const orgId = getCurrentOrgId(req);

    const detail = await getVenteDetailForPdf(venteId, orgId);
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Vente non trouvée' });
    }

    const { generateTicketPdf } = require('../utils/ticket-pdf');
    const pdfBuffer = await generateTicketPdf(detail);

    const filename = `ticket-${detail.vente.numero_ticket || venteId}.pdf`.replace(/\s/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/ventes-historique/:id
 * Détail complet d'une vente (lignes, paiements, panier source)
 */
router.get("/:id", requirePermission("caisse.sell", { json: true }), async (req, res) => {
  try {
    const venteId = parseInt(req.params.id);
    const orgId = getCurrentOrgId(req);

    // Récupérer la vente (source depuis ventes.source)
    const ventes = await queryPromise(
      `SELECT
        v.*,
        u_caissier.username as caissier_nom,
        u_caissier.email as caissier_email,
        u_client.username as client_nom,
        v.source as panier_source
      FROM ventes v
      LEFT JOIN users u_caissier ON v.created_by = u_caissier.id
      LEFT JOIN users u_client ON v.adherent_id = u_client.id
      WHERE v.id = ? AND v.organization_id = ? AND v.statut = 'complete'`,
      [venteId, orgId]
    );

    if (ventes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vente non trouvée'
      });
    }

    const vente = ventes[0];

    // Récupérer les lignes de vente
    const lignes = await queryPromise(
      `SELECT
        lv.*,
        p.nom as product_nom_actuel,
        p.stock as stock_actuel
      FROM lignes_vente lv
      LEFT JOIN products p ON lv.produit_id = p.id
      WHERE lv.vente_id = ?
      ORDER BY lv.id`,
      [venteId]
    );

    // Récupérer les paiements
    const paiements = await queryPromise(
      `SELECT
        pai.*,
        mp.nom as mode_paiement_nom
      FROM paiements pai
      LEFT JOIN modes_paiement mp ON pai.mode_paiement_id = mp.id
      WHERE pai.vente_id = ?`,
      [venteId]
    );

    // Si la vente vient d'un panier, récupérer l'état du panier au moment de la vente
    let panierArticles = [];
    if (vente.panier_id) {
      panierArticles = await queryPromise(
        `SELECT
          pa.*,
          p.nom as product_nom
        FROM panier_articles pa
        LEFT JOIN catalog_products cp ON pa.catalog_product_id = cp.id
        LEFT JOIN products p ON cp.product_id = p.id
        WHERE pa.panier_id = ?`,
        [vente.panier_id]
      );
    }

    res.json({
      success: true,
      vente: {
        ...vente,
        montant_ttc: parseFloat(vente.montant_ttc) || 0
      },
      lignes: lignes.map(l => {
        const isCotisation = !!(l.is_cotisation || (l.produit_id == null && (l.nom_produit || '').includes('Cotisation mensuelle')));
        return {
          ...l,
          quantite: parseFloat(l.quantite) || 0,
          prix_unitaire: parseFloat(l.prix_unitaire) || 0,
          montant_ttc: parseFloat(l.montant_ttc) || 0,
          is_cotisation: isCotisation,
          is_avoir: (l.produit_id === null || l.produit_id === 0) && !isCotisation
        };
      }),
      paiements: paiements.map(p => ({
        ...p,
        montant: parseFloat(p.montant) || 0
      })),
      panier_articles: panierArticles.map(pa => ({
        ...pa,
        quantity: parseFloat(pa.quantity) || 0,
        prix_unitaire: parseFloat(pa.prix_unitaire) || 0,
        is_avoir: pa.catalog_product_id === null
      }))
    });
  } catch (error) {
    console.error('Error loading vente details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/ventes-historique/stats/resume
 * Statistiques des ventes (CA total, nb ventes, ticket moyen)
 */
router.get("/stats/resume", requirePermission("caisse.sell", { json: true }), async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const { date_debut, date_fin } = req.query;

    let query = `
      SELECT
        COUNT(*) as nb_ventes,
        SUM(montant_ttc) as ca_total,
        AVG(montant_ttc) as ticket_moyen,
        MIN(montant_ttc) as ticket_min,
        MAX(montant_ttc) as ticket_max
      FROM ventes
      WHERE organization_id = ?
        AND statut = 'complete'
    `;

    const params = [orgId];

    if (date_debut) {
      query += ` AND created_at >= ?`;
      params.push(date_debut);
    }

    if (date_fin) {
      query += ` AND created_at <= ?`;
      params.push(date_fin + ' 23:59:59');
    }

    const stats = await queryPromise(query, params);

    res.json({
      success: true,
      stats: {
        nb_ventes: stats[0].nb_ventes || 0,
        ca_total: parseFloat(stats[0].ca_total) || 0,
        ticket_moyen: parseFloat(stats[0].ticket_moyen) || 0,
        ticket_min: parseFloat(stats[0].ticket_min) || 0,
        ticket_max: parseFloat(stats[0].ticket_max) || 0
      }
    });
  } catch (error) {
    console.error('Error loading stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
