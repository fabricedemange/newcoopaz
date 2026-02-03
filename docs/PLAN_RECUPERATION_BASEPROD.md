# Plan de récupération des données depuis baseprod (ancien modèle)

## Contexte

- **Base source** : `baseprod` (ou `baserpod` si c’est le nom exact sur votre machine).  
  Elle a servi à l’import des données de l’ancien modèle vers le nouveau (`coopazfr_commandes`).
- **Données à récupérer** : catalogues, articles des catalogues, paniers, et **commandes** (qui sont des paniers soumis).

## Schéma dans baseprod

D’après les scripts d’import (`migrations/import_baseprod.sql`, `migrations/import_paniers_baseprod.sql`), la base source contient :

| Table            | Rôle |
|------------------|------|
| `catalog_files`  | Catalogues (fichiers, métadonnées, dates, organisation) |
| `articles`       | Articles des catalogues (produit, prix, unité, lien catalogue) |
| `paniers`        | Paniers utilisateur (user, catalogue, date, **is_submitted**, note) |
| `panier_articles`| Lignes de panier (panier_id, article_id, quantity, note) |

Il n’y a **pas** de table `commandes` séparée. Les **commandes** correspondent aux **paniers avec `is_submitted = 1`**.

## Plan en 5 étapes

### 1. Vérifier le nom et l’accès à la base source

- Nom exact de la base : `baseprod` ou `baserpod` (à confirmer en local).
- Vérifier que vous pouvez vous connecter avec les mêmes identifiants que la base actuelle (même `DB_HOST`, `DB_USER`, `DB_PASS`), en changeant seulement le nom de la base.

### 2. Récupérer les catalogues

- **Table** : `catalog_files`
- **Requête** :  
  `SELECT * FROM baseprod.catalog_files;`  
  (remplacer `baseprod` par `baserpod` si nécessaire)
- **Colonnes utiles** (alignées sur l’import) :  
  id, filename, originalname, upload_date, expiration_date, uploader_id, description, is_archived, date_livraison, organization_id, referent_order_reminder_enabled, referent_order_reminder_sent_at

### 3. Récupérer les articles des catalogues

- **Table** : `articles`
- **Requête** :  
  `SELECT * FROM baseprod.articles;`
- **Colonnes** : id, catalog_file_id, produit, description, prix, unite, image_filename

### 4. Récupérer les paniers

- **Table** : `paniers`
- **Requête** :  
  `SELECT * FROM baseprod.paniers;`
- **Colonnes** : id, user_id, catalog_file_id, created_at, is_submitted, note  
- Pour n’avoir que les **commandes** :  
  `SELECT * FROM baseprod.paniers WHERE is_submitted = 1;`

### 5. Récupérer les lignes de panier (et donc de commandes)

- **Table** : `panier_articles`
- **Requête** :  
  `SELECT * FROM baseprod.panier_articles;`
- **Colonnes** : id, panier_id, article_id, quantity, note

## Si la base cible a déjà des données

Comportement des scripts d’import (`migrations/import_baseprod.sql` et `import_paniers_baseprod.sql`) :

### `import_baseprod.sql`

- **Étape 1** : le script **vide d’abord** les 4 tables cibles dans la base cible :
  - `panier_articles`
  - `paniers`
  - `articles`
  - `catalog_files`
- Donc **toutes les données déjà présentes dans ces tables sont supprimées** (TRUNCATE), puis remplacées par l’import depuis baseprod.
- **Conséquence** : si vous lancez ce script sur une base cible qui contient déjà des catalogues, articles ou paniers, ces données sont **perdues**. À faire uniquement sur une base vide de ces tables, ou après une sauvegarde.

### `import_paniers_baseprod.sql`

- Ce script **ne vide pas** les tables. Il fait des `INSERT` directs dans `paniers` et `panier_articles`.
- S’il est exécuté **après** `import_baseprod.sql`, il n’y a pas de conflit (les tables viennent d’être remplies par le premier script).
- S’il est exécuté **seul** alors que la cible a déjà des données :
  - **Conflits de clés primaires** : erreurs « Duplicate entry » si les `id` de baseprod existent déjà en cible.
  - **Incohérences possibles** : des `panier_articles` pourraient référencer des `article_id` ou `panier_id` qui ne correspondent pas aux données déjà en cible.

### Recommandation

- Avant tout import vers la base cible : **faire une sauvegarde** (dump MySQL).
- Si vous voulez **fusionner** des données (garder l’existant et ajouter baseprod), les scripts actuels ne le permettent pas ; il faudrait une variante qui n’utilise pas TRUNCATE et qui gère les IDs (par ex. réattribution ou INSERT en évitant les doublons).

## Format de sortie

- **Option A** : Exporter en **CSV** (un fichier par table) pour lecture dans Excel / LibreOffice.
- **Option B** : Exporter en **JSON** pour réutilisation dans un script ou une autre appli.
- **Option C** : Réexécuter les scripts d’import existants si le but est de **réimporter** tout vers `coopazfr_commandes` (en s’assurant que la base cible est sauvegardée avant).

## Script fourni

Le script **`scripts/export-baseprod.js`** :

- Se connecte à la base source dont le nom est donné par la variable d’environnement **`DB_SOURCE_NAME`** (ex. `baseprod` ou `baserpod`).
- Utilise `DB_HOST`, `DB_USER`, `DB_PASS` comme pour la base actuelle.
- Exporte les 4 tables ci‑dessus en CSV (et éventuellement JSON) dans **`data/export-baseprod/`**.

**Utilisation** :

```bash
# Dans .env, ajouter (en plus de DB_HOST, DB_USER, DB_PASS, DB_NAME) :
# DB_SOURCE_NAME=baseprod
# ou DB_SOURCE_NAME=baserpod

node scripts/export-baseprod.js
```

En résumé : **catalogues** = `catalog_files`, **paniers** = `paniers` + `panier_articles`, **commandes** = mêmes tables avec `paniers.is_submitted = 1`. Le plan et le script permettent de tout récupérer et de choisir le format (CSV/JSON) ou de réimporter via les migrations existantes.

## Backup avant import ou migration

Avant tout import ou migration, faire un **backup complet** (base + projet) :

```bash
node scripts/backup-complet.js
```

- **Base** : `backups/<DB_NAME>_YYYYMMDD_HHMMSS.sql` (mysqldump)
- **Projet** : `backups/project_YYYYMMDD_HHMMSS.tar.gz` (git archive ou tar)

Variables d’environnement : `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` (pour la base).

## Import « option complète » (nouveau modèle uniquement)

Le script **`scripts/run-import-baseprod.js`** exécute par défaut l’**option complète** :

- **N’écrit que** dans : `catalog_files`, `products`, `catalog_products`, `paniers`, `panier_articles`.
- **Ne touche pas** à la table `articles`. Les `panier_articles` sont créés avec `catalog_product_id` (mapping `article_id` baseprod → `catalog_product_id` cible).
- **Dédoublonnage** des produits (même nom + description = un seul `product` par organisation).
- **Catégorisation** automatique (Boulangerie, Fromagerie, etc.) selon le nom du produit.
- **Catégories / fournisseurs** par défaut (« Autres », « Fournisseur général ») créés si besoin par organisation.

**Utilisation** :

```bash
node scripts/run-import-baseprod.js
```

Après cet import, le code applicatif n’a pas besoin de fallback sur `articles` / `article_id` : tout passe par `catalog_products` et `panier_articles.catalog_product_id`.

Pour l’**ancien import** (catalog_files + articles + paniers + panier_articles avec article_id) :

```bash
USE_LEGACY_IMPORT=1 node scripts/run-import-baseprod.js
```

Voir aussi **`scripts/run-import-baseprod-complet.js`** (logique détaillée) et **`scripts/run-import-baseprod-legacy.js`** (ancien flux SQL).
