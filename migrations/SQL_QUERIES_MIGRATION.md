# Guide de Migration des Requêtes SQL

## Requêtes à Remplacer

### 1. Affichage des produits d'un catalogue

**AVANT (articles):**
```sql
SELECT id, catalog_file_id, produit, description, prix, unite, image_filename
FROM articles
WHERE catalog_file_id = ?
ORDER BY produit
```

**APRÈS (catalog_products + products):**
```sql
SELECT
  cp.id,
  cp.catalog_file_id,
  cp.product_id,
  cp.prix,
  cp.unite,
  p.nom as produit,
  p.description,
  p.image as image_filename,
  c.nom as categorie,
  c.couleur as categorie_couleur,
  s.nom as fournisseur
FROM catalog_products cp
INNER JOIN products p ON cp.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE cp.catalog_file_id = ?
ORDER BY c.ordre, p.nom
```

### 2. Synthèse des commandes par produit

**AVANT:**
```sql
SELECT
  a.produit,
  a.description,
  a.prix,
  COALESCE(NULLIF(pa.note, ''), '') AS note_article,
  SUM(pa.quantity) AS total_commande
FROM articles a
JOIN panier_articles pa ON pa.article_id = a.id
JOIN paniers p ON pa.panier_id = p.id
WHERE a.catalog_file_id = ? AND p.is_submitted = 1
GROUP BY a.id, pa.note
ORDER BY a.produit
```

**APRÈS:**
```sql
SELECT
  p.nom as produit,
  p.description,
  cp.prix,
  COALESCE(NULLIF(pa.note, ''), '') AS note_article,
  SUM(pa.quantity) AS total_commande,
  c.nom as categorie,
  c.couleur as categorie_couleur
FROM catalog_products cp
INNER JOIN products p ON cp.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
JOIN panier_articles pa ON pa.catalog_product_id = cp.id
JOIN paniers pan ON pa.panier_id = pan.id
WHERE cp.catalog_file_id = ? AND pan.is_submitted = 1
GROUP BY cp.id, pa.note
ORDER BY c.ordre, p.nom
```

### 3. Détails des commandes par utilisateur

**AVANT:**
```sql
SELECT
  u.username,
  a.produit,
  pa.quantity,
  a.prix,
  pa.note
FROM paniers c
JOIN panier_articles pa ON pa.panier_id = c.id
JOIN articles a ON pa.article_id = a.id
JOIN users u ON c.user_id = u.id
WHERE a.catalog_file_id = ? AND c.is_submitted = 1
ORDER BY u.username, a.produit
```

**APRÈS:**
```sql
SELECT
  u.username,
  p.nom as produit,
  pa.quantity,
  cp.prix,
  pa.note,
  c.nom as categorie
FROM paniers pan
JOIN panier_articles pa ON pa.panier_id = pan.id
JOIN catalog_products cp ON pa.catalog_product_id = cp.id
JOIN products p ON cp.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
JOIN users u ON pan.user_id = u.id
WHERE cp.catalog_file_id = ? AND pan.is_submitted = 1
ORDER BY u.username, c.ordre, p.nom
```

### 4. Ajouter un produit à un catalogue (NOUVEAU)

**AVANT (insérer un article):**
```sql
INSERT INTO articles (catalog_file_id, produit, description, prix, unite)
VALUES (?, ?, ?, ?, ?)
```

**APRÈS (lier un produit existant):**
```sql
INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite)
VALUES (?, ?, ?, ?)
```

### 5. Modifier un article dans un catalogue

**AVANT:**
```sql
UPDATE articles
SET produit = ?, description = ?, prix = ?, unite = ?
WHERE id = ? AND catalog_file_id = ?
```

**APRÈS (modifier seulement prix/unité):**
```sql
UPDATE catalog_products
SET prix = ?, unite = ?
WHERE id = ? AND catalog_file_id = ?
```

**Note:** Le nom et la description ne se modifient plus au niveau du catalogue, mais au niveau du produit global.

### 6. Supprimer un article d'un catalogue

**AVANT:**
```sql
DELETE FROM articles
WHERE id = ? AND catalog_file_id = ?
```

**APRÈS:**
```sql
DELETE FROM catalog_products
WHERE id = ? AND catalog_file_id = ?
```

### 7. Dupliquer un catalogue

**AVANT:**
```sql
-- Récupérer les articles
SELECT id, produit, description, prix, unite, image_filename
FROM articles
WHERE catalog_file_id = ?

-- Insérer les copies
INSERT INTO articles (catalog_file_id, produit, description, prix, unite, image_filename)
VALUES (?, ?, ?, ?, ?, NULL)
```

**APRÈS:**
```sql
-- Récupérer les liaisons produits
SELECT id, product_id, prix, unite
FROM catalog_products
WHERE catalog_file_id = ?

-- Insérer les nouvelles liaisons (pas besoin de copier images)
INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite)
VALUES (?, ?, ?, ?)
```

### 8. Vérifier si un produit existe dans panier_articles

**AVANT:**
```sql
SELECT * FROM panier_articles
WHERE panier_id = ? AND article_id = ?
```

**APRÈS:**
```sql
SELECT * FROM panier_articles
WHERE panier_id = ? AND catalog_product_id = ?
```

### 9. Ajouter/Modifier dans le panier

**AVANT:**
```sql
INSERT INTO panier_articles (panier_id, article_id, quantity, note)
VALUES (?, ?, ?, ?)

UPDATE panier_articles
SET quantity = ?, note = ?
WHERE panier_id = ? AND article_id = ?
```

**APRÈS:**
```sql
INSERT INTO panier_articles (panier_id, catalog_product_id, quantity, note)
VALUES (?, ?, ?, ?)

UPDATE panier_articles
SET quantity = ?, note = ?
WHERE panier_id = ? AND catalog_product_id = ?
```

### 10. Upload d'image

**AVANT:**
```sql
SELECT a.image_filename, c.organization_id
FROM articles a
JOIN catalog_files c ON c.id = a.catalog_file_id
WHERE a.id = ? AND a.catalog_file_id = ?

UPDATE articles
SET image_filename = ?
WHERE id = ? AND catalog_file_id = ?
```

**APRÈS:**
```sql
SELECT cp.id, p.image, c.organization_id
FROM catalog_products cp
JOIN products p ON cp.product_id = p.id
JOIN catalog_files c ON c.id = cp.catalog_file_id
WHERE cp.id = ? AND cp.catalog_file_id = ?

UPDATE products
SET image = ?
WHERE id = ?
```

**IMPORTANT:** L'image est maintenant stockée au niveau du produit, pas du catalogue_product !

## Changements de Noms de Colonnes

| Ancienne colonne (articles) | Nouvelle colonne (products/catalog_products) |
|------------------------------|----------------------------------------------|
| `articles.id` | `catalog_products.id` |
| `articles.produit` | `products.nom` |
| `articles.description` | `products.description` |
| `articles.prix` | `catalog_products.prix` (peut varier par catalogue) |
| `articles.unite` | `catalog_products.unite` |
| `articles.image_filename` | `products.image` (au niveau produit) |
| `panier_articles.article_id` | `panier_articles.catalog_product_id` |

## Nouveaux Champs Disponibles

Grâce à la nouvelle structure, vous avez accès à:
- `categories.nom` - Nom de la catégorie
- `categories.couleur` - Couleur du badge
- `categories.icon` - Icône Bootstrap
- `suppliers.nom` - Nom du fournisseur
- `products.origine` - Origine géographique
- `products.label` - Labels (Bio, AOP, etc.)
- `products.allergenes` - Allergènes
- `products.code_ean` - Code-barres
- `products.dlc_jours` - DLC en jours

## Impact sur les Routes

### Routes à modifier complètement:
1. `POST /admin/catalogues/:id/articles/add` - Ne crée plus d'article, mais lie un produit existant
2. `GET /admin/catalogues/:id/articles/:article_id/edit` - Édite seulement prix/unité
3. `POST /admin/catalogues/:id/articles/:article_id/update` - Idem
4. `POST /admin/catalogues/:id/articles/:article_id/delete` - Supprime la liaison, pas le produit

### Nouvelles routes à créer:
1. `GET /admin/products/search` - Recherche de produits pour ajout au catalogue ✅ (déjà créée)
2. `POST /admin/catalogues/:id/products/add` - Ajouter un produit existant au catalogue
3. Interface de sélection de produits dans le formulaire d'édition de catalogue
