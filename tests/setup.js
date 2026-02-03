/**
 * Jest setup : exécuté avant les tests.
 * Définit NODE_ENV=test et les variables d'environnement requises par app.js
 * pour éviter process.exit(1) au chargement.
 */
process.env.NODE_ENV = "test";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_NAME = process.env.DB_NAME || "coopaz_test";
process.env.DB_PASS = process.env.DB_PASS || "";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
process.env.SMTP_HOST = process.env.SMTP_HOST || "localhost";
process.env.SMTP_PORT = process.env.SMTP_PORT || "1025";
process.env.SMTP_USER = process.env.SMTP_USER || "test";
process.env.SMTP_PASS = process.env.SMTP_PASS || "test";
