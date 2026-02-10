/**
 * API: Inventaires et mouvements de stock
 * - Sessions d'inventaire (draft / complete)
 * - Lignes d'inventaire (produit, quantité comptée, stock théorique, écart)
 * - Appliquer l'inventaire → mise à jour products.stock + stock_movements
 * - Historique des mouvements de stock
 */

const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");

function queryPromise(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Toutes les routes inventaire/stock nécessitent inventory_stock (droit Administration Inventaire et stock)
const requireInventoryStock = requirePermission("inventory_stock", { json: true });

/**
 * POST /api/caisse/inventaires
 * Créer une session d'inventaire (statut draft).
 */
router.post("/inventaires", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);
    const { comment } = req.body || {};

    const result = await queryPromise(
      `INSERT INTO inventaires (organization_id, statut, created_by, comment)
       VALUES (?, 'draft', ?, ?)`,
      [orgId, userId, comment || null]
    );
    const id = result.insertId;
    const rows = await queryPromise(
      "SELECT id, organization_id, statut, created_by, created_at, comment FROM inventaires WHERE id = ?",
      [id]
    );
    res.status(201).json({ success: true, inventaire: rows && rows[0] ? rows[0] : { id } });
  } catch (error) {
    console.error("Erreur création inventaire:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/inventaires
 * Liste des sessions d'inventaire (historique).
 */
router.get("/inventaires", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const list = await queryPromise(
      `SELECT i.id, i.statut, i.created_by, i.created_at, i.completed_at, i.comment,
              u.username AS created_by_username,
              (SELECT COUNT(*) FROM inventaire_lignes il WHERE il.inventaire_id = i.id) AS nb_lignes
       FROM inventaires i
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.organization_id = ?
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [orgId, limit, offset]
    );
    const [{ total }] = await queryPromise(
      "SELECT COUNT(*) AS total FROM inventaires WHERE organization_id = ?",
      [orgId]
    );
    res.json({ success: true, inventaires: list, total });
  } catch (error) {
    console.error("Erreur liste inventaires:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/inventaires/:id
 * Détail d'une session + lignes avec écarts.
 */
router.get("/inventaires/:id", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const id = parseInt(req.params.id, 10);

    const [inv] = await queryPromise(
      `SELECT i.id, i.statut, i.created_by, i.created_at, i.completed_at, i.comment,
              u.username AS created_by_username
       FROM inventaires i
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = ? AND i.organization_id = ?`,
      [id, orgId]
    );
    if (!inv) {
      return res.status(404).json({ success: false, error: "Inventaire non trouvé" });
    }

    const lignes = await queryPromise(
      `SELECT il.id, il.product_id, il.quantite_comptee, il.stock_theorique, il.ecart, il.comment,
              p.nom AS product_nom, p.code_ean
       FROM inventaire_lignes il
       INNER JOIN products p ON p.id = il.product_id
       WHERE il.inventaire_id = ?
       ORDER BY p.nom`,
      [id]
    );
    res.json({ success: true, inventaire: inv, lignes: lignes || [] });
  } catch (error) {
    console.error("Erreur détail inventaire:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/caisse/inventaires/:id/lignes
 * Ajouter ou mettre à jour une ligne (product_id, quantite_comptee, comment optionnel).
 * stock_theorique et ecart sont remplis côté serveur.
 */
router.post("/inventaires/:id/lignes", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const id = parseInt(req.params.id, 10);
    const { product_id, quantite_comptee, comment } = req.body || {};

    if (!product_id || quantite_comptee == null) {
      return res.status(400).json({ success: false, error: "product_id et quantite_comptee requis" });
    }
    const qte = Number(quantite_comptee);
    if (qte < 0) {
      return res.status(400).json({ success: false, error: "quantite_comptee doit être >= 0" });
    }

    const [inv] = await queryPromise(
      "SELECT id FROM inventaires WHERE id = ? AND organization_id = ? AND statut = 'draft'",
      [id, orgId]
    );
    if (!inv) {
      return res.status(404).json({ success: false, error: "Inventaire non trouvé ou déjà finalisé" });
    }

    const [prod] = await queryPromise(
      "SELECT id, stock FROM products WHERE id = ? AND organization_id = ?",
      [product_id, orgId]
    );
    if (!prod) {
      return res.status(404).json({ success: false, error: "Produit non trouvé" });
    }
    const stockTheorique = Number(prod.stock) || 0;
    const ecart = qte - stockTheorique;

    const commentVal = comment != null ? String(comment).trim() || null : null;
    await queryPromise(
      `INSERT INTO inventaire_lignes (inventaire_id, product_id, quantite_comptee, stock_theorique, ecart, comment)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         quantite_comptee = VALUES(quantite_comptee),
         stock_theorique = VALUES(stock_theorique),
         ecart = VALUES(ecart),
         comment = VALUES(comment)`,
      [id, product_id, qte, stockTheorique, ecart, commentVal]
    );
    const rows = await queryPromise(
      `SELECT il.id, il.product_id, il.quantite_comptee, il.stock_theorique, il.ecart, il.comment,
              p.nom AS product_nom
       FROM inventaire_lignes il
       INNER JOIN products p ON p.id = il.product_id
       WHERE il.inventaire_id = ? AND il.product_id = ?`,
      [id, product_id]
    );
    res.json({ success: true, ligne: rows && rows[0] ? rows[0] : null });
  } catch (error) {
    console.error("Erreur ajout ligne inventaire:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/caisse/inventaires/:id/lignes/:productId
 * Draft : supprime la ligne.
 * Complete : remet le stock à stock_theorique, enregistre un mouvement, puis supprime la ligne.
 */
router.delete("/inventaires/:id/lignes/:productId", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);
    const id = parseInt(req.params.id, 10);
    const productId = parseInt(req.params.productId, 10);

    const [inv] = await queryPromise(
      "SELECT id, statut FROM inventaires WHERE id = ? AND organization_id = ?",
      [id, orgId]
    );
    if (!inv) {
      return res.status(404).json({ success: false, error: "Inventaire non trouvé" });
    }

    if (inv.statut === "draft") {
      await queryPromise(
        "DELETE FROM inventaire_lignes WHERE inventaire_id = ? AND product_id = ?",
        [id, productId]
      );
      return res.json({ success: true });
    }

    if (inv.statut === "complete") {
      const [ligne] = await queryPromise(
        "SELECT product_id, quantite_comptee, stock_theorique FROM inventaire_lignes WHERE inventaire_id = ? AND product_id = ?",
        [id, productId]
      );
      if (!ligne) {
        return res.status(404).json({ success: false, error: "Ligne non trouvée" });
      }
      const stockActuel = Number(ligne.quantite_comptee);
      const stockRestaure = Number(ligne.stock_theorique);
      const delta = stockRestaure - stockActuel;

      await queryPromise(
        "UPDATE products SET stock = ? WHERE id = ? AND organization_id = ?",
        [stockRestaure, productId, orgId]
      );
      await queryPromise(
        `INSERT INTO stock_movements
          (organization_id, product_id, type, quantite, stock_avant, stock_apres, reference_type, reference_id, created_by, comment)
         VALUES (?, ?, 'ajustement', ?, ?, ?, 'inventaire_annulation', ?, ?, ?)`,
        [orgId, productId, delta, stockActuel, stockRestaure, id, userId, "Annulation ligne inventaire"]
      );
      await queryPromise(
        "DELETE FROM inventaire_lignes WHERE inventaire_id = ? AND product_id = ?",
        [id, productId]
      );
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Statut invalide" });
  } catch (error) {
    console.error("Erreur suppression ligne inventaire:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/caisse/inventaires/:id
 * Draft : supprime l'inventaire (lignes en cascade).
 * Complete : remet les stocks à stock_theorique pour chaque ligne, enregistre les mouvements, puis supprime.
 */
router.delete("/inventaires/:id", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);
    const id = parseInt(req.params.id, 10);

    const [inv] = await queryPromise(
      "SELECT id, statut FROM inventaires WHERE id = ? AND organization_id = ?",
      [id, orgId]
    );
    if (!inv) {
      return res.status(404).json({ success: false, error: "Inventaire non trouvé" });
    }

    if (inv.statut === "draft") {
      await queryPromise("DELETE FROM inventaires WHERE id = ?", [id]);
      return res.json({ success: true });
    }

    if (inv.statut === "complete") {
      const lignes = await queryPromise(
        "SELECT product_id, quantite_comptee, stock_theorique FROM inventaire_lignes WHERE inventaire_id = ?",
        [id]
      );
      for (const ligne of lignes || []) {
        const stockRestaure = Number(ligne.stock_theorique);
        const stockActuel = Number(ligne.quantite_comptee);
        const delta = stockRestaure - stockActuel;

        await queryPromise(
          "UPDATE products SET stock = ? WHERE id = ? AND organization_id = ?",
          [stockRestaure, ligne.product_id, orgId]
        );
        await queryPromise(
          `INSERT INTO stock_movements
            (organization_id, product_id, type, quantite, stock_avant, stock_apres, reference_type, reference_id, created_by, comment)
           VALUES (?, ?, 'ajustement', ?, ?, ?, 'inventaire_annulation', ?, ?, ?)`,
          [orgId, ligne.product_id, delta, stockActuel, stockRestaure, id, userId, "Annulation inventaire entier"]
        );
      }
      await queryPromise("DELETE FROM inventaire_lignes WHERE inventaire_id = ?", [id]);
      await queryPromise("DELETE FROM inventaires WHERE id = ?", [id]);
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Statut invalide" });
  } catch (error) {
    console.error("Erreur suppression inventaire:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/caisse/inventaires/:id/appliquer
 * Appliquer l'inventaire : pour chaque ligne, mettre à jour products.stock,
 * insérer dans stock_movements, passer l'inventaire en complete.
 */
router.post("/inventaires/:id/appliquer", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);
    const id = parseInt(req.params.id, 10);

    const [inv] = await queryPromise(
      "SELECT id FROM inventaires WHERE id = ? AND organization_id = ? AND statut = 'draft'",
      [id, orgId]
    );
    if (!inv) {
      return res.status(404).json({ success: false, error: "Inventaire non trouvé ou déjà finalisé" });
    }

    const lignes = await queryPromise(
      "SELECT id, product_id, quantite_comptee, stock_theorique, ecart, comment FROM inventaire_lignes WHERE inventaire_id = ?",
      [id]
    );
    if (!lignes || lignes.length === 0) {
      return res.status(400).json({ success: false, error: "Aucune ligne à appliquer" });
    }

    for (const ligne of lignes) {
      const stockAvant = Number(ligne.stock_theorique);
      const quantiteComptee = Number(ligne.quantite_comptee);
      const stockApres = quantiteComptee;
      const delta = quantiteComptee - stockAvant;
      const commentMovement = ligne.comment ? String(ligne.comment).trim() || null : null;

      await queryPromise(
        "UPDATE products SET stock = ? WHERE id = ? AND organization_id = ?",
        [stockApres, ligne.product_id, orgId]
      );
      await queryPromise(
        `INSERT INTO stock_movements
          (organization_id, product_id, type, quantite, stock_avant, stock_apres, reference_type, reference_id, created_by, comment)
         VALUES (?, ?, 'inventaire', ?, ?, ?, 'inventaire', ?, ?, ?)`,
        [orgId, ligne.product_id, delta, stockAvant, stockApres, id, userId, commentMovement]
      );
    }

    await queryPromise(
      "UPDATE inventaires SET statut = 'complete', completed_at = NOW() WHERE id = ?",
      [id]
    );

    res.json({ success: true, message: "Inventaire appliqué", nb_lignes: lignes.length });
  } catch (error) {
    console.error("Erreur appliquer inventaire:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/caisse/stock-mouvements
 * Liste des mouvements de stock.
 * Filtres: product_id, product_search (nom produit LIKE), type, date_debut, date_fin, created_by.
 * Tri: sort_by (created_at|product_nom|type|quantite|stock_avant|stock_apres), sort_order (asc|desc).
 */
router.get("/stock-mouvements", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const {
      product_id,
      product_search,
      type,
      date_debut,
      date_fin,
      created_by,
      limit = 50,
      offset = 0,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;

    const allowedSort = {
      created_at: "sm.created_at",
      product_nom: "p.nom",
      type: "sm.type",
      quantite: "sm.quantite",
      stock_avant: "sm.stock_avant",
      stock_apres: "sm.stock_apres",
    };
    const orderCol = allowedSort[sort_by] || "sm.created_at";
    const orderDir = sort_order === "asc" ? "ASC" : "DESC";

    let query = `
      SELECT sm.id, sm.product_id, sm.type, sm.quantite, sm.stock_avant, sm.stock_apres,
             sm.reference_type, sm.reference_id, sm.created_by, sm.created_at, sm.comment,
             p.nom AS product_nom,
             u.username AS created_by_username
      FROM stock_movements sm
      INNER JOIN products p ON p.id = sm.product_id AND p.organization_id = ?
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.organization_id = ?
    `;
    const params = [orgId, orgId];

    if (product_id) {
      query += " AND sm.product_id = ?";
      params.push(parseInt(product_id, 10));
    }
    if (product_search && String(product_search).trim()) {
      query += " AND p.nom LIKE ?";
      params.push("%" + String(product_search).trim() + "%");
    }
    if (type) {
      query += " AND sm.type = ?";
      params.push(type);
    }
    if (date_debut) {
      query += " AND sm.created_at >= ?";
      params.push(date_debut);
    }
    if (date_fin) {
      query += " AND sm.created_at <= ?";
      params.push(date_fin + " 23:59:59");
    }
    if (created_by) {
      query += " AND sm.created_by = ?";
      params.push(parseInt(created_by, 10));
    }

    let countQuery = `
      SELECT COUNT(*) AS total FROM stock_movements sm
      INNER JOIN products p ON p.id = sm.product_id AND p.organization_id = ?
      WHERE sm.organization_id = ?
    `;
    const countParams = [orgId, orgId];
    if (product_id) { countQuery += " AND sm.product_id = ?"; countParams.push(parseInt(product_id, 10)); }
    if (product_search && String(product_search).trim()) {
      countQuery += " AND p.nom LIKE ?";
      countParams.push("%" + String(product_search).trim() + "%");
    }
    if (type) { countQuery += " AND sm.type = ?"; countParams.push(type); }
    if (date_debut) { countQuery += " AND sm.created_at >= ?"; countParams.push(date_debut); }
    if (date_fin) { countQuery += " AND sm.created_at <= ?"; countParams.push(date_fin + " 23:59:59"); }
    if (created_by) { countQuery += " AND sm.created_by = ?"; countParams.push(parseInt(created_by, 10)); }
    const countResult = await queryPromise(countQuery, countParams);
    const total = (countResult && countResult[0] && countResult[0].total) ? countResult[0].total : 0;

    query += ` ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`;
    params.push(lim, off);
    const movements = await queryPromise(query, params);

    res.json({ success: true, movements: movements || [], total: total || 0 });
  } catch (error) {
    console.error("Erreur liste stock_movements:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/caisse/products/:id/code-ean
 * Mise à jour du code-barres d'un produit (contexte inventaire, droit inventory_stock).
 */
router.patch("/products/:id/code-ean", requireInventoryStock, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const productId = parseInt(req.params.id, 10);
    const { code_ean } = req.body || {};
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ success: false, error: "ID produit invalide" });
    }
    const codeEan = code_ean != null ? String(code_ean).trim() || null : null;
    const result = await queryPromise(
      "UPDATE products SET code_ean = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?",
      [codeEan, productId, orgId]
    );
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Produit non trouvé" });
    }
    res.json({ success: true, message: "Code-barres mis à jour" });
  } catch (error) {
    console.error("Erreur PATCH code-ean:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
