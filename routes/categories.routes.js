const express = require("express");
const router = express.Router();
const { db } = require("../config/db-trace-wrapper");
const { requirePermission } = require("../middleware/rbac.middleware");
const { renderAdminView } = require("../utils/view-helpers");
const { getCurrentOrgId } = require("../utils/session-helpers");
const { queryWithUser } = require("../config/db-trace-wrapper");
const csrfProtection = require("../config/csrf");

// ============================================================================
// Liste des catégories - Version Vue.js
// ============================================================================
router.get("/vue", requirePermission('categories'), (req, res) => {
  renderAdminView(res, "admin_categories_list_vue");
});

// ============================================================================
// Liste des catégories - Redirection vers Vue+Vite
// ============================================================================
router.get("/", requirePermission('categories'), (req, res) => {
  res.redirect("/admin/categories/vue");
});

// ============================================================================
// Formulaire de création (Vue+Vite)
// ============================================================================
router.get("/new", requirePermission('categories'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);

  db.query(
    "SELECT * FROM categories WHERE organization_id = ? ORDER BY ordre, nom",
    [orgId],
    (err, allCategories) => {
      const payload = {
        category: null,
        allCategories: allCategories || [],
        csrfToken: req.csrfToken(),
        APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
      };
      res.render("admin_category_form_vue", payload);
    }
  );
});

// ============================================================================
// Créer une catégorie
// ============================================================================
router.post("/", requirePermission('categories'), csrfProtection, (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  const {
    nom,
    description,
    parent_id,
    ordre,
    couleur,
    icon,
    is_active
  } = req.body;
  const orgId = getCurrentOrgId(req);

  if (!nom || nom.trim() === "") {
    if (wantsJson) return res.status(400).json({ success: false, error: "Le nom de la catégorie est obligatoire" });
    return res.status(400).send("Le nom de la catégorie est obligatoire");
  }

  queryWithUser(`
    INSERT INTO categories (
      organization_id, nom, description, parent_id,
      ordre, couleur, icon, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    orgId,
    nom.trim(),
    description || null,
    parent_id || null,
    ordre || 0,
    couleur || null,
    icon || null,
    is_active ? 1 : 0
  ], (err) => {
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la création de la catégorie" });
      return res.status(500).send("Erreur lors de la création de la catégorie");
    }
    if (wantsJson) return res.json({ success: true, redirect: "/admin/categories" });
    res.redirect("/admin/categories");
  }, req);
});

// ============================================================================
// Formulaire d'édition (Vue+Vite)
// ============================================================================
router.get("/:id/edit", requirePermission('categories'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const categoryId = req.params.id;

  db.query(
    "SELECT * FROM categories WHERE id = ? AND organization_id = ?",
    [categoryId, orgId],
    (err, categories) => {
      if (err || !categories || categories.length === 0) {
        return res.status(404).send("Catégorie non trouvée");
      }

      const category = categories[0];

      db.query(
        "SELECT * FROM categories WHERE organization_id = ? AND id != ? ORDER BY ordre, nom",
        [orgId, categoryId],
        (err2, allCategories) => {
          const errorMessage = req.session.errorMessage;
          const successMessage = req.session.successMessage;
          delete req.session.errorMessage;
          delete req.session.successMessage;

          const payload = {
            category,
            allCategories: allCategories || [],
            csrfToken: req.csrfToken(),
            errorMessage: errorMessage || null,
            successMessage: successMessage || null,
            APP_VERSION: req.app.locals.APP_VERSION || Date.now(),
          };
          res.render("admin_category_form_vue", payload);
        }
      );
    }
  );
});

// ============================================================================
// Modifier une catégorie
// ============================================================================
router.post("/:id", requirePermission('categories'), csrfProtection, (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  const orgId = getCurrentOrgId(req);
  const categoryId = req.params.id;
  const {
    nom,
    description,
    parent_id,
    ordre,
    couleur,
    icon,
    is_active
  } = req.body;

  if (!nom || nom.trim() === "") {
    if (wantsJson) return res.status(400).json({ success: false, error: "Le nom de la catégorie est obligatoire" });
    return res.status(400).send("Le nom de la catégorie est obligatoire");
  }

  if (parent_id && parseInt(parent_id) === parseInt(categoryId)) {
    if (wantsJson) return res.status(400).json({ success: false, error: "Une catégorie ne peut pas être sa propre parente" });
    return res.status(400).send("Une catégorie ne peut pas être sa propre parente");
  }

  queryWithUser(`
    UPDATE categories SET
      nom = ?,
      description = ?,
      parent_id = ?,
      ordre = ?,
      couleur = ?,
      icon = ?,
      is_active = ?,
      updated_at = NOW()
    WHERE id = ? AND organization_id = ?
  `, [
    nom.trim(),
    description || null,
    parent_id || null,
    ordre || 0,
    couleur || null,
    icon || null,
    is_active ? 1 : 0,
    categoryId,
    orgId
  ], (err) => {
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la modification de la catégorie" });
      return res.status(500).send("Erreur lors de la modification de la catégorie");
    }
    if (wantsJson) return res.json({ success: true, redirect: "/admin/categories" });
    res.redirect("/admin/categories");
  }, req);
});

// ============================================================================
// Désactiver une catégorie (soft delete)
// ============================================================================
router.post("/:id/delete", requirePermission('categories'), csrfProtection, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const categoryId = req.params.id;

  // Vérifier qu'il n'y a pas de produits dans cette catégorie
  db.query(
    "SELECT COUNT(*) as nb_products FROM products WHERE category_id = ?",
    [categoryId],
    (err, results) => {
      if (err) {
        return res.status(500).send("Erreur lors de la vérification des produits");
      }

      const productCount = results[0].nb_products;

      if (productCount > 0) {
        req.session.errorMessage = `Impossible de supprimer cette catégorie : ${productCount} produit(s) y sont encore associés. Veuillez d'abord réassigner ou supprimer ces produits, ou fusionner cette catégorie avec une autre.`;
        return res.redirect(`/admin/categories/${categoryId}/edit`);
      }

      // Vérifier qu'il n'y a pas de sous-catégories
      db.query(
        "SELECT COUNT(*) as nb_subcategories FROM categories WHERE parent_id = ?",
        [categoryId],
        (err, subResults) => {
          if (err) {
            return res.status(500).send("Erreur lors de la vérification des sous-catégories");
          }

          const subcategoryCount = subResults[0].nb_subcategories;

          if (subcategoryCount > 0) {
            req.session.errorMessage = `Impossible de supprimer cette catégorie : ${subcategoryCount} sous-catégorie(s) y sont encore rattachées. Veuillez d'abord les supprimer ou les rattacher à une autre catégorie.`;
            return res.redirect(`/admin/categories/${categoryId}/edit`);
          }

          // Aucun produit ni sous-catégorie, on peut supprimer
          queryWithUser(
            "DELETE FROM categories WHERE id = ? AND organization_id = ?",
            [categoryId, orgId],
            (err, result) => {
              if (err) {
                return res.status(500).send("Erreur lors de la suppression de la catégorie");
              }

              if (result.affectedRows === 0) {
                return res.status(404).send("Catégorie introuvable");
              }

              req.session.successMessage = "Catégorie supprimée avec succès";
              res.redirect("/admin/categories");
            },
            req
          );
        }
      );
    }
  );
});

module.exports = router;
