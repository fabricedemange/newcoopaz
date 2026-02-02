# Bilan de la migration Vue 3 SFC + Vite

*Dernière mise à jour : février 2025*

---

## 1. Vue d’ensemble

La migration remplace progressivement :
- **Ancienne génération** : pages EJS côté serveur + applications Vue CDN (public/vue/*.js)
- **Nouvelle génération** : application Vue 3 SFC (Single File Components) buildée avec Vite, servie via des vues EJS minimales (`*_vue.ejs`) qui chargent le bundle frontend.

Les URLs cibles utilisent le suffixe **`/vue`** (ou `/:id/vue` pour les détails) pour les écrans migrés.

---

## 2. Routes serveur (redirections vers Vue+Vite)

| Contexte | Ancienne URL | Nouvelle URL (Vue+Vite) |
|----------|--------------|--------------------------|
| **Accueil** | `GET /` | → `GET /vue` (index_vue.ejs + app Vite) |
| **Paniers** | `GET /panier` | → `GET /panier/vue` |
| **Paniers** | `GET /panier/:id/modifier` | → `GET /panier/:id/modifier/vue` |
| **Paniers** | `GET /panier/legacy` | → `GET /panier/vue` |
| **Commandes** | `GET /commandes` | → `GET /commandes/vue` |
| **Commandes** | `GET /commandes/:id` | → `GET /commandes/:id/vue` |
| **Catalogues** | `GET /catalogues` | → `GET /catalogues/vue` |
| **Catalogues** | `GET /catalogues/:id` | → `GET /catalogues/:id/vue` (?panier= conservé) |
| **Admin** | `GET /admin/` | → `GET /admin/dashboard/vue` |
| **Admin** | `GET /admin/menu` | → `GET /admin/dashboard/vue` |
| **Admin** | `GET /admin/dashboard` | → `GET /admin/dashboard/vue` |
| **Admin** | `GET /admin/users` | → `GET /admin/users/vue` |
| **Admin** | `GET /admin/catalogues` | → `GET /admin/catalogues/vue` (?scope=) |
| **Admin** | `GET /admin/products` | → `GET /admin/products/vue` |
| **Admin** | `GET /admin/categories` | → `GET /admin/categories/vue` |
| **Admin** | `GET /admin/suppliers` | → `GET /admin/suppliers/vue` |
| **Admin** | `GET /admin/catalogues/:id/synthese` | → `GET /admin/catalogues/:id/synthese/vue` |
| **Admin** | `GET /admin/catalogues/:id/synthese-detaillee` | → `GET /admin/catalogues/:id/synthese-detaillee/vue` |
| **Admin** | `GET /admin/paniers/:id/edit` | → `GET /panier/:id/modifier/vue` |
| **Auth** | `GET /login` | rendu direct `login_vue.ejs` (Vue) |

**Fichiers concernés** : `routes/index.routes.js`, `panier.routes.js`, `commandes.routes.js`, `catalogues.routes.js`, `admin.routes.js`, `products.routes.js`, `categories.routes.js`, `suppliers.routes.js`, `auth.routes.js`.

---

## 3. Redirections après actions (res.redirect)

Toutes les redirections serveur vers les écrans migrés ont été alignées sur les URLs `/vue` :

- **Panier** : après remove, note, change-owner, submit, supprimer → `/panier/vue`, `/commandes/vue`, `/admin/dashboard/vue`, `/catalogues/:id/vue?panier=...`, `/panier/:id/modifier/vue`
- **Commandes** : après note, edit → `/admin/dashboard/vue`, `/commandes/vue`, `/commandes/:id/vue`, `/panier/vue`
- **Admin** : dashboard, catalogues (liste, scope, referer fallback) → `/admin/dashboard/vue`, `/admin/catalogues/vue` (ou `/admin/catalogues/vue?scope=all`)
- **Catalogues** : après POST invisible-utilisateurs / invisible-tous → `/admin/catalogues/vue`
- **API** : après login ou action → `/panier/vue` si pertinent

**Fichiers** : `routes/panier.routes.js`, `commandes.routes.js`, `admin.routes.js`, `catalogues.routes.js`, `api.routes.js`.

---

## 4. Liens corrigés (href / to)

### 4.1 Vues EJS (pages d’accueil, admin, synthèses)

- **views/index.ejs** : panier, commandes, catalogues, modifier panier → `/panier/vue`, `/commandes/vue`, `/catalogues/vue`, `/panier/:id/modifier/vue`
- **views/admin_menu.ejs** : dashboard, catalogues → `/admin/dashboard/vue`, `/admin/catalogues/vue`
- **views/admin_edit_panier.ejs**, **admin_dashboard.ejs**, **paniers_grouped.ejs**, **paniers_lien_unique.ejs** : dashboard, modifier panier, détail catalogue → `/admin/dashboard/vue`, `/panier/:id/modifier/vue`, `/catalogues/:id/vue`
- **views/admin_catalogue_synthese.ejs**, **admin_catalogue_synthese_detaillee.ejs** : synthèse détaillée, retours → `/admin/catalogues/:id/synthese-detaillee/vue`, `/admin/catalogues/vue`
- **views/admin_catalogue_upload_form.ejs**, **admin_catalogue_form.ejs**, **import.ejs**, **admin_article_edit_form.ejs** : retours liste catalogues → `/admin/catalogues/vue`

### 4.2 Frontend Vue (Vite)

- **AdminDashboardPage.vue** : liens Synthèse / Synthèse détaillée → `/admin/catalogues/:id/synthese/vue`, `/admin/catalogues/:id/synthese-detaillee/vue`

### 4.3 Apps Vue CDN (public/vue)

- **AdminDashboardApp.js** : mêmes liens synthèse / synthèse-detaillee → avec `/vue`

### 4.4 Sidebar

- **views/partials/admin_sidebar.ejs** : déjà en `/catalogues/vue`, `/panier/vue`, `/commandes/vue`, `/admin/dashboard/vue`, `/admin/catalogues/vue`

---

## 5. Pages Vue SFC (frontend Vite)

**Répertoire** : `frontend/src/views/`

| Page | Route / Vue EJS | Rôle |
|------|------------------|------|
| HomePage.vue | `/vue` (index_vue.ejs) | Accueil utilisateur |
| PaniersPage.vue | `/panier/vue` | Liste des paniers |
| PanierDetailPage.vue | `/panier/:id/modifier/vue` | Détail / édition panier |
| CataloguesPage.vue | `/catalogues/vue` | Liste des catalogues |
| CatalogueDetailPage.vue | `/catalogues/:id/vue` | Détail catalogue + panier |
| CommandesPage.vue | `/commandes/vue` | Liste des commandes |
| CommandeDetailPage.vue | `/commandes/:id/vue` | Détail commande |
| AdminDashboardPage.vue | `/admin/dashboard/vue` | Tableau de bord admin |
| AdminCataloguesPage.vue | `/admin/catalogues/vue` | Liste catalogues admin |
| AdminCatalogueSynthesePage.vue | `/admin/catalogues/:id/synthese/vue` | Synthèse catalogue |
| AdminCatalogueSyntheseDetailleePage.vue | `/admin/catalogues/:id/synthese-detaillee/vue` | Synthèse détaillée |
| AdminProductsPage.vue | `/admin/products/vue` | Produits |
| AdminCategoriesPage.vue | `/admin/categories/vue` | Catégories |
| AdminSuppliersPage.vue | `/admin/suppliers/vue` | Fournisseurs |
| AdminUsersPage.vue | `/admin/users/vue` | Utilisateurs |
| AdminUserRolesPage.vue | `/admin/users/:id/roles` | Rôles d’un utilisateur |
| AdminRolesPage.vue | `/admin/roles/vue` | Rôles |
| AdminStatsPage.vue | `/admin/stats` | Statistiques |
| AdminOrganizationsPage.vue | (admin) | Organisations |
| AdminBandeauxPage.vue | `/admin/bandeaux` | Bandeaux |
| AdminTracePage.vue | `/admin/trace` | Trace / audit |
| AdminEmailQueuePage.vue | `/admin/email-queue` | File d’emails |
| CaissePage.vue | `/caisse` | Caisse |
| CaisseHistoriquePage.vue | `/caisse/historique` | Historique caisse |

---

## 6. Vues EJS « Vue » (shells pour le bundle Vite)

**Répertoire** : `views/` (fichiers `*_vue.ejs`)

Ces vues ne font que charger le layout et le script du bundle Vite correspondant (pas de rendu EJS des données).

- index_vue.ejs, paniers_vue.ejs, panier_modifier_vue.ejs  
- catalogues_vue.ejs, catalogue_articles_vue.ejs  
- commandes_vue.ejs, commande_detail_vue.ejs  
- admin_dashboard_vue.ejs, admin_catalogues_vue.ejs  
- admin_catalogue_synthese_vue.ejs, admin_catalogue_synthese_detaillee_vue.ejs  
- admin_products_list_vue.ejs, admin_categories_list_vue.ejs, admin_suppliers_list_vue.ejs  
- admin_users_vue.ejs, admin_user_form_vue.ejs, admin_roles_vue.ejs, admin_user_roles_vue.ejs  
- admin_categories_list_vue.ejs, admin_category_form_vue.ejs  
- admin_suppliers_list_vue.ejs, admin_supplier_form_vue.ejs, admin_supplier_detail_vue.ejs  
- admin_products_list_vue.ejs, admin_product_form_vue.ejs, admin_product_detail_vue.ejs  
- admin_stats_vue.ejs, admin_trace_vue.ejs, admin_organizations_vue.ejs  
- admin_bandeaux_vue.ejs, admin_email_queue_vue.ejs  
- caisse_vue.ejs, caisse_historique_vue.ejs  
- vue_dev.ejs, test_vue.ejs  

---

## 7. Migration « pur Vue 3 SFC + Vite » (état actuel)

### 7.1 Fait (Phase 1 + Phase 2 Auth)

- **Listes admin** : toutes redirigent vers Vue (`/admin/users`, `/admin/catalogues`, `/admin/products`, `/admin/categories`, `/admin/suppliers` → `/vue`).
- **Menu admin** : `GET /admin/menu` et `GET /admin/` → `/admin/dashboard/vue`.
- **Édition panier admin** : `GET /admin/paniers/:id/edit` → `/panier/:id/modifier/vue`.
- **Panier** : `GET /panier/:id/modifier` (EJS) → `/panier/:id/modifier/vue` ; `GET /panier/legacy` → `/panier/vue`.
- **Auth (Phase 2)** : toutes les pages auth sont en Vue+Vite :
  - **Login** : `GET /login` → `login_vue.ejs` (`LoginPage.vue`). POST `/login` accepte JSON.
  - **Mot de passe oublié** : `GET /forgot-password` → `forgot_password_vue.ejs` (`ForgotPasswordPage.vue`). POST accepte JSON.
  - **Inscription** : `GET /register` → `register_vue.ejs` (`RegisterPage.vue`). POST `/register` accepte JSON.
  - **Réinitialisation** : `GET /reset-password?token=...` → `reset_password_vue.ejs` (`ResetPasswordPage.vue`). POST accepte JSON.
  - **Mon compte** : `GET /account` → `account_vue.ejs` (`AccountEditPage.vue`, avec header/sidebar). POST `/account` accepte JSON.
- **Phase 3 – Formulaires admin (en cours)** :
  - **Utilisateur** : `GET /admin/users/new` et `GET /admin/users/:id/edit` → `admin_user_form_vue.ejs` (`AdminUserFormPage.vue`). POST `/admin/users/new` et POST `/admin/users/:id/edit` acceptent JSON (`success`, `redirect`, `error`).
  - **Catégorie** : `GET /admin/categories/new` et `GET /admin/categories/:id/edit` → `admin_category_form_vue.ejs` (`AdminCategoryFormPage.vue`). POST `/admin/categories` et POST `/admin/categories/:id` acceptent JSON.
  - **Fournisseur** : `GET /admin/suppliers/new` et `GET /admin/suppliers/:id/edit` → `admin_supplier_form_vue.ejs` (`AdminSupplierFormPage.vue`). `GET /admin/suppliers/:id` → `admin_supplier_detail_vue.ejs` (`AdminSupplierDetailPage.vue`). POST `/admin/suppliers` et POST `/admin/suppliers/:id` acceptent JSON.
  - **Produit** : `GET /admin/products/new` et `GET /admin/products/:id/edit` → `admin_product_form_vue.ejs` (`AdminProductFormPage.vue`). `GET /admin/products/:id` → `admin_product_detail_vue.ejs` (`AdminProductDetailPage.vue`). POST `/admin/products` et POST `/admin/products/:id` acceptent JSON (édition avec image via FormData multipart).

### 7.2 Reste à migrer (même pattern)

- **Formulaires admin** : catalogues (new, upload, edit), articles, bandeaux. Chaque écran = une page Vue + entry + shell EJS + route qui rend le shell + POST en JSON.
- **Caisse** : déjà en vues `*_vue.ejs`.
- **Accueil** : `GET /` → `/vue` ; `GET /legacy-home` conservé pour rollback.

---

## 8. Récapitulatif des fichiers modifiés (cette vague)

- **Routes** : index.routes.js, panier.routes.js, commandes.routes.js, catalogues.routes.js, admin.routes.js, api.routes.js  
- **Vues** : index.ejs, admin_menu.ejs, admin_edit_panier.ejs, admin_dashboard.ejs, paniers_grouped.ejs, paniers_lien_unique.ejs, admin_catalogue_synthese.ejs, admin_catalogue_synthese_detaillee.ejs, admin_catalogue_upload_form.ejs, admin_catalogue_form.ejs, import.ejs, admin_article_edit_form.ejs  
- **Frontend** : AdminDashboardPage.vue  
- **CDN** : AdminDashboardApp.js  

---

## 9. Vérifications utiles

- Tester les parcours : accueil → paniers / commandes / catalogues → détail → retour.
- Vérifier les redirections après : soumission panier, note commande, changement propriétaire, actions admin (archivage, visibilité, etc.).
- S’assurer que tous les liens du menu (sidebar) et des boutons « Retour » pointent bien vers les URLs `/vue` pour les écrans migrés.
