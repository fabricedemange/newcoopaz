/**
 * API: Réceptions de commandes
 * - Création réception (draft), lignes (préremplissage précommande ou manuel)
 * - Validation → mise à jour products.stock + stock_movements type 'reception'
 * - Historique des réceptions
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

const requireReception = requirePermission("inventory_stock", { json: true });

/**
 * GET /api/admin/receptions
 * Liste des réceptions (filtres: supplier_id, statut).
 */
router.get("/", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const { supplier_id, statut } = req.query;

    let sql = `
      SELECT r.id, r.supplier_id, r.bl_number, r.is_from_preorder, r.catalog_file_id, r.statut,
             r.created_by, r.created_at, r.validated_at, r.validated_by, r.comment,
             s.nom AS supplier_nom,
             u.username AS created_by_username,
             cf.originalname AS catalog_originalname
      FROM receptions r
      LEFT JOIN catalog_files cf ON cf.id = r.catalog_file_id
      INNER JOIN suppliers s ON s.id = r.supplier_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.organization_id = ?
    `;
    const params = [orgId];
    if (supplier_id) {
      sql += " AND r.supplier_id = ?";
      params.push(supplier_id);
    }
    if (statut) {
      sql += " AND r.statut = ?";
      params.push(statut);
    }
    sql += " ORDER BY r.created_at DESC";

    const receptions = await queryPromise(sql, params);
    res.json({ success: true, receptions: receptions || [] });
  } catch (error) {
    console.error("Erreur liste réceptions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/receptions/products
 * Query: supplier_id, search (optionnel). Produits du fournisseur pour ajout manuel.
 */
router.get("/products", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const supplierId = parseInt(req.query.supplier_id, 10);
    const search = (req.query.search || "").trim().toLowerCase();

    if (!supplierId) {
      return res.status(400).json({ success: false, error: "supplier_id requis" });
    }

    let sql = `
      SELECT p.id, p.nom, p.prix, p.unite, p.stock
      FROM products p
      WHERE p.organization_id = ? AND p.supplier_id = ?
    `;
    const params = [orgId, supplierId];
    if (search) {
      sql += " AND (p.nom LIKE ? OR p.description LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like);
    }
    sql += " ORDER BY p.nom LIMIT 100";

    const products = await queryPromise(sql, params);
    res.json({ success: true, products: products || [] });
  } catch (error) {
    console.error("Erreur products réceptions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/receptions/preorders-catalogues
 * Query: supplier_id. Les 3 catalogues (précommandes) les plus récents pour ce fournisseur,
 * avec date_livraison = jour même ou plus ancien.
 */
router.get("/preorders-catalogues", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const supplierId = parseInt(req.query.supplier_id, 10);
    if (!supplierId) {
      return res.status(400).json({ success: false, error: "supplier_id requis" });
    }

    const list = await queryPromise(
      `SELECT DISTINCT cf.id, cf.originalname, cf.description, cf.date_livraison
       FROM catalog_files cf
       INNER JOIN catalog_products cp ON cp.catalog_file_id = cf.id
       INNER JOIN products p ON p.id = cp.product_id AND p.organization_id = ? AND p.supplier_id = ?
       WHERE cf.organization_id = ?
         AND (cf.date_livraison IS NULL OR cf.date_livraison <= CURDATE())
       ORDER BY cf.date_livraison DESC, cf.id DESC
       LIMIT 3`,
      [orgId, supplierId, orgId]
    );
    res.json({ success: true, catalogues: list || [] });
  } catch (error) {
    console.error("Erreur preorders-catalogues:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/receptions/preorders-delivered
 * Query: supplier_id. Liste des dernières réceptions validées "issue d'une précommande" pour ce fournisseur.
 */
router.get("/preorders-delivered", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const supplierId = parseInt(req.query.supplier_id, 10);
    if (!supplierId) {
      return res.status(400).json({ success: false, error: "supplier_id requis" });
    }

    const list = await queryPromise(
      `SELECT r.id, r.bl_number, r.validated_at, r.comment,
              (SELECT COUNT(*) FROM reception_lignes rl WHERE rl.reception_id = r.id) AS nb_lignes
       FROM receptions r
       WHERE r.organization_id = ? AND r.supplier_id = ? AND r.statut = 'validated' AND r.is_from_preorder = 1
       ORDER BY r.validated_at DESC
       LIMIT 30`,
      [orgId, supplierId]
    );
    res.json({ success: true, receptions: list || [] });
  } catch (error) {
    console.error("Erreur preorders-delivered:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/receptions/preorder-lines
 * Query: supplier_id, catalog_file_id (optionnel). Lignes agrégées des précommandes pour ce fournisseur.
 * Si catalog_file_id est fourni, uniquement les paniers de ce catalogue. Sinon tous les catalogues (date_livraison <= aujourd'hui).
 */
router.get("/preorder-lines", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const supplierId = parseInt(req.query.supplier_id, 10);
    const catalogFileId = req.query.catalog_file_id ? parseInt(req.query.catalog_file_id, 10) : null;
    if (!supplierId) {
      return res.status(400).json({ success: false, error: "supplier_id requis" });
    }

    const params = [orgId, orgId, supplierId];
    let whereCatalog = "";
    if (catalogFileId) {
      whereCatalog = " AND pan.catalog_file_id = ?";
      params.push(catalogFileId);
    }

    const lines = await queryPromise(
      `SELECT p.id AS product_id, p.nom AS product_nom, p.prix AS prix_base,
              SUM(COALESCE(pa.quantity, 0)) AS quantite_commandee
       FROM panier_articles pa
       INNER JOIN paniers pan ON pan.id = pa.panier_id AND pan.is_submitted = 1
       INNER JOIN catalog_files cf ON cf.id = pan.catalog_file_id AND cf.organization_id = ?
         AND (cf.date_livraison IS NULL OR cf.date_livraison <= CURDATE())
       INNER JOIN catalog_products cp ON cp.id = pa.catalog_product_id AND cp.catalog_file_id = pan.catalog_file_id
       INNER JOIN products p ON p.id = cp.product_id AND p.organization_id = ? AND p.supplier_id = ?
       WHERE 1=1 ${whereCatalog}
       GROUP BY p.id, p.nom, p.prix
       HAVING quantite_commandee > 0
       ORDER BY p.nom`,
      params
    );
    res.json({ success: true, lines: lines || [] });
  } catch (error) {
    console.error("Erreur preorder-lines:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/receptions
 * Créer une réception (draft). Body: supplier_id, bl_number, is_from_preorder, catalog_file_id (optionnel), lignes[] (optionnel).
 */
router.post("/", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);
    const { supplier_id, bl_number, is_from_preorder, catalog_file_id, lignes } = req.body || {};

    if (!supplier_id || !bl_number || bl_number.trim() === "") {
      return res.status(400).json({ success: false, error: "supplier_id et bl_number requis" });
    }

    const [supplier] = await queryPromise(
      "SELECT id FROM suppliers WHERE id = ? AND organization_id = ?",
      [supplier_id, orgId]
    );
    if (!supplier) {
      return res.status(400).json({ success: false, error: "Fournisseur non trouvé" });
    }

    const catalogId = catalog_file_id != null && catalog_file_id !== "" ? parseInt(catalog_file_id, 10) : null;
    const result = await queryPromise(
      `INSERT INTO receptions (organization_id, supplier_id, bl_number, is_from_preorder, catalog_file_id, statut, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [orgId, supplier_id, String(bl_number).trim(), is_from_preorder ? 1 : 0, catalogId, userId]
    );
    const receptionId = result.insertId;

    if (Array.isArray(lignes) && lignes.length > 0) {
      for (const ligne of lignes) {
        const productId = ligne.product_id;
        const qte = parseFloat(ligne.quantite_recue) || 0;
        const prix = parseFloat(ligne.prix_unitaire) || 0;
        const comment = (ligne.comment || "").trim() || null;
        if (!productId || qte <= 0) continue;

        const [prod] = await queryPromise(
          "SELECT id, prix FROM products WHERE id = ? AND organization_id = ?",
          [productId, orgId]
        );
        if (!prod) continue;

        const prixBase = prod.prix != null ? parseFloat(prod.prix) : null;
        await queryPromise(
          `INSERT INTO reception_lignes (reception_id, product_id, quantite_recue, prix_unitaire, prix_base, comment)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [receptionId, productId, qte, prix, prixBase, comment]
        );
      }
    }

    const [created] = await queryPromise(
      `SELECT r.*, s.nom AS supplier_nom FROM receptions r
       INNER JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ?`,
      [receptionId]
    );
    res.status(201).json({ success: true, reception: created });
  } catch (error) {
    console.error("Erreur création réception:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/receptions/:id
 * Détail d'une réception avec lignes (produit, nom, prix base, etc.).
 */
router.get("/:id", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const id = parseInt(req.params.id, 10);

    const [rec] = await queryPromise(
      `SELECT r.*, s.nom AS supplier_nom,
              u.username AS created_by_username,
              uv.username AS validated_by_username,
              cf.originalname AS catalog_originalname
       FROM receptions r
       INNER JOIN suppliers s ON s.id = r.supplier_id
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN users uv ON uv.id = r.validated_by
       LEFT JOIN catalog_files cf ON cf.id = r.catalog_file_id
       WHERE r.id = ? AND r.organization_id = ?`,
      [id, orgId]
    );
    if (!rec) {
      return res.status(404).json({ success: false, error: "Réception non trouvée" });
    }

    const lignes = await queryPromise(
      `SELECT rl.id, rl.product_id, rl.quantite_recue, rl.prix_unitaire, rl.prix_base, rl.comment,
              p.nom AS product_nom, p.unite
       FROM reception_lignes rl
       INNER JOIN products p ON p.id = rl.product_id
       WHERE rl.reception_id = ?
       ORDER BY p.nom`,
      [id]
    );

    res.json({ success: true, reception: rec, lignes: lignes || [] });
  } catch (error) {
    console.error("Erreur détail réception:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/admin/receptions/:id
 * Mettre à jour une réception draft (en-tête + lignes).
 */
router.patch("/:id", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const id = parseInt(req.params.id, 10);
    const { bl_number, is_from_preorder, catalog_file_id, comment, lignes } = req.body || {};

    const [rec] = await queryPromise(
      "SELECT id FROM receptions WHERE id = ? AND organization_id = ? AND statut = 'draft'",
      [id, orgId]
    );
    if (!rec) {
      return res.status(404).json({ success: false, error: "Réception non trouvée ou déjà validée" });
    }

    const updates = [];
    const params = [];
    if (bl_number !== undefined) {
      updates.push("bl_number = ?");
      params.push(String(bl_number).trim() || "");
    }
    if (is_from_preorder !== undefined) {
      updates.push("is_from_preorder = ?");
      params.push(is_from_preorder ? 1 : 0);
    }
    if (comment !== undefined) {
      updates.push("comment = ?");
      params.push((comment || "").trim() || null);
    }
    if (catalog_file_id !== undefined) {
      updates.push("catalog_file_id = ?");
      params.push(catalog_file_id != null && catalog_file_id !== "" ? parseInt(catalog_file_id, 10) : null);
    }
    if (updates.length) {
      params.push(id);
      await queryPromise(
        `UPDATE receptions SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }

    if (Array.isArray(lignes)) {
      await queryPromise("DELETE FROM reception_lignes WHERE reception_id = ?", [id]);
      for (const ligne of lignes) {
        const productId = ligne.product_id;
        const qte = parseFloat(ligne.quantite_recue) || 0;
        const prix = parseFloat(ligne.prix_unitaire) || 0;
        const commentL = (ligne.comment || "").trim() || null;
        if (!productId || qte <= 0) continue;

        const [prod] = await queryPromise(
          "SELECT id, prix FROM products WHERE id = ? AND organization_id = ?",
          [productId, orgId]
        );
        if (!prod) continue;

        const prixBase = prod.prix != null ? parseFloat(prod.prix) : null;
        await queryPromise(
          `INSERT INTO reception_lignes (reception_id, product_id, quantite_recue, prix_unitaire, prix_base, comment)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, productId, qte, prix, prixBase, commentL]
        );
      }
    }

    const [updated] = await queryPromise(
      `SELECT r.*, s.nom AS supplier_nom FROM receptions r
       INNER JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ?`,
      [id]
    );
    const lignesList = await queryPromise(
      `SELECT rl.id, rl.product_id, rl.quantite_recue, rl.prix_unitaire, rl.prix_base, rl.comment,
              p.nom AS product_nom, p.unite
       FROM reception_lignes rl INNER JOIN products p ON p.id = rl.product_id
       WHERE rl.reception_id = ? ORDER BY p.nom`,
      [id]
    );
    res.json({ success: true, reception: updated, lignes: lignesList || [] });
  } catch (error) {
    console.error("Erreur mise à jour réception:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/receptions/:id/validate
 * Valider la réception : mise à jour des stocks, enregistrement des mouvements, statut validated.
 */
router.post("/:id/validate", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const userId = getCurrentUserId(req);
    const id = parseInt(req.params.id, 10);

    const [rec] = await queryPromise(
      "SELECT id FROM receptions WHERE id = ? AND organization_id = ? AND statut = 'draft'",
      [id, orgId]
    );
    if (!rec) {
      return res.status(404).json({ success: false, error: "Réception non trouvée ou déjà validée" });
    }

    const lignes = await queryPromise(
      "SELECT id, product_id, quantite_recue FROM reception_lignes WHERE reception_id = ?",
      [id]
    );
    if (!lignes || lignes.length === 0) {
      return res.status(400).json({ success: false, error: "Aucune ligne à valider" });
    }

    for (const ligne of lignes) {
      const qte = parseFloat(ligne.quantite_recue) || 0;
      if (qte <= 0) continue;

      const [prod] = await queryPromise(
        "SELECT id, stock FROM products WHERE id = ? AND organization_id = ?",
        [ligne.product_id, orgId]
      );
      if (!prod) continue;

      const stockAvant = parseFloat(prod.stock) || 0;
      const stockApres = stockAvant + qte;

      await queryPromise(
        "UPDATE products SET stock = ? WHERE id = ? AND organization_id = ?",
        [stockApres, ligne.product_id, orgId]
      );
      await queryPromise(
        `INSERT INTO stock_movements
         (organization_id, product_id, type, quantite, stock_avant, stock_apres, reference_type, reference_id, created_by, comment)
         VALUES (?, ?, 'reception', ?, ?, ?, 'reception', ?, ?, ?)`,
        [orgId, ligne.product_id, qte, stockAvant, stockApres, id, userId, `Réception BL #${id}`]
      );
    }

    await queryPromise(
      "UPDATE receptions SET statut = 'validated', validated_at = NOW(), validated_by = ? WHERE id = ?",
      [userId, id]
    );

    res.json({ success: true, message: "Réception validée", nb_lignes: lignes.length });
  } catch (error) {
    console.error("Erreur validation réception:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/receptions/:id
 * Supprimer une réception (draft uniquement).
 */
router.delete("/:id", requireReception, async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const id = parseInt(req.params.id, 10);

    const [rec] = await queryPromise(
      "SELECT id FROM receptions WHERE id = ? AND organization_id = ? AND statut = 'draft'",
      [id, orgId]
    );
    if (!rec) {
      return res.status(404).json({ success: false, error: "Réception non trouvée ou déjà validée" });
    }

    await queryPromise("DELETE FROM reception_lignes WHERE reception_id = ?", [id]);
    await queryPromise("DELETE FROM receptions WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression réception:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
