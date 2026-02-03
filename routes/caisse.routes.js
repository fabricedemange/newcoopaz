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

// GET /caisse/inventaire - Inventaire (scan caméra + recherche produit) — droit Administration Inventaire et stock
router.get("/inventaire", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_inventaire_vue", {
    pageTitle: "Inventaire"
  });
});

// GET /caisse/stock-mouvements - Historique des mouvements de stock
router.get("/stock-mouvements", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_stock_mouvements_vue", {
    pageTitle: "Mouvements de stock"
  });
});

// GET /caisse/inventaires-historique - Historique des sessions d'inventaire
router.get("/inventaires-historique", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_inventaires_historique_vue", {
    pageTitle: "Historique des inventaires"
  });
});

module.exports = router;
