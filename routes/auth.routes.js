const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { db } = require("../config/config");
const { requireLogin } = require("../middleware/middleware");
const emailService = require("../services/email.service");
const { logger } = require("../config/logger");
const { queryWithUser } = require("../config/db-trace-wrapper");
const { invalidateBandeauxCache } = require("../utils/bandeaux-cache");
const {
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentUsername,
} = require("../utils/session-helpers");
const { handleDatabaseError } = require("../utils/error-helpers");
const { debugLog } = require("../utils/logger-helpers");
const {
  validateLoginInput,
  validateRegistrationInput,
  validatePasswordChangeInput,
} = require("../utils/validation-helpers");

// Rate limiter pour la route de login (protection contre brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 tentatives par fenêre de 15 minutes
  message:
    "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.",
  standardHeaders: true, // Retourne les infos de rate limit dans les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
});

// Helper function pour envoyer des emails
function envoimail(to, subject, htmlContent, initiatedBy = null) {
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
      sendNow: true,
      initiatedBy,
    });
  } else {
    // C'est du texte simple
    return emailService.sendEmail({
      to,
      subject,
      text: htmlContent,
      sendNow: true,
      initiatedBy,
    });
  }
}

// GET /login - Formulaire de connexion Vue+Vite
router.get("/login", (req, res) => {
  const redirectUrl = req.query.redirect;
  if (redirectUrl && typeof redirectUrl === "string" && redirectUrl.startsWith("/")) {
    req.session.afterLoginRedirect = redirectUrl;
  } else if (redirectUrl && typeof redirectUrl === "string") {
    try {
      const u = new URL(redirectUrl);
      if (u.origin === req.protocol + "://" + req.get("host") || u.hostname === "localhost") {
        req.session.afterLoginRedirect = redirectUrl;
      }
    } catch (_) {}
  }
  res.render("login_vue", {
    csrfToken: res.locals.csrfToken || "",
    APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
  });
});

// POST /login - Traiter la connexion (avec rate limiting)
router.post("/login", loginLimiter, validateLoginInput, (req, res) => {
  const { email, password } = req.body;

  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));

  db.query(
    "SELECT * FROM users WHERE LOWER(email) = ?",
    [email],
    async (err, results) => {
      if (results.length === 0) {
        if (wantsJson) return res.status(401).json({ success: false, error: "Identifiants incorrects. Veuillez réessayer." });
        return res.render("login", {
          error: "Identifiants incorrects. Veuillez réessayer.",
        });
      }

      const user = results[0];

      if (!user.is_validated) {
        if (wantsJson) return res.status(403).json({ success: false, error: "Votre compte n'a pas encore été validé par un administrateur." });
        return res.render("login", {
          error:
            "Votre compte n'a pas encore été validé par un administrateur.",
        });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        if (wantsJson) return res.status(401).json({ success: false, error: "Utilisateur ou mot de passe incorrect." });
        return res.render("login", {
          error: "Utilisateur ou mot de passe incorrect.",
        });
      }

      // Mettre à jour la date de dernière connexion
      db.query(
        "UPDATE users SET last_login = NOW() WHERE id = ?",
        [user.id],
        (updateErr) => {
          if (updateErr) {
            debugLog("Erreur lors de la mise à jour du last_login", {
              error: updateErr,
            });
            // On continue quand même la connexion
          }

          // Régénération de la session pour prévenir les attaques de fixation de session
          req.session.regenerate((err) => {
            if (err) {
              debugLog("Erreur lors de la régénération de session", {
                error: err,
              });
              if (wantsJson) return res.status(500).json({ success: false, error: "Erreur lors de la connexion. Veuillez réessayer." });
              return res.render("login", {
                error: "Erreur lors de la connexion. Veuillez réessayer.",
              });
            }

            // Définir les données de session après régénération
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            req.session.organization_id = user.organization_id;
            req.session.rbac_enabled = user.rbac_enabled === 1 ? true : false;

            const redirectTo = req.session.afterLoginRedirect || "/";
            delete req.session.afterLoginRedirect;

            invalidateBandeauxCache();

            if (wantsJson) return res.json({ success: true, redirect: redirectTo });
            res.redirect(redirectTo);
          });
        }
      );
    }
  );
});

// GET /logout - Déconnexion
router.get("/logout", (req, res) => {
  const cookieName = process.env.SESSION_COOKIE_NAME || "session_cookie_name";

  const finalizeLogout = () => {
    // On tente de supprimer les 2 noms possibles (selon config/historique)
    res.clearCookie(cookieName, { path: "/" });
    res.clearCookie("connect.sid", { path: "/" });
    invalidateBandeauxCache();
    res.redirect("/login");
  };

  if (!req.session) {
    return finalizeLogout();
  }

  req.session.destroy((err) => {
    if (err) {
      logger.warn("Logout: session destroy failed", { error: err?.message });
    }
    finalizeLogout();
  });
});

// GET /account - Formulaire Mon compte Vue+Vite (tout utilisateur connecté)
router.get(
  "/account",
  requireLogin,
  (req, res) => {
    db.query(
      "SELECT username, email, description, email_catalogue FROM users WHERE id = ?",
      [getCurrentUserId(req)],
      (err, results) => {
        const account = results && results.length > 0 ? results[0] : {};
        res.render("account_vue", {
          user: getCurrentUsername(req),
          role: getCurrentUserRole(req),
          account,
          csrfToken: res.locals.csrfToken || "",
          APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
        });
      }
    );
  }
);

// POST /account - Traiter la modification du compte (tout utilisateur connecté)
router.post(
  "/account",
  requireLogin,
  validatePasswordChangeInput,
  async (req, res) => {
    const {
      email,
      description,
      email_catalogue,
      current_password,
      new_password,
      confirm_password,
    } = req.body;
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));

    const emailCatalogue =
      email_catalogue === "1" ||
      email_catalogue === "true" ||
      email_catalogue === "on"
        ? 1
        : 0;

    let error = null;
    let success = null;

    db.query(
      "SELECT * FROM users WHERE id = ?",
      [getCurrentUserId(req)],
      async (err, results) => {
        if (err || !results || results.length === 0) {
          if (wantsJson) return res.status(401).json({ success: false, error: "Non authentifié." });
          return res.redirect("/login");
        }

        const user = results[0];

        // Vérification mot de passe si changement demandé
        if (new_password || confirm_password) {
          const match = await bcrypt.compare(current_password, user.password);
          if (!match) {
            error = "Le mot de passe actuel est incorrect.";
          }
        }

        if (error) {
          if (wantsJson) return res.status(400).json({ success: false, error });
          return res.render("account_edit", {
            user: getCurrentUsername(req),
            role: getCurrentUserRole(req),
            account: {
              username: user.username,
              email,
              description,
              email_catalogue: emailCatalogue,
            },
            error,
            success: null,
          });
        }

        // Mise à jour du mot de passe si besoin
        if (new_password) {
          const hashed = await bcrypt.hash(new_password, 10);
          queryWithUser(
            "UPDATE users SET email = ?, description = ?, email_catalogue = ?, password = ? WHERE id = ?",
            [email, description, emailCatalogue, hashed, getCurrentUserId(req)],
            () => {
              success = "Compte et mot de passe mis à jour.";
              if (wantsJson) return res.json({ success: true, message: success });
              res.render("account_edit", {
                user: getCurrentUsername(req),
                role: getCurrentUserRole(req),
                account: {
                  username: user.username,
                  email,
                  description,
                  email_catalogue: emailCatalogue,
                },
                error: null,
                success,
              });
            },
            req
          );
        } else {
          queryWithUser(
            "UPDATE users SET email = ?, description = ?, email_catalogue = ? WHERE id = ?",
            [email, description, emailCatalogue, getCurrentUserId(req)],
            () => {
              success = "Compte mis à jour.";
              if (wantsJson) return res.json({ success: true, message: success });
              res.render("account_edit", {
                user: getCurrentUsername(req),
                role: getCurrentUserRole(req),
                account: {
                  username: user.username,
                  email,
                  description,
                  email_catalogue: emailCatalogue,
                },
                error: null,
                success,
              });
            },
            req
          );
        }
      }
    );
  }
);

// GET /forgot-password - Formulaire Vue+Vite
router.get("/forgot-password", (req, res) => {
  res.render("forgot_password_vue", {
    csrfToken: res.locals.csrfToken || "",
    APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
  });
});

// POST /forgot-password - Traitement de la demande de reset
router.post("/forgot-password", (req, res) => {
  const { email, flag } = req.body;
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));

  db.query("SELECT * FROM users WHERE email = ? AND COALESCE(is_active, 1) = 1", [email], (err, results) => {
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: "Erreur interne." });
      return res.render("forgot-password", {
        error: "Erreur interne!!",
        message: null,
      });
    }

    if (!results || results.length === 0) {
      if (wantsJson) return res.status(404).json({ success: false, error: "Utilisateur non trouvé." });
      return res.render("forgot-password", {
        error: "Utilisateur non trouvé.",
        message: null,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    queryWithUser(
      "UPDATE users SET resetToken = ?, resetTokenExpiry = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE email = ?",
      [token, email],
      (err2) => {
        if (err2) {
          if (wantsJson) return res.status(500).json({ success: false, error: "Erreur interne." });
          return res.render("forgot-password", {
            error: "Erreur interne.",
            message: null,
          });
        }

        const protocol = req.protocol;
        const host = req.get("host");
        const fullUrl = `${protocol}://${host}`;

        envoimail(
          email,
          `Réinitialisation de votre mot de passe`,
          `Lien de réinitialisation : ${fullUrl}/reset-password?token=${token}`,
          req.session?.username || "system"
        );

        if (flag == "admin") {
          if (wantsJson) return res.json({ success: true, redirect: "/admin/users/vue" });
          res.redirect("/admin/users/vue");
        } else {
          const msg = "La demande de réinitialisation de votre mot de passe est faite, vérifiez votre messagerie pour changer le mot de passe.";
          if (wantsJson) return res.json({ success: true, message: msg });
          res.render("login", {
            message: null,
            error: msg,
          });
        }
      },
      req
    );
  });
});

// GET /reset-password - Formulaire Vue+Vite
router.get("/reset-password", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.send("Lien invalide.");
  }

  db.query(
    "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?",
    [token, Date.now()],
    (err, results) => {
      if (err || !results || results.length === 0) {
        return res.send("Lien invalide ou expiré.");
      }
      res.render("reset_password_vue", {
        token,
        csrfToken: res.locals.csrfToken || "",
        APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
      });
    }
  );
});

// POST /reset-password - Traitement de la saisie du nouveau mot de passe
router.post("/reset-password", (req, res) => {
  const { token, password, confirm } = req.body;
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));

  if (!token) {
    if (wantsJson) return res.status(400).json({ success: false, error: "Lien invalide." });
    return res.send("Lien invalide.");
  }

  if (password !== confirm) {
    if (wantsJson) return res.status(400).json({ success: false, error: "Les mots de passe ne correspondent pas." });
    return res.render("reset-password", {
      token,
      error: "Les mots de passe ne correspondent pas.",
      message: null,
    });
  }

  db.query(
    "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?",
    [token, Date.now()],
    (err, results) => {
      if (err || !results || results.length === 0) {
        if (wantsJson) return res.status(400).json({ success: false, error: "Lien invalide ou expiré." });
        return res.send("Lien invalide ou expiré.");
      }

      const user = results[0];
      const hash = bcrypt.hashSync(password, 10);

      queryWithUser(
        "UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
        [hash, user.id],
        (err2) => {
          if (err2) {
            if (wantsJson) return res.status(500).json({ success: false, error: "Erreur interne." });
            return res.render("reset-password", {
              token,
              error: "Erreur interne.",
              message: null,
            });
          }
          if (wantsJson) return res.json({ success: true, message: "Votre mot de passe est bien réinitialisé.", redirect: "/login" });
          res.render("login", {
            error: "Votre mot de passe est bien réinitialisé.",
            message: null,
          });
        },
        req
      );
    }
  );
});

// GET /register - Formulaire d'inscription Vue+Vite
router.get("/register", (req, res) => {
  res.render("register_vue", {
    csrfToken: res.locals.csrfToken || "",
    APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
  });
});

// POST /register - Traitement de l'inscription
router.post("/register", async (req, res) => {
  const { username, email, password, description, role } = req.body;
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));

  db.query(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [username, email],
    async (err, results) => {
      if (results.length > 0) {
        if (wantsJson) return res.status(409).json({ success: false, error: "Nom d'utilisateur ou email déjà utilisé." });
        return res.render("register", {
          error: "Nom d'utilisateur ou email déjà utilisé.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      queryWithUser(
        "INSERT INTO users (username, email, password, description, role) VALUES (?, ?, ?, ?, ?)",
        [
          username,
          email,
          hashedPassword,
          description || "",
          role || "utilisateur",
        ],
        () => {
          if (wantsJson) return res.json({ success: true, redirect: "/login" });
          res.redirect("/login");
        },
        req
      );
    }
  );
});

// Routes anciennes (deprecated mais conservées pour compatibilité)
router.get("/registerold", (req, res) => {
  res.render("register", { error: null });
});

router.post("/registerold", async (req, res) => {
  const { username, email, password, description, role } = req.body;

  db.query(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [username, email],
    async (err, results) => {
      if (results.length > 0) {
        return res.render("register", {
          error: "Nom d'utilisateur ou email déjà utilisé.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      queryWithUser(
        "INSERT INTO users (username, email, password, description, role) VALUES (?, ?, ?, ?, ?)",
        [
          username,
          email,
          hashedPassword,
          description || "",
          role || "utilisateur",
        ],
        () => {
          res.redirect("/login");
        },
        req
      );
    }
  );
});

// GET /session-temps-restant - Vérifier le temps restant de la session
router.get("/session-temps-restant", (req, res) => {
  if (!req.session || !req.session.cookie) {
    return res.send("Session introuvable.");
  }

  const expires = req.session.cookie._expires
    ? new Date(req.session.cookie._expires)
    : null;

  if (!expires) {
    return res.send("Session n'a pas de date d'expiration définie.");
  }

  const now = new Date();
  const diffMs = expires - now;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec <= 0) {
    return res.send("Session expirée ou expiration imminente.");
  }

  res.send(
    `Temps restant avant expiration de la session : ${diffSec} secondes`
  );
});

module.exports = router;
