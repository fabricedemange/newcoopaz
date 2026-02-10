const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/rbac.middleware");
const { renderAdminView } = require("../utils/view-helpers");

// GET /caisse/accueil - Page d'accueil Gestion de la Caisse (liens Caisse, Historique + chiffres du jour)
router.get("/accueil", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_accueil", {
    title: "Gestion de la Caisse",
    pageTitle: "Gestion de la Caisse"
  });
});

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

// GET /caisse/cotisations-historique - Historique des paiements de cotisations (tout le monde)
router.get("/cotisations-historique", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_cotisations_historique_vue", {
    title: "Historique des cotisations",
    pageTitle: "Historique des cotisations"
  });
});

// GET /caisse/test-codes-barres - Page de test lecteur de codes-barres
router.get("/test-codes-barres", requirePermission("caisse.sell"), (req, res) => {
  renderAdminView(res, "caisse_test_codes_barres", {
    pageTitle: "Test lecteur de codes-barres"
  });
});

// GET /caisse/stock - Page d'accueil Stock (Inventaire, Réceptions, Mouvements)
router.get("/stock", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_stock_accueil", {
    pageTitle: "Stock"
  });
});

// GET /caisse/inventaire - Inventaire (scan caméra + recherche produit) — droit Administration Inventaire et stock
router.get("/inventaire", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_inventaire_vue", {
    pageTitle: "Inventaire",
    pwaManifest: "/manifest.json"
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

// GET /caisse/receptions - Réceptions de commandes (BL, fournisseur, lignes, validation stock)
router.get("/receptions", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_receptions_vue", {
    pageTitle: "Réceptions de commandes"
  });
});

// GET /caisse/stock-produits-jamais-vendus - Produits jamais vendus (à enrichir avec volume)
router.get("/stock-produits-jamais-vendus", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_stock_produits_jamais_vendus", {
    pageTitle: "Produits jamais vendus"
  });
});

// GET /caisse/stock-produits-limite - Vendus régulièrement en limite de stock (à enrichir avec volume)
router.get("/stock-produits-limite", requirePermission("inventory_stock"), (req, res) => {
  renderAdminView(res, "caisse_stock_produits_limite", {
    pageTitle: "Vendus régulièrement en limite de stock"
  });
});

module.exports = router;
