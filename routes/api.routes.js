const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { logger } = require("../config/logger");
const { queryWithUser } = require("../config/db-trace-wrapper");
const {
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentOrgId,
} = require("../utils/session-helpers");
const { handleDatabaseError } = require("../utils/error-helpers");
const { debugLog } = require("../utils/logger-helpers");

// POST /article/:id/note - Modifier la note d'un article
router.post("/article/:id/note", (req, res) => {
  const wantsJson =
    req.xhr ||
    req.headers["x-requested-with"] === "XMLHttpRequest" ||
    (req.get("accept") || "").toLowerCase().includes("application/json");

  if (!getCurrentUserId(req)) {
    if (wantsJson) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    return res.redirect("/login");
  }

  const articleId = req.params.id;
  const { note } = req.body;

  debugLog("Sauvegarde note article", {
    articleId,
    note,
    userId: getCurrentUserId(req),
  });

  db.query(
    `SELECT pa.*, p.user_id 
     FROM panier_articles pa
     JOIN paniers p ON pa.panier_id = p.id
     WHERE pa.id = ?`,
    [articleId],
    (err, results) => {
      if (err) {
        debugLog("Erreur lors de la récupération de l'article", {
          error: err,
        });
        if (wantsJson) {
          return res.status(500).json({ error: "Erreur serveur" });
        }
        return res.status(500).send("Erreur serveur");
      }

      if (!results || results.length === 0) {
        if (wantsJson) {
          return res.status(404).json({ error: "Article non trouvé" });
        }
        return res.status(404).send("Article non trouvé");
      }

      const article = results[0];

      if (
        article.user_id !== getCurrentUserId(req) &&
        !["admin", "epicier", "referent", "SuperAdmin"].includes(
          getCurrentUserRole(req)
        )
      ) {
        debugLog(
          "Accès refusé: user_id du panier:",
          article.user_id,
          "user_id session:",
          getCurrentUserId(req),
          "role:",
          getCurrentUserRole(req)
        );
        if (wantsJson) {
          return res
            .status(403)
            .json({ error: "Non autorisé à modifier cette note" });
        }
        return res.status(403).send("Non autorisé");
      }

      queryWithUser(
        "UPDATE panier_articles SET note = ? WHERE id = ?",
        [note, articleId],
        (err, result) => {
          if (err) {
            debugLog(
              "Erreur lors de la mise à jour de la note d'article:",
              err
            );
            if (wantsJson) {
              return res.status(500).json({
                error: "Erreur lors de la sauvegarde de la note",
                details: err.message,
              });
            }
            return res.status(500).send("Erreur serveur");
          }

          console.log(
            "Note article mise à jour avec succès, lignes affectées:",
            result.affectedRows
          );

          if (wantsJson) {
            return res.json({
              success: true,
              message: "Note sauvegardée avec succès",
            });
          }

          const referer = req.get("Referer") || req.headers.referer;
          if (referer) {
            return res.redirect(referer);
          } else {
            return res.redirect("/panier/vue");
          }
        },
        req
      );
    }
  );
});

// API: Récupérer les données des commandes pour stats
router.get(
  "/admin/stats/commandes",
  requirePermission("admin", { json: true }),
  (req, res) => {
    db.query(
      `SELECT paniers.id as commande_id, paniers.created_at, users.username, 
     CONCAT(catalog_files.originalname, ' (', catalog_files.id, ')') AS catalogue, 
     catalog_files.description AS description, catalog_files.expiration_date, catalog_files.is_archived
     FROM paniers
     JOIN users ON paniers.user_id = users.id
     JOIN catalog_files ON paniers.catalog_file_id = catalog_files.id
     WHERE paniers.is_submitted = 1
     ORDER BY paniers.created_at DESC
     LIMIT 100`,
      [],
      (err, commandes) => {
        if (err) {
          debugLog("Erreur lors de la récupération des commandes:", err);
          return res
            .status(500)
            .json({ error: "Erreur lors de la récupération des commandes." });
        }
        res.json(commandes);
      }
    );
  }
);

// API: Récupérer les données des utilisateurs pour stats
router.get(
  "/admin/stats/utilisateurs",
  requirePermission("admin", { json: true }),
  (req, res) => {
    db.query(
      "SELECT id, username, role, email, last_login FROM users WHERE organization_id = ? ORDER BY id DESC",
      [getCurrentOrgId(req)],
      [],
      (err, utilisateurs) => {
        if (err) {
          debugLog("Erreur lors de la récupération des utilisateurs:", err);
          return res.status(500).json({
            error: "Erreur lors de la récupération des utilisateurs.",
          });
        }
        res.json(utilisateurs);
      }
    );
  }
);

// API: Récupérer les données des catalogues pour stats
router.get(
  "/admin/stats/catalogues",
  requirePermission("admin", { json: true }),
  (req, res) => {
    db.query(
      `SELECT
      cf.id AS catalogue_id,
      CONCAT(cf.originalname, ' (', cf.id, ')') AS originalname_id,
      DATE_FORMAT(cf.expiration_date, '%d/%m/%Y') AS expiration_date,
      COUNT(DISTINCT p.id) AS nombre_commandes,
      ROUND(COALESCE(SUM(pa.quantity * a.prix), 0), 2) AS montant_total
    FROM catalog_files cf
    LEFT JOIN paniers p ON p.catalog_file_id = cf.id AND p.is_submitted = 1
    LEFT JOIN panier_articles pa ON pa.panier_id = p.id
    LEFT JOIN articles a ON pa.article_id = a.id
    GROUP BY cf.id, cf.originalname, cf.expiration_date
    ORDER BY cf.expiration_date DESC`,
      [],
      (err, catalogues) => {
        if (err) {
          debugLog("Erreur lors de la récupération des catalogues:", err);
          return res
            .status(500)
            .json({ error: "Erreur lors de la récupération des catalogues." });
        }
        res.json(catalogues);
      }
    );
  }
);

// API: Statistiques commandes par période (semaine + mois)
router.get(
  "/admin/stats/commandes-periode",
  requirePermission("admin", { json: true }),
  (req, res) => {
    const sql = `WITH weekly AS (
  SELECT
    DATE_FORMAT(created_at, '%x-%v') AS semaine_iso,
    STR_TO_DATE(CONCAT(DATE_FORMAT(created_at, '%x%v'), '1'), '%x%v%w') AS semaine_debut,
    DATE_ADD(STR_TO_DATE(CONCAT(DATE_FORMAT(created_at, '%x%v'), '1'), '%x%v%w'), INTERVAL 6 DAY) AS semaine_fin,
    COUNT(*) AS nb_commandes
  FROM paniers
  WHERE is_submitted = 1
  GROUP BY semaine_iso, semaine_debut, semaine_fin
),
monthly AS (
  SELECT
    DATE_FORMAT(created_at, '%Y-%m') AS mois_iso,
    DATE_FORMAT(MIN(created_at), '%Y-%m-01') AS mois_debut,
    LAST_DAY(MAX(created_at)) AS mois_fin,
    COUNT(*) AS nb_commandes
  FROM paniers
  WHERE is_submitted = 1
  GROUP BY mois_iso
)
SELECT
  'semaine' AS periode_type,
  semaine_iso AS periode_label,
  semaine_debut AS date_debut,
  semaine_fin AS date_fin,
  nb_commandes AS nombre_commandes
FROM weekly
UNION ALL
SELECT
  'mois' AS periode_type,
  mois_iso AS periode_label,
  mois_debut AS date_debut,
  mois_fin AS date_fin,
  nb_commandes AS nombre_commandes
FROM monthly
ORDER BY date_debut;`;

    db.query(sql, [], (err, resultat) => {
      if (err) {
        debugLog(
          "Erreur lors de la récupération des commandes par période:",
          err
        );
        return res.status(500).json({
          error: "Erreur lors de la récupération des commandes par période.",
        });
      }
      res.json(resultat);
    });
  }
);

// GET /help/:page - Récupérer l'aide pour une page
router.get("/help/:page", requirePermission("admin", { json: true }), (req, res) => {
  db.query(
    "SELECT content FROM help_texts WHERE page = ?",
    [req.params.page],
    (err, rows) => {
      if (err) return res.status(500).json({ content: "" });
      res.json({ content: rows && rows.length > 0 ? rows[0].content : "" });
    }
  );
});

module.exports = router;
