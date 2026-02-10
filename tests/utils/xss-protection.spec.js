/**
 * Phase 3 / Phase 4 - Tests unitaires pour la fonction escapeHtml (XSS).
 * Vérifie que les entrées malveillantes sont correctement échappées.
 * Logique alignée sur public/js/xss-protection.js.
 */
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
    "/": "&#x2F;",
  };
  return String(text).replace(/[&<>"'\/]/g, (s) => map[s]);
}

describe("escapeHtml (XSS protection)", () => {
  describe("payloads XSS classiques", () => {
    it("échappe <script>alert(1)</script>", () => {
      const input = "<script>alert('XSS')</script>";
      const out = escapeHtml(input);
      expect(out).not.toContain("<script>");
      expect(out).toContain("&lt;script&gt;");
      expect(out).not.toMatch(/<script|<\/script>/);
    });

    it("échappe img onerror", () => {
      const input = '<img src=x onerror=alert(1)>';
      const out = escapeHtml(input);
      expect(out).not.toContain("<img");
      expect(out).toContain("&lt;img");
      expect(out).toContain("&gt;");
    });

    it("échappe javascript: dans lien", () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const out = escapeHtml(input);
      expect(out).toContain("&quot;");
      expect(out).toContain("&lt;a");
    });

    it("échappe les guillemets simples et doubles", () => {
      expect(escapeHtml('"')).toBe("&quot;");
      expect(escapeHtml("'")).toBe("&#039;");
      expect(escapeHtml('say "hello"')).toContain("&quot;");
    });

    it("échappe & pour éviter entités HTML", () => {
      expect(escapeHtml("a&b")).toBe("a&amp;b");
      expect(escapeHtml("&lt;script&gt;")).toContain("&amp;");
    });

    it("échappe / pour éviter fermeture de balise", () => {
      expect(escapeHtml("</script>")).toContain("&#x2F;");
    });
  });

  describe("entrées vides ou non-string", () => {
    it("retourne une chaîne vide pour null/undefined", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
    });

    it("convertit les nombres en chaîne puis échappe (0 est falsy donc retourne \"\")", () => {
      expect(escapeHtml(42)).toBe("42");
      expect(escapeHtml(0)).toBe(""); // comportement client : if (!text) return ""
    });
  });

  describe("texte sans caractères spéciaux", () => {
    it("conserve le texte normal", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
      expect(escapeHtml("Note de commande")).toBe("Note de commande");
      expect(escapeHtml("bi bi-star")).toBe("bi bi-star");
    });
  });

  describe("régression : aucune exécution possible après échappement", () => {
    it("échappe plusieurs angles et guillemets", () => {
      const input = "<script>alert(String.fromCharCode(88,83,83))</script>";
      const out = escapeHtml(input);
      expect(out).not.toMatch(/<|>/);
      expect(out).toMatch(/&lt;|&gt;/);
    });

    it("payload avec événement onclick", () => {
      const input = '<div onclick="alert(1)">x</div>';
      const out = escapeHtml(input);
      expect(out).toContain("&lt;div");
      expect(out).toContain("&quot;");
      expect(out).toContain("&gt;");
    });
  });
});
