const { db } = require("../config/config");
const { logger } = require("../config/logger");
const { enqueueEmail } = require("./email-queue.service");
const { generateCatalogueSynthesisPdfBuffer } = require("../utils/exports");

const REMINDER_OFFSET_HOURS = Number(
  process.env.CATALOGUE_ORDER_REMINDER_OFFSET_HOURS || 8
);
const WORKER_INTERVAL_MS = Number(
  process.env.CATALOGUE_ORDER_REMINDER_INTERVAL_MS || 10 * 60 * 1000
);

let reminderTimer = null;

function formatFrDate(value) {
  if (!value) {
    return "Non définie";
  }
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch (err) {
    return "Non définie";
  }
}

function buildReminderEmail({ catalogue, appUrl }) {
  const expirationDate = formatFrDate(catalogue.expiration_date);
  const livraisonDate = formatFrDate(catalogue.date_livraison);

  const subject = `Prévoir la commande fournisseur : ${
    catalogue.originalname ||
    catalogue.description ||
    `Catalogue #${catalogue.id}`
  }`;

  const adminLink = `${appUrl}/admin/catalogues/${catalogue.id}/edit`;

  const html = `
    <p style="font-family: Arial, sans-serif;">Bonjour ${
      catalogue.referent_username || ""
    },</p>
    <p style="font-family: Arial, sans-serif;">
      Catalogue n° <strong>${catalogue.id}</strong><br />
      Date d'expiration : <strong>${expirationDate}</strong><br />
      Date de livraison : <strong>${livraisonDate}</strong>
    </p>
    <p style="font-family: Arial, sans-serif;">
      Le catalogue <strong>${
        catalogue.originalname || `#${catalogue.id}`
      }</strong> est expiré depuis plus de ${REMINDER_OFFSET_HOURS} heures.
    </p>
    <p style="font-family: Arial, sans-serif;">
      Merci de <strong>prévoir la commande</strong> auprès du fournisseur.
    </p>
    <p style="font-family: Arial, sans-serif;">
      Accès direct : <a href="${adminLink}">${adminLink}</a>
    </p>
  `;

  return { subject, html };
}

async function fetchDueCatalogues(limit = 100) {
  const sql = `
    SELECT
      c.id,
      c.originalname,
      c.description,
      c.expiration_date,
      c.date_livraison,
      c.organization_id,
      c.uploader_id,
      u.username AS referent_username,
      u.email AS referent_email
    FROM catalog_files c
    JOIN users u ON u.id = c.uploader_id
    WHERE c.referent_order_reminder_enabled = 1
      AND c.referent_order_reminder_sent_at IS NULL
      AND c.expiration_date IS NOT NULL
      AND c.is_archived IN (0, 1, 2)
      AND DATE_ADD(c.expiration_date, INTERVAL ? HOUR) <= NOW()
      AND u.email IS NOT NULL
      AND u.email <> ''
      AND u.is_validated = 1
    ORDER BY c.expiration_date ASC
    LIMIT ?
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, [REMINDER_OFFSET_HOURS, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function markCatalogueReminded(catalogueId) {
  const sql = `UPDATE catalog_files
    SET referent_order_reminder_sent_at = NOW()
    WHERE id = ? AND referent_order_reminder_sent_at IS NULL`;

  return new Promise((resolve, reject) => {
    db.query(sql, [catalogueId], (err, result) => {
      if (err) return reject(err);
      resolve(result?.affectedRows || 0);
    });
  });
}

async function processCatalogueOrderRemindersOnce() {
  const due = await fetchDueCatalogues();
  if (!due.length) {
    return;
  }

  const appUrl = process.env.APP_URL || "https://cde.coopaz.fr";

  for (const catalogue of due) {
    try {
      const { subject, html } = buildReminderEmail({ catalogue, appUrl });

      const { pdfBuffer } = await generateCatalogueSynthesisPdfBuffer(
        catalogue.id,
        "simple"
      );

      const attachments = [
        {
          filename: "synthese.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ];

      const queuedEmail = await enqueueEmail({
        to: catalogue.referent_email,
        subject,
        html,
        attachments,
        initiatedBy: "catalogue-order-reminder",
      });

      await markCatalogueReminded(catalogue.id);

      logger.info("Catalogue referent reminder queued", {
        catalogueId: catalogue.id,
        emailQueueId: queuedEmail?.id,
        referent: catalogue.referent_username,
        email: catalogue.referent_email,
      });
    } catch (error) {
      logger.error("Catalogue referent reminder failed", {
        catalogueId: catalogue.id,
        error: error?.message,
      });
    }
  }
}

function startCatalogueOrderReminderWorker() {
  if (reminderTimer) {
    return;
  }

  reminderTimer = setInterval(() => {
    processCatalogueOrderRemindersOnce().catch((err) => {
      logger.error("Catalogue referent reminder worker error", {
        error: err?.message,
      });
    });
  }, WORKER_INTERVAL_MS);

  if (reminderTimer && reminderTimer.unref) {
    reminderTimer.unref();
  }

  logger.info("Catalogue referent reminder worker started", {
    intervalMs: WORKER_INTERVAL_MS,
    offsetHours: REMINDER_OFFSET_HOURS,
  });
}

module.exports = {
  startCatalogueOrderReminderWorker,
  processCatalogueOrderRemindersOnce,
};
