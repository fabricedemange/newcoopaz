const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission, requireAnyPermission } = require("../middleware/rbac.middleware");
const { renderAdminView } = require("../utils/view-helpers");
const { getCurrentOrgId, getCurrentUserId } = require("../utils/session-helpers");
const { queryWithUser } = require("../config/db-trace-wrapper");
const csrfProtection = require("../config/csrf");

// ============================================================================
// Liste des fournisseurs - Version Vue.js
// ============================================================================
router.get("/vue", requirePermission('suppliers'), (req, res) => {
  renderAdminView(res, "admin_suppliers_list_vue");
});

// ============================================================================
// Liste des fournisseurs - Redirection vers Vue+Vite
// ============================================================================
router.get("/", requirePermission('suppliers'), (req, res) => {
  res.redirect("/admin/suppliers/vue");
});

// ============================================================================
// Formulaire de création (Vue+Vite) — redirige vers la liste avec modal
// ============================================================================
router.get("/new", requirePermission('suppliers'), (req, res) => {
  res.redirect("/admin/suppliers/vue?modal=new");
});

// ============================================================================
// Créer un fournisseur
// ============================================================================
router.post("/", requirePermission('suppliers'), csrfProtection, (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  const {
    nom,
    contact_nom,
    email,
    telephone,
    adresse,
    code_postal,
    ville,
    siret,
    notes,
    is_active
  } = req.body;
  const orgId = getCurrentOrgId(req);

  if (!nom || nom.trim() === "") {
    if (wantsJson) return res.status(400).json({ success: false, error: "Le nom du fournisseur est obligatoire" });
    return res.status(400).send("Le nom du fournisseur est obligatoire");
  }

  queryWithUser(`
    INSERT INTO suppliers (
      organization_id, nom, contact_nom, email, telephone,
      adresse, code_postal, ville, siret, notes, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    orgId,
    nom.trim(),
    contact_nom || null,
    email || null,
    telephone || null,
    adresse || null,
    code_postal || null,
    ville || null,
    siret || null,
    notes || null,
    is_active ? 1 : 0
  ], (err, result) => {
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la création du fournisseur" });
      return res.status(500).send("Erreur lors de la création du fournisseur");
    }
    const redirect = result && result.insertId ? `/admin/suppliers/${result.insertId}` : "/admin/suppliers";
    if (wantsJson) return res.json({ success: true, redirect });
    res.redirect(redirect);
  }, req);
});

// ============================================================================
// Détails d'un fournisseur (Vue+Vite)
// ============================================================================
router.get("/:id", requirePermission('suppliers'), (req, res) => {
  const orgId = getCurrentOrgId(req);
  const supplierId = req.params.id;

  db.query(
    "SELECT * FROM suppliers WHERE id = ? AND organization_id = ?",
    [supplierId, orgId],
    (err, suppliers) => {
      if (err || !suppliers || suppliers.length === 0) {
        return res.status(404).send("Fournisseur non trouvé");
      }

      const supplier = suppliers[0];

      db.query(`
        SELECT
          p.*,
          c.nom as categorie,
          c.couleur as categorie_couleur,
          COUNT(DISTINCT cp.catalog_file_id) as nb_catalogues
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN catalog_products cp ON cp.product_id = p.id
        WHERE p.supplier_id = ?
        GROUP BY p.id
        ORDER BY p.nom
      `, [supplierId], (err2, products) => {
        const payload = {
          supplier,
          products: products || [],
          APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
        };
        res.render("admin_supplier_detail_vue", payload);
      });
    }
  );
});

// ============================================================================
// Formulaire d'édition (Vue+Vite)
// ============================================================================
router.get("/:id/edit", requirePermission('suppliers'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const supplierId = req.params.id;

  db.query(
    "SELECT * FROM suppliers WHERE id = ? AND organization_id = ?",
    [supplierId, orgId],
    (err, suppliers) => {
      if (err || !suppliers || suppliers.length === 0) {
        return res.status(404).send("Fournisseur non trouvé");
      }

      const errorMessage = req.session.errorMessage;
      const successMessage = req.session.successMessage;
      delete req.session.errorMessage;
      delete req.session.successMessage;

      const payload = {
        supplier: suppliers[0],
        csrfToken: req.csrfToken(),
        errorMessage: errorMessage || null,
        successMessage: successMessage || null,
        APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
      };
      res.render("admin_supplier_form_vue", payload);
    }
  );
});

// ============================================================================
// Modifier un fournisseur
// ============================================================================
router.post("/:id", requirePermission('suppliers'), csrfProtection, (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  const orgId = getCurrentOrgId(req);
  const supplierId = req.params.id;
  const {
    nom,
    contact_nom,
    email,
    telephone,
    adresse,
    code_postal,
    ville,
    siret,
    notes,
    is_active
  } = req.body;

  if (!nom || nom.trim() === "") {
    if (wantsJson) return res.status(400).json({ success: false, error: "Le nom du fournisseur est obligatoire" });
    return res.status(400).send("Le nom du fournisseur est obligatoire");
  }

  queryWithUser(`
    UPDATE suppliers SET
      nom = ?,
      contact_nom = ?,
      email = ?,
      telephone = ?,
      adresse = ?,
      code_postal = ?,
      ville = ?,
      siret = ?,
      notes = ?,
      is_active = ?,
      updated_at = NOW()
    WHERE id = ? AND organization_id = ?
  `, [
    nom.trim(),
    contact_nom || null,
    email || null,
    telephone || null,
    adresse || null,
    code_postal || null,
    ville || null,
    siret || null,
    notes || null,
    is_active ? 1 : 0,
    supplierId,
    orgId
  ], (err) => {
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la modification du fournisseur" });
      return res.status(500).send("Erreur lors de la modification du fournisseur");
    }
    if (wantsJson) return res.json({ success: true, redirect: `/admin/suppliers/${supplierId}` });
    res.redirect(`/admin/suppliers/${supplierId}`);
  }, req);
});

// ============================================================================
// Supprimer un fournisseur (hard delete)
// ============================================================================
router.post("/:id/delete", requirePermission('suppliers'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const supplierId = req.params.id;

  // Vérifier d'abord s'il y a des produits associés
  queryWithUser(
    "SELECT COUNT(*) as count FROM products WHERE supplier_id = ?",
    [supplierId],
    (err, results) => {
      if (err) {
        return res.status(500).send("Erreur lors de la vérification des produits associés");
      }

      const productCount = results[0].count;

      if (productCount > 0) {
        // Il y a des produits associés, on ne peut pas supprimer
        req.session.errorMessage = `Impossible de supprimer ce fournisseur : ${productCount} produit(s) y sont encore associés. Veuillez d'abord réassigner ou supprimer ces produits, ou fusionner ce fournisseur avec un autre.`;
        return res.redirect(`/admin/suppliers/${supplierId}/edit`);
      }

      // Aucun produit associé, on peut supprimer
      queryWithUser(
        "DELETE FROM suppliers WHERE id = ? AND organization_id = ?",
        [supplierId, orgId],
        (err, result) => {
          if (err) {
            return res.status(500).send("Erreur lors de la suppression du fournisseur");
          }

          if (result.affectedRows === 0) {
            return res.status(404).send("Fournisseur introuvable");
          }

          req.session.successMessage = "Fournisseur supprimé avec succès";
          res.redirect("/admin/suppliers");
        },
        req
      );
    },
    req
  );
});

module.exports = router;
