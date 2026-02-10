# Synthèse – Ce qu’il reste à faire

*Référence : ANALYSE_COMPLETE_CODE.md (6 fév. 2026)*

---

## ✅ Déjà réalisé (6 fév. 2026)

- **Rate limiting** : `POST /register`, `POST /reset-password`, `POST /forgot-password` (implémenté + tests `tests/api/rate-limit.spec.js`).
- **XSS Phase 2 et 3** : `escapeHtml` sur les vues à risque (dashboard temps réel, users connectés, cotisations, test codes-barres, formulaire catégorie) ; tests unitaires et d’intégration (`xss-protection.spec.js`, `xss-phase3.spec.js`).
- **Tests RBAC** : correction CSRF/NODE_ENV pour `POST /test/session` en test ; préservation de `NODE_ENV=test` après chargement de `.env` dans `app.js`.
- **Générateur de secret** : script `scripts/generate-secret.js` ; `SESSION_SECRET` en dev peut être remplacé par une valeur générée (déjà fait si configuré dans `.env`).
- **Secret de session en production** : en prod, utiliser un secret généré (`openssl rand -base64 64` ou `npm run generate-secret`), différent par environnement — fait.
- **Priorité haute** : Vérification config production (log au démarrage en prod + avertissement si NODE_ENV incohérent) ; vérification XSS Phase 2 complémentaire (toutes les vues à risque ont une protection ; voir section ci-dessous).

---

## 🔴 Priorité critique

| # | Action | Détail | Temps |
|---|--------|--------|-------|
| 1 | **Mot de passe BDD en dev** | En dev, `DB_PASS` est vide. Soit définir un mot de passe pour la BDD locale, soit utiliser une base de test isolée. Vérifier que `.env` de prod n’est jamais versionné. | ~15 min |
| ~~2~~ | ~~Secret de session en production~~ | ✅ **Fait** — Secret généré utilisé en prod (différent par environnement). | — |

---

## 🟠 Priorité haute (sous 1 semaine) ✅ Fait (6 fév. 2026)

| # | Action | Détail | Statut |
|---|--------|--------|--------|
| 3 | **Vérifier la config production** | Cookies `secure: true`, HSTS activé, `NODE_ENV=production`. | ✅ **Fait** — Le code applique déjà `secure: process.env.NODE_ENV === "production"` (session + CSRF), HSTS uniquement en production (Helmet). Au démarrage en `NODE_ENV=production`, un log confirme « Config production active » (cookiesSecure, hstsEnabled, rateLimitAuth). Si NODE_ENV n’est ni test ni development, un avertissement est loggé. |
| 4 | **XSS – Phase 2 complémentaire** | Vérifier que `xss-protection.js` est chargé partout où innerHTML à risque. | ✅ **Fait** — Les 5 vues à risque élevé/moyen ont `/js/xss-protection.js` et utilisent `escapeHtml()` : `admin_dashboard_temps_reel`, `admin_users_connected`, `caisse_cotisations_historique_vue`, `caisse_test_codes_barres`, `admin_category_form`. `stats.ejs` a sa propre fonction `escapeHtml` et l’utilise pour toutes les données dynamiques. `paniers_grouped.ejs` et `admin_catalogue_upload_form.ejs` utilisent `textContent` pour les données utilisateur. Aucune vue à risque supplémentaire sans protection. |

---

## 🟡 Priorité moyenne (sous 1 mois)

| # | Action | Détail | Temps |
|---|--------|--------|-------|
| 5 | **Politique de mot de passe** | Règles de complexité : 12 car. min., majuscules, minuscules, chiffres, caractères spéciaux. Adapter `isValidPassword` / messages d’erreur. | ~2 h |
| 6 | **CSP sans unsafe-inline** | Réduire ou supprimer `'unsafe-inline'` / `'unsafe-eval'` (nonces, externalisation des scripts). | 4–6 h |
| 7 | **Monitoring des logs de sécurité** | Alertes sur tentatives de connexion échouées, refus de permissions, etc. | 4–6 h |
| 8 | **Audit des dépendances** | `npm audit` régulier + intégration en CI/CD ; optionnel : Snyk / Dependabot. | 1–2 h |
| 9 | **Stockage des uploads** | Vérifier que seuls les fichiers validés sont servis via `/uploads`. | ~2 h |

---

## 🟢 Priorité basse (améliorations continues)

| # | Action | Détail | Temps |
|---|--------|--------|-------|
| 10 | **Découpage admin.routes.js** | Découper en sous-routeurs (users, catalogues, products, etc.). | 4–6 h |
| 11 | **Couverture de tests** | Viser 80 %+ ; ajouter tests sur les parcours critiques. | 20–30 h |
| 12 | **Verrouillage de compte** | Après N échecs de connexion, verrouillage temporaire. | 3–4 h |
| 13 | **Rate limiting différencié** | Limites différentes selon la route (ex. création utilisateur plus stricte). | 2–3 h |
| 14 | **ESLint / Prettier** | Règles strictes + formatage automatique. | 2–3 h |
| 15 | **Documentation du code** | JSDoc sur les fonctions publiques importantes. | 8–12 h |
| 16 | **Modèles / logique métier** | Renforcer les modèles ou documenter la convention (requêtes SQL dans les routes). | 8–12 h |
| 17 | **2FA (admin)** | Authentification à deux facteurs pour les comptes admin. | 16–24 h |
| 18 | **Scan antivirus des uploads** | Ex. ClamAV pour les fichiers uploadés. | 8–12 h |

---

## 📋 Tests manuels optionnels (XSS)

- **3.1** – Note de panier avec payload XSS (`paniers_grouped.ejs`).
- **3.2** – Stats avec données contenant caractères spéciaux / script (`stats.ejs`).
- **3.3** – Articles de catalogue avec description malveillante (`catalogue_articles.ejs`).
- **3.4** – Caisse avec données de vente malveillantes (`caisse_accueil.ejs`).
- **3.5** – Dashboard admin temps réel avec username/catalogue malveillant (`admin_dashboard_temps_reel.ejs`).
- **5.1** – Vérifier l’affichage normal sur chaque page modifiée (régression).
- **5.2** – Tests sur plusieurs navigateurs (Chrome, Firefox, Safari, Edge).

---

## 📋 Tests manuels optionnels (rate limiting)

- **2.1** – Inscription normale (succès).
- **2.2** – 6 tentatives d’inscription → 6ᵉ en 429 (déjà couvert par les tests auto).
- **2.3** – Réinitialisation du compteur après 15 min.
- **2.4** – Comportement par IP (2 IP différentes).
- **3.1 / 4.1** – Réinitialisation / forgot-password avec flux normal.
- **4.3** – Forgot-password avec email inexistant (message générique).
- **6.1** – Impact sur les performances.
- **7.1 / 7.2** – Pas de régression ; utilisateurs légitimes non bloqués.

---

## ✅ Checklist avant mise en production

- [ ] Variables d’environnement configurées (production).
- [ ] Mot de passe BDD robuste.
- [ ] `NODE_ENV=production`.
- [ ] Secret de session généré de façon cryptographique (différent par env).
- [ ] Cookies sécurisés (httpOnly, secure, sameSite).
- [ ] HTTPS activé (certificat SSL valide).
- [ ] Rate limiting activé (déjà en place sur login, register, reset-password, forgot-password).
- [ ] Headers de sécurité vérifiés (Helmet).
- [ ] Logs en mode production (niveau adapté).
- [ ] Monitoring activé.
- [ ] Sauvegardes de la base configurées.
- [ ] Plan de réponse aux incidents documenté.

---

## 📅 Prochaines échéances

- **Prochaine analyse recommandée** : 6 mai 2026 (tous les 3 mois).
- **Audit de sécurité complet** : annuel.

---

*Document dérivé de ANALYSE_COMPLETE_CODE.md et XSS_INVENTAIRE_PHASE1.md.*
