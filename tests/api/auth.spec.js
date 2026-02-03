/**
 * Tests API auth (Phase 1 + Phase 2) : routes publiques et protégées sans DB.
 * - Routes publiques : GET /login, GET /register → 200
 * - Route protégée (requireLogin) sans session : 302 (HTML) ou 401 (API JSON)
 */
const request = require("supertest");
const app = require("../../app");

describe("Auth API", () => {
  describe("routes publiques", () => {
    it("GET /login retourne 200", async () => {
      const res = await request(app).get("/login");
      expect(res.status).toBe(200);
    });

    it("GET /register retourne 200", async () => {
      const res = await request(app).get("/register");
      expect(res.status).toBe(200);
    });
  });

  describe("route protégée (requireLogin) sans session", () => {
    it("GET /account sans session redirige vers /login (302)", async () => {
      const res = await request(app).get("/account");
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/login/);
    });

    it("GET /api/catalogues sans session avec Accept JSON retourne 401", async () => {
      const res = await request(app)
        .get("/api/catalogues")
        .set("Accept", "application/json");
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, error: expect.any(String) });
    });
  });
});
