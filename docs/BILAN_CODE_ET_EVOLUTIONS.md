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
   **Backend** : Jest + supertest ; tests dans `tests/` (`tests/api/auth.spec.js`, `tests/api/rbac.spec.js`). Lancer avec `npm run test`.  
   - Phase 1 : smoke GET /login ; Phase 2 : routes publiques, route protégée sans session, RBAC (401/403). Session en test : MemoryStore ; route `/test/session` (NODE_ENV=test).  
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

- Notifications temps réel (WebSocket ou SSE) pour nouvelles commandes, rappels, etc.
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
