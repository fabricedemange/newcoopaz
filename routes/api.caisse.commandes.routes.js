const express = require('express');
const router = express.Router();
const { db } = require('../config/config');
const { requirePermission } = require('../middleware/rbac.middleware');
const { getCurrentOrgId } = require('../utils/session-helpers');

/**
 * GET /api/caisse/commandes-utilisateur
 * Récupère les commandes catalogue d'un utilisateur qui n'ont pas encore été transformées en vente caisse
 */
router.get('/commandes-utilisateur', requirePermission('caisse.sell', { json: true }), (req, res) => {
  const { user_id } = req.query;
  const organization_id = getCurrentOrgId(req);

  if (!user_id) {
    return res.status(400).json({ error: 'user_id requis' });
  }

  // Récupérer les commandes finalisées de l'utilisateur
  // qui n'ont PAS encore été transformées en vente caisse
  // ET dont le catalogue est expiré
  const query = `
    SELECT
      p.id,
      p.user_id,
      p.created_at,
      p.note,
      u.username,
      COUNT(pa.id) as nb_articles,
      COALESCE(SUM(pa.quantity * cp.prix), 0) as total,
      COALESCE(v.id, NULL) as vente_id,
      cf.expiration_date,
      cf.originalname as catalogue_nom,
      cf.id as catalog_id
    FROM paniers p
    INNER JOIN users u ON p.user_id = u.id
    INNER JOIN catalog_files cf ON p.catalog_file_id = cf.id
    LEFT JOIN panier_articles pa ON p.id = pa.panier_id
    LEFT JOIN catalog_products cp ON pa.catalog_product_id = cp.id
    LEFT JOIN ventes v ON v.panier_id = p.id
    WHERE u.organization_id = ?
      AND p.user_id = ?
      AND p.is_submitted = 1
      AND v.id IS NULL
      AND cf.expiration_date < NOW()
      AND cf.is_archived = 2
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  db.query(query, [organization_id, user_id], (err, commandes) => {
    if (err) {
      console.error('Erreur récupération commandes utilisateur:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    res.json(commandes);
  });
});

/**
 * GET /api/caisse/commandes/:id/articles
 * Récupère les articles d'une commande avec mapping vers les produits caisse
 */
router.get('/commandes/:id/articles', requirePermission('caisse.sell', { json: true }), (req, res) => {
  const { id } = req.params;
  const organization_id = getCurrentOrgId(req);

  // Vérifier que la commande appartient à l'organisation
  db.query(
    'SELECT p.id FROM paniers p INNER JOIN users u ON p.user_id = u.id WHERE p.id = ? AND u.organization_id = ?',
    [id, organization_id],
    (err, paniers) => {
      if (err) {
        console.error('Erreur vérification panier:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      if (!paniers || paniers.length === 0) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      const query = `
        SELECT
          pa.id as panier_article_id,
          pa.quantity,
          cp.prix as price_commande,
          pa.catalog_product_id,
          cp.product_id,
          p.id as product_id_caisse,
          p.nom,
          p.prix as prix_actuel,
          p.unite,
          p.stock,
          p.image_url
        FROM panier_articles pa
        INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
        LEFT JOIN products p ON cp.product_id = p.id
        WHERE pa.panier_id = ?
        ORDER BY pa.id
      `;

      db.query(query, [id], (err2, articles) => {
        if (err2) {
          console.error('Erreur récupération articles commande:', err2);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json(articles || []);
      });
    }
  );
});

module.exports = router;
