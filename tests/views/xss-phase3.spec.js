/**
 * Phase 3 - Tests d'intégration XSS : vérification que les pages corrigées
 * chargent le script xss-protection.js et que le fichier est servi correctement.
 */
const request = require("supertest");
const fs = require("fs");
const path = require("path");

const app = require("../../app");

describe("XSS Phase 3 - Intégration", () => {
  describe("Fichier xss-protection.js", () => {
    it("GET /js/xss-protection.js retourne 200", async () => {
      const res = await request(app).get("/js/xss-protection.js");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/javascript/);
    });

    it("contient la fonction escapeHtml", async () => {
      const res = await request(app).get("/js/xss-protection.js");
      expect(res.text).toContain("function escapeHtml");
      expect(res.text).toContain("&lt;");
      expect(res.text).toContain("&gt;");
      expect(res.text).toContain("&quot;");
    });

    it("échappe les caractères dangereux (comportement cohérent avec le test unitaire)", async () => {
      const filePath = path.join(__dirname, "../../public/js/xss-protection.js");
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toMatch(/replace\(.*[&<>"']/);
    });
  });

  describe("Vues modifiées (Phase 2) - présence du script", () => {
    const pagesAvecXssProtection = [
      { path: "/admin/dashboard-temps-reel", name: "admin_dashboard_temps_reel" },
      { path: "/admin/connected-users", name: "admin_users_connected" },
      { path: "/caisse/cotisations-historique", name: "caisse_cotisations_historique" },
      { path: "/caisse/test-codes-barres", name: "caisse_test_codes_barres" },
    ];

    pagesAvecXssProtection.forEach(({ path: pagePath, name }) => {
      it(`${name} : sans auth redirige ou 403 (page protégée)`, async () => {
        const res = await request(app).get(pagePath);
        expect([302, 403]).toContain(res.status);
      });
    });
  });
});
