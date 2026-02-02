const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { db } = require("../config/config");
const { requirePermission, requireAnyPermission } = require("../middleware/rbac.middleware");
const emailService = require("../services/email.service");
const { logger } = require("../config/logger");
const { queryWithUser } = require("../config/db-trace-wrapper");
const { insertPanier, insertPanierArticle } = require("../utils/db-helpers");
const {
  getCurrentUserId,
  getCurrentUserRole,
} = require("../utils/session-helpers");
const { handleDatabaseError } = require("../utils/error-helpers");
const { debugLog } = require("../utils/logger-helpers");

// Helper function pour envoyer des emails
function envoimail(
  to,
  subject,
  htmlContent,
  { sendNow = false, initiatedBy = null } = {}
) {
  // Détecter si c'est du HTML ou du texte simple
  const isHtml = htmlContent.includes("<") && htmlContent.includes(">");

  if (isHtml) {
    // C'est du HTML, créer un email HTML complet
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${htmlContent}
        <p>Retrouvez vos informations en ligne sur <a href="https://cde.coopaz.fr" style="color: #007bff; text-decoration: none;">Coopaz.fr</a>.</p>
      </body>
      </html>
    `;
    return emailService.sendEmail({
      to,
      subject,
      html,
      sendNow,
      initiatedBy,
    });
  } else {
    // C'est du texte simple
    return emailService.sendEmail({
      to,
      subject,
      text: htmlContent,
      sendNow,
      initiatedBy,
    });
  }
}

// Fonction utilitaire pour convertir une date JS en format SQL DATETIME
function convertToSQLDate(dateString) {
  if (!dateString) return null;
  const [datePart, timePart = "00:00"] = dateString.split(" ");
  const [day, month, year] = datePart.split("/");
  const timeSQL = timePart.length === 5 ? timePart + ":00" : timePart;
  return `${year}-${month}-${day} ${timeSQL}`;
}

// Fonction pour générer le HTML du panier
function generateCartHtml(cart) {
  let rows = cart
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.produit} ${
        item.description
      }</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align:center;">${
        item.quantity
      }</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align:right;">${
        item.prix
      } €</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align:right;">${(
        item.prix * item.quantity
      ).toFixed(2)} €</td>
    </tr>
  `
    )
    .join("");
  const total = cart.reduce((sum, item) => sum + item.prix * item.quantity, 0);
  return `
    <h2></h2>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
      <thead>
        <tr>
          <th style="padding: 8px; border: 1px solid #ddd;">Produit</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Quantité</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Prix Unitaire</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align:right;"><strong>Total :</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align:right;"><strong>${total.toFixed(
            2
          )} €</strong></td>
        </tr>
      </tbody>
    </table>
    <p style="font-family: Arial, sans-serif;">Merci à vous !</p>
  `;
}

// Génération d'un lien unique (token)
function lienunique(newUserId, chemin, baseUrl) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1h de validité
  const lienU = baseUrl + `/access-carts/${token}`;
  db.query(
    "INSERT INTO access_tokens (token, user_id, expires_at, chemin) VALUES (?, ?, ?, ?)",
    [token, newUserId, expiresAt, chemin]
  );
  return lienU;
}

// GET /panier/vue - Version Vue.js de la liste des paniers
router.get("/vue", requireAnyPermission(['paniers.user', 'paniers.admin']), (req, res) => {
  res.render("paniers_vue", {
    title: "Mes paniers en cours",
    hideSidebar: false,
  });
});

// GET /panier - Redirection vers la liste des paniers Vue+Vite
router.get("/", requireAnyPermission(['paniers.user', 'paniers.admin']), (req, res) => {
  return res.redirect("/panier/vue");
});

// GET /panier/legacy - Redirection vers Vue+Vite
router.get("/legacy", requireAnyPermission(['paniers.user', 'paniers.admin']), (req, res) => {
  res.redirect("/panier/vue");
});

// GET /panier/new/:id - Créer un nouveau panier pour un catalogue
router.get("/new/:id", requireAnyPermission(['paniers.user', 'paniers.admin']), (req, res) => {
  const catalogFileId = req.params.id;
  const userId = getCurrentUserId(req);

  db.query(
    "SELECT * FROM catalog_files WHERE id = ? AND is_archived = 0",
    [catalogFileId],
    (err, catalogues) => {
      if (err || !catalogues || catalogues.length === 0) {
        return res.status(403).send("Catalogue introuvable ou archivé.");
      }
      logger.debug("Catalogue trouvé", { catalogues });
      insertPanier(userId, catalogFileId, req, function (err, result) {
        if (err) return res.status(500).send("Erreur création panier.");
        db.query(
          "SELECT max(id) as nvxID FROM paniers WHERE catalog_file_id=? and user_id=? and is_submitted=0",
          [catalogFileId, userId],
          (err, nvxID) => {
            logger.debug("Nouveau panier créé", {
              nvxID,
              catalogFileId,
              userId,
            });
            if (err)
              return res.status(500).send("Erreur récupération du panier.");

            db.query(
              "SELECT * FROM paniers WHERE user_id=? AND is_submitted=0",
              [userId],
              (err, paniers) => {
                if (err)
                  return res.status(500).send("Erreur récupération paniers.");
                db.query("SELECT * FROM users", [], (err, utilisateurs) => {
                  if (err)
                    return res
                      .status(500)
                      .send("Erreur récupération utilisateurs.");
                  res.redirect(`/panier/${nvxID[0].nvxID}/modifier/vue`);
                });
              }
            );
          }
        );
      });
    }
  );
});

// GET /panier/:id/modifier - Redirection vers Vue+Vite
router.get(
  "/:id/modifier",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    res.redirect("/panier/" + req.params.id + "/modifier/vue");
  }
);

// GET /panier/:id/modifier/vue - Version Vue.js de la modification du panier
router.get(
  "/:id/modifier/vue",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    res.render("panier_modifier_vue", {
      title: "Mon panier",
      hideSidebar: false,
    });
  }
);

// POST /panier/add - Ajouter/modifier un article dans un panier
router.post(
  "/add",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const catalog_product_id = req.body.catalog_product_id;
    const panier = req.body.panier_id;
    const delta = parseFloat(req.body.quantity || "0");
    const catalog_file_id = req.body.catalog_file_id;

    const wantsJson =
      req.xhr ||
      req.headers["x-requested-with"] === "XMLHttpRequest" ||
      (req.headers.accept && req.headers.accept.includes("application/json"));

    const respondError = (status, message) => {
      if (wantsJson) {
        return res.status(status).json({ success: false, error: message });
      }
      return res.status(status).send(message);
    };

    const respondSuccess = (quantity, panierArticleId = null) => {
      if (wantsJson) {
        return res.json({
          success: true,
          quantity,
          articleId: Number(catalog_product_id),
          panierId: Number(panier),
          panierArticleId,
        });
      }
      return res.redirect(
        `/catalogues/${catalog_file_id}/vue?panier=${panier}&article=${catalog_product_id}`
      );
    };

    logger.debug("DEBUG POST /panier/add", {
      catalog_product_id,
      panier,
      delta,
      catalog_file_id,
      referer: req.get("Referer"),
    });

    db.query("SELECT * FROM paniers WHERE id = ?", [panier], (err, results) => {
      if (err) {
        debugLog("Erreur lors de la vérification du panier", {
          error: err,
        });
        if (wantsJson) {
          return res.status(500).json({
            success: false,
            error: "Erreur lors de la vérification du panier",
          });
        }
        return handleDatabaseError(
          res,
          err,
          "Erreur lors de la vérification du panier"
        );
      }
      if (!results || results.length === 0) {
        return respondError(404, "Panier non trouvé");
      }

      const panierData = results[0];

      if (
        panierData.user_id !== getCurrentUserId(req) &&
        !["admin", "epicier", "referent", "SuperAdmin"].includes(
          getCurrentUserRole(req)
        )
      ) {
        debugLog("Accès refusé à un panier", {
          panierUserId: panierData.user_id,
          sessionUserId: getCurrentUserId(req),
          role: getCurrentUserRole(req),
        });
        return respondError(403, "Accès interdit à ce panier");
      }

      if (!catalog_product_id || !catalog_file_id) {
        return respondError(400, "Article ou catalogue manquant");
      }

      db.query(
        "SELECT * FROM panier_articles WHERE panier_id = ? AND catalog_product_id = ?",
        [panier, catalog_product_id],
        (err, paResults) => {
          if (err) {
            const { debugLog } = require("../utils/logger-helpers");
            debugLog("Erreur lors de la recherche dans panier_articles:", err);
            return respondError(500, "Erreur serveur");
          }

          if (paResults && paResults.length > 0) {
            const pa = paResults[0];
            let newQuantity = pa.quantity + delta;
            newQuantity = Math.max(0, newQuantity);

            queryWithUser(
              "UPDATE panier_articles SET quantity = GREATEST(0, ?) WHERE id = ?",
              [newQuantity, pa.id],
              (err) => {
                if (err) {
                  console.error(
                    "Erreur lors de la mise à jour panier_articles :",
                    err
                  );
                  return respondError(500, "Erreur serveur");
                }
                return respondSuccess(newQuantity, pa.id);
              },
              req
            );
          } else {
            const newQuantity = Math.max(0, delta);

            insertPanierArticle(
              panier,
              catalog_product_id,
              delta,
              req,
              (err, result) => {
                if (err) {
                  console.error(
                    "Erreur lors de l'insertion dans panier_articles :",
                    err
                  );
                  return respondError(500, "Erreur serveur");
                }
                const insertedId = result?.insertId || null;
                return respondSuccess(newQuantity, insertedId);
              },
              req
            );
          }
        }
      );
    });
  }
);

// POST /panier/remove - Supprimer un article du panier
router.post(
  "/remove",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const { panier_catalog_product_id } = req.body;
    queryWithUser(
      "DELETE FROM panier_articles WHERE id = ?",
      [panier_catalog_product_id],
      () => {
        res.redirect("/panier/vue");
      },
      req
    );
  }
);

// POST /panier/:id/note - Modifier la note d'un panier (AJAX)
router.post(
  "/:id/note",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const panierId = req.params.id;
    const { note } = req.body;

    console.log(`Sauvegarde note panier ${panierId}:`, note);

    db.query(
      "SELECT * FROM paniers WHERE id = ?",
      [panierId],
      (err, results) => {
        if (err) {
          console.error("Erreur lors de la récupération du panier:", err);
          if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
            return res.status(500).json({ error: "Erreur serveur" });
          }
          return res.status(500).send("Erreur serveur");
        }

        if (!results || results.length === 0) {
          if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
            return res.status(404).json({ error: "Panier non trouvé" });
          }
          return res.status(404).send("Panier non trouvé");
        }

        const panier = results[0];

        if (
          panier.user_id !== getCurrentUserId(req) &&
          !["admin", "epicier", "referent", "SuperAdmin"].includes(
            getCurrentUserRole(req)
          )
        ) {
          if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
            return res.status(403).json({ error: "Non autorisé" });
          }
          return res.status(403).send("Non autorisé");
        }

        queryWithUser(
          "UPDATE paniers SET note = ? WHERE id = ?",
          [note, panierId],
          (err) => {
            if (err) {
              console.error("Erreur lors de la mise à jour de la note:", err);
              if (
                req.xhr ||
                req.headers["x-requested-with"] === "XMLHttpRequest"
              ) {
                return res
                  .status(500)
                  .json({ error: "Erreur lors de la sauvegarde" });
              }
              return res.status(500).send("Erreur serveur");
            }

            console.log(`Note panier ${panierId} sauvegardée avec succès`);

            if (
              req.xhr ||
              req.headers["x-requested-with"] === "XMLHttpRequest"
            ) {
              return res.json({
                success: true,
                message: "Note sauvegardée avec succès",
              });
            }

            const referer = req.get("Referer") || req.headers.referer;
            if (referer) {
              return res.redirect(referer);
            }
            return res.redirect("/panier/vue");
          },
          req
        );
      }
    );
  }
);

// POST /panier/:id/:source/change-owner - Changer le propriétaire d'un panier
router.post(
  "/:id/:source/change-owner",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const cartId = req.params.id;
    const source = req.params.source;
    const newUserId = req.body.user_id;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    queryWithUser(
      "UPDATE paniers SET user_id = ? WHERE id = ?",
      [newUserId, cartId],
      (err) => {
        if (err) return res.status(500).send("Erreur changement propriétaire");

        if (source === "U") {
          db.query(
            "SELECT email FROM users WHERE id = ?",
            [newUserId],
            (err, rows) => {
              if (err || !rows || rows.length === 0) return;
              const email = rows[0].email;
              db.query(
                `SELECT pa.quantity, p.nom as produit, p.description, cp.prix
           FROM panier_articles pa
           JOIN catalog_products cp ON pa.catalog_product_id = cp.id JOIN products p ON cp.product_id = p.id
           WHERE pa.panier_id = ?`,
                [cartId],
                (err, cart) => {
                  if (err) return;
                  const lien = lienunique(newUserId, cartId, baseUrl);

                  const html =
                    `<p style="font-family: Arial, sans-serif;">N'oubliez pas de la valider en allant sur le site ou en cliquant sur ce lien (valable 60 minutes) :  ${lien}  </p> <p style="font-family: Arial, sans-serif;"> N'oubliez pas de valider ce panier : ${cartId} </p> ` +
                    generateCartHtml(cart);
                  envoimail(
                    email,
                    "Un nouveau panier (N°" + cartId + ") vous attend",
                    html,
                    {
                      initiatedBy: req.session?.username || null,
                    }
                  );
                }
              );
            }
          );
        }

        if (source === "A") res.redirect("/admin/dashboard/vue");
        if (source === "U") res.redirect("/panier/vue");
      },
      req
    );
  }
);

// POST /panier/submit - Soumettre un panier (transformer en commande)
router.post(
  "/submit",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const panierId = req.body.panier_id;
    const note = req.body.note;
    const source = req.body.source;
    console.log(source);

    const client_datetime1 = convertToSQLDate(
      new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
    );

    queryWithUser(
      "UPDATE paniers SET is_submitted = 1, note = ? WHERE id = ?",
      [note, panierId],
      () => {
        const userId = getCurrentUserId(req);
        db.query(
          "SELECT email, username FROM users WHERE id = ?",
          [userId],
          (err, users) => {
            if (err || !users || users.length === 0) return;
            const userEmail = users[0].email;
            const sujet = "Votre commande N°" + panierId + " a été validée";
            db.query(
              `SELECT pa.quantity, p.nom as produit, p.description, cp.prix
         FROM panier_articles pa
         JOIN catalog_products cp ON pa.catalog_product_id = cp.id JOIN products p ON cp.product_id = p.id
         WHERE pa.panier_id = ?`,
              [panierId],
              (err, cart) => {
                if (err) return;
                const html =
                  `<p style="font-family: Arial, sans-serif;">Merci pour cette commande N°${panierId}</p>` +
                  generateCartHtml(cart);
                if (source !== "A") {
                  envoimail(userEmail, sujet, html, {
                    sendNow: true,
                    initiatedBy: req.session?.username || null,
                  });
                }
              }
            );
          }
        );
      },
      req
    );

    if (source === "A") {
      res.redirect("/admin/dashboard/vue");
    } else {
      res.redirect("/commandes/vue");
    }
  }
);

// POST /panier/:id/submit - Soumettre un panier (pour Vue.js - ID dans l'URL)
router.post(
  "/:id/submit",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const panierId = req.params.id;
    const userId = getCurrentUserId(req);

    // Vérifier que l'utilisateur a accès à ce panier
    db.query(
      "SELECT * FROM paniers WHERE id = ? AND (user_id = ? OR ? IN (SELECT id FROM users WHERE role <> 'utilisateur'))",
      [panierId, userId, userId],
      (err, results) => {
        if (err) {
          return res.status(500).json({
            success: false,
            error: "Erreur lors de la vérification du panier"
          });
        }
        if (!results || results.length === 0) {
          return res.status(403).json({
            success: false,
            error: "Accès interdit à ce panier"
          });
        }

        // Marquer le panier comme soumis
        queryWithUser(
          "UPDATE paniers SET is_submitted = 1 WHERE id = ?",
          [panierId],
          () => {
            // Envoyer l'email de confirmation
            db.query(
              "SELECT email, username FROM users WHERE id = ?",
              [userId],
              (err, users) => {
                if (err || !users || users.length === 0) {
                  return res.json({ success: true });
                }
                const userEmail = users[0].email;
                const sujet = "Votre commande N°" + panierId + " a été validée";
                db.query(
                  `SELECT pa.quantity, p.nom as produit, p.description, cp.prix
                   FROM panier_articles pa
                   JOIN catalog_products cp ON pa.catalog_product_id = cp.id
                   JOIN products p ON cp.product_id = p.id
                   WHERE pa.panier_id = ?`,
                  [panierId],
                  (err, cart) => {
                    if (!err && cart) {
                      const html =
                        `<p style="font-family: Arial, sans-serif;">Merci pour cette commande N°${panierId}</p>` +
                        generateCartHtml(cart);
                      envoimail(userEmail, sujet, html, {
                        sendNow: true,
                        initiatedBy: req.session?.username || null,
                      });
                    }
                  }
                );
              }
            );
          },
          req
        );

        res.json({ success: true });
      }
    );
  }
);

// POST /panier/:id/supprimer - Supprimer un panier
router.post(
  "/:id/supprimer",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  (req, res) => {
    const panierId = req.params.id;
    const userId = getCurrentUserId(req);

    db.query(
      `SELECT p.*, cf.expiration_date FROM paniers p JOIN catalog_files cf ON p.catalog_file_id = cf.id WHERE p.id = ?`,
      [panierId],
      (err, paniers) => {
        if (err)
          return res
            .status(500)
            .json({ success: false, error: "Erreur lors de la récupération du panier" });
        if (!paniers || paniers.length === 0)
          return res.status(404).json({ success: false, error: "Panier introuvable" });

        const panier = paniers[0];
        if (panier.user_id !== userId)
          return res.status(403).json({ success: false, error: "Non autorisé" });

        // Un panier non soumis peut être supprimé même si le catalogue est expiré
        queryWithUser(
          "DELETE FROM paniers WHERE id = ?",
          [panierId],
          function (err) {
            if (err)
              return res
                .status(500)
                .json({ success: false, error: "Erreur lors de la suppression du panier" });

            // Renvoyer JSON pour les appels AJAX
            const isAjax = req.xhr ||
                          req.headers['content-type']?.indexOf('application/json') > -1 ||
                          req.headers.accept?.indexOf('application/json') > -1 ||
                          req.headers['x-requested-with'] === 'XMLHttpRequest';

            if (isAjax) {
              return res.json({ success: true });
            }
            // Rediriger pour les appels classiques
            res.redirect("/panier/vue");
          },
          req
        );
      }
    );
  }
);

// GET /access-carts/:token - Récupération via lien unique
router.get("/access-carts/:token", (req, res) => {
  const { token } = req.params;

  db.query(
    "SELECT * FROM access_tokens WHERE token = ?",
    [token],
    (err, results) => {
      if (
        err ||
        !results ||
        results.length === 0 ||
        new Date(results[0].expires_at) < new Date()
      ) {
        return res.status(403).send("Lien expiré ou invalide.");
      }

      const access = results[0];
      const panierId = access.chemin;
      const note = "validation directe par un lien depuis un mail";
      const userId = access.user_id;

      const nowParis = new Date().toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
      });
      const client_datetime1 = convertToSQLDate(nowParis);

      queryWithUser(
        "UPDATE paniers SET is_submitted = 1 WHERE id = ?",
        [panierId],
        (err) => {
          if (err) {
            return res
              .status(500)
              .send("Erreur lors de la mise à jour du panier.");
          }

          db.query(
            "DELETE FROM access_tokens WHERE token = ?",
            [token],
            (err, results) => {
              if (err) {
                console.error("Erreur lors de la suppression du token :", err);
              }
            }
          );

          res.status(200).send("Le panier a bien été transformé en commande !");
        },
        req
      );
    }
  );
});

// POST /panier/auto-fill - Préremplir le panier avec les commandes passées
router.post("/auto-fill", requireAnyPermission(['paniers.user', 'paniers.admin']), (req, res) => {
  const { panierId, catalogId } = req.body;
  const userId = getCurrentUserId(req);

  if (!panierId || !catalogId || !userId) {
    return res.status(400).json({ error: "Paramètres manquants." });
  }

  const query = `
    INSERT IGNORE INTO panier_articles (panier_id, catalog_product_id, quantity)
    SELECT ?, cp.id, 1
    FROM catalog_products cp
    INNER JOIN products p ON cp.product_id = p.id
    WHERE cp.catalog_file_id = ?
    AND p.nom IN (
      SELECT h.produit
      FROM histo_cde h
      WHERE h.user_id = ?
      AND h.created_at > DATE_SUB(CURDATE(), INTERVAL 60 DAY)
    );
  `;

  console.log("Executing query:", query);

  queryWithUser(
    query,
    [panierId, catalogId, userId],
    (err, result) => {
      if (err) {
        console.error("Erreur lors du préremplissage du panier:", err);

        return res.status(500).json({ error: "Erreur serveur." });
      }

      res.json({
        success: true,
        message: "Panier prérempli avec succès.",
        affectedRows: result.affectedRows,
      });
    },
    req
  );
});

// POST /panier/update-quantity - Mettre à jour la quantité d'un produit (pour Vue.js)
router.post(
  "/update-quantity",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  async (req, res) => {
    const { catalog_file_id, catalog_product_id, quantity, nouveau_panier } = req.body;
    const userId = getCurrentUserId(req);
    const orgId = req.session?.organization_id;

    try {
      const qty = parseInt(quantity) || 0;

      // Vérifier que les paramètres sont présents
      if (!catalog_file_id || !catalog_product_id) {
        return res.status(400).json({
          success: false,
          error: "Paramètres manquants"
        });
      }

      // Si nouveau_panier=true, forcer la création d'un nouveau panier
      // Sinon, chercher un panier existant
      const handlePanier = (callback) => {
        if (nouveau_panier === true) {
          // Créer directement un nouveau panier sans chercher
          callback(null, []);
        } else {
          // Chercher un panier existant
          const findPanierQuery = `
            SELECT id FROM paniers
            WHERE user_id = ? AND catalog_file_id = ? AND is_submitted = 0
            ORDER BY created_at DESC LIMIT 1
          `;
          db.query(findPanierQuery, [userId, catalog_file_id], callback);
        }
      };

      handlePanier((err, panierResults) => {
        if (err) {
          console.error("Erreur recherche panier:", err);
          return res.status(500).json({
            success: false,
            error: "Erreur serveur"
          });
        }

        let panierId;

        const handleQuantityUpdate = (pid) => {
          if (qty === 0) {
            // Supprimer l'article
            queryWithUser(
              "DELETE FROM panier_articles WHERE panier_id = ? AND catalog_product_id = ?",
              [pid, catalog_product_id],
              (err) => {
                if (err) {
                  console.error("Erreur suppression article:", err);
                  return res.status(500).json({
                    success: false,
                    error: "Erreur serveur"
                  });
                }
                return res.json({
                  success: true,
                  panier_id: pid,
                  quantity: 0
                });
              },
              req
            );
          } else {
            // Vérifier si l'article existe déjà
            db.query(
              "SELECT id FROM panier_articles WHERE panier_id = ? AND catalog_product_id = ?",
              [pid, catalog_product_id],
              (err, articleResults) => {
                if (err) {
                  console.error("Erreur recherche article:", err);
                  return res.status(500).json({
                    success: false,
                    error: "Erreur serveur"
                  });
                }

                if (articleResults && articleResults.length > 0) {
                  // Mettre à jour
                  queryWithUser(
                    "UPDATE panier_articles SET quantity = ? WHERE id = ?",
                    [qty, articleResults[0].id],
                    (err) => {
                      if (err) {
                        console.error("Erreur mise à jour article:", err);
                        return res.status(500).json({
                          success: false,
                          error: "Erreur serveur"
                        });
                      }
                      return res.json({
                        success: true,
                        panier_id: pid,
                        quantity: qty
                      });
                    },
                    req
                  );
                } else {
                  // Insérer
                  insertPanierArticle(
                    pid,
                    catalog_product_id,
                    qty,
                    req,
                    (err) => {
                      if (err) {
                        console.error("Erreur insertion article:", err);
                        return res.status(500).json({
                          success: false,
                          error: "Erreur serveur"
                        });
                      }
                      return res.json({
                        success: true,
                        panier_id: pid,
                        quantity: qty
                      });
                    }
                  );
                }
              }
            );
          }
        };

        if (panierResults && panierResults.length > 0) {
          // Panier existe
          panierId = panierResults[0].id;
          handleQuantityUpdate(panierId);
        } else {
          // Créer un nouveau panier
          insertPanier(
            userId,
            catalog_file_id,
            req,
            (err, result) => {
              if (err) {
                console.error("Erreur création panier:", err);
                return res.status(500).json({
                  success: false,
                  error: "Erreur serveur"
                });
              }
              panierId = result.insertId;
              handleQuantityUpdate(panierId);
            }
          );
        }
      });
    } catch (error) {
      console.error("Erreur update-quantity:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur"
      });
    }
  }
);

// POST /panier/update-note - Mettre à jour la note d'un produit (pour Vue.js)
router.post(
  "/update-note",
  requireAnyPermission(['paniers.user', 'paniers.admin']),
  async (req, res) => {
    const { catalog_file_id, catalog_product_id, note } = req.body;
    const userId = getCurrentUserId(req);
    const orgId = req.session?.organization_id;

    try {
      // Vérifier que les paramètres sont présents
      if (!catalog_file_id || !catalog_product_id) {
        return res.status(400).json({
          success: false,
          error: "Paramètres manquants"
        });
      }

      // Chercher le panier
      const findPanierQuery = `
        SELECT id FROM paniers
        WHERE user_id = ? AND catalog_file_id = ? AND is_submitted = 0
        ORDER BY created_at DESC LIMIT 1
      `;

      db.query(findPanierQuery, [userId, catalog_file_id], (err, panierResults) => {
        if (err) {
          console.error("Erreur recherche panier:", err);
          return res.status(500).json({
            success: false,
            error: "Erreur serveur"
          });
        }

        if (!panierResults || panierResults.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Panier non trouvé"
          });
        }

        const panierId = panierResults[0].id;

        // Chercher l'article
        db.query(
          "SELECT id FROM panier_articles WHERE panier_id = ? AND catalog_product_id = ?",
          [panierId, catalog_product_id],
          (err, articleResults) => {
            if (err) {
              console.error("Erreur recherche article:", err);
              return res.status(500).json({
                success: false,
                error: "Erreur serveur"
              });
            }

            if (!articleResults || articleResults.length === 0) {
              // L'article n'existe pas encore, on pourrait le créer avec quantité 0
              // Mais pour l'instant on retourne une erreur
              return res.status(404).json({
                success: false,
                error: "Article non trouvé dans le panier"
              });
            }

            // Mettre à jour la note
            queryWithUser(
              "UPDATE panier_articles SET note = ? WHERE id = ?",
              [note || null, articleResults[0].id],
              (err) => {
                if (err) {
                  console.error("Erreur mise à jour note:", err);
                  return res.status(500).json({
                    success: false,
                    error: "Erreur serveur"
                  });
                }
                return res.json({
                  success: true,
                  note: note || ''
                });
              },
              req
            );
          }
        );
      });
    } catch (error) {
      console.error("Erreur update-note:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur serveur"
      });
    }
  }
);

module.exports = router;
