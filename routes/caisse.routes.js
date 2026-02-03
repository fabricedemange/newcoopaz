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

// GET /caisse/test-codes-barres - Page de test lecteur de codes-barres
router.get("/test-codes-barres", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_test_codes_barres", {
    pageTitle: "Test lecteur de codes-barres"
  });
});

// GET /caisse/inventaire - Inventaire (scan caméra, smartphone)
router.get("/inventaire", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_inventaire_vue", {
    pageTitle: "Inventaire"
  });
});

module.exports = router;
