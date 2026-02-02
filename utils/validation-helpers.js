const { debugLog } = require("./logger-helpers");

/**
 * Middleware de validation d'entrée pour les données utilisateur
 */

// Validation d'email basique
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Validation de mot de passe
function isValidPassword(password) {
  return (
    password &&
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

// Validation de nom d'utilisateur
function isValidUsername(username) {
  return (
    username &&
    typeof username === "string" &&
    username.length >= 2 &&
    username.length <= 50 &&
    /^[a-zA-Z0-9\s\-_]+$/.test(username)
  );
}

// Validation d'ID numérique
function isValidId(id) {
  return !isNaN(id) && parseInt(id) > 0;
}

// Validation de chaîne de caractères générale
function isValidString(str, minLength = 1, maxLength = 1000) {
  return (
    str &&
    typeof str === "string" &&
    str.length >= minLength &&
    str.length <= maxLength &&
    str.trim() !== ""
  );
}

// Sanitisation basique (suppression des caractères dangereux)
function sanitizeString(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>\"'&]/g, "").trim();
}

// Middleware de validation pour les routes d'authentification
function validateLoginInput(req, res, next) {
  const { email, password } = req.body;

  const errors = [];

  if (!isValidEmail(email)) {
    errors.push("Adresse email invalide");
  }

  if (!password || typeof password !== "string" || password.length < 1) {
    errors.push("Mot de passe requis");
  }

  if (errors.length > 0) {
    debugLog("Validation failed for login", {
      errors,
      email: email ? "provided" : "missing",
    });
    return res.render("login", {
      error: errors.join(". "),
    });
  }

  // Sanitisation
  req.body.email = sanitizeString(email).toLowerCase();
  req.body.password = password; // Ne pas sanitiser le mot de passe

  next();
}

function validateRegistrationInput(req, res, next) {
  const { email, password, confirmPassword, username } = req.body;

  const errors = [];

  if (!isValidEmail(email)) {
    errors.push("Adresse email invalide");
  }

  if (!isValidPassword(password)) {
    errors.push("Le mot de passe doit contenir au moins 8 caractères");
  }

  if (password !== confirmPassword) {
    errors.push("Les mots de passe ne correspondent pas");
  }

  if (!isValidUsername(username)) {
    errors.push(
      "Nom d'utilisateur invalide (2-50 caractères, lettres, chiffres, espaces, tirets et underscores uniquement)"
    );
  }

  if (errors.length > 0) {
    debugLog("Validation failed for registration", { errors });
    return res.render("register", {
      error: errors.join(". "),
    });
  }

  // Sanitisation
  req.body.email = sanitizeString(email).toLowerCase();
  req.body.username = sanitizeString(username);
  req.body.password = password; // Ne pas sanitiser le mot de passe

  next();
}

function validatePasswordChangeInput(req, res, next) {
  const { current_password, new_password, confirm_password } = req.body;

  const errors = [];

  if (!current_password || typeof current_password !== "string") {
    errors.push("Mot de passe actuel requis");
  }

  if (!isValidPassword(new_password)) {
    errors.push("Le nouveau mot de passe doit contenir au moins 8 caractères");
  }

  if (new_password !== confirm_password) {
    errors.push("Les nouveaux mots de passe ne correspondent pas");
  }

  if (current_password === new_password) {
    errors.push("Le nouveau mot de passe doit être différent de l'actuel");
  }

  if (errors.length > 0) {
    debugLog("Validation failed for password change", { errors });
    return res.status(400).json({ error: errors.join(". ") });
  }

  next();
}

function validateUserUpdateInput(req, res, next) {
  const { email, username, role } = req.body;

  const errors = [];

  if (email && !isValidEmail(email)) {
    errors.push("Adresse email invalide");
  }

  if (username && !isValidUsername(username)) {
    errors.push("Nom d'utilisateur invalide");
  }

  const validRoles = ["admin", "referent", "epicier", "utilisateur"];
  if (role && !validRoles.includes(role)) {
    errors.push("Rôle invalide");
  }

  if (errors.length > 0) {
    debugLog("Validation failed for user update", { errors });
    return res.status(400).json({ error: errors.join(". ") });
  }

  // Sanitisation
  if (email) req.body.email = sanitizeString(email).toLowerCase();
  if (username) req.body.username = sanitizeString(username);

  next();
}

function validateBandeauInput(req, res, next) {
  const { message, type } = req.body;

  const errors = [];

  if (!isValidString(message, 1, 1000)) {
    errors.push(
      "Le message est obligatoire et ne doit pas dépasser 1000 caractères"
    );
  }

  const validTypes = ["info", "important"];
  if (!type || !validTypes.includes(type)) {
    errors.push("Type de bandeau invalide");
  }

  if (errors.length > 0) {
    debugLog("Validation failed for bandeau", { errors });
    return res.status(400).json({ error: errors.join(". ") });
  }

  // Sanitisation basique
  req.body.message = sanitizeString(message);

  next();
}

module.exports = {
  validateLoginInput,
  validateRegistrationInput,
  validatePasswordChangeInput,
  validateUserUpdateInput,
  validateBandeauInput,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isValidId,
  isValidString,
  sanitizeString,
};
