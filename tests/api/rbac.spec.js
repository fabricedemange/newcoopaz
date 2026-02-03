/**
 * Tests API RBAC (Phase 2) : routes protégées par requirePermission.
 * - Sans session + Accept JSON → 401
 * - Avec session mais sans la permission requise → 403 (session mockée, permissions mockées via DB)
 */
const request = require("supertest");

// Mock du wrapper DB pour que getUserPermissions retourne une liste vide (aucune permission)
jest.mock("../../config/db-trace-wrapper", () => ({
  db: {
    query: (sql, params, cb) => {
      if (typeof params === "function") {
        cb = params;
        params = [];
      }
      cb(null, []);
    },
  },
  queryWithUser: (sql, params, cb, req) => {
    if (typeof params === "function") {
      cb = params;
      params = [];
    }
    cb(null, []);
  },
}));

const app = require("../../app");

describe("RBAC API", () => {
  describe("GET /api/admin/users (requirePermission('users', { json: true }))", () => {
    it("sans session avec Accept JSON retourne 401", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Accept", "application/json");
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, error: "Non authentifié" });
    });

    it("avec session mockée mais sans permission users retourne 403", async () => {
      const agent = request.agent(app);
      await agent.post("/test/session").expect(204);
      const res = await agent
        .get("/api/admin/users")
        .set("Accept", "application/json");
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/Permission refusée/),
      });
    });
  });
});
