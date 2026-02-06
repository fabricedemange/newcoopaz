# Analyse des performances – CoopAz v13

**Date :** 6 février 2026

---

## 1. Résumé exécutif

L’application repose sur **Node.js / Express**, **MySQL** (pool), **sessions en base**, **EJS** et **Vue 3**. Plusieurs bons choix sont déjà en place (compression, cache bandeaux, cache RBAC, pool DB). Les principaux goulots d’étranglement identifiés concernent : **requêtes systématiques à chaque requête HTTP** (rôles utilisateur, permissions, session MySQL), **boucles d’INSERT/UPDATE** en caisse, et quelques redondances (double `express.json`, middleware lourd sur toutes les vues).

---

## 2. Points positifs

| Élément | Détail |
|--------|--------|
| **Compression** | `compression()` activé (ligne 119 `app.js`) – réponses HTML/JSON compressées. |
| **Pool MySQL** | `config/config.js` : `connectionLimit: 30`, `waitForConnections: true`, `queueLimit: 0`. |
| **Cache bandeaux** | `utils/bandeaux-cache.js` : NodeCache TTL 5 min, évite une requête SQL à chaque rendu. |
| **Cache RBAC** | `middleware/rbac.middleware.js` : L1 (Map) + L2 (table MySQL `permission_cache`), TTL 15 min. |
| **Assets statiques** | `express.static` avec `maxAge: "1d"` et `etag: true` pour `public/` et `uploads/`. |
| **Requêtes parallèles** | Page d’accueil et API home : 6 requêtes en `Promise.all` (paniers, commandes, catalogues, etc.). |
| **Dashboard admin** | 3 requêtes (commandes, paniers, catalogues) en `Promise.all`. |

---

## 3. Goulots d’étranglement et recommandations

### 3.1 Requêtes à **chaque** requête HTTP (critique) — ✅ Traité

Pour **toute requête** d’un utilisateur connecté, le middleware global dans `app.js` exécutait :

1. **Requête `user_roles`** — **corrigé**  
   - Une requête SQL par requête pour récupérer les rôles affichés.  
   - **Implémenté :** cache en mémoire par `userId` (TTL 5 min) dans `utils/user-roles-cache.js`. Le middleware utilise `getDisplayRoles(req.session.userId)`. Invalidation après toute modification des rôles (API user-roles, API users, admin.routes).

2. **`getUserPermissions(req.session.userId)`** (lignes 322–324)  
   - Déjà caché (L1 + L2), mais au premier hit ou après expiration : 1 requête + éventuel remplissage L2.  
   - Acceptable si le cache est bien utilisé ; vérifier en production que les hits L1 dominent.

3. **Session MySQL** (`express-mysql-session`)  
   - Chaque requête = lecture (et souvent écriture) en base pour la session.  
   - **Recommandation :** en production, utiliser **Redis** pour le store de session (`connect-redis` est déjà dans `package.json`) afin de réduire la latence et la charge MySQL.

**Impact estimé :** 1 à 2 requêtes SQL minimum par requête (session + rôles), en plus de la logique métier. Sur une page avec plusieurs requêtes (ex. home), cela s’ajoute à chaque fois.

---

### 3.2 Rendu des vues : `getBandeaux` à chaque `res.render` — ✅ Traité

Dans le override de `res.render`, chaque rendu appelait `getBandeaux(callback)` puis filtrait en JS par organisation et page cible.

**Implémenté :**
- **Pré-filtrage par organisation** dans `utils/bandeaux-cache.js` : `getBandeaux(orgId, callback)` avec cache par org (clé `bandeaux_org_<orgId>`). La requête SQL filtre `(organization_id = ? OR organization_id = 0)` et ne charge que les bandeaux utiles pour l’org (ou globaux pour visiteur).
- En JS il ne reste que le filtre **page cible** (`pageCibleMatches`) et le **tri** par date d’expiration.
- `invalidateBandeauxCache()` supprime toutes les entrées `bandeaux_org_*` (un bandeau global doit disparaître de tous les caches).

---

### 3.3 Caisse : boucles d’INSERT / UPDATE (N requêtes)

Fichier **`routes/api.caisse.paniers-ventes.routes.js`** :

| Endpoint / action | Problème |
|-------------------|----------|
| **POST paniers** (création) | Boucle `for (const ligne of lignes)` avec `await queryPromise(INSERT INTO lignes_vente ...)` – une requête par ligne. |
| **PUT paniers/:id** (mise à jour) | Même schéma : DELETE puis N INSERT en boucle. |
| **POST paniers/:id/valider** | Boucle sur les lignes avec `await queryPromise(UPDATE products SET stock_disponible = ...)` – une requête par ligne. |

**Recommandations :**

- **lignes_vente :** utiliser un **INSERT multiple** en une seule requête, par ex.  
  `INSERT INTO lignes_vente (vente_id, produit_id, ...) VALUES (?,?,...), (?,?,...), ...`  
  (batch des lignes avec un seul `queryPromise`).
- **Décrément de stock :** soit une seule requête avec `CASE` / expressions par produit, soit un batch d’UPDATE, ou une procédure stockée qui boucle côté MySQL.  
  Cela réduit fortement le nombre d’allers-retours DB pour les paniers de côté et la validation.

---

### 3.4 Redondance : `express.json()` appliqué deux fois — ✅ Traité

- Le second `app.use(express.json());` (après le gestionnaire d’erreurs Multer) a été **supprimé**. Un seul parser JSON reste (avec limite 5 MB, voir § 3.6).

---

### 3.5 Logging HTTP sur chaque requête — ✅ Traité

**Implémenté** dans `config/logger.js` : en **production**, le `httpLogger` ne logue plus chaque requête entrante ni les réponses 2xx/3xx. Seules les réponses **4xx** (warn) et **5xx** (error) sont loguées sur `finish`. En développement, le comportement reste inchangé (requête entrante + requête complétée).

---

### 3.6 Taille des réponses et limites — ✅ Traité

- **Limites body** : `express.json({ limit: "5mb" })` et `express.urlencoded({ limit: "5mb" })` (au lieu de 50 MB / 10 MB). Réduit l’exposition aux abus (mémoire, CPU). Rate limiting sur `/api/` déjà en place.

---

## 4. Base de données

### 4.1 Indexation

D’après les migrations et `create_caisse_tables.sql` :

- **ventes :** `idx_org`, `idx_created_at`, `idx_numero`, `idx_statut`
- **lignes_vente :** `idx_vente`, `idx_produit`
- **paniers :** `idx_paniers_source`, `idx_paniers_user_caisse`
- **catalog_files :** `uploader_id`, `organization_id`
- **RBAC :** `permission_cache` avec `user_id`, `expires_at`, etc.

Les requêtes fréquentes (par `organization_id`, `user_id`, `vente_id`, `catalog_file_id`, `created_at`) sont en général couvertes.  
**Recommandation :** En production, utiliser `EXPLAIN` sur les requêtes lentes (dashboard, historique ventes, liste catalogues) pour confirmer l’usage des index.

### 4.2 Pool

- `connectionLimit: 30` est cohérent pour une app de taille moyenne.  
- En forte charge, surveiller les files d’attente (queue) et les timeouts ; ajuster si besoin selon le nombre de workers (ex. Passenger) et la capacité MySQL.

---

## 5. Synthèse des actions prioritaires

| Priorité | Action | Impact estimé |
|----------|--------|----------------|
| ~~Haute~~ | ~~Mettre en cache la requête **user_roles**~~ — **Fait** (voir § 3.1). | Réduction nette de la charge DB et de la latence par requête. |
| Haute | Remplacer le store de session MySQL par **Redis** en production. | Moins de charge MySQL, latence session plus faible. |
| Haute | Remplacer les boucles d’INSERT/UPDATE en caisse par des **batch** (INSERT multiple, mise à jour stock groupée). | Forte réduction du nombre de requêtes pour paniers et validation. |
| ~~Moyenne~~ | ~~Supprimer le second express.json()~~ — **Fait** (§ 3.4). | Code plus clair, pas de double parsing. |
| ~~Moyenne~~ | ~~Réduire logs HTTP en production~~ — **Fait** (§ 3.5) : 4xx/5xx uniquement. | Moins d’I/O disque et de CPU. |
| ~~Basse~~ | ~~Ajuster limites body~~ — **Fait** (§ 3.6) : 5 MB JSON et 5 MB urlencoded. | Limitation des abus et de la consommation mémoire. |
| Basse | Vérifier avec `EXPLAIN` les requêtes lentes (dashboard, historique, catalogues). | S’assurer que les index sont bien utilisés. |

---

## 6. Métriques à suivre

Pour valider les gains et détecter les régressions :

- **Temps de réponse** par route (P50, P95, P99) – le `httpLogger` donne déjà la durée par requête.
- **Nombre de requêtes SQL par requête HTTP** (middleware + route) – possible avec un wrapper autour de `db.query` en dev/staging.
- **Utilisation du pool MySQL** : connexions actives, en attente, timeouts.
- **Taille des réponses** (HTML/JSON) pour les pages lourdes (dashboard, listes).

---

*Document généré à partir de l’analyse du code (app.js, config, middleware, routes caisse/home/admin, bandeaux-cache, rbac.middleware).*
