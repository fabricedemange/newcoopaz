/**
 * Lecture/écriture des paramètres applicatifs (table app_settings).
 * Utilisé par les workers email et la page admin email-queue.
 */

const { db } = require("../config/config");
const { logger } = require("../config/logger");

const CACHE_MS = 30000; // 30 s
const cache = {};
const cacheExpiry = {};

function getAppSetting(key, callback) {
  const now = Date.now();
  if (cache[key] !== undefined && cacheExpiry[key] > now) {
    return callback(null, cache[key]);
  }
  db.query(
    "SELECT value FROM app_settings WHERE `key` = ?",
    [key],
    (err, rows) => {
      if (err) {
        logger.error("app_settings get", { key, error: err?.message });
        return callback(err, undefined);
      }
      const value = rows && rows[0] ? rows[0].value : undefined;
      cache[key] = value;
      cacheExpiry[key] = now + CACHE_MS;
      callback(null, value);
    }
  );
}

function getAppSettingSync(key) {
  return cache[key];
}

/** Retourne true si la valeur est '1' ou 'true'. */
function isEnabled(value) {
  return value === "1" || value === "true";
}

/**
 * Vérifie si le worker d'envoi d'emails est activé (DB ou env en fallback).
 * @param {Function} callback (err, enabled)
 */
function isMailQueueSendEnabled(callback) {
  getAppSetting("mail_queue_send_enabled", (err, value) => {
    if (err) {
      const env = process.env.MAIL_QUEUE_SEND_ENABLED === "true" || process.env.MAIL_QUEUE_SEND_ENABLED === "1";
      return callback(null, env);
    }
    if (value === undefined || value === null) {
      const env = process.env.MAIL_QUEUE_SEND_ENABLED === "true" || process.env.MAIL_QUEUE_SEND_ENABLED === "1";
      return callback(null, env);
    }
    callback(null, isEnabled(value));
  });
}

/**
 * Vérifie si le cron de rappels catalogue est activé (DB ou env en fallback).
 * @param {Function} callback (err, enabled)
 */
function isCatalogueOrderReminderEnabled(callback) {
  getAppSetting("catalogue_order_reminder_enabled", (err, value) => {
    if (err) {
      const env = process.env.CATALOGUE_ORDER_REMINDER_ENABLED === "true" || process.env.CATALOGUE_ORDER_REMINDER_ENABLED === "1";
      return callback(null, env);
    }
    if (value === undefined || value === null) {
      const env = process.env.CATALOGUE_ORDER_REMINDER_ENABLED === "true" || process.env.CATALOGUE_ORDER_REMINDER_ENABLED === "1";
      return callback(null, env);
    }
    callback(null, isEnabled(value));
  });
}

function setAppSetting(key, value, callback) {
  const v = value === true || value === 1 || value === "1" || value === "true" ? "1" : "0";
  db.query(
    "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [key, v],
    (err) => {
      if (err) {
        logger.error("app_settings set", { key, error: err?.message });
        return callback(err);
      }
      cache[key] = v;
      cacheExpiry[key] = Date.now() + CACHE_MS;
      callback(null);
    }
  );
}

/** Stocke une valeur texte (ex. maintenance_message). */
function setAppSettingText(key, value, callback) {
  const v = value != null ? String(value).slice(0, 255) : "";
  db.query(
    "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [key, v],
    (err) => {
      if (err) {
        logger.error("app_settings setText", { key, error: err?.message });
        return callback(err);
      }
      cache[key] = v;
      cacheExpiry[key] = Date.now() + CACHE_MS;
      callback(null);
    }
  );
}

/** Récupère les réglages maintenance (enabled + message). */
function getMaintenanceSettings(callback) {
  getAppSetting("maintenance_enabled", (err1, v1) => {
    if (err1) return callback(err1, null);
    getAppSetting("maintenance_message", (err2, v2) => {
      if (err2) return callback(err2, null);
      callback(null, {
        enabled: isEnabled(v1),
        message: (v2 != null ? String(v2) : "").trim() || "Le site est actuellement en maintenance. Merci de réessayer plus tard.",
      });
    });
  });
}

/** Promisified getAppSetting pour usage async/await */
function getAppSettingAsync(key) {
  return new Promise((resolve, reject) => {
    getAppSetting(key, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

module.exports = {
  getAppSetting,
  getAppSettingSync,
  setAppSetting,
  setAppSettingText,
  getAppSettingAsync,
  isEnabled,
  isMailQueueSendEnabled,
  isCatalogueOrderReminderEnabled,
  getMaintenanceSettings,
};
