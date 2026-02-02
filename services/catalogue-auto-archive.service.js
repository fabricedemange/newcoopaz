const cron = require("node-cron");
const { db } = require("../config/config");
const { logger } = require("../config/logger");

const DEFAULT_TIMEZONE = "Europe/Paris";
const DEFAULT_CRON_EXPRESSION = "0 1 * * *"; // Tous les jours à 01:00

let scheduledTask = null;

async function processCatalogueAutoArchiveOnce() {
  const pool = db.promise();

  const [hideExpiredForUsersResult] = await pool.query(
    `UPDATE catalog_files
     SET is_archived = 2
     WHERE is_archived = 0
       AND expiration_date < (NOW() - INTERVAL 1 DAY)`
  );

  const [archiveDeliveredResult] = await pool.query(
    `UPDATE catalog_files
     SET is_archived = 3
     WHERE date_livraison < (NOW() - INTERVAL 5 DAY)`
  );

  const summary = {
    hideExpiredForUsers: hideExpiredForUsersResult?.affectedRows || 0,
    archiveDelivered: archiveDeliveredResult?.affectedRows || 0,
  };

  logger.info("Catalogue auto-archive executed", summary);
  return summary;
}

function startCatalogueAutoArchiveScheduler() {
  if (scheduledTask) {
    return;
  }

  if (process.env.DISABLE_SCHEDULED_TASKS === "1") {
    logger.info("Scheduled tasks disabled via DISABLE_SCHEDULED_TASKS=1", {
      task: "catalogue-auto-archive",
    });
    return;
  }

  const timezone = process.env.CRON_TIMEZONE || DEFAULT_TIMEZONE;
  const cronExpression =
    process.env.CATALOGUE_AUTO_ARCHIVE_CRON || DEFAULT_CRON_EXPRESSION;

  scheduledTask = cron.schedule(
    cronExpression,
    () => {
      processCatalogueAutoArchiveOnce().catch((error) => {
        logger.error("Catalogue auto-archive failed", {
          error: error?.message,
        });
      });
    },
    { timezone }
  );

  logger.info("Catalogue auto-archive scheduler started", {
    cronExpression,
    timezone,
  });
}

module.exports = {
  startCatalogueAutoArchiveScheduler,
  processCatalogueAutoArchiveOnce,
};
