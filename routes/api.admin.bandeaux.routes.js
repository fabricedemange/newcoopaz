const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { queryWithUser } = require("../config/db-trace-wrapper");
const { requirePermission } = require("../middleware/rbac.middleware");
const {
  getCurrentOrgId,
  getCurrentUserRole,
  getCurrentUsername,
} = require("../utils/session-helpers");
const { getAllOrganizations } = require("../utils/db-helpers");

/**
 * GET /api/admin/bandeaux
 * Retourne la liste des bandeaux (filtrée par org sauf pour SuperAdmin)
 */
router.get("/", requirePermission("users", { json: true }), (req, res) => {
  let sql = `SELECT b.*, o.name AS organization_name
              FROM bandeaux b
              LEFT JOIN organizations o ON b.organization_id = o.id`;
  let params = [];

  if (getCurrentUserRole(req) !== "SuperAdmin") {
    sql += " WHERE b.organization_id = ?";
    params.push(getCurrentOrgId(req));
  }

  sql += " ORDER BY b.expiration_date ASC";

  db.query(sql, params, (err, bandeaux) => {
    if (err) {
      console.error("Erreur lors de la récupération des bandeaux", err);
      return res.json({
        success: false,
        error: "Erreur lors du chargement des bandeaux",
      });
    }

    res.json({
      success: true,
      bandeaux: bandeaux || [],
      userRole: getCurrentUserRole(req),
      organizationId: getCurrentOrgId(req),
    });
  });
});

/**
 * GET /api/admin/bandeaux/organizations
 * Retourne les organisations disponibles (pour SuperAdmin)
 */
router.get("/organizations", requirePermission("users", { json: true }), (req, res) => {
  if (getCurrentUserRole(req) !== "SuperAdmin") {
    return res.json({
      success: false,
      error: "Accès refusé",
    });
  }

  getAllOrganizations((err, orgs) => {
    if (err) {
      return res.json({
        success: false,
        error: "Erreur lors du chargement des organisations",
      });
    }

    res.json({
      success: true,
      organizations: orgs || [],
    });
  });
});

/**
 * POST /api/admin/bandeaux
 * Créer un nouveau bandeau
 */
router.post("/", requirePermission("users", { json: true }), (req, res) => {
  let { message, expiration_date, page_cible, type, organization_id } = req.body;

  // Validation
  if (!message || !type || !["info", "important"].includes(type)) {
    return res.json({
      success: false,
      error: !message ? "Le message est obligatoire" : "Le type de bandeau est obligatoire",
    });
  }

  // Normaliser les valeurs vides
  if (!page_cible || page_cible.trim() === "") {
    page_cible = null;
  }

  // Non-SuperAdmin : forcer son org
  if (getCurrentUserRole(req) !== "SuperAdmin") {
    organization_id = getCurrentOrgId(req);
  }

  if (organization_id === "") {
    organization_id = null;
  }

  queryWithUser(
    `INSERT INTO bandeaux (message, expiration_date, page_cible, type, organization_id) VALUES (?, ?, ?, ?, ?)`,
    [
      message,
      expiration_date || null,
      page_cible,
      type,
      organization_id,
    ],
    (err) => {
      if (err) {
        console.error("Erreur lors de l'ajout du bandeau", err);
        return res.json({
          success: false,
          error: "Erreur lors de l'ajout du bandeau",
        });
      }

      res.json({
        success: true,
        message: "Bandeau créé avec succès",
      });
    },
    req
  );
});

/**
 * GET /api/admin/bandeaux/:id
 * Retourne un bandeau par son ID
 */
router.get("/:id", requirePermission("users", { json: true }), (req, res) => {
  db.query(
    "SELECT b.*, o.name AS organization_name FROM bandeaux b LEFT JOIN organizations o ON b.organization_id = o.id WHERE b.id = ?",
    [req.params.id],
    (err, results) => {
      if (err) {
        return res.json({
          success: false,
          error: "Erreur lors de la récupération du bandeau",
        });
      }

      if (results.length === 0) {
        return res.json({
          success: false,
          error: "Bandeau introuvable",
        });
      }

      const bandeau = results[0];

      // Vérifier droits d'accès
      if (
        getCurrentUserRole(req) !== "SuperAdmin" &&
        bandeau.organization_id != getCurrentOrgId(req)
      ) {
        return res.json({
          success: false,
          error: "Accès refusé",
        });
      }

      res.json({
        success: true,
        bandeau,
      });
    }
  );
});

/**
 * PUT /api/admin/bandeaux/:id
 * Modifier un bandeau
 */
router.put("/:id", requirePermission("users", { json: true }), (req, res) => {
  const { message, page_cible, expiration_date, type, organization_id } = req.body;

  // Validation
  if (!message || !type || !["info", "important"].includes(type)) {
    return res.json({
      success: false,
      error: !message ? "Le message est obligatoire" : "Le type de bandeau est obligatoire",
    });
  }

  // Vérifier que le bandeau existe et que l'utilisateur a le droit de le modifier
  db.query("SELECT * FROM bandeaux WHERE id = ?", [req.params.id], (err, results) => {
    if (err || results.length === 0) {
      return res.json({
        success: false,
        error: "Bandeau introuvable",
      });
    }

    const bandeau = results[0];

    if (
      getCurrentUserRole(req) !== "SuperAdmin" &&
      bandeau.organization_id != getCurrentOrgId(req)
    ) {
      return res.json({
        success: false,
        error: "Accès refusé",
      });
    }

    const expirationValue = expiration_date || null;
    const pageCibleValue = page_cible || null;

    queryWithUser(
      "UPDATE bandeaux SET message = ?, page_cible = ?, expiration_date = ?, type = ?, organization_id = ? WHERE id = ?",
      [
        message,
        pageCibleValue,
        expirationValue,
        type,
        organization_id || null,
        req.params.id,
      ],
      (err) => {
        if (err) {
          console.error("Erreur lors de la modification du bandeau", err);
          return res.json({
            success: false,
            error: "Erreur lors de la modification",
          });
        }

        res.json({
          success: true,
          message: "Bandeau modifié avec succès",
        });
      },
      req
    );
  });
});

/**
 * DELETE /api/admin/bandeaux/:id
 * Supprimer un bandeau
 */
router.delete("/:id", requirePermission("users", { json: true }), (req, res) => {
  db.query(
    "SELECT * FROM bandeaux WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.json({
          success: false,
          error: "Bandeau introuvable",
        });
      }

      const bandeau = results[0];

      if (
        getCurrentUserRole(req) !== "SuperAdmin" &&
        bandeau.organization_id != getCurrentOrgId(req)
      ) {
        return res.json({
          success: false,
          error: "Accès refusé",
        });
      }

      queryWithUser(
        "DELETE FROM bandeaux WHERE id = ?",
        [req.params.id],
        (err) => {
          if (err) {
            console.error("Erreur lors de la suppression du bandeau", err);
            return res.json({
              success: false,
              error: "Erreur lors de la suppression",
            });
          }

          res.json({
            success: true,
            message: "Bandeau supprimé avec succès",
          });
        },
        req
      );
    }
  );
});

module.exports = router;
