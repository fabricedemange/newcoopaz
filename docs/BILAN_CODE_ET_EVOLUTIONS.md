# Bilan complet du code et évolutions possibles

*Dernière mise à jour : février 2025*

---

## 1. Vue d’ensemble du projet

**Coopaz** est une application de gestion de commandes pour une coopérative : catalogues, paniers, commandes, caisse, administration (utilisateurs, produits, catégories, fournisseurs, catalogues, rôles RBAC, stats, bandeaux, etc.).

- **Backend** : Node.js + Express, MySQL, sessions, CSRF, Helmet, rate limiting.
- **Frontend** : Vue 3 (SFC) + Vite + Pinia pour les écrans migrés ; EJS + apps Vue CDN (legacy) encore présents.
- **Sécurité** : RBAC pur (permissions en base), plus de `requireRole` legacy ; `/account` en `requireLogin`.

---

## 2. Stack technique

| Couche | Technologie |
|--------|-------------|
| Runtime | Node.js |
| Framework backend | Express 4.x |
| Base de données | MySQL (mysql2) |
| Sessions | express-session (+ Redis/MySQL store possible) |
| Sécurité | bcrypt, csurf, helmet, express-rate-limit |
| Vue côté serveur | EJS |
| Frontend moderne | Vue 3, Vite 6, Pinia |
| Emails | Nodemailer |
| Fichiers / images | Multer, Sharp |
| PDF | pdfmake, html2pdf |
| Excel | exceljs, xlsx |
| Logs | Winston |

---

## 3. Architecture actuelle

### 3.1 Backend

- **`app.js`** : point d’entrée, middlewares globaux, injection `user` / `role` / `userPermissions` / RBAC, montage des routes.
- **`config/`** : config DB, logger, CSRF.
- **`routes/`** : ~45 fichiers de routes (admin, auth, panier, commandes, catalogues, caisse, API admin, API caisse, etc.). Routes admin protégées par **`requirePermission`** / **`requireAnyPermission`** (RBAC).
- **`middleware/`** : `requireLogin`, `validateCatalogOwnership`, `injectBandeaux`, `handleCSRFError`, `handle404` ; **RBAC** dans `rbac.middleware.js` (cache L1/L2, `requirePermission`, `requireAnyPermission`).
- **`services/`** : email, file d’emails, PDF, Excel, archivage catalogues, rappels commandes.
- **`utils/`** : helpers DB, vues, erreurs, validation, bandeaux, etc.
- **`models/`** : 3 modules (catalogue, organization, user) – peu utilisés par rapport aux requêtes SQL directes dans les routes.

### 3.2 Frontend (Vite)

- **`frontend/src/`** : entries (une par “page” ou groupe de pages), **stores** Pinia (~20), **views** (~45 pages Vue), **api** (client HTTP centralisé), **components** (formulaires réutilisables : AdminProductFormContent, AdminCategoryFormContent, AdminSupplierFormContent).
- **Build** : Vite produit des bundles dans `public/dist/` (entries multiples : auth-*, admin-*, caisse*, catalogues, commandes, paniers, home, etc.).
- **Modals** : création produit / catégorie / fournisseur / utilisateur en modal sur les listes (plus de page dédiée “new” pour ces écrans).

### 3.3 Vues EJS

- **`views/`** : ~66 fichiers EJS ; layout (header, footer, admin_sidebar), pages “legacy” et **shells Vue** (`*_vue.ejs`) qui ne font que charger un bundle Vite.
- Les URLs “Vue” utilisent le suffixe **`/vue`** (ex. `/admin/products/vue`, `/panier/vue`).

### 3.4 RBAC

- Contrôle d’accès **uniquement par permissions** (`requirePermission('users')`, `requireAnyPermission(['paniers.user', 'paniers.admin'])`, etc.).
- Permissions “macro” en base : `users`, `catalogues`, `products`, `categories`, `suppliers`, `organizations`, `roles`, `paniers.admin`, `paniers.user`, `commandes.admin`, `commandes.user`, `reports`, `bandeaux`, `audit_logs`, `admin`, etc.
- **`requireRole`** et middlewares dérivés (**requireAdmin**, **requireReferent**, etc.) ont été **supprimés** du code actif.
- Les checks "SuperAdmin" et listes de rôles en dur ont été remplacés par la permission **`organizations.view_all`** et **`hasPermission`** (voir section "Dette technique", point 1 finalisé). “Dette technique”.

### 3.5 Archive (legacy nettoyé)

- Les fichiers **`.bak`** ont été déplacés dans **`archive/`** (`archive/bak_routes/`, `archive/bak_views/`).
- Les anciennes **apps Vue CDN** ont été déplacées dans **`archive/vue_cdn/`** ; toutes les pages concernées utilisent désormais les bundles Vite (`public/dist/`). Le helper **`responsive-helper.js`** est servi depuis **`public/js/responsive-helper.js`** (chargé dans `views/partials/header.ejs`). Voir `archive/README.md`.

---

## 4. Points forts

- **RBAC unifié** : plus de mélange rôle legacy / permission ; contrôle d’accès cohérent côté backend.
- **Migration Vue/Vite avancée** : listes admin, auth, panier, commandes, catalogues, caisse, stats, etc. en SFC + Pinia.
- **UX** : modals pour “nouveau produit / catégorie / fournisseur / utilisateur” sur les listes, moins de changements de page.
- **Sécurité** : CSRF, rate limiting login, Helmet, mots de passe hashés, permissions vérifiées en base avec cache.
- **Documentation** : BILAN_MIGRATION_VUE_VITE.md, RBAC_IMPLEMENTATION.md, COTISATION_CAISSE.md, etc.
- **Migrations SQL** : nombreuses migrations datées et scripts (backup, import baseprod, etc.).

---

## 5. Dette technique et points d’attention

1. **Rôle “SuperAdmin” et listes de rôles en dur**  
   **Finalisé.** Backend : tous les checks remplacés par **`organizations.view_all`** et **`hasPermission`** (ou `paniers.admin` / `commandes.admin`). Migration `20260202_add_organizations_view_all_permission.sql` ; L’ancien helper basé sur le rôle a été supprimé. Frontend : stores utilisent encore `state.role === 'SuperAdmin'` pour l’affichage (option : API renvoie `canViewAllOrgs`).
   Migration : `migrations/20260202_add_organizations_view_all_permission.sql` ; Helper supprimé de `utils/session-helpers.js` et de `middleware/rbac.middleware.js`.
   - `routes/admin.routes.js` : accès “toutes orgs”, formulaires users, etc.
   - `routes/panier.routes.js` : accès à des actions “admin” panier.
   - `routes/commandes.routes.js` : accès liste commandes.
   - **Finalisé** : migration `20260202_add_organizations_view_all_permission.sql`, `hasPermission(req, "organizations.view_all")` partout en backend ; helper retiré de session-helpers. Frontend : stores utilisent encore `state.role === 'SuperAdmin'` pour l’affichage (option : API renvoie `canViewAllOrgs`).

2. **Tests automatisés (Phases 1, 2 et 3 en place)**  
   **Backend** : Jest + supertest ; tests dans `tests/` (`tests/api/auth.spec.js`, `tests/api/rbac.spec.js`, `tests/api/rate-limit.spec.js`, `tests/utils/xss-protection.spec.js`, `tests/views/xss-phase3.spec.js`). Lancer avec `npm run test`.  
   - Phase 1 : smoke GET /login ; Phase 2 : routes publiques, route protégée sans session, RBAC (401/403). Session en test : MemoryStore ; route `/test/session` (NODE_ENV=test, exclue du CSRF en test). En tête de `app.js`, NODE_ENV est préservé après `dotenv` pour que les tests gardent `NODE_ENV=test`.  
   **Frontend** : Vitest + @vue/test-utils (happy-dom) ; tests dans `frontend/src/` (stores : `catalogues.spec.js`, `commandes.spec.js` ; composant : `AdminProductFormContent.spec.js`). Lancer avec `cd frontend && npm run test`.  
   - Phase 3 : getters + actions mockées (catalogues : loadAll succès/erreur/authRequired ; commandes : filteredCommandes, sortedCommandes, loadAll) ; composant AdminProductFormContent (rendu, champs obligatoires, émission cancel, libellés création/édition).  
   **Script racine** : `npm run test:all` exécute backend puis frontend.

3. **Modèles peu utilisés**  
   Les `models/` (user, organization, catalogue) ne centralisent pas toute la logique métier ; beaucoup de requêtes SQL dans les routes.  
   **Évolution** : soit renforcer les modèles / couche “service”, soit documenter la convention “routes + SQL direct”.

4. **Fin de migration Vue** — **finalisé (CDN)**  
   Les apps Vue CDN ont été archivées dans **`archive/vue_cdn/`**. Plus aucune page ne charge les scripts depuis `public/vue/`. Le helper `responsive-helper.js` a été déplacé dans `public/js/` et reste disponible pour d’éventuelles vues EJS legacy.  
   **Reste éventuellement** : basculer les dernières pages EJS legacy en SFC + Vite et simplifier les shells EJS (`*_vue.ejs`) si besoin.

5. **Fichiers .bak** — **finalisé**  
   Tous les `.bak` ont été déplacés dans **`archive/bak_routes/`** et **`archive/bak_views/`**.

6. **Taille de `admin.routes.js`**  
   Fichier très volumineux (~3400 lignes).  
   **Évolution** : découper par domaine (users, catalogues, products, paniers admin, etc.) en sous-routeurs.

7. **Duplication EJS / Vue**  
   Certaines listes ou formulaires existent encore en EJS et en Vue (ex. détail commande). À clarifier quelles URLs sont “canoniques”.

---

## 5. Audit RBAC – protection des URLs

**Objectif** : s'assurer qu'aucune URL ne peut être atteinte en la saisissant directement pour contourner les contrôles RBAC du menu.

- **Pas de middleware global** : chaque route (ou groupe) doit avoir son propre `requireLogin` / `requirePermission` / `requireAnyPermission`.
- **Corrections appliquées (fév. 2026)** :  
  - `/api/caisse/ventes-historique` (toutes les méthodes) → `requirePermission("caisse.sell", { json: true })`.  
  - `/api/caisse/modes-paiement`, `/api/caisse/utilisateurs` → `requirePermission("caisse.sell", { json: true })`.  
  - `/admin/catalogues/:id/synthese/export/pdf/:action` et `synthese-detaillee/export/pdf/:action` → `requirePermission('catalogues')`.
- **Vérification manuelle** : avec un compte Utilisateur, taper `/admin/dashboard/vue`, `/caisse`, `/api/caisse/ventes-historique` → 302 login ou 403. `/panier/access-carts/:token` reste public (lien par token).

---

## 6. Évolutions possibles (priorisées)

### 6.1 Court terme (sécurité / cohérence)

- **Remplacer les checks “SuperAdmin” et listes de rôles** — **fait** : permission `organizations.view_all` + `hasPermission` partout en backend (voir point 1 ci-dessus).
- **Nettoyer** : les `*.bak` et les apps Vue CDN ont été archivés (voir `archive/`).

### 6.2 Moyen terme (qualité / maintenabilité)

- **Tests** : ajouter des tests (ex. Vitest pour le frontend, tests API pour les routes critiques : auth, panier, commandes, RBAC).
- **Découpage d’`admin.routes.js`** : un router par domaine (users, catalogues, products, categories, suppliers, bandeaux, trace, stats, email-queue, organizations, paniers admin, commandes admin) et montage dans `app.js`.
- **Documentation des permissions** : un tableau ou un fichier (ex. `docs/PERMISSIONS.md`) listant chaque permission, les routes protégées et les rôles système qui les ont par défaut.

### 6.3 Plus long terme (architecture / fonctionnel)

- **Fin de migration Vue** : les apps Vue CDN ont été archivées (`archive/vue_cdn/`). Reste éventuellement à basculer les dernières pages EJS legacy en SFC + Vite et à simplifier les shells EJS si besoin.
- **API REST cohérente** : normaliser les préfixes (`/api/...`), les codes HTTP et le format des réponses (JSON) pour toutes les API utilisées par le frontend.
- **Couche service / modèles** : centraliser la logique métier et l’accès données dans des services ou modèles, les routes ne faisant que HTTP + permissions.
- **SSR ou SPA optionnelle** : si besoin (SEO, première peinture), envisager Nuxt ou un rendu serveur minimal pour certaines routes ; sinon, consolider le “Vite + EJS shell” actuel.
- **Monitoring / santé** : endpoint `/health` ou `/status`, logs structurés (Winston déjà en place), alertes sur erreurs critiques.
- **CI/CD** : pipeline (build frontend, tests, déploiement) et éventuellement vérification des migrations SQL.

### 6.4 Idées fonctionnelles (hors bilan technique)

#### Savoir qui est connecté (avant ou sans WebSocket/SSE)

**Objectif** : afficher en admin la liste des utilisateurs « actuellement connectés » (ont une session active ou ont eu une activité récente).

**Oui, c’est possible**, avec votre stack actuelle (sessions en MySQL via `express-mysql-session`). Deux approches :

**1. Utiliser la table des sessions (déjà en place)**  
Le store MySQL crée une table (souvent `sessions`) avec `session_id`, `expires`, `data` (contenu de la session sérialisé).  
- « Connecté » = session dont `expires` > maintenant.  
- Pour avoir *qui* : il faut lire le champ `data` (souvent JSON) et en extraire `userId` / `username` (et éventuellement `organization_id`).  
- **Limites** : format de `data` dépend du store ; exposer la liste des connectés nécessite une route admin protégée (ex. `requirePermission('users')`) qui fait un `sessionStore.all()` ou une requête SQL sur `sessions` puis parse `data` pour n’afficher que user_id, username, org.  
- **Attention** : ne pas exposer le contenu brut des sessions (cookies, tokens, etc.), seulement des infos d’affichage (qui est connecté).

**2. Table « présence » (last_seen)**  
- Créer une table ex. `user_presence` : `user_id`, `session_id`, `last_seen_at`, optionnellement `ip`, `user_agent`.  
- Dans un middleware (sur chaque requête authentifiée, ou sur une route `/api/ping` appelée toutes les 30 s par le front), faire `UPDATE user_presence SET last_seen_at = NOW() WHERE user_id = ? AND session_id = ?` (ou INSERT si absent).  
- « Connecté » = `last_seen_at` dans les dernières 5–15 minutes.  
- **Avantage** : requête simple, pas de parsing de session ; on peut ajouter page courante, org, etc.  
- **Inconvénient** : une migration + un peu de code (middleware ou route ping + route admin qui lit `user_presence`).

**Recommandation** :  
- Pour un premier pas **sans migration** : utiliser la table `sessions` (option 1) et une route admin « Utilisateurs connectés » qui lit les sessions actives et extrait userId/username.  
- Pour un affichage plus propre et évolutif (dernière page, durée, etc.) : ajouter la table présence (option 2) et un ping côté front.

Une fois les **notifications temps réel (WebSocket/SSE)** en place, « qui est connecté » peut aussi être dérivé des connexions SSE/WebSocket ouvertes (liste des user_id ayant un flux actif).

#### Notifications temps réel (WebSocket ou SSE)

**Objectif** : informer les utilisateurs sans recharger la page (nouvelle commande reçue, rappel catalogue, message admin, etc.).

**Fonctionnement général :**

1. **Connexion persistante**  
   Le navigateur ouvre une connexion longue vers le serveur (WebSocket ou SSE). Tant que la page reste ouverte, cette connexion reste active.

2. **Événements côté serveur**  
   Quand un événement se produit (ex. un client soumet un panier → nouvelle commande, ou le cron envoie un rappel catalogue), le backend **pousse** un message vers les clients connectés au lieu d’attendre qu’ils fassent une requête.

3. **Réception côté frontend**  
   Le client reçoit le message et met à jour l’interface : badge « Nouvelles commandes », toast « Rappel envoyé pour le catalogue X », mise à jour du compteur, etc.

**Exemples de flux :**

- **Nouvelle commande** : un utilisateur valide son panier → le serveur enregistre la commande et envoie un événement `command.created` (avec id, catalogue, etc.) → les écrans « Commandes » ouverts (admin, référent) reçoivent l’événement et mettent à jour la liste ou un badge.
- **Rappel catalogue** : le worker envoie un email de rappel → le serveur émet `catalogue.reminder_sent` → les admins/referents connectés voient une notification.
- **Message admin** : un admin envoie un bandeau ou un message → événement `message.broadcast` → tous les clients connectés (ou par org) affichent une alerte.

**WebSocket vs SSE (Server-Sent Events) :**

| Critère | SSE | WebSocket |
|--------|-----|-----------|
| Sens | Serveur → client uniquement | Bidirectionnel |
| Complexité | Plus simple (HTTP, EventSource en JS) | Plus lourd (protocole dédié, Socket.io ou ws) |
| Cas d’usage ici | Suffisant si on envoie seulement des notifications (commandes, rappels) | Utile si le client doit aussi envoyer des messages en temps réel (chat, formulaire collaboratif) |

Pour des **notifications** (serveur → client), **SSE** est souvent suffisant et plus simple à intégrer (route GET qui garde la connexion ouverte, `EventSource` en frontend). WebSocket devient pertinent si on ajoute du temps réel bidirectionnel (chat, édition collaborative).

**Intégration possible dans l’app actuelle :**

- **Backend** : une route protégée (ex. `GET /api/notifications/stream`) qui, après `requireLogin`, garde la connexion ouverte et envoie des événements (SSE : `Content-Type: text/event-stream`, messages au format `data: {...}\n\n`). Un module « event bus » côté serveur reçoit les émissions des routes (création commande, worker rappel, etc.) et les renvoie aux streams ouverts (filtrés par org / rôle si besoin).
- **Frontend** : sur les pages concernées (dashboard admin, liste commandes, caisse), création d’un `EventSource` (SSE) ou d’un client WebSocket qui écoute les événements et met à jour le store Pinia (ex. `commandesStore.addNewCommand(payload)`) ou affiche un toast.

- Export / rapports avancés (stats, commandes, cotisation) avec planification.
- Application mobile ou PWA pour la caisse / les commandes.
- Intégration comptable ou facturation (export, pièces jointes).

---

## 7. Résumé

| Thème | État actuel | Priorité évolution |
|-------|-------------|--------------------|
| RBAC | 100 % permissions ; SuperAdmin remplacé par organizations.view_all | Optionnel : API renvoie canViewAllOrgs, frontend l’utilise |
| Frontend | Vue 3 + Vite pour la majorité des écrans ; legacy CDN archivé | Basculer dernières pages EJS en SFC si besoin |
| Tests | Aucun | Introduire tests API + frontend |
| Routes admin | Un gros fichier | Découper en sous-routeurs |
| Modèles / services | Peu utilisés vs SQL dans routes | Clarifier stratégie (services ou SQL documenté) |
| Fichiers .bak / doc | .bak et Vue CDN archivés | Tenir à jour la doc |

Ce document peut être mis à jour au fil des décisions (ex. choix de framework de test, découpage effectif d’`admin.routes.js`, nouvelles permissions).
