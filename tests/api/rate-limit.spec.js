/**
 * Tests du rate limiting sur les routes sensibles (inscription, réinitialisation mot de passe).
 * Vérifie qu'au-delà du nombre autorisé de tentatives, la réponse est 429.
 * Utilise le token CSRF récupéré via GET pour que les POST passent le middleware CSRF.
 */
const request = require("supertest");
const app = require("../../app");

/** Extrait le token CSRF du HTML (window.CSRF_TOKEN = '...') */
function extractCsrfFromHtml(html) {
  const m = html.match(/CSRF_TOKEN\s*=\s*['"]([^'"]*)['"]/);
  return m ? m[1] : null;
}

async function getCsrfToken(agent) {
  const res = await (agent || request(app)).get("/register");
  expect(res.status).toBe(200);
  const token = extractCsrfFromHtml(res.text);
  expect(token).toBeTruthy();
  return token;
}

function postRegister(agent, csrfToken) {
  return (agent || request(app))
    .post("/register")
    .set("Accept", "application/json")
    .send({
      _csrf: csrfToken,
      username: "test",
      email: "test@test.com",
      password: "test",
    });
}

function postForgotPassword(agent, csrfToken) {
  return (agent || request(app))
    .post("/forgot-password")
    .set("Accept", "application/json")
    .send({ _csrf: csrfToken, email: "test@test.com" });
}

function postResetPassword(agent, csrfToken) {
  return (agent || request(app))
    .post("/reset-password")
    .set("Accept", "application/json")
    .send({
      _csrf: csrfToken,
      token: "fake",
      password: "newpass",
      confirm: "newpass",
    });
}

describe("Rate limiting - routes sensibles", () => {
  describe("POST /register (max 5 / 15 min)", () => {
    it("après 6 requêtes, retourne 429 avec message d'erreur", async () => {
      const agent = request.agent(app);
      const csrf = await getCsrfToken(agent);
      let res;
      for (let i = 0; i < 6; i++) {
        res = await postRegister(agent, csrf);
      }
      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({ success: false, error: expect.any(String) });
      expect(res.body.error).toMatch(/tentatives d'inscription|réessayer/);
    });
  });

  describe("POST /forgot-password (max 3 / 15 min)", () => {
    it("après 4 requêtes, retourne 429", async () => {
      const agent = request.agent(app);
      const csrf = await getCsrfToken(agent);
      let res;
      for (let i = 0; i < 4; i++) {
        res = await postForgotPassword(agent, csrf);
      }
      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/réinitialisation|réessayer/);
    });
  });

  describe("POST /reset-password (max 5 / 15 min)", () => {
    it("après 6 requêtes, retourne 429", async () => {
      const agent = request.agent(app);
      const csrf = await getCsrfToken(agent);
      let res;
      for (let i = 0; i < 6; i++) {
        res = await postResetPassword(agent, csrf);
      }
      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/réinitialisation|réessayer/);
    });
  });
});
