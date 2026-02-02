const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");

// POST /api/caisse/ventes - Créer une vente
router.post("/", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const { adherent_id, nom_client, lignes, montant_ttc, panier_id } = req.body;
  const orgId = getCurrentOrgId(req);
  const userId = getCurrentUserId(req);

  // Validation
  if (!lignes || lignes.length === 0) {
    return res.status(400).json({ success: false, error: "Le panier est vide" });
  }

  if (montant_ttc == null || montant_ttc < 0) {
    return res.status(400).json({ success: false, error: "Montant invalide" });
  }

  // Générer numéro ticket temporaire (sera remplacé par l'ID)
  const numero_ticket_temp = `T-TEMP-${Date.now()}`;

  // Transaction SQL - Get connection from pool
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Erreur connexion:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    connection.beginTransaction((err) => {
      if (err) {
        console.error('Erreur début transaction:', err);
        connection.release();
        return res.status(500).json({ success: false, error: err.message });
      }

      // 1. Créer la vente
      const insertVenteQuery = `
        INSERT INTO ventes
          (organization_id, numero_ticket, adherent_id, nom_client, montant_ttc, created_by, source, statut, panier_id)
        VALUES (?, ?, ?, ?, ?, ?, 'caisse', 'complete', ?)
      `;

      connection.query(
        insertVenteQuery,
        [orgId, numero_ticket_temp, adherent_id, nom_client || 'Anonyme', montant_ttc, userId, panier_id || null],
        (err, result) => {
          if (err) {
            console.error('Erreur création vente:', err);
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ success: false, error: err.message });
            });
          }

          const venteId = result.insertId;
          const numero_ticket = `T${venteId}`;

          // Mettre à jour le numéro de ticket avec l'ID de la vente
          connection.query(
            'UPDATE ventes SET numero_ticket = ? WHERE id = ?',
            [numero_ticket, venteId],
            (err) => {
              if (err) {
                console.error('Erreur mise à jour numero_ticket:', err);
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ success: false, error: err.message });
                });
              }

              // Continuer avec les lignes de vente
              updateVenteWithLines(connection, venteId, numero_ticket);
            }
          );
        }
      );

      function updateVenteWithLines(connection, venteId, numero_ticket) {

          // 2. Créer les lignes de vente
          const insertLignesQuery = `
            INSERT INTO lignes_vente
              (vente_id, produit_id, nom_produit, quantite, prix_unitaire, montant_ttc)
            VALUES ?
          `;

          const lignesValues = lignes.map(l => [
            venteId,
            l.produit_id,
            l.nom_produit,
            l.quantite,
            l.prix_unitaire,
            l.quantite * l.prix_unitaire
          ]);

          connection.query(insertLignesQuery, [lignesValues], (err2) => {
            if (err2) {
              console.error('Erreur création lignes vente:', err2);
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ success: false, error: err2.message });
              });
            }

            // 3. Décrémenter le stock pour chaque produit (sans vérification de stock suffisant)
            const updateStockPromises = lignes.map(ligne => {
              return new Promise((resolve, reject) => {
                const updateStockQuery = `
                  UPDATE products
                  SET stock = stock - ?
                  WHERE id = ?
                    AND organization_id = ?
                `;

                connection.query(
                  updateStockQuery,
                  [ligne.quantite, ligne.produit_id, orgId],
                  (err, result) => {
                    if (err) {
                      console.error('Erreur mise à jour stock:', err);
                      return reject(err);
                    }

                    // Pas de vérification de stock - on autorise les stocks négatifs
                    resolve();
                  }
                );
              });
            });

            Promise.all(updateStockPromises)
              .then(() => {
                // 4. Si vente créée depuis une commande, mettre à jour la note du panier
                if (panier_id) {
                  const updateNoteQuery = `
                    UPDATE paniers p
                    INNER JOIN users u ON p.user_id = u.id
                    SET p.note = CONCAT(COALESCE(p.note, ''), '\n[Ticket caisse #', ?, ']')
                    WHERE p.id = ?
                      AND u.organization_id = ?
                  `;

                  connection.query(
                    updateNoteQuery,
                    [venteId, panier_id, orgId],
                    (err) => {
                      if (err) {
                        console.error('Erreur mise à jour note panier (non bloquant):', err);
                        // Ne pas bloquer la vente si update note échoue
                      }

                      // Commit de la transaction
                      connection.commit((err) => {
                        if (err) {
                          console.error('Erreur commit transaction:', err);
                          return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ success: false, error: err.message });
                          });
                        }

                        connection.release();
                        res.json({
                          success: true,
                          vente: {
                            id: venteId,
                            numero_ticket,
                            montant_ttc
                          },
                          message: panier_id
                            ? 'Vente créée depuis commande catalogue'
                            : 'Vente créée'
                        });
                      });
                    }
                  );
                } else {
                  // Pas de panier_id, commit directement
                  connection.commit((err) => {
                    if (err) {
                      console.error('Erreur commit transaction:', err);
                      return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ success: false, error: err.message });
                      });
                    }

                    connection.release();
                    res.json({
                      success: true,
                      vente: {
                        id: venteId,
                        numero_ticket,
                        montant_ttc
                      }
                    });
                  });
                }
              })
              .catch((err) => {
                console.error('Erreur traitement stock:', err);
                connection.rollback(() => {
                  connection.release();
                  res.status(500).json({
                    success: false,
                    error: err.message || 'Erreur lors de la mise à jour du stock'
                  });
                });
              });
          });
      }
    });
  });
});

// GET /api/caisse/ventes - Historique ventes
router.get("/", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const orgId = getCurrentOrgId(req);
  const { dateFrom, dateTo, adherentId } = req.query;

  let query = `
    SELECT
      v.id,
      v.numero_ticket,
      v.nom_client,
      v.montant_ttc,
      v.created_at,
      u.username as created_by_username,
      COUNT(lv.id) as nb_articles
    FROM ventes v
    LEFT JOIN users u ON v.created_by = u.id
    LEFT JOIN lignes_vente lv ON v.id = lv.vente_id
    WHERE v.organization_id = ?
  `;

  const params = [orgId];

  if (dateFrom) {
    query += ` AND v.created_at >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ` AND v.created_at <= ?`;
    params.push(dateTo);
  }

  if (adherentId) {
    query += ` AND v.adherent_id = ?`;
    params.push(adherentId);
  }

  query += ` GROUP BY v.id ORDER BY v.created_at DESC LIMIT 100`;

  db.query(query, params, (err, ventes) => {
    if (err) {
      console.error('Erreur chargement ventes:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      ventes: ventes || []
    });
  });
});

// GET /api/caisse/ventes/:id/lignes - Détail vente
router.get("/:id/lignes", requirePermission("caisse.sell", { json: true }), (req, res) => {
  const venteId = req.params.id;
  const orgId = getCurrentOrgId(req);

  const query = `
    SELECT
      lv.id,
      lv.nom_produit,
      lv.quantite,
      lv.prix_unitaire,
      lv.montant_ttc
    FROM lignes_vente lv
    INNER JOIN ventes v ON lv.vente_id = v.id
    WHERE v.id = ?
      AND v.organization_id = ?
    ORDER BY lv.id ASC
  `;

  db.query(query, [venteId, orgId], (err, lignes) => {
    if (err) {
      console.error('Erreur chargement lignes vente:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({
      success: true,
      lignes: lignes || []
    });
  });
});

module.exports = router;
