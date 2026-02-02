const { debugLog } = require("./logger-helpers");

/**
 * Centralized error handling helpers for database operations and responses
 */

/**
 * Standard database error handler
 * @param {Object} err - Error object
 * @param {Object} res - Response object
 * @param {string} message - Custom error message
 * @param {number} statusCode - HTTP status code (default: 500)
 */
function handleDatabaseError(
  err,
  res,
  message = "Erreur base de données",
  statusCode = 500
) {
  debugLog(`${message}:`, err);
  return res.status(statusCode).send(message);
}

/**
 * Handle database query errors with custom response
 * @param {Object} err - Error object
 * @param {Object} res - Response object
 * @param {string} context - Context for the error (e.g., "catalog_files", "users")
 */
function handleQueryError(err, res, context = "base de données") {
  return handleDatabaseError(err, res, `Erreur ${context}`);
}

/**
 * Handle export-related errors
 * @param {Object} err - Error object
 * @param {Object} res - Response object
 * @param {string} exportType - Type of export (e.g., "PDF", "Excel")
 */
function handleExportError(err, res, exportType = "export") {
  return handleDatabaseError(err, res, `Erreur lors de l'export ${exportType}`);
}

module.exports = {
  handleDatabaseError,
  handleQueryError,
  handleExportError,
};
