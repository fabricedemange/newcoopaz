const { db } = require("../config/config");

/**
 * Helper to render admin views with common data
 * @param {Object} res - Response object
 * @param {string} viewName - Name of the view
 * @param {Object} extraData - Additional data to merge
 * @param {string} error - Error message (optional)
 */
function renderAdminView(res, viewName, extraData = {}, error = null) {
  const commonData = {
    csrfToken: res.locals.csrfToken,
    user: res.locals.user || null,
    role: res.locals.role || null,
    userPermissions: res.locals.userPermissions || [],
    userRoles: res.locals.userRoles || [],
    isImpersonating: res.locals.isImpersonating || false,
    impersonationContext: res.locals.impersonationContext || null,
    bandeaux: res.locals.bandeaux || [],
    APP_VERSION: res.app.locals.APP_VERSION || Date.now(), // Cache busting
    error: error,
    ...extraData,
  };
  res.render(viewName, commonData);
}

module.exports = {
  renderAdminView,
};
