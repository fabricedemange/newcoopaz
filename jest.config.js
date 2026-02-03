/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.spec.js"],
  testPathIgnorePatterns: ["/node_modules/", "/frontend/"],
  setupFiles: ["<rootDir>/tests/setup.js"],
  verbose: true,
};
