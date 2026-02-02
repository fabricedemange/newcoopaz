# AUDIT DE SÉCURITÉ COMPLET - COOPAZ v13
## Date : 8 octobre 2025

---

## 📋 RÉSUMÉ EXÉCUTIF

### Niveau de sécurité global : ⭐⭐⭐⭐ (Bon)

L'application CoopAz v13 présente un niveau de sécurité **globalement satisfaisant** avec plusieurs mécanismes de protection déjà en place. Cependant, certaines améliorations sont recommandées pour atteindre un niveau de sécurité optimal.

**Points forts :**
- ✅ Protection CSRF implémentée et active
- ✅ Headers de sécurité (Helmet) correctement configurés
- ✅ Hashage des mots de passe avec bcrypt
- ✅ Gestion des sessions sécurisée
- ✅ Contrôle d'accès par rôles

**Points d'amélioration identifiés :**
- ⚠️ Cookies de session non sécurisés pour HTTPS
- ⚠️ Absence de rate limiting sur les routes sensibles
- ⚠️ Utilisation de innerHTML dans certaines vues (risque XSS)
- ⚠️ Logs verbeux en production
- ⚠️ Absence de validation stricte des entrées utilisateur

---

## 🔒 ANALYSE DÉTAILLÉE PAR DOMAINE

### 1. AUTHENTIFICATION ET GESTION DES MOTS DE PASSE

#### ✅ **Points conformes**

**Hashage des mots de passe :**
```javascript
// Utilisation de bcrypt avec salt rounds = 10
const hashedPassword = await bcrypt.hash(password, 10);
```
- ✅ Utilisation de bcrypt (algorithme robuste)
- ✅ Salt automatique généré
- ✅ Comparaison sécurisée avec bcrypt.compare()

**Validation de compte :**
```javascript
if (!user.is_validated) {
  return res.render("login", {
    error: "Votre compte n'a pas encore été validé par un administrateur."
  });
}
```
- ✅ Double validation : email + approbation admin
- ✅ Prévient les inscriptions malveillantes

#### ⚠️ **Points à améliorer**

**1.1 Absence de politique de mot de passe strict**
```javascript
// ACTUEL : Aucune validation de la complexité
// RECOMMANDÉ : Ajouter des règles de complexité

function validatePassword(password) {
  const minLength = 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, error: "Le mot de passe doit contenir au moins 12 caractères" };
  }
  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, error: "Le mot de passe doit contenir des majuscules et minuscules" };
  }
  if (!hasNumbers) {
    return { valid: false, error: "Le mot de passe doit contenir au moins un chiffre" };
  }
  if (!hasSpecialChar) {
    return { valid: false, error: "Le mot de passe doit contenir au moins un caractère spécial" };
  }
  
  return { valid: true };
}
```

**PRIORITÉ : MOYENNE**  
**IMPACT SÉCURITÉ : MOYEN**

**1.2 Absence de rate limiting sur /login**

Risque : Attaques par force brute sur les comptes utilisateurs.

```javascript
// RECOMMANDÉ : Ajouter express-rate-limit
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives maximum
  message: "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/login", loginLimiter, (req, res) => {
  // ... code existant
});
```

**PRIORITÉ : HAUTE**  
**IMPACT SÉCURITÉ : ÉLEVÉ**

**1.3 Messages d'erreur trop informatifs**

```javascript
// ACTUEL : Révèle si un utilisateur existe
if (results.length === 0)
  return res.render("login", {
    error: "Utilisateur ou mot de passe incorrect."
  });

// RECOMMANDÉ : Message générique identique
return res.render("login", {
  error: "Identifiants incorrects. Veuillez réessayer."
});
```

**PRIORITÉ : BASSE**  
**IMPACT SÉCURITÉ : FAIBLE**

---

### 2. PROTECTION CSRF (Cross-Site Request Forgery)

#### ✅ **Points conformes**

**Implémentation CSRF globale :**
```javascript
const csrf = require("csurf");
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Injection automatique du token dans les vues
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

**Gestion des erreurs CSRF :**
```javascript
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    console.error("Erreur CSRF détectée :", err);
    return res.status(403).render("404", {
      message: "Token de sécurité invalide. Veuillez réessayer.",
    });
  }
  next(err);
});
```

**Tokens CSRF présents dans tous les formulaires critiques :**
- ✅ Login / Register
- ✅ Gestion des utilisateurs (admin)
- ✅ Gestion des catalogues
- ✅ Gestion des paniers et commandes
- ✅ Modification de compte
- ✅ Réinitialisation de mot de passe
- ✅ Notes (commandes, articles, paniers)
- ✅ Bandeaux admin

**STATUT : CONFORME** ✅  
**Aucune amélioration nécessaire**

---

### 3. HEADERS DE SÉCURITÉ HTTP (Helmet)

#### ✅ **Points conformes**

**Configuration Helmet complète :**
```javascript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", ...],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", ...],
        imgSrc: ["'self'", "data:", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 an
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
  })
);
```

**Protection implémentée :**
- ✅ **CSP (Content Security Policy)** : Limite les sources de contenu
- ✅ **HSTS** : Force HTTPS (31536000 secondes = 1 an)
- ✅ **X-Frame-Options: DENY** : Prévient le clickjacking
- ✅ **X-Content-Type-Options: nosniff** : Empêche le MIME sniffing
- ✅ **X-XSS-Protection** : Active le filtre XSS du navigateur

#### ⚠️ **Points à améliorer**

**3.1 CSP avec 'unsafe-inline'**

L'utilisation de `'unsafe-inline'` affaiblit la protection CSP.

**RECOMMANDATION :**
```javascript
// Supprimer 'unsafe-inline' et utiliser des nonces ou des hashes
// Option 1 : Nonces (recommandé)
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Dans les vues EJS :
// <script nonce="<%= nonce %>">...</script>

// Option 2 : Externaliser tous les scripts/styles inline
```

**PRIORITÉ : MOYENNE**  
**IMPACT SÉCURITÉ : MOYEN**

---

### 4. GESTION DES SESSIONS

#### ✅ **Points conformes**

**Configuration des sessions :**
```javascript
app.use(
  session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET,
    store: sessionStore, // MySQL store
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1700000 }, // ~28 minutes
    rolling: true, // Renouvelle le cookie à chaque requête
  })
);
```

- ✅ Secret stocké dans variable d'environnement
- ✅ Store persistant (MySQL)
- ✅ `resave: false` et `saveUninitialized: false` (bonnes pratiques)
- ✅ Rolling session (renouvellement automatique)
- ✅ Timeout approprié (~28 minutes)

#### ⚠️ **Points à améliorer**

**4.1 Cookies non sécurisés pour HTTPS**

```javascript
// ACTUEL
cookie: { maxAge: 1700000 }

// RECOMMANDÉ
cookie: { 
  maxAge: 1700000,
  httpOnly: true,      // Empêche l'accès JavaScript aux cookies
  secure: process.env.NODE_ENV === 'production', // HTTPS uniquement en prod
  sameSite: 'strict'   // Protection CSRF supplémentaire
}
```

**PRIORITÉ : HAUTE**  
**IMPACT SÉCURITÉ : ÉLEVÉ**

**4.2 Secret de session faible dans .env**

```
SESSION_SECRET=unSuperSecretTresLongEtImprevisible
```

**RECOMMANDÉ :**
- Générer un secret cryptographiquement robuste (64+ caractères)
- Utiliser : `openssl rand -base64 64`

**PRIORITÉ : HAUTE**  
**IMPACT SÉCURITÉ : ÉLEVÉ**

---

### 5. INJECTION SQL

#### ✅ **Points conformes**

**Utilisation systématique de requêtes paramétrées :**
```javascript
// ✅ Bonne pratique - Paramètres liés
db.query(
  "SELECT * FROM users WHERE LOWER(email) = ?",
  [emailLower],
  (err, results) => { ... }
);

db.query(
  "UPDATE paniers SET note = ? WHERE id = ? AND user_id = ?",
  [note, panierId, req.session.userId],
  (err) => { ... }
);
```

**ANALYSE :** Aucune concaténation de chaînes détectée dans les requêtes SQL.

**STATUT : CONFORME** ✅  
**Excellente protection contre l'injection SQL**

---

### 6. VULNÉRABILITÉS XSS (Cross-Site Scripting)

#### ✅ **Points conformes**

**Échappement automatique dans EJS :**
```html
<!-- ✅ Échappement automatique avec <%= %> -->
<p><strong>Catalogue :</strong> <%= commande.originalname %></p>
<p><%= user.username %></p>
```

#### ⚠️ **Points à améliorer**

**6.1 Utilisation de innerHTML dans JavaScript**

**Fichiers concernés :**
- `paniers_grouped.ejs` (lignes 382, 390, 398, 409)
- `stats.ejs` (lignes 336, 338, 355, 371, 373, 409, 425, 427, 451)
- `catalogue_articles.ejs` (lignes 427, 437, 447, 459)

**Exemple problématique :**
```javascript
// ACTUEL - RISQUE XSS
noteDisplay.innerHTML = '<strong><i class="bi bi-sticky"></i> Note de commande :</strong> ' + note;
```

**RECOMMANDÉ :**
```javascript
// Option 1 : Utiliser textContent pour le contenu dynamique
noteDisplay.innerHTML = '<strong><i class="bi bi-sticky"></i> Note de commande :</strong> <span></span>';
noteDisplay.querySelector('span').textContent = note;

// Option 2 : Échapper manuellement
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

noteDisplay.innerHTML = '<strong><i class="bi bi-sticky"></i> Note de commande :</strong> ' + escapeHtml(note);
```

**PRIORITÉ : HAUTE**  
**IMPACT SÉCURITÉ : ÉLEVÉ**

---

### 7. CONTRÔLE D'ACCÈS ET AUTORISATION

#### ✅ **Points conformes**

**Middleware de contrôle d'accès :**
```javascript
function requireLogin(req, res, next) {
  if (!req.session.userId || !req.session) return res.redirect("/login");
  next();
}

function requireRole(roles) {
  return function (req, res, next) {
    db.query(
      "SELECT role FROM users WHERE id = ?",
      [req.session.userId],
      (err, results) => {
        let userRole = null;
        if (err) {
          console.error("[DB Error]", err.message);
        } else if (results.length > 0) {
          userRole = results[0].role;
        }
        // ... vérification du rôle
      }
    );
  };
}
```

**Protection des routes sensibles :**
- ✅ Routes admin protégées par `requireRole(['admin'])`
- ✅ Routes utilisateur protégées par `requireLogin`
- ✅ Vérification de propriété des ressources (paniers, commandes)

**Exemple de vérification de propriété :**
```javascript
db.query(
  `SELECT * FROM paniers WHERE id = ? AND user_id = ?`,
  [commandeId, req.session.userId],
  (err, results) => {
    if (err || !results || results.length === 0)
      return res.status(403).send("Commande inaccessible");
    // ...
  }
);
```

**STATUT : CONFORME** ✅  
**Excellente gestion des autorisations**

---

### 8. GESTION DES FICHIERS UPLOADÉS

#### ✅ **Points conformes**

**Configuration Multer :**
```javascript
const upload = multer({ dest: "uploads/" });
```

#### ⚠️ **Points à améliorer**

**8.1 Absence de validation des types de fichiers**

```javascript
// RECOMMANDÉ
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accepter uniquement les fichiers Excel
  const allowedMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls les fichiers Excel sont acceptés.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB max
  }
});
```

**PRIORITÉ : HAUTE**  
**IMPACT SÉCURITÉ : ÉLEVÉ**

---

### 9. GESTION DES ERREURS ET LOGS

#### ✅ **Points conformes**

**Middleware de gestion d'erreurs :**
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Une erreur serveur est survenue.");
});
```

#### ⚠️ **Points à améliorer**

**9.1 Logs trop verbeux**

```javascript
// ACTUEL - Affiche des informations sensibles en production
console.log('Vue appelée :', view);
console.log('CSRF Token:', csrfToken);
console.error("Erreur CSRF détectée :", err);
```

**RECOMMANDÉ :**
```javascript
// Utiliser un système de logs professionnel
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// En production, ne logger que les erreurs critiques sans détails sensibles
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Remplacer console.log par logger.info, logger.error, etc.
```

**PRIORITÉ : MOYENNE**  
**IMPACT SÉCURITÉ : MOYEN**

**9.2 Stack traces exposées en production**

```javascript
// ACTUEL
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Une erreur serveur est survenue.");
});

// RECOMMANDÉ
app.use((err, req, res, next) => {
  // Logger l'erreur complète côté serveur
  logger.error('Erreur serveur:', { error: err.message, stack: err.stack });
  
  // En production, ne pas exposer les détails
  if (process.env.NODE_ENV === 'production') {
    res.status(500).render('error', { 
      message: "Une erreur est survenue. Veuillez réessayer plus tard." 
    });
  } else {
    // En développement, afficher les détails
    res.status(500).render('error', { 
      message: err.message, 
      stack: err.stack 
    });
  }
});
```

**PRIORITÉ : MOYENNE**  
**IMPACT SÉCURITÉ : MOYEN**

---

### 10. CONFIGURATION ET SECRETS

#### ✅ **Points conformes**

**Utilisation de variables d'environnement :**
```javascript
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
```

**Fichier .env présent et non versionné (devrait être dans .gitignore)**

#### ⚠️ **Points à améliorer**

**10.1 Mot de passe de base de données vide**

```
DB_PASS=
```

**RECOMMANDATION :**
- Définir un mot de passe robuste pour MySQL
- Ne jamais laisser un accès root sans mot de passe

**PRIORITÉ : CRITIQUE**  
**IMPACT SÉCURITÉ : CRITIQUE**

**10.2 Vérifier que .env est dans .gitignore**

```bash
# .gitignore doit contenir :
.env
uploads/
node_modules/
*.log
```

**PRIORITÉ : CRITIQUE**  
**IMPACT SÉCURITÉ : CRITIQUE**

---

### 11. DÉPENDANCES ET PACKAGES

#### ✅ **Points conformes**

**Packages de sécurité installés :**
```json
{
  "bcrypt": "^5.1.0",
  "csurf": "^1.11.0",
  "helmet": "^4.6.0",
  "express-session": "^1.17.3"
}
```

#### ⚠️ **Points à améliorer**

**11.1 Vérifier les vulnérabilités connues**

```bash
# Exécuter régulièrement :
npm audit
npm audit fix
```

**11.2 Packages manquants recommandés**

```bash
# Rate limiting
npm install express-rate-limit

# Validation des données
npm install joi

# Logging professionnel
npm install winston

# Sanitization
npm install express-validator
```

**PRIORITÉ : MOYENNE**  
**IMPACT SÉCURITÉ : MOYEN**

---

## 🎯 PLAN D'ACTION PRIORISÉ

### 🔴 **PRIORITÉ CRITIQUE (à corriger immédiatement)**

1. **Mot de passe base de données vide**
   - Définir un mot de passe robuste pour MySQL
   - Temps estimé : 15 minutes

2. **Vérifier .gitignore**
   - S'assurer que .env n'est pas versionné
   - Temps estimé : 5 minutes

### 🟠 **PRIORITÉ HAUTE (à corriger sous 1 semaine)**

3. **Cookies de session non sécurisés**
   - Ajouter httpOnly, secure, sameSite
   - Temps estimé : 30 minutes

4. **Secret de session faible**
   - Générer un secret cryptographique robuste
   - Temps estimé : 15 minutes

5. **Rate limiting sur /login**
   - Implémenter express-rate-limit
   - Temps estimé : 1 heure

6. **Validation des fichiers uploadés**
   - Ajouter filtres de type et taille
   - Temps estimé : 2 heures

7. **Vulnérabilités XSS (innerHTML)**
   - Remplacer innerHTML par textContent ou échapper les données
   - Temps estimé : 3 heures

### 🟡 **PRIORITÉ MOYENNE (à corriger sous 1 mois)**

8. **Politique de mot de passe**
   - Implémenter des règles de complexité
   - Temps estimé : 2 heures

9. **CSP sans 'unsafe-inline'**
   - Utiliser des nonces ou externaliser les scripts
   - Temps estimé : 4 heures

10. **Système de logs professionnel**
    - Intégrer winston
    - Temps estimé : 3 heures

11. **Gestion d'erreurs en production**
    - Masquer les stack traces
    - Temps estimé : 1 heure

### 🟢 **PRIORITÉ BASSE (améliorations continues)**

12. **Messages d'erreur génériques**
    - Uniformiser les messages de login
    - Temps estimé : 30 minutes

13. **Audit des dépendances**
    - Mettre en place un processus d'audit régulier
    - Temps estimé : 1 heure (récurrent)

---

## 📊 MÉTRIQUES DE SÉCURITÉ

### Score par catégorie

| Catégorie | Score | Statut |
|-----------|-------|--------|
| Authentification | 7/10 | 🟡 Bon |
| Protection CSRF | 10/10 | 🟢 Excellent |
| Headers HTTP | 8/10 | 🟢 Très bon |
| Gestion sessions | 7/10 | 🟡 Bon |
| Injection SQL | 10/10 | 🟢 Excellent |
| Vulnérabilités XSS | 6/10 | 🟡 Moyen |
| Contrôle d'accès | 9/10 | 🟢 Excellent |
| Upload de fichiers | 5/10 | 🟠 À améliorer |
| Gestion erreurs/logs | 6/10 | 🟡 Moyen |
| Configuration | 4/10 | 🔴 Critique |
| Dépendances | 7/10 | 🟡 Bon |

### **Score global : 7.2/10** 🟡

---

## 🛡️ RECOMMANDATIONS GÉNÉRALES

### Formation et sensibilisation
- Former l'équipe aux bonnes pratiques OWASP Top 10
- Organiser des code reviews orientées sécurité
- Mettre en place un processus de sécurité dans le cycle de développement

### Tests de sécurité
- Mettre en place des tests de pénétration réguliers
- Utiliser des outils d'analyse statique (SonarQube, ESLint avec plugins sécurité)
- Automatiser les scans de vulnérabilités (npm audit, Snyk)

### Monitoring et surveillance
- Implémenter un système de détection d'intrusion
- Monitorer les tentatives de connexion échouées
- Logger tous les accès aux ressources sensibles
- Mettre en place des alertes pour les comportements anormaux

### Documentation
- Documenter les choix de sécurité
- Maintenir un registre des incidents de sécurité
- Créer des procédures de réponse aux incidents

---

## 📝 CONCLUSION

L'application CoopAz v13 présente une **base solide** en matière de sécurité, notamment :
- Protection CSRF complète et fonctionnelle
- Excellente protection contre les injections SQL
- Contrôle d'accès bien implémenté
- Headers de sécurité correctement configurés

Les **principaux risques identifiés** concernent :
1. La configuration de base de données (mot de passe vide)
2. Les vulnérabilités XSS potentielles (innerHTML)
3. L'absence de rate limiting (risque de force brute)
4. Les cookies de session non sécurisés pour HTTPS

**Recommandation finale :** Appliquer le plan d'action priorisé en commençant par les éléments critiques et de haute priorité. Une fois ces corrections effectuées, le niveau de sécurité de l'application sera **excellent** (9/10).

---

## 📅 SUIVI

- **Date du dernier audit :** 8 octobre 2025
- **Auditeur :** GitHub Copilot
- **Prochain audit recommandé :** 8 janvier 2026 (tous les 3 mois)

---

## 📎 ANNEXES

### A. Commandes utiles pour la sécurité

```bash
# Audit des dépendances npm
npm audit
npm audit fix

# Vérifier les packages obsolètes
npm outdated

# Générer un secret cryptographique
openssl rand -base64 64

# Vérifier les permissions des fichiers sensibles
ls -la .env
ls -la uploads/

# Tester les headers de sécurité
curl -I http://localhost:3000

# Scanner les ports ouverts
nmap localhost
```

### B. Ressources recommandées

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)

### C. Checklist de déploiement sécurisé

- [ ] Variables d'environnement configurées (production)
- [ ] Mot de passe BDD robuste
- [ ] NODE_ENV=production
- [ ] Cookies sécurisés (httpOnly, secure, sameSite)
- [ ] HTTPS activé (certificat SSL valide)
- [ ] Rate limiting activé
- [ ] Logs configurés (sans données sensibles)
- [ ] Firewall configuré
- [ ] Sauvegardes automatisées
- [ ] Plan de reprise après incident

---

**FIN DU RAPPORT D'AUDIT**
