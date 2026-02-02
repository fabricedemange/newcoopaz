const express = require("express");
//const { traceActionsMiddleware } = require("../middleware/trace.middleware");
//const { logTrace } = require("../middleware/trace.middleware");
const router = express.Router();
//router.use(traceActionsMiddleware);
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { google } = require("googleapis");
const PdfPrinter = require("pdfmake");
const sharp = require("sharp");
const { db, queryWithTrace } = require("../config/db-trace-wrapper");
const { requirePermission, requireAnyPermission } = require("../middleware/rbac.middleware");
const emailService = require("../services/email.service");
const { logger } = require("../config/logger");
const { queryWithUser } = require("../config/db-trace-wrapper");
const csrfProtection = require("../config/csrf");
const {
  insertCatalog,
  insertArticle,
  insertUser,
  getCatalogsByOrg,
  getAllCatalogs,
  getUsersByOrg,
  getAllUsers,
  getAllOrganizations,
} = require("../utils/db-helpers");
const { renderAdminView } = require("../utils/view-helpers");
const { validateCatalogOwnership } = require("../middleware/middleware");
const {
  handleDatabaseError,
  handleQueryError,
  handleExportError,
} = require("../utils/error-helpers");
const {
  getCurrentOrgId,
  getCurrentUserId,
  getCurrentUserRole,
  getCurrentUsername,
  isSuperAdmin,
  getOriginalUser,
  isImpersonating,
} = require("../utils/session-helpers");
const { validateBandeauInput } = require("../utils/validation-helpers");

// Configuration sécurisée pour l'upload de fichiers
const {
  upload,
  validateUploadedFile,
  handleMulterError,
  cleanupFile: cleanupUploadedFile,
} = require("../middleware/upload.middleware");

const {
  articleImageUpload,
  cleanupFile: cleanupTempArticleImage,
} = require("../middleware/article-image-upload.middleware");

const {
  catalogueImageUpload,
  cleanupFile: cleanupTempCatalogueImage,
} = require("../middleware/catalogue-image-upload.middleware");

const ARTICLE_IMAGE_DIR = path.join(
  __dirname,
  "..",
  "uploads",
  "article-images"
);

const CATALOGUE_IMAGE_DIR = path.join(
  __dirname,
  "..",
  "uploads",
  "catalogue-images"
);

// Requête SQL réutilisable pour récupérer les produits d'un catalogue
const GET_CATALOG_PRODUCTS_SQL = `
  SELECT
    cp.id,
    cp.catalog_file_id,
    cp.product_id,
    cp.prix,
    cp.unite,
    p.nom as produit,
    p.description,
    p.image_filename,
    c.nom as categorie,
    c.couleur as categorie_couleur,
    c.ordre as categorie_ordre,
    s.nom as fournisseur
  FROM catalog_products cp
  INNER JOIN products p ON cp.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN suppliers s ON p.supplier_id = s.id
  WHERE cp.catalog_file_id = ?
  ORDER BY c.ordre, p.nom
`;

// Requête pour récupérer un catalog_product spécifique
const GET_CATALOG_PRODUCT_BY_ID_SQL = `
  SELECT
    cp.id,
    cp.catalog_file_id,
    cp.product_id,
    cp.prix,
    cp.unite,
    p.nom as produit,
    p.description,
    p.image_filename,
    c.nom as categorie,
    s.nom as fournisseur
  FROM catalog_products cp
  INNER JOIN products p ON cp.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN suppliers s ON p.supplier_id = s.id
  WHERE cp.id = ? AND cp.catalog_file_id = ?
`;

// En prod, on veut que le dossier final existe dès le démarrage (comme tmp-article-images)
try {
  if (!fs.existsSync(ARTICLE_IMAGE_DIR)) {
    fs.mkdirSync(ARTICLE_IMAGE_DIR, { recursive: true });
  }
} catch (e) {
  // Ne bloque pas le démarrage, mais ça explique pourquoi les images ne peuvent pas être écrites.
  console.error(
    "Impossible de créer le dossier article-images:",
    ARTICLE_IMAGE_DIR,
    e
  );
}

try {
  if (!fs.existsSync(CATALOGUE_IMAGE_DIR)) {
    fs.mkdirSync(CATALOGUE_IMAGE_DIR, { recursive: true });
  }
} catch (e) {
  console.error(
    "Impossible de créer le dossier catalogue-images:",
    CATALOGUE_IMAGE_DIR,
    e
  );
}

// Configuration PDF printer
const fonts = {
  Roboto: {
    normal: "./fonts/Roboto-Regular.ttf",
    bold: "./fonts/Roboto-Bold.ttf",
    italics: "./fonts/Roboto-ExtraBoldItalic.ttf",
    bolditalics: "./fonts/Roboto-Light.ttf",
  },
};
const printer = new PdfPrinter(fonts);

function requireActiveImpersonation(req, res, next) {
  if (req.session && req.session.originalUser) {
    return next();
  }
  return res.redirect("/admin/dashboard/vue");
}

// Helper functions pour les emails
function envoimail(to, subject, text, attachment, { initiatedBy } = {}) {
  const normalizeRecipients = (raw) => {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw.filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw
        .split(/[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  };

  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) {
    return Promise.resolve([]);
  }

  const baseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1 style="color:blue;">Bonjour !</h1>
        ${text}
        <p>Retrouvez vos informations en ligne sur <a href="https://cde.coopaz.fr" style="color: #007bff; text-decoration: none;">Coopaz.fr</a>.</p>
      </body>
      </html>
    `;

  const buildMailOptions = (recipient) => {
    const options = {
      from: "contact@coopaz.fr",
      to: recipient,
      subject,
      html: baseHtml,
      initiatedBy: initiatedBy || null,
    };

    if (attachment && attachment.length > 0) {
      options.attachments = [
        {
          filename: "synthese.pdf",
          content: attachment,
        },
      ];
    }

    return options;
  };

  const jobs = recipients.map((recipient) =>
    emailService.sendEmail(buildMailOptions(recipient))
  );

  return Promise.all(jobs);
}

function envoimailtous(sujet, messagemail, pj) {
  db.query(
    "SELECT email FROM users where is_validated=1 AND organization_id = ?",
    [getCurrentOrgId(req)],
    (err, rows) => {
      if (err) throw err;
      const emails = rows.map((row) => row.email);
      envoimail(emails, sujet, messagemail, pj, {
        initiatedBy: "system",
      }).catch((err) => logger.error("Failed to send email to all users", err));
    }
  );
}

function formatDateFR(date) {
  if (!date) return "";
  if (date instanceof Date) {
    return date.toLocaleDateString("fr-FR");
  }
  const d = new Date(date);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("fr-FR");
}

function convertToSQLDate(dateStr) {
  if (!dateStr) return null;
  const [datePart, timePart = "00:00"] = dateStr.split(" ");
  const [day, month, year] = datePart.split("/");
  const timeSQL = timePart.length === 5 ? timePart + ":00" : timePart;
  return `${year}-${month}-${day} ${timeSQL}`;
}

// ============================================
// USERS MANAGEMENT
// ============================================

router.post("/impersonate", requirePermission('organizations'), (req, res) => {
  const targetUserId = parseInt(req.body.user_id, 10);
  if (!Number.isInteger(targetUserId)) {
    return res.status(400).send("Utilisateur cible invalide");
  }

  if (!req.session) {
    return res.status(500).send("Session invalide");
  }

  if (req.session.originalUser) {
    return res.status(400).send("Une session d'impersonation est déjà active");
  }

  if (targetUserId === req.session.userId) {
    return res.redirect(req.get("referer") || "/admin/users");
  }

  db.query(
    "SELECT id, username, role, organization_id, rbac_enabled FROM users WHERE id = ?",
    [targetUserId],
    (err, rows) => {
      if (err) {
        logger.error(
          "Erreur lors de la récupération de l'utilisateur pour impersonation",
          {
            error: err,
            targetUserId,
          }
        );
        return res.status(500).send("Erreur serveur lors de l'impersonation");
      }

      if (!rows || rows.length === 0) {
        return res.status(404).send("Utilisateur introuvable");
      }

      const targetUser = rows[0];

      req.session.originalUser = {
        userId: req.session.userId,
        role: req.session.role,
        username: req.session.username,
        organization_id: req.session.organization_id,
        rbac_enabled: req.session.rbac_enabled,
      };

      req.session.userId = targetUser.id;
      req.session.role = targetUser.role;
      req.session.username = targetUser.username;
      req.session.organization_id = targetUser.organization_id;
      req.session.rbac_enabled = targetUser.rbac_enabled === 1;
      req.session.impersonatedUser = {
        userId: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
      };

      logger.info("Impersonation démarrée", {
        superAdminId: req.session.originalUser.userId,
        targetUserId: targetUser.id,
      });

      req.session.save(() => {
        res.redirect(req.get("referer") || "/");
      });
    }
  );
});

router.post("/impersonate/stop", requireActiveImpersonation, (req, res) => {
  const original = getOriginalUser(req);

  if (!original) {
    return res.redirect("/");
  }

  const impersonated = req.session.impersonatedUser || null;

  req.session.userId = original.userId;
  req.session.role = original.role;
  req.session.username = original.username;
  req.session.organization_id = original.organization_id;
  req.session.rbac_enabled = original.rbac_enabled;

  delete req.session.originalUser;
  delete req.session.impersonatedUser;

  logger.info("Impersonation terminée", {
    superAdminId: req.session.userId,
    impersonatedUserId: impersonated ? impersonated.userId : null,
  });

  req.session.save(() => {
    res.redirect(req.get("referer") || "/admin/dashboard/vue");
  });
});

// Liste utilisateurs - Redirection vers Vue+Vite
router.get("/users", requirePermission('users'), (req, res) => {
  res.redirect("/admin/users/vue");
});

// Formulaire nouvel utilisateur Vue+Vite
router.get("/users/new", requirePermission('users'), (req, res) => {
  const orgId = getCurrentOrgId(req);

  const rolesQuery = `
    SELECT id, name, display_name, description
    FROM roles
    WHERE organization_id = ? OR organization_id IS NULL
    ORDER BY display_name
  `;

  db.query(rolesQuery, [orgId], (err, allRoles) => {
    if (err) {
      console.error('Error loading roles:', err);
      allRoles = [];
    }

    const payload = {
      user: null,
      error: null,
      action: "add",
      organizations: null,
      allRoles: allRoles || [],
      userRoleIds: [],
      csrfToken: res.locals.csrfToken || "",
      APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
    };

    if (isSuperAdmin(req)) {
      getAllOrganizations((err, orgs) => {
        payload.organizations = orgs;
        res.render("admin_user_form_vue", payload);
      });
    } else {
      res.render("admin_user_form_vue", payload);
    }
  });
});

// Ajout utilisateur
router.post("/users/new", requirePermission('users'), async (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  let {
    username,
    password,
    email,
    description,
    organization_id,
    email_catalogue,
  } = req.body;

  // Get RBAC roles from checkboxes (array)
  let rbacRoles = req.body['rbac_roles[]'] || req.body.rbac_roles || [];
  if (!Array.isArray(rbacRoles)) {
    rbacRoles = [rbacRoles];
  }
  rbacRoles = rbacRoles.filter(r => r).map(r => parseInt(r));

  const usernameLower = username && username.toLowerCase();
  if (!username || !email || !password) {
    if (wantsJson) return res.status(400).json({ success: false, error: "Champs obligatoires manquants." });
    return renderAdminView(res, "admin_user_form", {
      user: null,
      error: "Champs obligatoires manquants.",
      action: "add",
      allRoles: [],
      userRoleIds: []
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle email_catalogue checkbox (can be array ["0", "1"] if both hidden and checkbox are sent)
    let emailCatalogueValue = email_catalogue;
    if (Array.isArray(email_catalogue)) {
      emailCatalogueValue = email_catalogue.includes("1") ? "1" : "0";
    }
    const emailCatalogue =
      emailCatalogueValue === "1" ||
      emailCatalogueValue === "true" ||
      emailCatalogueValue === "on"
        ? 1
        : 0;

    let orgIdToUse;
    if (isSuperAdmin(req)) {
      orgIdToUse = organization_id;
      if (orgIdToUse === "" || orgIdToUse === "Toutes") {
        orgIdToUse = null;
      }
    } else {
      orgIdToUse = getCurrentOrgId(req);
    }

    // Insert user
    const insertQuery = `
      INSERT INTO users (username, password, email, description, email_catalogue, organization_id, role, is_validated)
      VALUES (?, ?, ?, ?, ?, ?, 'utilisateur', 1)
    `;

    const userId = await new Promise((resolve, reject) => {
      queryWithUser(
        insertQuery,
        [usernameLower, hashedPassword, email, description, emailCatalogue, orgIdToUse],
        function (err, result) {
          if (err) return reject(err);
          resolve(result.insertId);
        },
        req
      );
    });

    // If no roles selected, assign default "utilisateur" role
    if (rbacRoles.length === 0) {
      const defaultRoleQuery = "SELECT id FROM roles WHERE name = 'utilisateur' LIMIT 1";
      const defaultRole = await new Promise((resolve) => {
        db.query(defaultRoleQuery, (err, results) => {
          if (!err && results && results.length > 0) {
            resolve(results[0].id);
          } else {
            resolve(null);
          }
        });
      });
      if (defaultRole) {
        rbacRoles.push(defaultRole);
      }
    }

    // Insert user roles
    if (rbacRoles.length > 0) {
      const currentUserId = getCurrentUserId(req);
      const insertValues = rbacRoles.map(roleId => [userId, roleId, currentUserId]);
      await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ?",
          [insertValues],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    }

    if (wantsJson) return res.json({ success: true, redirect: "/admin/users/vue" });
    res.redirect("/admin/users/vue");
  } catch (err) {
    console.error('Error creating user:', err);
    if (wantsJson) return res.status(400).json({ success: false, error: "Erreur : nom ou email déjà utilisé." });
    return renderAdminView(res, "admin_user_form", {
      user: null,
      error: "Erreur : nom ou email déjà utilisé.",
      action: "add",
      allRoles: [],
      userRoleIds: []
    });
  }
});

// Formulaire édition utilisateur Vue+Vite
router.get(
  "/users/:id/edit",
  requirePermission('users'),
  async (req, res) => {
    const id = req.params.id;
    const isSuperAdmin = getCurrentUserRole(req) === "SuperAdmin";
    const orgId = getCurrentOrgId(req);

    try {
      const userQuery = isSuperAdmin
        ? "SELECT * FROM users WHERE id = ?"
        : "SELECT * FROM users WHERE id = ? AND organization_id = ?";
      const userParams = isSuperAdmin ? [id] : [id, orgId];

      db.query(userQuery, userParams, async (err, results) => {
        if (err || !results || results.length === 0)
          return res.redirect("/admin/users/vue");

        const user = results[0];

        const rolesQuery = `
          SELECT id, name, display_name, description
          FROM roles
          WHERE organization_id = ? OR organization_id IS NULL
          ORDER BY display_name
        `;
        db.query(rolesQuery, [user.organization_id], (err2, allRoles) => {
          if (err2) {
            console.error('Error loading roles:', err2);
            return res.redirect("/admin/users/vue");
          }

          db.query("SELECT role_id FROM user_roles WHERE user_id = ?", [id], (err3, userRoles) => {
            if (err3) {
              console.error('Error loading user roles:', err3);
              return res.redirect("/admin/users/vue");
            }

            const userRoleIds = userRoles.map(r => r.role_id);
            const payload = {
              user,
              error: null,
              action: "edit",
              organizations: null,
              allRoles: allRoles || [],
              userRoleIds,
              csrfToken: res.locals.csrfToken || "",
              APP_VERSION: res.app.locals.APP_VERSION || Date.now(),
            };

            if (isSuperAdmin) {
              getAllOrganizations((err, orgs) => {
                payload.organizations = orgs;
                res.render("admin_user_form_vue", payload);
              });
            } else {
              res.render("admin_user_form_vue", payload);
            }
          });
        });
      });
    } catch (error) {
      console.error('Error in user edit route:', error);
      res.redirect("/admin/users/vue");
    }
  }
);

// Modification utilisateur
router.post("/users/:id/edit", requirePermission('users'), async (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
  let {
    username,
    password,
    email,
    description,
    organization_id,
    email_catalogue,
  } = req.body;

  // Get RBAC roles from checkboxes (array)
  let rbacRoles = req.body['rbac_roles[]'] || req.body.rbac_roles || [];
  if (!Array.isArray(rbacRoles)) {
    rbacRoles = [rbacRoles];
  }
  rbacRoles = rbacRoles.filter(r => r).map(r => parseInt(r));

  // If no roles selected, assign default "utilisateur" role
  if (rbacRoles.length === 0) {
    const defaultRoleQuery = "SELECT id FROM roles WHERE name = 'utilisateur' LIMIT 1";
    const defaultRole = await new Promise((resolve) => {
      db.query(defaultRoleQuery, (err, results) => {
        if (!err && results && results.length > 0) {
          resolve(results[0].id);
        } else {
          resolve(null);
        }
      });
    });
    if (defaultRole) {
      rbacRoles.push(defaultRole);
    }
  }

  const usernameLower = username.toLowerCase();
  const id = req.params.id;

  // Handle email_catalogue checkbox (can be array ["0", "1"] if both hidden and checkbox are sent)
  let emailCatalogueValue = email_catalogue;
  if (Array.isArray(email_catalogue)) {
    emailCatalogueValue = email_catalogue.includes("1") ? "1" : "0";
  }
  const emailCatalogue =
    emailCatalogueValue === "1" ||
    emailCatalogueValue === "true" ||
    emailCatalogueValue === "on"
      ? 1
      : 0;

  if (!username || !email) {
    if (wantsJson) return res.status(400).json({ success: false, error: "Champs obligatoires manquants." });
    return res.redirect(`/admin/users/${id}/edit?error=missing_fields`);
  }

  try {
    // Update user basic info
    const isSuperAdmin = getCurrentUserRole(req) === "SuperAdmin";
    let updateQuery, updateParams;

    if (isSuperAdmin && organization_id) {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateQuery = "UPDATE users SET username=?, password=?, email=?, description=?, email_catalogue=?, organization_id=? WHERE id=?";
        updateParams = [usernameLower, hashedPassword, email, description, emailCatalogue, organization_id, id];
      } else {
        updateQuery = "UPDATE users SET username=?, email=?, description=?, email_catalogue=?, organization_id=? WHERE id=?";
        updateParams = [usernameLower, email, description, emailCatalogue, organization_id, id];
      }
    } else {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateQuery = "UPDATE users SET username=?, password=?, email=?, description=?, email_catalogue=? WHERE id=?";
        updateParams = [usernameLower, hashedPassword, email, description, emailCatalogue, id];
      } else {
        updateQuery = "UPDATE users SET username=?, email=?, description=?, email_catalogue=? WHERE id=?";
        updateParams = [usernameLower, email, description, emailCatalogue, id];
      }
    }

    await new Promise((resolve, reject) => {
      queryWithUser(updateQuery, updateParams, resolve, req);
    });

    // Update user roles: delete all and insert new ones
    await new Promise((resolve, reject) => {
      db.query("DELETE FROM user_roles WHERE user_id = ?", [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (rbacRoles.length > 0) {
      const currentUserId = getCurrentUserId(req);
      const insertValues = rbacRoles.map(roleId => [id, roleId, currentUserId]);
      await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ?",
          [insertValues],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    }

    if (wantsJson) return res.json({ success: true, redirect: "/admin/users/vue" });
    res.redirect("/admin/users/vue");
  } catch (error) {
    console.error('Error updating user:', error);
    if (wantsJson) return res.status(400).json({ success: false, error: "Erreur lors de la mise à jour." });
    res.redirect(`/admin/users/${id}/edit?error=update_failed`);
  }
});

// Suppression d'un utilisateur
router.post("/users/:id/delete", requirePermission('users'), (req, res) => {
  if (parseInt(req.params.id) === getCurrentUserId(req)) {
    return res.redirect("/admin/users/vue");
  }
  queryWithUser(
    "DELETE FROM users WHERE id = ?",
    [req.params.id],
    function () {
      res.redirect("/admin/users/vue");
    },
    req
  );
});

// Validation d'un utilisateur
router.post("/users/:id/validate", requirePermission('users'), (req, res) => {
  queryWithUser(
    "UPDATE users SET is_validated = 1 WHERE id = ?",
    [req.params.id],
    function (err) {
      res.redirect("/admin/users/vue");
    },
    req
  );
});

// Page file d'attente email (Vue.js)
router.get("/email-queue", requirePermission('admin'), (req, res) => {
  renderAdminView(res, "admin_email_queue_vue");
});

// Legacy route pour compatibilité
router.get("/email-queue/legacy", requirePermission('admin'), (req, res) => {
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 10), 1000)
    : 500;

  const catalogSubjectFilter = "subject LIKE 'Nouveau catalogue disponible%'";
  const productSubjectFilter = "subject LIKE 'Commande disponible%'";

  const notificationSummarySql = `WITH filtered AS (
      SELECT
        subject,
        COALESCE(from_address, '') AS initiator_key,
        from_address AS initiated_by,
        status,
        updated_at
      FROM email_queue
      WHERE ${catalogSubjectFilter} OR ${productSubjectFilter}
    ),
    ranked AS (
      SELECT
        subject,
        initiator_key,
        initiated_by,
        MAX(updated_at) AS last_activity
      FROM filtered
      GROUP BY subject, initiator_key, initiated_by
    )
    SELECT
      r.subject,
      r.initiated_by,
      SUM(CASE WHEN f.status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      SUM(CASE WHEN f.status IN ('pending','sending') THEN 1 ELSE 0 END) AS pending_count,
      COUNT(*) AS total_count,
      r.last_activity
    FROM ranked r
    JOIN filtered f
      ON f.subject = r.subject
     AND f.initiator_key = r.initiator_key
    GROUP BY r.subject, r.initiated_by, r.last_activity
    ORDER BY r.last_activity DESC`;

  const entriesSql = `SELECT id, status, from_address AS initiated_by, to_addresses, subject,
      attempt_count, last_error, scheduled_at, sent_at, created_at, updated_at
    FROM email_queue
    WHERE NOT (${catalogSubjectFilter} OR ${productSubjectFilter})
    ORDER BY created_at DESC
    LIMIT ?`;

  db.query(entriesSql, [limit], (entryErr, rows) => {
    if (entryErr) {
      logger.error("Erreur lors de la récupération de la file email", {
        error: entryErr,
      });
      return renderAdminView(
        res,
        "admin_email_queue",
        { entries: [], limit, subjectSummary: [] },
        "Erreur lors du chargement de la file d'attente email."
      );
    }

    db.query(notificationSummarySql, (summaryErr, summaryRows) => {
      if (summaryErr) {
        logger.error("Erreur lors du calcul du résumé email", {
          error: summaryErr,
        });
      }

      const formatDateTime = (value) => {
        if (!value) {
          return "—";
        }
        try {
          const date = value instanceof Date ? value : new Date(value);
          if (Number.isNaN(date.getTime())) {
            return String(value);
          }
          return date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        } catch (formatError) {
          return String(value);
        }
      };

      const entries = (rows || []).map((row) => {
        let toList = [];
        if (row.to_addresses) {
          try {
            const parsed = JSON.parse(row.to_addresses);
            if (Array.isArray(parsed)) {
              toList = parsed.filter(Boolean).map(String);
            } else if (parsed) {
              toList = [String(parsed)];
            }
          } catch (parseError) {
            toList = [String(row.to_addresses)];
          }
        }

        return {
          ...row,
          to_display: toList.join(", ") || "—",
          initiated_by_display: row.initiated_by || "—",
          scheduled_at_formatted: formatDateTime(row.scheduled_at),
          sent_at_formatted: formatDateTime(row.sent_at),
          updated_at_formatted: formatDateTime(row.updated_at),
        };
      });

      const subjectSummary = (summaryRows || []).map((row) => {
        const rawLastActivity = row.last_activity;
        let lastActivityTs = null;
        if (rawLastActivity) {
          const parsedDate =
            rawLastActivity instanceof Date
              ? rawLastActivity
              : new Date(rawLastActivity);
          if (!Number.isNaN(parsedDate.getTime())) {
            lastActivityTs = parsedDate.getTime();
          }
        }

        return {
          subject: row.subject || "(Sujet vide)",
          initiated_by_display: row.initiated_by || "—",
          sent_count: row.sent_count || 0,
          pending_count: row.pending_count || 0,
          total_count: row.total_count || 0,
          last_activity: rawLastActivity,
          last_activity_ts: lastActivityTs,
        };
      });

      renderAdminView(res, "admin_email_queue", {
        entries,
        limit,
        subjectSummary,
      });
    });
  });
});

// ============================================
// CATALOGUES MANAGEMENT
// ============================================

// Liste des catalogues - Redirection vers Vue+Vite
router.get("/catalogues", requirePermission('catalogues'), (req, res) => {
  const qs = req.query.scope != null ? `?scope=${req.query.scope}` : "?scope=all";
  res.redirect("/admin/catalogues/vue" + qs);
});

// Route Vue pour la gestion des catalogues
router.get("/catalogues/vue", requirePermission('catalogues'), (req, res) => {
  renderAdminView(res, "admin_catalogues_vue", {});
});

// Formulaire nouveau catalogue (choix du type)
router.get("/catalogues/new", requirePermission('catalogues'), (req, res) => {
  renderAdminView(res, "admin_catalogue_form", {
    error: null,
    csrfToken: req.csrfToken()
  });
});

// Formulaire upload Excel
router.get("/catalogues/upload-form", requirePermission('catalogues'), csrfProtection, (req, res) => {
  renderAdminView(res, "admin_catalogue_upload_form", {
    error: null,
    csrfToken: req.csrfToken()
  });
});

// Créer un catalogue vide (depuis base produits)
router.post("/catalogues/create-empty", requirePermission('catalogues'), (req, res) => {
  // DEBUG: Log CSRF token info
  console.log('🔐 DEBUG /catalogues/create-empty:');
  console.log('  - CSRF token from body:', req.body._csrf);
  console.log('  - CSRF cookie:', req.cookies['_csrf']);
  console.log('  - All cookies:', req.cookies);
  console.log('  - Content-Type:', req.headers['content-type']);

  const { name, expiration_date, date_livraison, description } = req.body;
  const uploaderId = getCurrentUserId(req);
  const organizationId = getCurrentOrgId(req);

  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      error: "Le nom du catalogue est obligatoire"
    });
  }

  // Si date_livraison n'est pas fournie, utiliser expiration_date ou NOW()
  const livraisonDate = date_livraison || expiration_date || null;
  const expirationDate = expiration_date || null;

  // Si date_livraison est toujours null, utiliser NOW()
  const finalLivraisonDate = livraisonDate || new Date().toISOString().split('T')[0];

  queryWithUser(
    `INSERT INTO catalog_files
      (filename, originalname, upload_date, expiration_date, uploader_id, date_livraison, description, organization_id)
      VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      name.trim(),
      expirationDate,
      uploaderId,
      finalLivraisonDate,
      description || "",
      organizationId
    ],
    function (err, result) {
      if (err) {
        logger.error("Erreur lors de la création du catalogue vide", { error: err });
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la création du catalogue"
        });
      }

      const catalogFileId = result.insertId;
      res.json({
        success: true,
        catalogId: catalogFileId
      });
    },
    req
  );
});

// Créer un catalogue depuis un catalogue existant
router.post("/catalogues/create-from-catalog", requirePermission('catalogues'), (req, res) => {
  // DEBUG: Log CSRF token info
  console.log('🔐 DEBUG /catalogues/create-from-catalog:');
  console.log('  - CSRF token from body:', req.body._csrf);
  console.log('  - CSRF cookie:', req.cookies['_csrf']);
  console.log('  - All cookies:', req.cookies);
  console.log('  - Content-Type:', req.headers['content-type']);

  const { name, expiration_date, date_livraison, description, source_catalog_id } = req.body;
  const uploaderId = getCurrentUserId(req);
  const organizationId = getCurrentOrgId(req);

  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      error: "Le nom du catalogue est obligatoire"
    });
  }

  if (!source_catalog_id) {
    return res.status(400).json({
      success: false,
      error: "Le catalogue source est obligatoire"
    });
  }

  // Vérifier que le catalogue source existe et appartient à la même organisation
  queryWithUser(
    "SELECT id FROM catalog_files WHERE id = ? AND organization_id = ?",
    [source_catalog_id, organizationId],
    (err, sourceCatalogs) => {
      if (err) {
        logger.error("Erreur lors de la vérification du catalogue source", { error: err });
        return res.status(500).json({
          success: false,
          error: "Erreur lors de la vérification du catalogue source"
        });
      }

      if (!sourceCatalogs || sourceCatalogs.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Catalogue source introuvable"
        });
      }

      // Si date_livraison n'est pas fournie, utiliser expiration_date ou NOW()
      const livraisonDate = date_livraison || expiration_date || null;
      const expirationDate = expiration_date || null;

      // Si date_livraison est toujours null, utiliser NOW()
      const finalLivraisonDate = livraisonDate || new Date().toISOString().split('T')[0];

      // Créer le nouveau catalogue
      queryWithUser(
        `INSERT INTO catalog_files
          (filename, originalname, upload_date, expiration_date, uploader_id, date_livraison, description, organization_id)
          VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          name.trim(),
          expirationDate,
          uploaderId,
          finalLivraisonDate,
          description || "",
          organizationId
        ],
        function (err, result) {
          if (err) {
            logger.error("Erreur lors de la création du catalogue", { error: err });
            return res.status(500).json({
              success: false,
              error: "Erreur lors de la création du catalogue"
            });
          }

          const newCatalogFileId = result.insertId;

          // Copier tous les produits du catalogue source
          queryWithUser(
            `INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite, ordre, notes)
             SELECT ?, product_id, prix, unite, ordre, notes
             FROM catalog_products
             WHERE catalog_file_id = ?`,
            [newCatalogFileId, source_catalog_id],
            function (err2) {
              if (err2) {
                logger.error("Erreur lors de la copie des produits", { error: err2 });
                // Supprimer le catalogue créé en cas d'erreur
                queryWithUser(
                  "DELETE FROM catalog_files WHERE id = ?",
                  [newCatalogFileId],
                  () => {},
                  req
                );
                return res.status(500).json({
                  success: false,
                  error: "Erreur lors de la copie des produits"
                });
              }

              res.json({
                success: true,
                catalogId: newCatalogFileId
              });
            },
            req
          );
        },
        req
      );
    },
    req
  );
});

// ANCIENNE route désactivée - remplacée par /catalogues/create-empty (POST avec CSRF)
// Cette route GET créait automatiquement un catalogue à chaque visite, ce qui est dangereux
// router.get("/catalogues/new2", ...)

// Upload catalogue Excel
router.post(
  "/catalogues/upload",
  requirePermission('catalogues'),
  upload.single("excel"),
  validateUploadedFile, // Validation sécurisée du fichier
  handleMulterError, // Gestion des erreurs d'upload
  csrfProtection,
  (req, res) => {
    const file = req.file;
    const expirationDate = req.body.expiration_date;
    const description = req.body.description || "";

    if (!file) {
      return res.render("admin_catalogue_form", {
        error: "Fichier Excel manquant.",
        csrfToken: req.csrfToken(),
      });
    }

    // Validation des données du formulaire
    if (!expirationDate || isNaN(Date.parse(expirationDate))) {
      cleanupUploadedFile(file.path);
      return res.render("admin_catalogue_form", {
        error: "Date d'expiration invalide.",
        csrfToken: req.csrfToken(),
      });
    }

    insertCatalog(
      file,
      expirationDate,
      getCurrentUserId(req),
      description,
      req,
      function (err, result) {
        if (err) {
          cleanupUploadedFile(file.path);
          logger.error("Erreur DB lors de l'upload", { error: err });
          return res.status(500).send("Erreur lors de l'upload.");
        }

        const catalogFileId = result.insertId;

        // Lecture sécurisée du fichier Excel
        let workbook, sheet, rows;
        try {
          workbook = xlsx.readFile(file.path);
          sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        } catch (xlsxError) {
          cleanupUploadedFile(file.path);
          logger.error(
            "Erreur lors de la lecture du fichier Excel:",
            xlsxError
          );

          // Supprimer l'entrée de la base de données
          queryWithUser(
            "DELETE FROM catalog_files WHERE id = ?",
            [catalogFileId],
            req
          );

          return res.status(400).render("admin_catalogue_form", {
            error: "Fichier Excel corrompu ou format invalide.",
            csrfToken: req.csrfToken(),
          });
        }

        rows.slice(1).forEach((row) => {
          const [produit, description, prix] = row;
          if (produit && prix) {
            insertArticle(
              catalogFileId,
              produit,
              description,
              prix,
              req,
              function (err) {}
            );
          }
        });

        fs.unlinkSync(file.path);
        res.redirect("/admin/catalogues/vue");
      },
      req
    );
  }
);

// Envoyer email pour nouveau catalogue
router.post(
  "/catalogues/:id/email",
  requirePermission('catalogues'),
  (req, res) => {
    const orgId = getCurrentOrgId(req);
    db.query(
      "SELECT * FROM catalog_files WHERE id = ? AND organization_id = ?",
      [req.params.id, orgId],
      (err, rows) => {
        if (err || !rows || rows.length === 0)
          return res.redirect("/admin/catalogues/vue");

        const catalogue = rows[0];
        const expiration = formatDateFR(catalogue.expiration_date);

        db.query(
          `SELECT email, username FROM users
           WHERE organization_id = ?
             AND is_validated = 1
             AND email_catalogue = 1
             AND email IS NOT NULL
             AND email <> ''`,
          [orgId],
          (userErr, users) => {
            if (userErr || !users || users.length === 0) {
              debugLog("Notification catalogue", {
                catalogueId: req.params.id,
                usersFound: users ? users.length : 0,
                error: userErr,
              });
              return res.redirect("/admin/catalogues/vue");
            }

            const subject = `Nouveau catalogue disponible : ${
              catalogue.originalname || catalogue.description || catalogue.id
            }`;
            const message = `
              <p style="font-family: Arial, sans-serif;">Un nouveau catalogue est disponible dans votre espace Coopaz.</p>
              <ul style="font-family: Arial, sans-serif;">
                <li><strong>Nom :</strong> ${
                  catalogue.originalname || "Catalogue"
                }</li>
                <li><strong>Description :</strong> ${
                  catalogue.description || "Non renseignée"
                }</li>
                ${
                  expiration
                    ? `<li><strong>Expiration :</strong> ${expiration}</li>`
                    : ""
                }
              </ul>
              <p style="font-family: Arial, sans-serif;">Connectez-vous dès maintenant pour découvrir les nouveautés.</p>
            `;

            const sendJobs = users.map((user) =>
              envoimail(user.email, subject, message, null, {
                initiatedBy: req.session?.username || null,
              }).catch((mailErr) => {
                logger.error("Failed to queue catalogue notification", {
                  error: mailErr,
                  email: user.email,
                  catalogueId: catalogue.id,
                });
                return null;
              })
            );

            Promise.all(sendJobs)
              .then(() => {
                debugLog("Notification catalogue envoyée", {
                  catalogueId: catalogue.id,
                  recipients: users.length,
                });
              })
              .finally(() => {
                res.redirect("/admin/catalogues/vue");
              });
          }
        );
      }
    );
  }
);

// Email arrivée commande
router.post(
  "/catalogues/:id/emailarrivee",
  requirePermission('catalogues'),
  (req, res) => {
    db.query(
      `SELECT u.email, u.id, c.description, c.originalname
from users u
join paniers p on u.id=p.user_id
join catalog_files c on c.id=p.catalog_file_id
where p.catalog_file_id=? and is_submitted=1  `,
      [req.params.id],
      (err, rows) => {
        if (err || !rows || rows.length === 0)
          return res.redirect("/admin/catalogues/vue");
        const catalogue = rows[0];
        const emails = rows.map((row) => row.email);
        const { debugLog } = require("../utils/logger-helpers");
        debugLog("Emails envoyés", { emails });
        envoimail(
          emails,
          "Commande disponible : " + catalogue.originalname,
          `<h1 style="color:blue;">Votre commande  <br> *** ` +
            catalogue.description +
            " " +
            catalogue.originalname +
            ` ***<br> est disponible à la Coop </h1>`,
          null,
          {
            initiatedBy: req.session?.username || null,
          }
        ).catch((err) =>
          logger.error("Failed to send email for order available", err)
        );
        res.redirect("/admin/catalogues/vue");
      }
    );
  }
);

// Activer/désactiver l'email automatique au référent (Expiration + 8h)
router.post(
  "/catalogues/:id/reminder-referent",
  requirePermission('catalogues'),
  validateCatalogOwnership,
  (req, res) => {
    const referentOrderReminderEnabled = req.body
      .referent_order_reminder_enabled
      ? 1
      : 0;

    const sql = `UPDATE catalog_files
      SET referent_order_reminder_enabled = ?,
          referent_order_reminder_sent_at = referent_order_reminder_sent_at
      WHERE id = ?`;

    queryWithUser(
      sql,
      [referentOrderReminderEnabled, req.params.id],
      () => {
        res.redirect(req.get("referer") || "/admin/catalogues/vue");
      },
      req
    );
  }
);

// Réinitialiser le rappel référent (autorise un renvoi)
router.post(
  "/catalogues/:id/reminder-referent-reset",
  requirePermission('catalogues'),
  validateCatalogOwnership,
  (req, res) => {
    const sql = `UPDATE catalog_files
      SET referent_order_reminder_sent_at = NULL
      WHERE id = ?`;

    queryWithUser(
      sql,
      [req.params.id],
      () => {
        res.redirect(
          req.get("referer") || `/admin/catalogues/${req.params.id}/edit`
        );
      },
      req
    );
  }
);

// Mise à jour expiration et description
router.post("/catalogues/:id/expiration", requirePermission('catalogues'), (req, res) => {
  const { id } = req.params;
  const { expiration_date, description } = req.body;
  queryWithUser(
    "UPDATE catalog_files SET expiration_date = ?, description = ? WHERE id = ?",
    [expiration_date, description, id],
    () => {
      res.redirect("/admin/catalogues/vue");
    },

    req
  );
});

// Modifier la visibilité d'un catalogue (is_archived)
router.post(
  "/catalogues/:id/visibility",
  requirePermission('catalogues'),
  validateCatalogOwnership,
  (req, res) => {
    const raw = req.body.is_archived;
    const nextVisibility = Number(raw);
    const allowed = new Set([0, 2, 3]);

    if (!allowed.has(nextVisibility)) {
      return res.redirect(req.get("referer") || "/admin/catalogues/vue");
    }

    queryWithUser(
      "UPDATE catalog_files SET is_archived = ? WHERE id = ?",
      [nextVisibility, req.params.id],
      () => {
        res.redirect(req.get("referer") || "/admin/catalogues/vue");
      },
      req
    );
  }
);

// Archiver un catalogue
router.post("/catalogues/:id/archive", requirePermission('catalogues'), (req, res) => {
  queryWithUser(
    "UPDATE catalog_files SET is_archived = 1 WHERE id = ?",
    [req.params.id],
    () => {
      res.redirect("/admin/catalogues/vue");
    },
    req
  );
});

// Désarchiver un catalogue
router.post("/catalogues/:id/unarchive", requirePermission('catalogues'), (req, res) => {
  queryWithUser(
    "UPDATE catalog_files SET is_archived = 0 WHERE id = ?",
    [req.params.id],
    () => {
      res.redirect("/admin/catalogues/vue");
    },
    req
  );
});

// Suppression d'un catalogue
router.post("/catalogues/:id/delete", requirePermission('catalogues'), (req, res) => {
  const catalogueId = req.params.id;

  db.query(
    "SELECT image_filename, organization_id FROM catalog_files WHERE id = ?",
    [catalogueId],
    (selectErr, rows) => {
      if (selectErr || !rows || rows.length === 0) {
        return res.redirect("/admin/catalogues/vue");
      }

      const { image_filename: oldFilename, organization_id: orgId } = rows[0];
      if (
        !isSuperAdmin(req) &&
        Number(orgId) !== Number(getCurrentOrgId(req))
      ) {
        return res.status(403).send("Accès interdit");
      }

      if (oldFilename) {
        const oldPath = path.join(CATALOGUE_IMAGE_DIR, oldFilename);
        try {
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (_) {
          // best-effort
        }
      }

      queryWithUser(
        "DELETE FROM catalog_files WHERE id = ?",
        [catalogueId],
        (err) => {
          if (err) {
            res.status(500).send("Erreur lors de la suppression du catalogue.");
          } else {
            res.redirect("/admin/catalogues/vue");
          }
        },
        req
      );
    }
  );
});

// Envoyer alerte de disponibilité des produits
router.post("/catalogues/:id/alerte", requirePermission('catalogues'), async (req, res) => {
  const catalogueId = req.params.id;

  try {
    // Récupérer les infos du catalogue
    db.query(
      "SELECT originalname, expiration_date FROM catalog_files WHERE id = ?",
      [catalogueId],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.status(404).json({ success: false, error: "Catalogue non trouvé" });
        }

        const catalogue = rows[0];

        // Récupérer tous les utilisateurs actifs
        db.query(
          "SELECT email, username FROM users WHERE role = 'utilisateur' AND is_validated = 1",
          async (err, users) => {
            if (err || !users || users.length === 0) {
              return res.status(500).json({ success: false, error: "Aucun utilisateur trouvé" });
            }

            // Envoyer un email à chaque utilisateur
            const emailPromises = users.map(user =>
              emailService.sendEmail({
                to: user.email,
                subject: `Nouveaux produits disponibles : ${catalogue.originalname}`,
                html: `
                  <h2>Bonjour ${user.username},</h2>
                  <p>De nouveaux produits sont disponibles dans le catalogue <strong>${catalogue.originalname}</strong>.</p>
                  <p>Connectez-vous pour passer commande avant le ${new Date(catalogue.expiration_date).toLocaleDateString('fr-FR')}.</p>
                  <p><a href="${process.env.APP_URL || 'http://localhost:3100'}/catalogues">Voir les catalogues</a></p>
                `
              })
            );

            await Promise.all(emailPromises);
            res.json({ success: true, message: "Alertes envoyées avec succès" });
          }
        );
      }
    );
  } catch (error) {
    console.error("Erreur envoi alerte:", error);
    res.status(500).json({ success: false, error: "Erreur lors de l'envoi des alertes" });
  }
});

// Envoyer rappel au référent pour commande
router.post("/catalogues/:id/rappel", requirePermission('catalogues'), async (req, res) => {
  const catalogueId = req.params.id;

  try {
    // Récupérer les infos du catalogue et du référent
    db.query(
      "SELECT cf.originalname, cf.expiration_date, u.email, u.username FROM catalog_files cf JOIN users u ON cf.user_id = u.id WHERE cf.id = ? AND u.is_validated = 1",
      [catalogueId],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.status(404).json({ success: false, error: "Catalogue non trouvé" });
        }

        const catalogue = rows[0];

        // Envoyer un email au référent
        await emailService.sendEmail({
          to: catalogue.email,
          subject: `Rappel : Commande pour le catalogue ${catalogue.originalname}`,
          html: `
            <h2>Bonjour ${catalogue.username},</h2>
            <p>Ceci est un rappel concernant le catalogue <strong>${catalogue.originalname}</strong>.</p>
            <p>Date limite de commande : ${new Date(catalogue.expiration_date).toLocaleDateString('fr-FR')}</p>
            <p>N'oubliez pas de valider les commandes avant cette date.</p>
            <p><a href="${process.env.APP_URL || 'http://localhost:3100'}/admin/catalogues/${catalogueId}">Voir le catalogue</a></p>
          `
        });

        res.json({ success: true, message: "Rappel envoyé avec succès" });
      }
    );
  } catch (error) {
    console.error("Erreur envoi rappel:", error);
    res.status(500).json({ success: false, error: "Erreur lors de l'envoi du rappel" });
  }
});

// Upload image du catalogue (1 image par catalogue)
router.post(
  "/catalogues/:id/image",
  requirePermission('catalogues'),
  (req, res, next) => {
    catalogueImageUpload.single("image")(req, res, (err) => {
      if (err) {
        logger.error("Erreur upload image catalogue (multer)", {
          error: err,
          catalogueId: req.params.id,
        });

        const catalogueId = req.params.id;
        const userMessage = (() => {
          const code = err && err.code ? String(err.code) : "";
          if (code === "LIMIT_FILE_SIZE") {
            return "Image trop lourde (max 8 MB).";
          }
          if (err && err.message) {
            return err.message;
          }
          return "Upload impossible (erreur de fichier).";
        })();

        db.query(
          GET_CATALOG_PRODUCTS_SQL,
          [catalogueId],
          (e2, articles) => {
            db.query(
              "SELECT * FROM catalog_files WHERE id = ?",
              [catalogueId],
              (e3, catalogues) => {
                const catalogue =
                  catalogues && catalogues.length > 0 ? catalogues[0] : null;
                return renderAdminView(res, "admin_catalogue_edit_form", {
                  catalogue,
                  articles: articles || [],
                  error: userMessage,
                });
              }
            );
          }
        );
        return;
      }
      next();
    });
  },
  csrfProtection,
  async (req, res) => {
    const catalogueId = req.params.id;

    if (!req.file) {
      return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
    }

    const tmpPath = req.file.path;

    db.query(
      "SELECT image_filename, organization_id FROM catalog_files WHERE id = ?",
      [catalogueId],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          cleanupTempCatalogueImage(tmpPath);
          return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }

        const { image_filename: oldFilename, organization_id: orgId } = rows[0];
        if (
          !isSuperAdmin(req) &&
          Number(orgId) !== Number(getCurrentOrgId(req))
        ) {
          cleanupTempCatalogueImage(tmpPath);
          return res.status(403).send("Accès interdit");
        }

        try {
          if (!fs.existsSync(CATALOGUE_IMAGE_DIR)) {
            fs.mkdirSync(CATALOGUE_IMAGE_DIR, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const newFilename = `catalogue-${catalogueId}-${uniqueSuffix}.webp`;
          const outputPath = path.join(CATALOGUE_IMAGE_DIR, newFilename);

          await sharp(tmpPath)
            .rotate()
            .resize({
              width: 1200,
              height: 1200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toFile(outputPath);

          cleanupTempCatalogueImage(tmpPath);

          if (oldFilename) {
            const oldPath = path.join(CATALOGUE_IMAGE_DIR, oldFilename);
            try {
              if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
              }
            } catch (_) {
              // best-effort
            }
          }

          queryWithUser(
            "UPDATE catalog_files SET image_filename = ? WHERE id = ?",
            [newFilename, catalogueId],
            (updateErr) => {
              if (updateErr) {
                const isMissingColumn =
                  updateErr &&
                  (updateErr.code === "ER_BAD_FIELD_ERROR" ||
                    /Unknown column/i.test(updateErr.message || ""));

                logger.error(
                  "Erreur DB lors de l'enregistrement image catalogue",
                  {
                    error: updateErr,
                    catalogueId,
                  }
                );

                try {
                  if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                  }
                } catch (_) {
                  // best-effort
                }

                db.query(
                  GET_CATALOG_PRODUCTS_SQL,
                  [catalogueId],
                  (e2, articles) => {
                    db.query(
                      "SELECT * FROM catalog_files WHERE id = ?",
                      [catalogueId],
                      (e3, catalogues) => {
                        const catalogue =
                          catalogues && catalogues.length > 0
                            ? catalogues[0]
                            : null;
                        return renderAdminView(
                          res,
                          "admin_catalogue_edit_form",
                          {
                            catalogue,
                            articles: articles || [],
                            error: isMissingColumn
                              ? "La base n'est pas à jour (colonne image manquante). Appliquez la migration 20260120_add_catalogue_image.sql puis réessayez."
                              : "Erreur lors de l'enregistrement de l'image en base.",
                          }
                        );
                      }
                    );
                  }
                );
                return;
              }

              return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
            },
            req
          );
        } catch (e) {
          cleanupTempCatalogueImage(tmpPath);
          db.query(
            GET_CATALOG_PRODUCTS_SQL,
            [catalogueId],
            (e2, articles) => {
              db.query(
                "SELECT * FROM catalog_files WHERE id = ?",
                [catalogueId],
                (e3, catalogues) => {
                  const catalogue =
                    catalogues && catalogues.length > 0 ? catalogues[0] : null;
                  return renderAdminView(res, "admin_catalogue_edit_form", {
                    catalogue,
                    articles: articles || [],
                    error:
                      "Impossible de traiter l'image (format non supporté ou image corrompue).",
                  });
                }
              );
            }
          );
        }
      }
    );
  }
);

// Upload image du catalogue via webcam (dataURL)
router.post(
  "/catalogues/:id/image/webcam",
  requirePermission('catalogues'),
  csrfProtection,
  async (req, res) => {
    const catalogueId = req.params.id;
    const dataUrl = req.body && req.body.image_data_url;

    if (!dataUrl || typeof dataUrl !== "string") {
      return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
    }

    const match = dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/i);
    if (!match) {
      return res.status(400).send("Image invalide (format dataURL attendu). ");
    }

    const base64Payload = match[3];
    let inputBuffer;
    try {
      inputBuffer = Buffer.from(base64Payload, "base64");
    } catch (e) {
      return res.status(400).send("Image invalide (base64). ");
    }

    db.query(
      "SELECT image_filename, organization_id FROM catalog_files WHERE id = ?",
      [catalogueId],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }

        const { image_filename: oldFilename, organization_id: orgId } = rows[0];
        if (
          !isSuperAdmin(req) &&
          Number(orgId) !== Number(getCurrentOrgId(req))
        ) {
          return res.status(403).send("Accès interdit");
        }

        try {
          if (!fs.existsSync(CATALOGUE_IMAGE_DIR)) {
            fs.mkdirSync(CATALOGUE_IMAGE_DIR, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const newFilename = `catalogue-${catalogueId}-${uniqueSuffix}.webp`;
          const outputPath = path.join(CATALOGUE_IMAGE_DIR, newFilename);

          await sharp(inputBuffer)
            .rotate()
            .resize({
              width: 1200,
              height: 1200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 82 })
            .toFile(outputPath);

          if (oldFilename) {
            const oldPath = path.join(CATALOGUE_IMAGE_DIR, oldFilename);
            try {
              if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
              }
            } catch (_) {
              // best-effort
            }
          }

          queryWithUser(
            "UPDATE catalog_files SET image_filename = ? WHERE id = ?",
            [newFilename, catalogueId],
            (updateErr) => {
              if (updateErr) {
                const isMissingColumn =
                  updateErr &&
                  (updateErr.code === "ER_BAD_FIELD_ERROR" ||
                    /Unknown column/i.test(updateErr.message || ""));

                logger.error(
                  "Erreur DB lors de l'enregistrement image catalogue webcam",
                  {
                    error: updateErr,
                    catalogueId,
                  }
                );

                try {
                  if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                  }
                } catch (_) {
                  // best-effort
                }

                db.query(
                  GET_CATALOG_PRODUCTS_SQL,
                  [catalogueId],
                  (e2, articles) => {
                    db.query(
                      "SELECT * FROM catalog_files WHERE id = ?",
                      [catalogueId],
                      (e3, catalogues) => {
                        const catalogue =
                          catalogues && catalogues.length > 0
                            ? catalogues[0]
                            : null;
                        return renderAdminView(
                          res,
                          "admin_catalogue_edit_form",
                          {
                            catalogue,
                            articles: articles || [],
                            error: isMissingColumn
                              ? "La base utilisée par l'application n'a pas la colonne image_filename. Vérifiez que la migration a été appliquée sur la bonne base (DB_NAME)."
                              : "Erreur lors de l'enregistrement de l'image webcam en base.",
                          }
                        );
                      }
                    );
                  }
                );
                return;
              }

              return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
            },
            req
          );
        } catch (e) {
          logger.error("Erreur traitement image catalogue webcam", {
            error: e && e.message ? e.message : e,
            catalogueId,
          });
          return res
            .status(400)
            .send(
              "Impossible de traiter l'image webcam (format non supporté ou image corrompue)."
            );
        }
      }
    );
  }
);

// Suppression de l'image d'un catalogue
router.post(
  "/catalogues/:id/image/delete",
  requirePermission('catalogues'),
  csrfProtection,
  (req, res) => {
    const catalogueId = req.params.id;

    db.query(
      "SELECT image_filename, organization_id FROM catalog_files WHERE id = ?",
      [catalogueId],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }

        const { image_filename: oldFilename, organization_id: orgId } = rows[0];
        if (
          !isSuperAdmin(req) &&
          Number(orgId) !== Number(getCurrentOrgId(req))
        ) {
          return res.status(403).send("Accès interdit");
        }

        if (oldFilename) {
          const oldPath = path.join(CATALOGUE_IMAGE_DIR, oldFilename);
          try {
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          } catch (_) {
            // best-effort
          }
        }

        queryWithUser(
          "UPDATE catalog_files SET image_filename = NULL WHERE id = ?",
          [catalogueId],
          (updateErr) => {
            if (updateErr) {
              logger.error("Erreur DB lors de la suppression image catalogue", {
                error: updateErr,
                catalogueId,
              });
            }
            return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
          },
          req
        );
      }
    );
  }
);

// Synthèse Vue (version moderne)
router.get("/catalogues/:id/synthese/vue", requirePermission('catalogues'), (req, res) => {
  renderAdminView(res, "admin_catalogue_synthese_vue", {
    catalogueId: req.params.id
  });
});

// Synthèse détaillée Vue (version moderne)
router.get("/catalogues/:id/synthese-detaillee/vue", requirePermission('catalogues'), (req, res) => {
  renderAdminView(res, "admin_catalogue_synthese_detaillee_vue", {
    catalogueId: req.params.id
  });
});

// GET /admin/catalogues/:id/synthese - Redirection vers la synthèse Vue+Vite
router.get("/catalogues/:id/synthese", requirePermission('catalogues'), (req, res) => {
  res.redirect(`/admin/catalogues/${req.params.id}/synthese/vue`);
});

// GET /admin/catalogues/:id/synthese-detaillee - Redirection vers la synthèse détaillée Vue+Vite
router.get(
  "/catalogues/:id/synthese-detaillee",
  requirePermission('catalogues'),
  (req, res) => {
    res.redirect(`/admin/catalogues/${req.params.id}/synthese-detaillee/vue`);
  }
);

// Afficher le formulaire d'édition d'un catalogue
router.get(
  "/catalogues/:id/edit",
  requirePermission('catalogues'),
  validateCatalogOwnership,
  (req, res) => {
    const orgId = getCurrentOrgId(req);

    // Récupérer les produits du catalogue
    db.query(
      GET_CATALOG_PRODUCTS_SQL,
      [req.params.id],
      (err, articles) => {
        if (err) {
          console.error("Error fetching catalog products:", err);
          return res.status(500).send("Erreur lors de la récupération des produits du catalogue");
        }

        // Récupérer tous les produits disponibles pour l'ajout avec leurs infos complètes
        // et le dernier prix connu depuis catalog_products
        db.query(
          `SELECT
            p.id,
            p.nom,
            p.description,
            p.supplier_id,
            p.category_id,
            s.nom as supplier_nom,
            c.nom as category_nom,
            (SELECT cp.prix
             FROM catalog_products cp
             INNER JOIN catalog_files cf ON cp.catalog_file_id = cf.id
             WHERE cp.product_id = p.id AND cf.organization_id = p.organization_id
             ORDER BY cf.upload_date DESC
             LIMIT 1) as dernier_prix,
            (SELECT cp.unite
             FROM catalog_products cp
             INNER JOIN catalog_files cf ON cp.catalog_file_id = cf.id
             WHERE cp.product_id = p.id AND cf.organization_id = p.organization_id
             ORDER BY cf.upload_date DESC
             LIMIT 1) as derniere_unite
          FROM products p
          LEFT JOIN suppliers s ON p.supplier_id = s.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.organization_id = ? AND p.is_active = 1
          ORDER BY p.nom`,
          [orgId],
          (err2, allProducts) => {
            if (err2) {
              console.error("Error fetching products:", err2);
              return res.status(500).send("Erreur lors de la récupération des produits");
            }

            // Récupérer les fournisseurs et catégories pour les filtres
            db.query(
              "SELECT id, nom FROM suppliers WHERE organization_id = ? AND is_active = 1 ORDER BY nom",
              [orgId],
              (err3, suppliers) => {
                if (err3) {
                  console.error("Error fetching suppliers:", err3);
                  return res.status(500).send("Erreur lors de la récupération des fournisseurs");
                }

                db.query(
                  "SELECT id, nom FROM categories WHERE organization_id = ? AND is_active = 1 ORDER BY nom",
                  [orgId],
                  (err4, categories) => {
                    if (err4) {
                      console.error("Error fetching categories:", err4);
                      return res.status(500).send("Erreur lors de la récupération des catégories");
                    }

                    // Récupérer les autres catalogues pour l'import
                    db.query(
                      `SELECT
                        cf.id,
                        cf.originalname,
                        cf.upload_date,
                        cf.expiration_date,
                        COUNT(cp.id) as nb_produits
                      FROM catalog_files cf
                      LEFT JOIN catalog_products cp ON cp.catalog_file_id = cf.id
                      WHERE cf.organization_id = ? AND cf.id != ?
                      GROUP BY cf.id, cf.originalname, cf.upload_date, cf.expiration_date
                      HAVING nb_produits > 0
                      ORDER BY cf.upload_date DESC
                      LIMIT 50`,
                      [orgId, req.params.id],
                      (err5, otherCatalogs) => {
                        if (err5) {
                          console.error("Error fetching other catalogs:", err5);
                          return res.status(500).send("Erreur lors de la récupération des catalogues");
                        }

                        renderAdminView(res, "admin_catalogue_edit_form", {
                          catalogue: req.catalog,
                          articles: articles || [],
                          allProducts: allProducts || [],
                          suppliers: suppliers || [],
                          categories: categories || [],
                          otherCatalogs: otherCatalogs || [],
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

// Valider le formulaire d'édition d'un catalogue
router.post(
  "/catalogues/:id/edit",
  requirePermission('catalogues'),
  validateCatalogOwnership,
  (req, res) => {
    const {
      originalname,
      expiration_date,
      description,
      is_archived,
      date_livraison,
    } = req.body;

    const referentOrderReminderEnabled = req.body
      .referent_order_reminder_enabled
      ? 1
      : 0;

    const sql = `UPDATE catalog_files
      SET originalname = ?,
          expiration_date = ?,
          description = ?,
          is_archived = ?,
          date_livraison = ?,
          referent_order_reminder_enabled = ?,
          referent_order_reminder_sent_at = referent_order_reminder_sent_at
      WHERE id = ?`;

    queryWithUser(
      sql,
      [
        originalname,
        expiration_date,
        description,
        is_archived,
        date_livraison,
        referentOrderReminderEnabled,
        req.params.id,
      ],
      (err) => {
        if (err) {
          console.error("Erreur lors de la modification du catalogue:", err);
          // Si c'est une requête AJAX, renvoyer du JSON
          if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(500).json({ error: "Erreur lors de la modification." });
          }

          renderAdminView(res, "admin_catalogue_edit_form", {
            catalogue: {
              ...req.catalog,
              ...req.body,
              referent_order_reminder_enabled: referentOrderReminderEnabled,
            },
            articles: [],
            error: "Erreur lors de la modification.",
          });
          return;
        }

        // Si c'est une requête AJAX (auto-save), renvoyer du JSON
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
          return res.json({ success: true, message: "Catalogue mis à jour" });
        }

        // Sinon, redirection normale
        res.redirect(`/admin/catalogues/${req.params.id}/edit`);
      },
      req
    );
  }
);

// Ajouter un produit existant au catalogue
router.post("/catalogues/:id/articles/add", requirePermission('catalogues'), (req, res) => {
  const { product_id, prix, unite } = req.body;
  const catalogueId = req.params.id;

  if (!product_id || !prix) {
    return res.status(400).json({
      error: "Le produit et le prix sont obligatoires."
    });
  }

  // Vérifier que le produit n'est pas déjà dans ce catalogue
  db.query(
    "SELECT id FROM catalog_products WHERE catalog_file_id = ? AND product_id = ?",
    [catalogueId, product_id],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors de la vérification." });
      }

      if (existing && existing.length > 0) {
        return res.status(400).json({
          error: "Ce produit est déjà dans le catalogue."
        });
      }

      // Ajouter la liaison
      queryWithUser(
        "INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite) VALUES (?, ?, ?, ?)",
        [catalogueId, product_id, prix, unite],
        function (err) {
          if (err) {
            return res.status(500).json({ error: "Erreur lors de l'ajout." });
          }
          res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        },
        req
      );
    }
  );
});

// Ajouter plusieurs produits existants au catalogue en une fois
router.post("/catalogues/:id/articles/add-multiple", requirePermission('catalogues'), (req, res) => {
  const catalogueId = req.params.id;
  const products = req.body.products; // Array de {product_id, prix, unite}

  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({
      error: "Aucun produit sélectionné."
    });
  }

  // Vérifier quels produits sont déjà dans le catalogue
  const productIds = products.map(p => p.product_id);
  db.query(
    "SELECT product_id FROM catalog_products WHERE catalog_file_id = ? AND product_id IN (?)",
    [catalogueId, productIds],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors de la vérification." });
      }

      const existingIds = existing.map(e => e.product_id);
      const toAdd = products.filter(p => !existingIds.includes(parseInt(p.product_id)));

      if (toAdd.length === 0) {
        return res.status(400).json({
          error: "Tous les produits sélectionnés sont déjà dans le catalogue."
        });
      }

      // Préparer les valeurs pour l'insertion
      const values = toAdd.map(p => [catalogueId, p.product_id, p.prix, p.unite]);

      // Insérer tous les produits
      queryWithUser(
        "INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite) VALUES ?",
        [values],
        function (err) {
          if (err) {
            console.error("Error adding multiple products:", err);
            return res.status(500).json({ error: "Erreur lors de l'ajout des produits." });
          }
          res.json({
            success: true,
            added: toAdd.length,
            skipped: products.length - toAdd.length
          });
        },
        req
      );
    }
  );
});

// Importer tous les produits d'un autre catalogue
router.post("/catalogues/:id/import-from-catalog", requirePermission('catalogues'), (req, res) => {
  const targetCatalogId = req.params.id;
  const sourceCatalogId = req.body.source_catalog_id;

  if (!sourceCatalogId) {
    return res.status(400).json({
      error: "Veuillez sélectionner un catalogue source."
    });
  }

  // Récupérer tous les produits du catalogue source
  db.query(
    "SELECT product_id, prix, unite FROM catalog_products WHERE catalog_file_id = ?",
    [sourceCatalogId],
    (err, sourceProducts) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors de la récupération des produits source." });
      }

      if (sourceProducts.length === 0) {
        return res.status(400).json({
          error: "Le catalogue source ne contient aucun produit."
        });
      }

      // Vérifier quels produits sont déjà dans le catalogue cible
      const productIds = sourceProducts.map(p => p.product_id);
      db.query(
        "SELECT product_id FROM catalog_products WHERE catalog_file_id = ? AND product_id IN (?)",
        [targetCatalogId, productIds],
        (err, existing) => {
          if (err) {
            return res.status(500).json({ error: "Erreur lors de la vérification." });
          }

          const existingIds = existing.map(e => e.product_id);
          const toAdd = sourceProducts.filter(p => !existingIds.includes(p.product_id));

          if (toAdd.length === 0) {
            return res.status(400).json({
              error: "Tous les produits du catalogue source sont déjà présents dans ce catalogue."
            });
          }

          // Préparer les valeurs pour l'insertion
          const values = toAdd.map(p => [targetCatalogId, p.product_id, p.prix, p.unite]);

          // Insérer tous les produits
          queryWithUser(
            "INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite) VALUES ?",
            [values],
            function (err) {
              if (err) {
                console.error("Error importing products:", err);
                return res.status(500).json({ error: "Erreur lors de l'import des produits." });
              }
              res.json({
                success: true,
                added: toAdd.length,
                skipped: sourceProducts.length - toAdd.length,
                total: sourceProducts.length
              });
            },
            req
          );
        }
      );
    }
  );
});

// Supprimer un article du catalogue (retire la liaison catalog_products)
router.post(
  "/catalogues/:catalogue_id/articles/:article_id/delete",
  requirePermission('catalogues'),
  (req, res) => {
    const { catalogue_id, article_id } = req.params;
    queryWithUser(
      "DELETE FROM catalog_products WHERE id = ? AND catalog_file_id = ?",
      [article_id, catalogue_id],
      (err) => {
        res.redirect(`/admin/catalogues/${catalogue_id}/edit`);
      },
      req
    );
  }
);

// Formulaire d'édition d'un article
router.get(
  "/catalogues/:catalogue_id/articles/:article_id/edit",
  requirePermission('catalogues'),
  (req, res) => {
    db.query(
      GET_CATALOG_PRODUCT_BY_ID_SQL,
      [req.params.article_id, req.params.catalogue_id],
      (err, results) => {
        if (err || !results || results.length === 0)
          return res.redirect(
            `/admin/catalogues/${req.params.catalogue_id}/edit`
          );
        const article = results[0];
        renderAdminView(res, "admin_article_edit_form", {
          article,
          catalogue_id: req.params.catalogue_id,
          error: null,
        });
      }
    );
  }
);

// Validation édition d'un article (modifie seulement prix et unité dans catalog_products)
router.post(
  "/catalogues/:catalogue_id/articles/:article_id/edit",
  requirePermission('catalogues'),
  (req, res) => {
    const { prix, unite } = req.body;
    // Note: produit et description ne sont plus modifiables ici, ils sont au niveau du produit global
    queryWithUser(
      "UPDATE catalog_products SET prix = ?, unite = ? WHERE id = ? AND catalog_file_id = ?",
      [
        prix,
        unite,
        req.params.article_id,
        req.params.catalogue_id,
      ],
      function (err) {
        if (err) {
          db.query(
            GET_CATALOG_PRODUCT_BY_ID_SQL,
            [req.params.article_id, req.params.catalogue_id],
            (e, results) => {
              const article = results && results.length > 0 ? results[0] : null;
              renderAdminView(res, "admin_article_edit_form", {
                article,
                catalogue_id: req.params.catalogue_id,
                error: "Erreur lors de la modification.",
              });
            }
          );
        } else {
          res.redirect(`/admin/catalogues/${req.params.catalogue_id}/edit`);
        }
      },
      req
    );
  }
);

// Upload / remplacement d'une image pour un article
router.post(
  "/catalogues/:catalogue_id/articles/:article_id/image",
  requirePermission('catalogues'),
  (req, res, next) => {
    articleImageUpload.single("image")(req, res, (err) => {
      if (err) {
        const catalogueId = req.params.catalogue_id;
        db.query(
          GET_CATALOG_PRODUCTS_SQL,
          [catalogueId],
          (e2, articles) => {
            db.query(
              "SELECT * FROM catalog_files WHERE id = ?",
              [catalogueId],
              (e3, catalogues) => {
                const catalogue =
                  catalogues && catalogues.length > 0 ? catalogues[0] : null;
                return renderAdminView(res, "admin_catalogue_edit_form", {
                  catalogue,
                  articles: articles || [],
                  error:
                    err && err.message
                      ? err.message
                      : "Erreur lors de l'upload de l'image.",
                });
              }
            );
          }
        );
        return;
      }
      next();
    });
  },
  csrfProtection,
  async (req, res) => {
    const { catalogue_id: catalogueId, article_id: articleId } = req.params;

    if (!req.file) {
      return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
    }

    const tmpPath = req.file.path;

    db.query(
      `SELECT a.image_filename, c.organization_id
       FROM articles a
       JOIN catalog_files c ON c.id = a.catalog_file_id
       WHERE a.id = ? AND a.catalog_file_id = ?`,
      [articleId, catalogueId],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          cleanupTempArticleImage(tmpPath);
          return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }

        const { image_filename: oldFilename, organization_id: orgId } = rows[0];
        if (
          !isSuperAdmin(req) &&
          Number(orgId) !== Number(getCurrentOrgId(req))
        ) {
          cleanupTempArticleImage(tmpPath);
          return res.status(403).send("Accès interdit");
        }

        try {
          if (!fs.existsSync(ARTICLE_IMAGE_DIR)) {
            fs.mkdirSync(ARTICLE_IMAGE_DIR, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const newFilename = `article-${articleId}-${uniqueSuffix}.webp`;
          const outputPath = path.join(ARTICLE_IMAGE_DIR, newFilename);

          await sharp(tmpPath)
            .rotate()
            .resize({
              width: 900,
              height: 900,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toFile(outputPath);

          cleanupTempArticleImage(tmpPath);

          if (oldFilename) {
            const oldPath = path.join(ARTICLE_IMAGE_DIR, oldFilename);
            try {
              if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
              }
            } catch (_) {
              // best-effort
            }
          }

          queryWithUser(
            "UPDATE articles SET image_filename = ? WHERE id = ? AND catalog_file_id = ?",
            [newFilename, articleId, catalogueId],
            (updateErr) => {
              if (updateErr) {
                // Si la migration n'a pas été appliquée, on le signale explicitement.
                const isMissingColumn =
                  updateErr &&
                  (updateErr.code === "ER_BAD_FIELD_ERROR" ||
                    /Unknown column/i.test(updateErr.message || ""));

                logger.error(
                  "Erreur DB lors de l'enregistrement image article",
                  {
                    error: updateErr,
                    articleId,
                    catalogueId,
                  }
                );

                // Nettoyage du fichier généré si la DB refuse l'update
                try {
                  if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                  }
                } catch (_) {
                  // best-effort
                }

                db.query(
                  GET_CATALOG_PRODUCTS_SQL,
                  [catalogueId],
                  (e2, articles) => {
                    db.query(
                      "SELECT * FROM catalog_files WHERE id = ?",
                      [catalogueId],
                      (e3, catalogues) => {
                        const catalogue =
                          catalogues && catalogues.length > 0
                            ? catalogues[0]
                            : null;
                        return renderAdminView(
                          res,
                          "admin_catalogue_edit_form",
                          {
                            catalogue,
                            articles: articles || [],
                            error: isMissingColumn
                              ? "La base n'est pas à jour (colonne image manquante). Appliquez la migration 20260115_add_article_image.sql puis réessayez."
                              : "Erreur lors de l'enregistrement de l'image en base.",
                          }
                        );
                      }
                    );
                  }
                );
                return;
              }

              return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
            },
            req
          );
        } catch (e) {
          cleanupTempArticleImage(tmpPath);
          db.query(
            GET_CATALOG_PRODUCTS_SQL,
            [catalogueId],
            (e2, articles) => {
              db.query(
                "SELECT * FROM catalog_files WHERE id = ?",
                [catalogueId],
                (e3, catalogues) => {
                  const catalogue =
                    catalogues && catalogues.length > 0 ? catalogues[0] : null;
                  return renderAdminView(res, "admin_catalogue_edit_form", {
                    catalogue,
                    articles: articles || [],
                    error:
                      "Impossible de traiter l'image (format non supporté ou image corrompue).",
                  });
                }
              );
            }
          );
        }
      }
    );
  }
);

// Upload image via webcam (dataURL) - fallback ultra-compatible (sans multipart)
router.post(
  "/catalogues/:catalogue_id/articles/:article_id/image/webcam",
  requirePermission('catalogues'),
  csrfProtection,
  async (req, res) => {
    const { catalogue_id: catalogueId, article_id: articleId } = req.params;
    const dataUrl = req.body && req.body.image_data_url;

    if (!dataUrl || typeof dataUrl !== "string") {
      return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
    }

    const match = dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/i);
    if (!match) {
      return res.status(400).send("Image invalide (format dataURL attendu). ");
    }

    const base64Payload = match[3];
    let inputBuffer;
    try {
      inputBuffer = Buffer.from(base64Payload, "base64");
    } catch (e) {
      return res.status(400).send("Image invalide (base64). ");
    }

    db.query(
      `SELECT a.image_filename, c.organization_id
       FROM articles a
       JOIN catalog_files c ON c.id = a.catalog_file_id
       WHERE a.id = ? AND a.catalog_file_id = ?`,
      [articleId, catalogueId],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }

        const { image_filename: oldFilename, organization_id: orgId } = rows[0];
        if (
          !isSuperAdmin(req) &&
          Number(orgId) !== Number(getCurrentOrgId(req))
        ) {
          return res.status(403).send("Accès interdit");
        }

        try {
          if (!fs.existsSync(ARTICLE_IMAGE_DIR)) {
            fs.mkdirSync(ARTICLE_IMAGE_DIR, { recursive: true });
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const newFilename = `article-${articleId}-${uniqueSuffix}.webp`;
          const outputPath = path.join(ARTICLE_IMAGE_DIR, newFilename);

          await sharp(inputBuffer)
            .rotate()
            .resize({
              width: 900,
              height: 900,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toFile(outputPath);

          if (oldFilename) {
            const oldPath = path.join(ARTICLE_IMAGE_DIR, oldFilename);
            try {
              if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
              }
            } catch (_) {
              // best-effort
            }
          }

          queryWithUser(
            "UPDATE articles SET image_filename = ? WHERE id = ? AND catalog_file_id = ?",
            [newFilename, articleId, catalogueId],
            (updateErr) => {
              if (updateErr) {
                const isMissingColumn =
                  updateErr &&
                  (updateErr.code === "ER_BAD_FIELD_ERROR" ||
                    /Unknown column/i.test(updateErr.message || ""));

                logger.error(
                  "Erreur DB lors de l'enregistrement image webcam",
                  {
                    error: updateErr,
                    articleId,
                    catalogueId,
                  }
                );

                // Nettoyage du fichier généré si la DB refuse l'update
                try {
                  if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                  }
                } catch (_) {
                  // best-effort
                }

                db.query(
                  "SELECT * FROM articles WHERE catalog_file_id = ?",
                  [catalogueId],
                  (e2, articles) => {
                    db.query(
                      "SELECT * FROM catalog_files WHERE id = ?",
                      [catalogueId],
                      (e3, catalogues) => {
                        const catalogue =
                          catalogues && catalogues.length > 0
                            ? catalogues[0]
                            : null;
                        return renderAdminView(
                          res,
                          "admin_catalogue_edit_form",
                          {
                            catalogue,
                            articles: articles || [],
                            error: isMissingColumn
                              ? "La base utilisée par l'application n'a pas la colonne image_filename. Vérifiez que la migration a été appliquée sur la bonne base (DB_NAME)."
                              : "Erreur lors de l'enregistrement de l'image webcam en base.",
                          }
                        );
                      }
                    );
                  }
                );
                return;
              }

              return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
            },
            req
          );
        } catch (e) {
          logger.error("Erreur traitement image webcam", {
            error: e && e.message ? e.message : e,
            articleId,
            catalogueId,
          });
          return res
            .status(400)
            .send(
              "Impossible de traiter l'image webcam (format non supporté ou image corrompue)."
            );
        }
      }
    );
  }
);

// Suppression de l'image d'un article
router.post(
  "/catalogues/:catalogue_id/articles/:article_id/image/delete",
  requirePermission('catalogues'),
  csrfProtection,
  (req, res) => {
    const { catalogue_id: catalogueId, article_id: articleId } = req.params;

    db.query(
      `SELECT a.image_filename, c.organization_id
       FROM articles a
       JOIN catalog_files c ON c.id = a.catalog_file_id
       WHERE a.id = ? AND a.catalog_file_id = ?`,
      [articleId, catalogueId],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }

        const { image_filename: oldFilename, organization_id: orgId } = rows[0];
        if (
          !isSuperAdmin(req) &&
          Number(orgId) !== Number(getCurrentOrgId(req))
        ) {
          return res.status(403).send("Accès interdit");
        }

        if (oldFilename) {
          const oldPath = path.join(ARTICLE_IMAGE_DIR, oldFilename);
          try {
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          } catch (_) {
            // best-effort
          }
        }

        queryWithUser(
          "UPDATE articles SET image_filename = NULL WHERE id = ? AND catalog_file_id = ?",
          [articleId, catalogueId],
          (updateErr) => {
            if (updateErr) {
              logger.error("Erreur DB lors de la suppression image article", {
                error: updateErr,
                articleId,
                catalogueId,
              });
            }
            return res.redirect(`/admin/catalogues/${catalogueId}/edit`);
          },
          req
        );
      }
    );
  }
);

// Dupliquer un catalogue
router.post("/catalogues/:id/duplicate", requirePermission('catalogues'), (req, res) => {
  const id = req.params.id;
  db.query(
    "SELECT * FROM catalog_files WHERE id = ? AND organization_id = ?",
    [id, getCurrentOrgId(req)],
    (err, catalogues) => {
      if (err || !catalogues || catalogues.length === 0)
        return res.redirect("/admin/catalogues/vue");
      const catalogue = catalogues[0];

      queryWithUser(
        `INSERT INTO catalog_files (filename, originalname, upload_date, expiration_date, uploader_id, description, is_archived, organization_id)
       VALUES (?, ?, NOW(), NOW(), ?, ?, 0, ?)`,
        [
          catalogue.filename,
          catalogue.originalname.replace(/(\.\w+)?$/, " (copie)$1"),
          getCurrentUserId(req),
          "[COPIE] " + (catalogue.description || ""),
          getCurrentOrgId(req),
        ],
        function (err, result) {
          if (err) return res.redirect("/admin/catalogues/vue");
          const newCatalogId = result.insertId;

          // Duplique l'image du catalogue si présente (évite le partage de fichier)
          if (catalogue.image_filename) {
            try {
              const srcPath = path.join(
                CATALOGUE_IMAGE_DIR,
                catalogue.image_filename
              );
              if (fs.existsSync(srcPath)) {
                const uniqueSuffix =
                  Date.now() + "-" + Math.round(Math.random() * 1e9);
                const newFilename = `catalogue-${newCatalogId}-${uniqueSuffix}.webp`;
                const dstPath = path.join(CATALOGUE_IMAGE_DIR, newFilename);

                if (!fs.existsSync(CATALOGUE_IMAGE_DIR)) {
                  fs.mkdirSync(CATALOGUE_IMAGE_DIR, { recursive: true });
                }

                fs.copyFileSync(srcPath, dstPath);

                queryWithUser(
                  "UPDATE catalog_files SET image_filename = ? WHERE id = ?",
                  [newFilename, newCatalogId],
                  () => {},
                  req
                );
              }
            } catch (copyErr) {
              logger.error(
                "Erreur duplication image catalogue lors de la duplication catalogue",
                {
                  error: copyErr,
                  srcImage: catalogue.image_filename,
                  newCatalogId,
                }
              );
            }
          }

          db.query(
            "SELECT id, produit, description, prix, unite, image_filename FROM articles WHERE catalog_file_id = ?",
            [id],
            (err, articles) => {
              if (!articles || articles.length === 0) {
                return res.redirect("/admin/catalogues/vue");
              }

              let idx = 0;
              const next = () => {
                if (idx >= articles.length) {
                  return res.redirect("/admin/catalogues/vue");
                }

                const a = articles[idx++];
                queryWithUser(
                  "INSERT INTO articles (catalog_file_id, produit, description, prix, unite, image_filename) VALUES (?, ?, ?, ?, ?, NULL)",
                  [newCatalogId, a.produit, a.description, a.prix, a.unite],
                  (insertErr, insertResult) => {
                    if (insertErr || !insertResult || !insertResult.insertId) {
                      return next();
                    }

                    const newArticleId = insertResult.insertId;

                    // Duplique le fichier image si présent, pour éviter le partage de fichier entre catalogues.
                    if (!a.image_filename) {
                      return next();
                    }

                    try {
                      const srcPath = path.join(
                        ARTICLE_IMAGE_DIR,
                        a.image_filename
                      );
                      if (!fs.existsSync(srcPath)) {
                        return next();
                      }

                      const ext =
                        path.extname(a.image_filename || "").toLowerCase() ||
                        ".webp";
                      const uniqueSuffix =
                        Date.now() + "-" + Math.round(Math.random() * 1e9);
                      const newFilename = `article-${newArticleId}-${uniqueSuffix}${ext}`;
                      const dstPath = path.join(ARTICLE_IMAGE_DIR, newFilename);

                      if (!fs.existsSync(ARTICLE_IMAGE_DIR)) {
                        fs.mkdirSync(ARTICLE_IMAGE_DIR, { recursive: true });
                      }

                      fs.copyFileSync(srcPath, dstPath);

                      queryWithUser(
                        "UPDATE articles SET image_filename = ? WHERE id = ? AND catalog_file_id = ?",
                        [newFilename, newArticleId, newCatalogId],
                        () => next(),
                        req
                      );
                    } catch (copyErr) {
                      logger.error(
                        "Erreur duplication image article lors de la duplication catalogue",
                        {
                          error: copyErr,
                          srcImage: a.image_filename,
                          newArticleId,
                          newCatalogId,
                        }
                      );
                      return next();
                    }
                  },
                  req
                );
              };

              next();
            }
          );
        },
        req
      );
    }
  );
});

// ============================================
// DASHBOARD ADMIN
// ============================================

router.get("/dashboard/vue", requirePermission('catalogues'), (req, res) => {
  renderAdminView(res, "admin_dashboard_vue", {
    title: "Dashboard Admin",
    hideSidebar: false,
  });
});

// GET /admin/dashboard - Redirection vers le dashboard Vue+Vite
router.get("/dashboard", requirePermission('catalogues'), (req, res) => {
  res.redirect("/admin/dashboard/vue");
});

// Suppression d'une commande
router.post("/commandes/:id/delete", requirePermission('commandes.admin'), (req, res) => {
  const commandeId = req.params.id;
  queryWithUser(
    "DELETE FROM paniers WHERE id = ?",
    [commandeId],
    () => {
      res.redirect("/admin/dashboard/vue");
    },
    req
  );
});

// Suppression d'un panier
router.post("/paniers/:id/delete", requirePermission('paniers.admin'), (req, res) => {
  const panierId = req.params.id;
  queryWithUser(
    "DELETE FROM panier_articles WHERE panier_id = ?",
    [panierId],
    () => {
      queryWithUser(
        "DELETE FROM paniers WHERE id = ?",
        [panierId],
        () => {
          res.redirect("/admin/dashboard/vue");
        },
        req
      );
    },
    req
  );
});

// Edition d'un panier - Redirection vers Vue+Vite
router.get("/paniers/:id/edit", requirePermission('paniers.admin'), (req, res) => {
  res.redirect("/panier/" + req.params.id + "/modifier/vue");
});

// Ajout d'articles dans le panier
router.post("/paniers/:id/articles/add", requirePermission('paniers.admin'), (req, res) => {
  const panierId = req.params.id;
  const { article_id, quantity } = req.body;

  db.query(
    "SELECT * FROM panier_articles WHERE panier_id = ? AND article_id = ?",
    [panierId, article_id],
    (err, paRows) => {
      if (paRows && paRows.length > 0) {
        let newQuantity = parseFloat(quantity) + paRows[0].quantity;
        newQuantity = Math.max(0, newQuantity);
        queryWithUser(
          "UPDATE panier_articles SET quantity = GREATEST(0, ?) WHERE id = ?",
          [newQuantity, paRows[0].id],
          () => res.redirect(`/panier/${panierId}/modifier/vue`),
          req
        );
      } else {
        queryWithUser(
          "INSERT INTO panier_articles (panier_id, article_id, quantity) VALUES (?, ?, GREATEST(0, ?))",
          [panierId, article_id, quantity],
          () => res.redirect(`/panier/${panierId}/modifier/vue`),
          req
        );
      }
    }
  );
});

// Suppression d'article du panier
router.post("/paniers/:id/articles/remove", requirePermission('paniers.admin'), (req, res) => {
  const panierId = req.params.id;
  const panier_article_id = req.body.panier_article_id;
  queryWithUser(
    "DELETE FROM panier_articles WHERE id = ?",
    [panier_article_id],
    () => {
      res.redirect(`/panier/${panierId}/modifier/vue`);
    },
    req
  );
});

// ============================================
// BANDEAUX
// ============================================

// Routes bandeaux d'information (converties en Vue.js - anciennes routes commentées ci-dessous)
router.get("/bandeaux", requirePermission('users'), (req, res) => {
  renderAdminView(res, "admin_bandeaux_vue");
});

// Anciennes routes bandeaux (commentées - API maintenant dans api.admin.bandeaux.routes.js)
// GET /bandeaux/new, POST /bandeaux/new, POST /bandeaux/:id/delete,
// GET /bandeaux/:id/edit, POST /bandeaux/:id/edit

// ============================================
// MENU ADMIN
// ============================================

// Menu admin - Redirection vers dashboard Vue+Vite
router.get("/menu", requirePermission('catalogues'), (req, res) => {
  res.redirect("/admin/dashboard/vue");
});

router.get("/", requirePermission('catalogues'), (req, res) => {
  res.redirect("/admin/dashboard/vue");
});

// ============================================
// EXPORTS EXCEL
// ============================================

router.get(
  "/catalogues/:id/synthese/export/xlsx",
  requirePermission('catalogues'),
  (req, res) => {
    const catalogueId = req.params.id;
    db.query(
      `SELECT prod.nom as produit, prod.description, cp.prix, pa.note as note_article,
           SUM(pa.quantity) AS total_commande,
           cat.nom as categorie
FROM catalog_products cp
INNER JOIN products prod ON cp.product_id = prod.id
LEFT JOIN categories cat ON prod.category_id = cat.id
JOIN panier_articles pa ON pa.catalog_product_id = cp.id
JOIN paniers pan ON pa.panier_id = pan.id
WHERE cp.catalog_file_id = ? AND pan.is_submitted = 1
GROUP BY cp.id, pa.note
ORDER BY cat.ordre, prod.nom ASC`,
      [catalogueId],
      (err, rows) => {
        if (err) return handleExportError(err, res, "Excel synthèse simple");
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "SyntheseSimple");
        const buffer = xlsx.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        });
        res.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.attachment("synthese_simple_" + catalogueId + ".xlsx");
        res.send(buffer);
      }
    );
  }
);

router.get(
  "/catalogues/:id/synthese-detaillee/export/xlsx/",
  requirePermission('catalogues'),
  (req, res) => {
    const catalogueId = req.params.id;
    db.query(
      `SELECT u.username,  a.produit, a.description, a.prix, 
           SUM(pa.quantity) as quantite, 
           SUM(pa.quantity * a.prix) as montant_utilisateur, COALESCE(c.note, '') AS note , pa.note as note_article
    FROM paniers c
    JOIN panier_articles pa ON pa.panier_id = c.id
    JOIN articles a ON pa.article_id = a.id
    JOIN users u ON c.user_id = u.id
    WHERE a.catalog_file_id = ? and is_submitted=1
    GROUP BY u.id, a.id, c.id
    ORDER BY u.username ASC, a.produit ASC`,
      [catalogueId],
      (err, rows) => {
        if (err) return handleExportError(err, res, "Excel synthèse détaillée");
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "SyntheseDetaillee");
        const buffer = xlsx.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        });
        res.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.attachment("synthese_detaillee_" + catalogueId + ".xlsx");
        res.send(buffer);
      }
    );
  }
);

router.get(
  "/catalogues/:id/synthese-utilisateur/export/xlsx",
  requirePermission('catalogues'),
  (req, res) => {
    const catalogueId = req.params.id;
    db.query(
      `SELECT 
      u.username, 
      u.email, 
      SUM(pa.quantity * a.prix) AS montant_total
    FROM paniers c
    JOIN panier_articles pa ON pa.panier_id = c.id
    JOIN articles a ON pa.article_id = a.id
    JOIN users u ON c.user_id = u.id
    WHERE a.catalog_file_id = ? and is_submitted=1
    GROUP BY u.id
    ORDER BY montant_total DESC`,
      [catalogueId],
      (err, rows) => {
        if (err)
          return handleExportError(err, res, "Excel montant par utilisateur");
        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(
          workbook,
          worksheet,
          "Synthese utilisateur"
        );
        const buffer = xlsx.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        });
        res.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.attachment(
          "synthese_total_utilisateur_catalogue_" + catalogueId + ".xlsx"
        );
        res.send(buffer);
      }
    );
  }
);

// ============================================
// EXPORTS PDF
// ============================================

router.get("/catalogues/:id/synthese/export/pdf/:action", (req, res) => {
  const catalogueId = req.params.id;
  const action = req.params.action;
  const { generateAndSendPdf } = require("../utils/exports");
  generateAndSendPdf(catalogueId, "simple", action, res, req);
});

router.get(
  "/catalogues/:id/synthese-detaillee/export/pdf/:action",
  (req, res) => {
    const catalogueId = req.params.id;
    const action = req.params.action;
    const { generateAndSendPdf } = require("../utils/exports");
    generateAndSendPdf(catalogueId, "detailed", action, res, req);
  }
);

// ============================================
// HELP MANAGEMENT
// ============================================

// Routes d'aide supprimées - fonctionnalité retirée

// ============================================
// GOOGLE SHEETS IMPORT
// ============================================

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

router.get(
  "/import",
  requirePermission('catalogues'),
  (req, res) => {
    res.render("import");
  }
);

router.post(
  "/import",
  requirePermission('catalogues'),
  async (req, res) => {
    const { sheetId, range } = req.body;
    try {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range || "A1:F3000",
      });
      const rows = result.data.values;
      if (!rows || rows.length < 2) {
        return res.send("Aucune donnée trouvée.");
      }
      const headers = rows[0];
      const data = rows.slice(1);
      res.render("table", {
        headers,
        data,
        sheetId,
        range,
        csrfToken: req.csrfToken && req.csrfToken(),
      });
    } catch (err) {
      res.send("Erreur lors de la lecture de la sheet : " + err.message);
    }
  }
);

router.post(
  "/save-catalog",
  requirePermission('catalogues'),
  (req, res) => {
    const {
      rows,
      filename,
      originalname,
      expiration_date,
      uploader_id,
      description,
    } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).send("Aucune ligne sélectionnée.");
    }

    const organizationId = getCurrentOrgId(req);
    queryWithUser(
      `INSERT INTO catalog_files (filename, originalname, upload_date, expiration_date, uploader_id, description, organization_id)
      VALUES (?, ?, NOW(), NOW(), ?, ?, ?)`,
      [
        filename || "import_sheet",
        originalname ||
          "Google Sheet import par " + (res.locals.user || "admin"),
        getCurrentUserId(req) || null,
        description || "",
        organizationId,
      ],
      function (err, result) {
        if (err)
          return handleDatabaseError(
            err,
            res,
            "Erreur lors de l'import du catalogue"
          );
        const catalog_file_id = result.insertId;
        let processed = 0;
        let updated = 0;
        let notFound = 0;

        rows.forEach((row) => {
          const productName = row[0] || "";
          const prix = parseFloat(
            (row[7] || "")
              .replace(/\s/g, "")
              .replace(",", ".")
              .replace(/[^0-9.]/g, "")
          );

          if (!prix || prix <= 0) {
            processed++;
            notFound++;
            if (processed === rows.length) {
              res.send(`Import terminé ! ${updated} produits mis à jour, ${notFound} non trouvés ou sans prix.`);
            }
            return;
          }

          // Mettre à jour products.prix directement (pas de catalog_products)
          // On cherche par nom exact, ou par début de nom
          queryWithUser(
            `UPDATE products
             SET prix = ?, updated_at = NOW()
             WHERE organization_id = ?
               AND (nom = ? OR nom LIKE ? OR ? LIKE CONCAT(nom, '%'))
             LIMIT 1`,
            [prix, organizationId, productName, `${productName}%`, productName],
            (err, result) => {
              if (err) {
                console.error("Erreur update produit:", productName, err);
              } else if (result && result.affectedRows > 0) {
                updated++;
              } else {
                notFound++;
              }
              processed++;
              if (processed === rows.length) {
                res.send(`Import terminé ! ${updated} produits mis à jour, ${notFound} non trouvés ou sans prix.`);
              }
            },
            req
          );
        });

        if (rows.length === 0) res.send("Catalogue importé avec succès !");
      },
      req
    );
  }
);

// ============================================
// TRACE
// ============================================

// Page gestion des traces (Vue.js)
router.get("/trace", requirePermission('audit_logs'), (req, res) => {
  renderAdminView(res, "admin_trace_vue");
});

// ============================================
// STATS
// ============================================

// Page statistiques (Vue.js)
// Page statistiques (Vue.js)
router.get("/stats", requirePermission('reports'), (req, res) => {
  renderAdminView(res, "admin_stats_vue");
});

// ============================================================================
// RBAC Routes - Gestion des Rôles et Permissions
// ============================================================================

// Page gestion des rôles
router.get("/roles/vue", requirePermission('roles'), (req, res) => {
  renderAdminView(res, "admin_roles_vue");
});

// Page gestion des utilisateurs avec RBAC
router.get("/users/vue", requirePermission('users'), (req, res) => {
  renderAdminView(res, "admin_users_vue");
});

// Page assignation rôles à un utilisateur
router.get("/users/:id/roles", requirePermission('users'), (req, res) => {
  renderAdminView(res, "admin_user_roles_vue", {
    userId: req.params.id
  });
});

module.exports = router;
