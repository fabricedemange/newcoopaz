const { db } = require("../config/config");
const { debugLog } = require("../utils/logger-helpers");
const { logger } = require("../config/logger");
const { sendEmailNow } = require("./email.service");

const MAX_DAILY_EMAILS = Number(process.env.MAIL_DAILY_LIMIT || 2000);
const QUEUE_INTERVAL_MS = Number(process.env.MAIL_QUEUE_INTERVAL_MS || 30000);
const MAX_ATTEMPTS = Number(process.env.MAIL_QUEUE_MAX_ATTEMPTS || 3);
const RETRY_DELAY_MS = Number(process.env.MAIL_QUEUE_RETRY_DELAY_MS || 300000);
const BATCH_SIZE = Number(process.env.MAIL_QUEUE_BATCH_SIZE || 60);
const SENDING_TIMEOUT_MS = Number(
  process.env.MAIL_QUEUE_SENDING_TIMEOUT_MS || 10 * 60 * 1000
);

/*
Table SQL recommandée :

CREATE TABLE email_queue (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  status ENUM('pending','sending','sent','error') NOT NULL DEFAULT 'pending',
  from_address VARCHAR(255) NULL,
  to_addresses JSON NOT NULL,
  subject VARCHAR(255) NOT NULL,
  text_body MEDIUMTEXT NULL,
  html_body MEDIUMTEXT NULL,
  attachments JSON NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
*/

function normalizeRecipients(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.filter(Boolean);
  }
  return String(input)
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function jsonSafeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify({ error: "unserializable" });
  }
}

function jsonSafeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    return fallback;
  }
}

function serializeAttachmentsForQueue(attachments) {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }

  return attachments.filter(Boolean).map((attachment) => {
    if (!attachment) {
      return attachment;
    }

    const content = attachment.content;

    if (Buffer.isBuffer(content)) {
      return {
        ...attachment,
        content: content.toString("base64"),
        encoding: attachment.encoding || "base64",
      };
    }

    if (
      content &&
      typeof content === "object" &&
      content.type === "Buffer" &&
      Array.isArray(content.data)
    ) {
      return {
        ...attachment,
        content: Buffer.from(content.data).toString("base64"),
        encoding: attachment.encoding || "base64",
      };
    }

    return attachment;
  });
}

function hydrateAttachmentsFromQueue(attachments) {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }

  return attachments.filter(Boolean).map((attachment) => {
    if (!attachment) {
      return attachment;
    }

    const content = attachment.content;
    const encoding = attachment.encoding;

    if (encoding === "base64" && typeof content === "string") {
      return {
        ...attachment,
        content: Buffer.from(content, "base64"),
      };
    }

    if (
      content &&
      typeof content === "object" &&
      content.type === "Buffer" &&
      Array.isArray(content.data)
    ) {
      return {
        ...attachment,
        content: Buffer.from(content.data),
      };
    }

    return attachment;
  });
}

async function requeueStaleSendingEmails() {
  if (!SENDING_TIMEOUT_MS || SENDING_TIMEOUT_MS <= 0) {
    return;
  }

  const threshold = new Date(Date.now() - SENDING_TIMEOUT_MS);

  const staleEmails = await new Promise((resolve, reject) => {
    const sql = `SELECT id, attempt_count, updated_at
      FROM email_queue
      WHERE status = 'sending' AND updated_at < ?`;
    db.query(sql, [threshold], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows || []);
    });
  });

  if (!staleEmails.length) {
    return;
  }

  debugLog("File email", {
    action: "requeue_stuck_sending",
    count: staleEmails.length,
    threshold: threshold.toISOString(),
  });

  const jobs = staleEmails.map((email) => {
    const attempt = Math.max((email.attempt_count || 0) - 1, 0);
    return markEmailStatus(email.id, "pending", {
      attempt_count: attempt,
      scheduled_at: new Date(),
      last_error: "Relance automatique depuis le statut 'sending'.",
    }).catch((err) => {
      debugLog("File email requeue failed", {
        id: email.id,
        error: err?.message,
      });
    });
  });

  await Promise.all(jobs);
}

function enqueueEmail(options) {
  return new Promise((resolve, reject) => {
    const recipients = normalizeRecipients(options.to);
    if (recipients.length === 0) {
      return reject(
        new Error("Aucun destinataire fourni pour la file d'attente email.")
      );
    }

    const payload = {
      from_address: options.initiatedBy || options.from || null,
      to_addresses: jsonSafeStringify(recipients),
      subject: options.subject || "",
      text_body: options.text || null,
      html_body: options.html || null,
      attachments: jsonSafeStringify(
        serializeAttachmentsForQueue(options.attachments || [])
      ),
      status: "pending",
      attempt_count: 0,
      scheduled_at: options.scheduledAt || new Date(),
      created_at: new Date(),
    };

    const sql = `INSERT INTO email_queue
      (status, from_address, to_addresses, subject, text_body, html_body, attachments, attempt_count, last_error, scheduled_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      payload.status,
      payload.from_address,
      payload.to_addresses,
      payload.subject,
      payload.text_body,
      payload.html_body,
      payload.attachments,
      payload.attempt_count,
      null,
      payload.scheduled_at,
      payload.created_at,
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve({ id: result.insertId, ...payload });
    });
  });
}

function countSentToday() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT COUNT(*) AS total
      FROM email_queue
      WHERE status = 'sent' AND sent_at >= CURDATE()`;
    db.query(sql, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows[0]?.total || 0);
    });
  });
}

function fetchNextPendingEmail() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT *
      FROM email_queue
      WHERE status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC, id ASC
      LIMIT 1`;

    db.query(sql, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows && rows.length ? rows[0] : null);
    });
  });
}

function markEmailStatus(id, status, extra = {}) {
  const fields = [];
  const params = [];

  fields.push("status = ?");
  params.push(status);

  if (extra.attempt_count !== undefined) {
    fields.push("attempt_count = ?");
    params.push(extra.attempt_count);
  }

  if (extra.last_error !== undefined) {
    fields.push("last_error = ?");
    params.push(extra.last_error);
  }

  if (extra.sent_at !== undefined) {
    fields.push("sent_at = ?");
    params.push(extra.sent_at);
  }

  if (extra.scheduled_at !== undefined) {
    fields.push("scheduled_at = ?");
    params.push(extra.scheduled_at);
  }

  fields.push("updated_at = NOW()");

  const sql = `UPDATE email_queue SET ${fields.join(", ")} WHERE id = ?`;
  params.push(id);

  return new Promise((resolve, reject) => {
    db.query(sql, params, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function processEmailQueueOnce() {
  await requeueStaleSendingEmails().catch((err) => {
    debugLog("File email cleanup erreur", err);
  });

  let processed = 0;
  let sentToday = await countSentToday();

  if (sentToday >= MAX_DAILY_EMAILS) {
    debugLog(
      "File email",
      `Quota quotidien atteint (${sentToday}/${MAX_DAILY_EMAILS}).`
    );
    return;
  }

  const availableSlots = Math.max(0, MAX_DAILY_EMAILS - sentToday);
  const iterations = Math.min(BATCH_SIZE, availableSlots);

  while (processed < iterations) {
    const email = await fetchNextPendingEmail();
    if (!email) {
      break;
    }

    const updatedAttempt = email.attempt_count + 1;
    await markEmailStatus(email.id, "sending", {
      attempt_count: updatedAttempt,
    });

    const toAddresses = jsonSafeParse(email.to_addresses, []);
    const attachments = hydrateAttachmentsFromQueue(
      jsonSafeParse(email.attachments, [])
    );

    try {
      await sendEmailNow({
        to: toAddresses,
        subject: email.subject,
        text: email.text_body || undefined,
        html: email.html_body || undefined,
        attachments,
        initiatedBy: email.from_address || null,
        __skipHistory: true,
      });

      await markEmailStatus(email.id, "sent", {
        sent_at: new Date(),
        attempt_count: updatedAttempt,
      });
      logger.info("Email queue sent", {
        queueId: email.id,
        to: toAddresses,
        subject: email.subject,
        attempt: updatedAttempt,
      });
      processed += 1;
      sentToday += 1;

      if (sentToday >= MAX_DAILY_EMAILS) {
        debugLog(
          "File email",
          `Quota atteint pendant le traitement (${sentToday}/${MAX_DAILY_EMAILS}).`
        );
        break;
      }
    } catch (error) {
      logger.error("Email queue send failed", {
        queueId: email.id,
        to: toAddresses,
        subject: email.subject,
        attempt: updatedAttempt,
        error: error?.message,
        code: error?.code,
      });
      const shouldRetry = updatedAttempt < MAX_ATTEMPTS;
      const nextStatus = shouldRetry ? "pending" : "error";
      const update = {
        attempt_count: updatedAttempt,
        last_error: error?.message || "Erreur inconnue",
      };

      if (shouldRetry) {
        update.scheduled_at = new Date(Date.now() + RETRY_DELAY_MS);
      }

      await markEmailStatus(email.id, nextStatus, update);
      debugLog("File email envoi échoué", {
        id: email.id,
        attempts: updatedAttempt,
        status: nextStatus,
        retryInMs: shouldRetry ? RETRY_DELAY_MS : null,
        message: update.last_error,
      });

      if (!shouldRetry) {
        processed += 1; // on considère l'email comme traité définitivement
      }
    }
  }
}

let queueTimer = null;

function startEmailQueueWorker() {
  if (queueTimer) {
    return;
  }

  queueTimer = setInterval(() => {
    processEmailQueueOnce().catch((err) => {
      debugLog("File email worker erreur", err);
    });
  }, QUEUE_INTERVAL_MS);

  if (queueTimer && queueTimer.unref) {
    queueTimer.unref();
  }

  debugLog("File email", {
    started: true,
    interval: QUEUE_INTERVAL_MS,
    limit: MAX_DAILY_EMAILS,
  });
}

module.exports = {
  enqueueEmail,
  startEmailQueueWorker,
  processEmailQueueOnce,
};
