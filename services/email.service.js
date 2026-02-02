const nodemailer = require("nodemailer");
const { MailtrapTransport } = require("mailtrap");
const { debugLog } = require("../utils/logger-helpers");
const { logger } = require("../config/logger");
const { db } = require("../config/config");

const MAILTRAP_TOKEN =
  process.env.MAILTRAP_TOKEN || process.env.MAILTRAP_API_TOKEN || "";
const MAILTRAP_TEST_INBOX_ID = process.env.MAILTRAP_INBOX_ID || undefined;
const MAILTRAP_ENDPOINT = process.env.MAILTRAP_ENDPOINT || undefined;
const MAILTRAP_FROM = process.env.MAILTRAP_FROM || process.env.SMTP_FROM;
const MAILTRAP_FROM_NAME =
  process.env.MAILTRAP_FROM_NAME || process.env.MAILTRAP_SENDER_NAME;

if (!MAILTRAP_TOKEN) {
  throw new Error(
    "MAILTRAP_TOKEN est requis pour l'envoi d'emails via Mailtrap."
  );
}

const transporter = nodemailer.createTransport(
  MailtrapTransport({
    token: MAILTRAP_TOKEN,
    testInboxId: MAILTRAP_TEST_INBOX_ID,
    endpoint: MAILTRAP_ENDPOINT,
  })
);

debugLog("Mailtrap configuration", {
  sender: MAILTRAP_FROM,
  senderName: MAILTRAP_FROM_NAME,
  testInboxId: MAILTRAP_TEST_INBOX_ID,
  endpoint: MAILTRAP_ENDPOINT,
});

transporter.verify((err) => {
  if (err) {
    debugLog("Mailtrap verify failed", {
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
    });
  } else {
    debugLog("Mailtrap verify success", {});
  }
});

function normalizeRecipients(raw) {
  if (!raw) {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw.filter(Boolean);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.includes(",") || trimmed.includes(";")) {
      return trimmed
        .split(/[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return trimmed;
  }

  return raw;
}

function serializeAttachmentsMeta(attachments) {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }

  return attachments.map((attachment) => {
    const size = Buffer.isBuffer(attachment.content)
      ? attachment.content.length
      : undefined;

    return {
      filename: attachment.filename || null,
      contentType: attachment.contentType || attachment.type || null,
      cid: attachment.cid || null,
      size,
    };
  });
}

function logImmediateEmailSend(mailOptions, originalOptions, info) {
  return new Promise((resolve) => {
    const normalized = normalizeRecipients(mailOptions.to);
    const recipients = Array.isArray(normalized)
      ? normalized
      : normalized
      ? [normalized]
      : [];
    const now = new Date();

    const sql = `INSERT INTO email_queue
      (status, from_address, to_addresses, subject, text_body, html_body, attachments,
       attempt_count, last_error, scheduled_at, sent_at, created_at)
      VALUES ('sent', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`;

    const attachmentsMeta = serializeAttachmentsMeta(mailOptions.attachments);

    const params = [
      originalOptions.initiatedBy || mailOptions.from || null,
      JSON.stringify(recipients),
      mailOptions.subject || "",
      originalOptions.text || mailOptions.text || null,
      originalOptions.html || mailOptions.html || null,
      JSON.stringify(attachmentsMeta),
      1,
      now,
      now,
      now,
    ];

    db.query(sql, params, (err) => {
      if (err) {
        logger.error("Email history insert failed", {
          to: recipients,
          subject: mailOptions.subject,
          error: err.message,
        });
        return resolve();
      }

      logger.info("Email history recorded", {
        to: recipients,
        subject: mailOptions.subject,
        messageId: info?.messageId,
      });
      resolve();
    });
  });
}

function buildMailOptions(options) {
  const defaultSender = MAILTRAP_FROM_NAME
    ? `${MAILTRAP_FROM_NAME} <${MAILTRAP_FROM}>`
    : MAILTRAP_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  const mailOptions = {
    from: options.from || defaultSender,
    to: normalizeRecipients(options.to),
    subject: options.subject,
    attachments: options.attachments || [],
  };

  // N'ajouter text ou html que s'ils sont fournis
  if (options.html) {
    mailOptions.html = options.html;
  }
  if (options.text) {
    mailOptions.text = options.text;
  }

  return mailOptions;
}

/**
 * Envoie immédiatement un email (sans passer par la file d'attente)
 * @param {Object} options
 * @returns {Promise}
 */
async function sendEmailNow(options) {
  const mailOptions = buildMailOptions(options);

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logger.error("Email send failed", {
          to: mailOptions.to,
          subject: mailOptions.subject,
          error: error.message,
          code: error.code,
        });
        debugLog("Erreur lors de l'envoi de l'email:", error);
        reject(error);
      } else {
        logger.info("Email sent successfully", {
          to: mailOptions.to,
          subject: mailOptions.subject,
          messageId: info.messageId,
          response: info.response,
        });
        debugLog("Email envoyé avec succès:", info.response);

        if (!options.__skipHistory) {
          logImmediateEmailSend(mailOptions, options, info).catch((err) => {
            logger.error("Email history logging error", {
              to: mailOptions.to,
              subject: mailOptions.subject,
              error: err.message,
            });
          });
        }

        resolve(info);
      }
    });
  });
}

/**
 * Enfile un email pour envoi différé via la file d'attente
 * @param {Object} options - Options de l'email
 * @returns {Promise}
 */
async function sendEmail(options) {
  if (options && options.sendNow) {
    return sendEmailNow(options);
  }
  const { enqueueEmail } = require("./email-queue.service");
  return enqueueEmail(options);
}

/**
 * Envoie un email avec pièce jointe PDF
 * @param {string} to - Destinataire
 * @param {string} subject - Sujet
 * @param {string} html - Contenu HTML
 * @param {Buffer} pdfBuffer - Buffer du PDF
 * @param {string} pdfFilename - Nom du fichier PDF
 * @returns {Promise}
 */
async function sendEmailWithPdf(to, subject, html, pdfBuffer, pdfFilename) {
  return sendEmail({
    to,
    subject,
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
    initiatedBy: "system",
  });
}

/**
 * Envoie un email de réinitialisation de mot de passe
 * @param {string} to - Email du destinataire
 * @param {string} resetToken - Token de réinitialisation
 * @returns {Promise}
 */
async function sendPasswordResetEmail(to, resetToken) {
  const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

  const html = `
    <h2>Réinitialisation de mot de passe</h2>
    <p>Vous avez demandé une réinitialisation de mot de passe.</p>
    <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>Ce lien est valide pendant 1 heure.</p>
    <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  `;

  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe",
    html,
    initiatedBy: "system",
  });
}

/**
 * Envoie un email de validation de compte
 * @param {string} to - Email du destinataire
 * @param {string} username - Nom d'utilisateur
 * @returns {Promise}
 */
async function sendAccountValidationEmail(to, username) {
  const html = `
    <h2>Compte validé</h2>
    <p>Bonjour ${username},</p>
    <p>Votre compte a été validé par un administrateur.</p>
    <p>Vous pouvez maintenant vous connecter à l'application.</p>
    <p><a href="${process.env.APP_URL}/login">Se connecter</a></p>
  `;

  return sendEmail({
    to,
    subject: "Votre compte a été validé",
    html,
    initiatedBy: "system",
  });
}

module.exports = {
  sendEmail,
  sendEmailNow,
  sendEmailWithPdf,
  sendPasswordResetEmail,
  sendAccountValidationEmail,
  transporter,
};
