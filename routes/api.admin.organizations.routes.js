const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { queryWithUser } = require("../config/db-trace-wrapper");
const { requirePermission } = require("../middleware/rbac.middleware");
const { logger } = require("../config/logger");

/**
 * GET /api/admin/organizations
 * Retourne la liste des organisations
 */
router.get("/", requirePermission("organizations", { json: true }), (req, res) => {
  db.query(
    "SELECT id, name, email, created_at FROM organizations ORDER BY name",
    (err, organizations) => {
      if (err) {
        logger.error("Erreur lors de la récupération des organisations", { error: err });
        return res.json({
          success: false,
          error: "Erreur lors du chargement des organisations",
        });
      }

      res.json({
        success: true,
        organizations: organizations || [],
      });
    }
  );
});

/**
 * GET /api/admin/organizations/:id
 * Retourne une organisation par son ID
 */
router.get("/:id", requirePermission("organizations", { json: true }), (req, res) => {
  db.query(
    "SELECT id, name, email, created_at FROM organizations WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err) {
        logger.error("Erreur lors de la récupération de l'organisation", { error: err });
        return res.json({
          success: false,
          error: "Erreur lors de la récupération",
        });
      }

      if (results.length === 0) {
        return res.json({
          success: false,
          error: "Organisation introuvable",
        });
      }

      res.json({
        success: true,
        organization: results[0],
      });
    }
  );
});

/**
 * GET /api/admin/organizations/:id/stats
 * Retourne les statistiques d'une organisation
 */
router.get("/:id/stats", requirePermission("organizations", { json: true }), (req, res) => {
  const orgId = req.params.id;

  // Requêtes parallèles pour obtenir les stats
  const queries = {
    users: new Promise((resolve, reject) => {
      db.query(
        "SELECT COUNT(*) as count FROM users WHERE organization_id = ?",
        [orgId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results[0]?.count || 0);
        }
      );
    }),
    catalogues: new Promise((resolve, reject) => {
      db.query(
        "SELECT COUNT(*) as count FROM catalogues WHERE organization_id = ?",
        [orgId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results[0]?.count || 0);
        }
      );
    }),
    commandes: new Promise((resolve, reject) => {
      db.query(
        "SELECT COUNT(*) as count FROM commandes c INNER JOIN catalogues cat ON c.catalogue_id = cat.id WHERE cat.organization_id = ?",
        [orgId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results[0]?.count || 0);
        }
      );
    }),
  };

  Promise.all([queries.users, queries.catalogues, queries.commandes])
    .then(([userCount, catalogueCount, commandeCount]) => {
      res.json({
        success: true,
        stats: {
          users: parseInt(userCount, 10) || 0,
          catalogues: parseInt(catalogueCount, 10) || 0,
          commandes: parseInt(commandeCount, 10) || 0,
        },
      });
    })
    .catch((err) => {
      logger.error("Erreur lors de la récupération des stats", { error: err });
      res.json({
        success: false,
        error: "Erreur lors du chargement des statistiques",
      });
    });
});

/**
 * POST /api/admin/organizations
 * Créer une nouvelle organisation
 */
router.post("/", requirePermission("organizations", { json: true }), (req, res) => {
  const { name, email } = req.body;

  // Validation
  if (!name || name.trim().length < 2) {
    return res.json({
      success: false,
      error: "Le nom doit contenir au moins 2 caractères",
    });
  }

  queryWithUser(
    "INSERT INTO organizations (name, email) VALUES (?, ?)",
    [name.trim(), email ? email.trim() : null],
    (err, result) => {
      if (err) {
        logger.error("Erreur lors de la création de l'organisation", { error: err });
        return res.json({
          success: false,
          error: "Erreur lors de la création",
        });
      }

      res.json({
        success: true,
        message: "Organisation créée avec succès",
        organizationId: result.insertId,
      });
    },
    req
  );
});

/**
 * PUT /api/admin/organizations/:id
 * Modifier une organisation
 */
router.put("/:id", requirePermission("organizations", { json: true }), (req, res) => {
  const { name, email } = req.body;
  const id = req.params.id;

  // Validation
  if (!name || name.trim().length < 2) {
    return res.json({
      success: false,
      error: "Le nom doit contenir au moins 2 caractères",
    });
  }

  queryWithUser(
    "UPDATE organizations SET name = ?, email = ? WHERE id = ?",
    [name.trim(), email ? email.trim() : null, id],
    (err, result) => {
      if (err) {
        logger.error("Erreur lors de la modification de l'organisation", { error: err });
        return res.json({
          success: false,
          error: "Erreur lors de la modification",
        });
      }

      if (result.affectedRows === 0) {
        return res.json({
          success: false,
          error: "Organisation introuvable",
        });
      }

      res.json({
        success: true,
        message: "Organisation modifiée avec succès",
      });
    },
    req
  );
});

/**
 * DELETE /api/admin/organizations/:id
 * Supprimer une organisation
 */
router.delete("/:id", requirePermission("organizations", { json: true }), (req, res) => {
  const id = req.params.id;

  // Vérifier d'abord si l'organisation a des utilisateurs, catalogues, etc.
  db.query(
    "SELECT COUNT(*) as count FROM users WHERE organization_id = ?",
    [id],
    (err, results) => {
      if (err) {
        logger.error("Erreur lors de la vérification", { error: err });
        return res.json({
          success: false,
          error: "Erreur lors de la vérification",
        });
      }

      const userCount = parseInt(results[0]?.count || 0, 10);

      if (userCount > 0) {
        return res.json({
          success: false,
          error: `Impossible de supprimer : ${userCount} utilisateur(s) associé(s)`,
        });
      }

      // Vérifier les catalogues
      db.query(
        "SELECT COUNT(*) as count FROM catalogues WHERE organization_id = ?",
        [id],
        (err2, results2) => {
          if (err2) {
            logger.error("Erreur lors de la vérification", { error: err2 });
            return res.json({
              success: false,
              error: "Erreur lors de la vérification",
            });
          }

          const catalogueCount = parseInt(results2[0]?.count || 0, 10);

          if (catalogueCount > 0) {
            return res.json({
              success: false,
              error: `Impossible de supprimer : ${catalogueCount} catalogue(s) associé(s)`,
            });
          }

          // Suppression possible
          queryWithUser(
            "DELETE FROM organizations WHERE id = ?",
            [id],
            (err3, result) => {
              if (err3) {
                logger.error("Erreur lors de la suppression", { error: err3 });
                return res.json({
                  success: false,
                  error: "Erreur lors de la suppression",
                });
              }

              if (result.affectedRows === 0) {
                return res.json({
                  success: false,
                  error: "Organisation introuvable",
                });
              }

              res.json({
                success: true,
                message: "Organisation supprimée avec succès",
              });
            },
            req
          );
        }
      );
    }
  );
});

module.exports = router;
