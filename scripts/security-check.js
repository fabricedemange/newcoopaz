#!/usr/bin/env node

/**
 * Script de vérification de sécurité
 * Vérifie que les fichiers sensibles ne sont pas présents dans le workspace
 */

const fs = require("fs");
const path = require("path");

const sensitiveFiles = [
  ".env",
  "credentials.json",
  "*.key",
  "*.pem",
  "*.p12",
  "*.pfx",
  "config/secrets.js",
];

const warnings = [];
const errors = [];

console.log("🔒 Vérification de sécurité Coopaz...\n");

// Vérifier les fichiers sensibles
sensitiveFiles.forEach((pattern) => {
  try {
    // Pour les patterns simples
    if (!pattern.includes("*")) {
      if (fs.existsSync(pattern)) {
        errors.push(`❌ Fichier sensible trouvé: ${pattern}`);
      }
    } else {
      // Pour les patterns avec wildcards, on vérifie manuellement
      const dir = path.dirname(pattern) || ".";
      const files = fs.readdirSync(dir).filter((file) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(file);
      });
      files.forEach((file) => {
        errors.push(`❌ Fichier sensible trouvé: ${file}`);
      });
    }
  } catch (err) {
    // Ignore les erreurs de lecture
  }
});

// Vérifier les permissions des fichiers de config
const configFiles = ["config/config.js", "app.js"];
configFiles.forEach((file) => {
  try {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      // Vérifier que les fichiers ne sont pas exécutables par tous
      if (stats.mode & 0o002) {
        warnings.push(`⚠️  ${file} a des permissions trop permissives`);
      }
    }
  } catch (err) {
    // Ignore
  }
});

// Vérifier que .env.example existe
if (!fs.existsSync(".env.example")) {
  warnings.push("⚠️  Fichier .env.example manquant");
}

// Vérifier le contenu de package.json pour les scripts suspects
try {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (packageJson.scripts) {
    Object.keys(packageJson.scripts).forEach((scriptName) => {
      const script = packageJson.scripts[scriptName];
      if (
        script.includes("rm -rf") ||
        script.includes("sudo") ||
        script.includes("chmod 777")
      ) {
        warnings.push(
          `⚠️  Script potentiellement dangereux dans package.json: ${scriptName}`
        );
      }
    });
  }
} catch (err) {
  // Ignore
}

// Résultats
if (errors.length > 0) {
  console.log("🚨 ERREURS CRITIQUES:");
  errors.forEach((error) => console.log(error));
  console.log("");
}

if (warnings.length > 0) {
  console.log("⚠️  AVERTISSEMENTS:");
  warnings.forEach((warning) => console.log(warning));
  console.log("");
}

if (errors.length === 0 && warnings.length === 0) {
  console.log("✅ Aucune anomalie détectée");
} else {
  console.log("🔧 Actions recommandées:");
  console.log("   - Supprimez les fichiers sensibles listés");
  console.log("   - Corrigez les permissions des fichiers");
  console.log("   - Utilisez .env.example comme modèle pour .env");
  console.log("   - Assurez-vous que .gitignore exclut les fichiers sensibles");
}

console.log("\n🔒 Vérification terminée");
