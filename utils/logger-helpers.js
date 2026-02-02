const { logger } = require("../config/logger");

/**
 * Centralized debug logging helper
 * @param {string} context - Context description
 * @param {Object} data - Data to log
 */
function debugLog(context, data) {
  if (process.env.NODE_ENV !== "production") {
    logger.debug(`${context}:`, data);
  }
}

module.exports = {
  debugLog,
};
