const express = require("express");
const router = express.Router();
const { db } = require("../config/config");
const { requirePermission } = require("../middleware/rbac.middleware");
const { logger } = require("../config/logger");

// ============================================================================
// API: File d'attente email (JSON)
// ============================================================================
router.get("/", requirePermission('admin', { json: true }), (req, res) => {
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
      return res.status(500).json({
        success: false,
        error: "Erreur lors du chargement de la file d'attente email"
      });
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
          sent_count: parseInt(row.sent_count, 10) || 0,
          pending_count: parseInt(row.pending_count, 10) || 0,
          total_count: parseInt(row.total_count, 10) || 0,
          last_activity: rawLastActivity,
          last_activity_ts: lastActivityTs,
        };
      });

      res.json({
        success: true,
        entries,
        subjectSummary,
        limit
      });
    });
  });
});

module.exports = router;
