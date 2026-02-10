#!/usr/bin/env node

/**
 * Script de génération de secrets cryptographiques sécurisés
 * 
 * Usage:
 *   node scripts/generate-secret.js [longueur]
 * 
 * Exemples:
 *   node scripts/generate-secret.js          # Génère un secret de 64 caractères (par défaut)
 *   node scripts/generate-secret.js 128      # Génère un secret de 128 caractères
 */

const crypto = require('crypto');

// Récupérer la longueur depuis les arguments (défaut: 64)
const length = process.argv[2] ? parseInt(process.argv[2], 10) : 64;

if (isNaN(length) || length < 32) {
  console.error('❌ Erreur: La longueur doit être un nombre >= 32');
  console.log('\nUsage: node scripts/generate-secret.js [longueur]');
  console.log('Exemple: node scripts/generate-secret.js 64');
  process.exit(1);
}

// Générer un secret cryptographiquement robuste
// Utilise crypto.randomBytes qui est sûr pour la cryptographie
const secret = crypto.randomBytes(length).toString('base64');

console.log('\n✅ Secret cryptographique généré avec succès!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(secret);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📏 Longueur: ${secret.length} caractères`);
console.log(`🔐 Entropie: ${length * 8} bits\n`);

console.log('💡 Pour l\'utiliser dans votre fichier .env:');
console.log(`   SESSION_SECRET=${secret}\n`);

console.log('⚠️  IMPORTANT:');
console.log('   - Ne partagez JAMAIS ce secret');
console.log('   - Utilisez un secret différent pour chaque environnement (dev, staging, production)');
console.log('   - Assurez-vous que le fichier .env n\'est pas versionné (.gitignore)\n');
