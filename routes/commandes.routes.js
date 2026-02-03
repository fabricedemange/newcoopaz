const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requireAnyPermission } = require("../middleware/rbac.middleware");
const { queryWithUser } = require("../config/db-trace-wrapper");
const {
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUserRole,
} = require("../utils/session-helpers");
const { debugLog } = require("../utils/logger-helpers");

// GET /commandes - Redirection vers la liste des commandes Vue+Vite
router.get(
  "/",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    res.redirect("/commandes/vue");
  }
);

// GET /commandes/vue - Version Vue.js de la liste des commandes
router.get(
  "/vue",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    res.render("commandes_vue", {
      title: "Mes commandes",
      hideSidebar: false,
    });
  }
);

// GET /commandes/cotisation - Redirection vers Mon historique de cotisation
router.get(
  "/cotisation",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    res.redirect("/commandes/cotisation/vue");
  }
);

// GET /commandes/cotisation/vue - Mon historique de cotisation (Vue.js)
router.get(
  "/cotisation/vue",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    res.render("commandes_cotisation_vue", {
      title: "Mon historique de cotisation",
      hideSidebar: false,
    });
  }
);

// GET /commandes/:id/vue - Version Vue.js du détail d'une commande
router.get(
  "/:id/vue",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    res.render("commande_detail_vue", {
      title: "Détail de la commande",
      hideSidebar: false,
    });
  }
);

// GET /commandes/:id - Redirection vers le détail commande Vue+Vite
router.get(
  "/:id",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    res.redirect(`/commandes/${req.params.id}/vue`);
  }
);

// POST /commandes/:id/note - Ajouter/modifier la note d'une commande
router.post("/:id/note", (req, res) => {
  if (!getCurrentUserId(req)) {
    const wantsJson = req.headers.accept && req.headers.accept.includes("application/json");
    if (wantsJson) {
      return res.status(401).json({ success: false, error: "Non authentifié" });
    }
    return res.redirect("/login");
  }

  const commandeId = req.params.id;
  const { note, source } = req.body;
  const wantsJson = req.headers.accept && req.headers.accept.includes("application/json");

  db.query(
    "SELECT * FROM paniers WHERE id = ?",
    [commandeId],
    async (err, results) => {
      if (err || !results || results.length === 0) {
        if (wantsJson) {
          return res.status(404).json({ success: false, error: "Commande non trouvée" });
        }
        return res.status(404).send("Commande non trouvée.");
      }
      const commande = results[0];

      const canAdminCommandes = await hasPermission(req, "commandes.admin");
      if (
        commande.user_id !== getCurrentUserId(req) &&
        !canAdminCommandes
      ) {
        if (wantsJson) {
          return res.status(403).json({ success: false, error: "Non autorisé" });
        }
        return res.status(403).send("Non autorisé.");
      }

      queryWithUser(
        "UPDATE paniers SET note = ? WHERE id = ?",
        [note, commandeId],
        () => {
          if (wantsJson) {
            return res.json({ success: true });
          }
          if (source === "A") {
            return res.redirect("/admin/dashboard/vue");
          } else if (source === "D") {
            return res.redirect(`/commandes/${commandeId}/vue`);
          } else {
            return res.redirect("/commandes/vue");
          }
        },
        req
      );
    }
  );
});

// POST /commandes/:id/edit - Réouvrir une commande (transformer en panier)
router.post(
  "/:id/edit",
  requireAnyPermission(["commandes.user", "commandes.admin", "commandes.own"]),
  (req, res) => {
    const commandeId = req.params.id;
    const source = req.body.source;
    let useridcommande = req.body.user_id;
    const wantsJson = req.xhr ||
                      req.headers['content-type']?.indexOf('application/json') > -1 ||
                      req.headers.accept?.indexOf('application/json') > -1 ||
                      req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (!useridcommande) {
      useridcommande = getCurrentUserId(req);
    }

    db.query(
      `SELECT paniers.*, paniers.id as panier_id, catalog_files.expiration_date, catalog_files.is_archived
     FROM paniers
     JOIN catalog_files ON paniers.catalog_file_id = catalog_files.id
     WHERE paniers.id = ? AND paniers.user_id = ?`,
      [commandeId, useridcommande],
      (err, commandes) => {
        if (err || !commandes || commandes.length === 0) {
          if (wantsJson) {
            return res.status(403).json({ success: false, error: "Commande inaccessible" });
          }
          return res.status(403).send("Commande inaccessible");
        }
        const commande = commandes[0];
        const today = new Date();
        const hier = new Date(today);
        hier.setDate(today.getDate() - 1);

        // La remise en panier ne dépend pas de la visibilité (is_archived),
        // uniquement de l'expiration réelle du catalogue.
        if (
          commande.expiration_date &&
          new Date(commande.expiration_date) < hier
        ) {
          if (wantsJson) {
            return res.status(400).json({ success: false, error: "Le catalogue de cette commande a expiré" });
          }
          return res
            .status(400)
            .send("Le catalogue de cette commande a expiré.");
        }

        queryWithUser(
          "UPDATE paniers SET is_submitted = 0 WHERE id = ?",
          [commande.panier_id],
          () => {
            if (wantsJson) {
              return res.json({ success: true });
            }
            if (source === "A") {
              res.redirect("/admin/dashboard/vue");
            } else {
              res.redirect("/panier/vue");
            }
          },
          req
        );
      }
    );
  }
);

module.exports = router;
