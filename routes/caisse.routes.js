const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/rbac.middleware");
const { renderAdminView } = require("../utils/view-helpers");

// GET /caisse - Page caisse
router.get("/", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_vue", {
    pageTitle: "Caisse"
  });
});

// GET /caisse/historique - Historique des ventes
router.get("/historique", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_historique_vue", {
    pageTitle: "Historique des ventes"
  });
});

module.exports = router;
