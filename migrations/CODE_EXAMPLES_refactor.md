# Exemples de Code - Refactorisation Produits

## 📚 Exemples de modifications de code

Ce document présente les principaux patterns de code à modifier après la migration.

---

## 1. Afficher les articles d'un catalogue

### ❌ AVANT (utilise `articles`)

```javascript
router.get("/catalogues/:id/edit", requireReferent, (req, res) => {
  db.query(
    "SELECT id, catalog_file_id, produit, description, prix, unite, image_filename FROM articles WHERE catalog_file_id = ? ORDER BY produit",
    [req.params.id],
    (err, articles) => {
      renderAdminView(res, "admin_catalogue_edit_form", {
        catalogue: req.catalog,
        articles,
      });
    }
  );
});
```

### ✅ APRÈS (utilise `catalog_products` + `products`)

```javascript
router.get("/catalogues/:id/edit", requireReferent, (req, res) => {
  db.query(`
    SELECT
      cp.id,
      cp.catalog_file_id,
      cp.prix,
      cp.unite,
      cp.ordre,
      p.id as product_id,
      p.nom as produit,
      p.description,
      p.image_filename
    FROM catalog_products cp
    INNER JOIN products p ON cp.product_id = p.id
    WHERE cp.catalog_file_id = ?
    ORDER BY cp.ordre, p.nom
  `, [req.params.id], (err, articles) => {
    renderAdminView(res, "admin_catalogue_edit_form", {
      catalogue: req.catalog,
      articles,
    });
  });
});
```

**Notes:**
- `cp.id` est maintenant l'identifiant de la liaison (catalog_product_id)
- `p.id` est l'identifiant du produit (product_id)
- L'ordre d'affichage peut se faire sur `cp.ordre` ou sur `p.nom`

---

## 2. Ajouter un article au panier

### ❌ AVANT

```javascript
router.post("/panier/:panier_id/ajouter", (req, res) => {
  const { article_id, quantity } = req.body;

  db.query(
    "INSERT INTO panier_articles (panier_id, article_id, quantity) VALUES (?, ?, ?)",
    [req.params.panier_id, article_id, quantity],
    (err) => {
      if (err) return res.status(500).send("Erreur");
      res.redirect(`/panier/${req.params.panier_id}`);
    }
  );
});
```

### ✅ APRÈS

```javascript
router.post("/panier/:panier_id/ajouter", (req, res) => {
  const { catalog_product_id, quantity } = req.body;

  db.query(
    "INSERT INTO panier_articles (panier_id, catalog_product_id, quantity) VALUES (?, ?, ?)",
    [req.params.panier_id, catalog_product_id, quantity],
    (err) => {
      if (err) return res.status(500).send("Erreur");
      res.redirect(`/panier/${req.params.panier_id}`);
    }
  );
});
```

**Changement:** `article_id` → `catalog_product_id`

---

## 3. Afficher le contenu d'un panier

### ❌ AVANT

```javascript
router.get("/panier/:id", (req, res) => {
  db.query(`
    SELECT
      pa.id,
      pa.quantity,
      pa.note,
      a.produit,
      a.description,
      a.prix,
      a.unite,
      a.image_filename
    FROM panier_articles pa
    INNER JOIN articles a ON pa.article_id = a.id
    WHERE pa.panier_id = ?
  `, [req.params.id], (err, items) => {
    res.render("panier_view", { items });
  });
});
```

### ✅ APRÈS

```javascript
router.get("/panier/:id", (req, res) => {
  db.query(`
    SELECT
      pa.id,
      pa.quantity,
      pa.note,
      p.nom as produit,
      p.description,
      cp.prix,
      cp.unite,
      p.image_filename,
      cp.catalog_file_id
    FROM panier_articles pa
    INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
    INNER JOIN products p ON cp.product_id = p.id
    WHERE pa.panier_id = ?
  `, [req.params.id], (err, items) => {
    res.render("panier_view", { items });
  });
});
```

**Note:** Maintenant un double JOIN (panier_articles → catalog_products → products)

---

## 4. Dupliquer un catalogue

### ❌ AVANT (duplique tous les articles)

```javascript
router.post("/catalogues/:id/duplicate", (req, res) => {
  const catalogueId = req.params.id;

  // Créer le nouveau catalogue
  db.query(
    "INSERT INTO catalog_files (filename, originalname, ...) SELECT ...",
    (err, result) => {
      const newCatalogId = result.insertId;

      // Dupliquer TOUS les articles
      db.query(`
        INSERT INTO articles (catalog_file_id, produit, description, prix, unite, image_filename)
        SELECT ?, produit, description, prix, unite, image_filename
        FROM articles
        WHERE catalog_file_id = ?
      `, [newCatalogId, catalogueId], (err) => {
        res.redirect(`/admin/catalogues/${newCatalogId}/edit`);
      });
    }
  );
});
```

### ✅ APRÈS (duplique seulement les liaisons)

```javascript
router.post("/catalogues/:id/duplicate", (req, res) => {
  const catalogueId = req.params.id;

  // Créer le nouveau catalogue
  db.query(
    "INSERT INTO catalog_files (filename, originalname, ...) SELECT ...",
    (err, result) => {
      const newCatalogId = result.insertId;

      // Dupliquer SEULEMENT les liaisons (les produits existent déjà!)
      db.query(`
        INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite, ordre)
        SELECT ?, product_id, prix, unite, ordre
        FROM catalog_products
        WHERE catalog_file_id = ?
      `, [newCatalogId, catalogueId], (err) => {
        res.redirect(`/admin/catalogues/${newCatalogId}/edit`);
      });
    }
  );
});
```

**Avantage:** Beaucoup plus rapide ! On ne copie que 211 lignes au lieu de recréer 1036 articles.

---

## 5. Ajouter un nouvel article à un catalogue

### ❌ AVANT (crée un nouvel article)

```javascript
router.post("/catalogues/:id/articles/new", (req, res) => {
  const { produit, description, prix, unite } = req.body;

  db.query(
    "INSERT INTO articles (catalog_file_id, produit, description, prix, unite) VALUES (?, ?, ?, ?, ?)",
    [req.params.id, produit, description, prix, unite],
    (err) => {
      res.redirect(`/admin/catalogues/${req.params.id}/edit`);
    }
  );
});
```

### ✅ APRÈS (2 options)

#### Option A: Créer un NOUVEAU produit et l'ajouter au catalogue

```javascript
router.post("/catalogues/:id/articles/new", (req, res) => {
  const { produit, description, prix, unite } = req.body;
  const catalogueId = req.params.id;
  const orgId = getCurrentOrgId(req);

  // 1. Créer le produit dans la bibliothèque
  db.query(
    "INSERT INTO products (organization_id, nom, description) VALUES (?, ?, ?)",
    [orgId, produit, description],
    (err, result) => {
      const productId = result.insertId;

      // 2. Lier le produit au catalogue avec son prix
      db.query(
        "INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite) VALUES (?, ?, ?, ?)",
        [catalogueId, productId, prix, unite],
        (err) => {
          res.redirect(`/admin/catalogues/${catalogueId}/edit`);
        }
      );
    }
  );
});
```

#### Option B: Ajouter un produit EXISTANT au catalogue

```javascript
router.post("/catalogues/:id/articles/add-existing", (req, res) => {
  const { product_id, prix, unite } = req.body;
  const catalogueId = req.params.id;

  // Vérifier que le produit appartient à la même organisation
  db.query(`
    SELECT p.id FROM products p
    INNER JOIN catalog_files cf ON cf.organization_id = p.organization_id
    WHERE p.id = ? AND cf.id = ?
  `, [product_id, catalogueId], (err, rows) => {
    if (!rows || rows.length === 0) {
      return res.status(403).send("Produit non autorisé");
    }

    // Ajouter le produit au catalogue
    db.query(
      "INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite) VALUES (?, ?, ?, ?)",
      [catalogueId, product_id, prix, unite],
      (err) => {
        res.redirect(`/admin/catalogues/${catalogueId}/edit`);
      }
    );
  });
});
```

**Note:** L'option B est une NOUVELLE fonctionnalité permise par la refactorisation!

---

## 6. Modifier un article d'un catalogue

### ❌ AVANT (modifie l'article directement)

```javascript
router.post("/catalogues/:cat_id/articles/:article_id/edit", (req, res) => {
  const { produit, description, prix, unite } = req.body;

  db.query(
    "UPDATE articles SET produit = ?, description = ?, prix = ?, unite = ? WHERE id = ?",
    [produit, description, prix, unite, req.params.article_id],
    (err) => {
      res.redirect(`/admin/catalogues/${req.params.cat_id}/edit`);
    }
  );
});
```

### ✅ APRÈS (2 updates: produit + liaison)

```javascript
router.post("/catalogues/:cat_id/articles/:catalog_product_id/edit", (req, res) => {
  const { produit, description, prix, unite, update_global } = req.body;
  const cpId = req.params.catalog_product_id;

  // 1. Récupérer le product_id
  db.query(
    "SELECT product_id FROM catalog_products WHERE id = ?",
    [cpId],
    (err, rows) => {
      const productId = rows[0].product_id;

      if (update_global) {
        // Option A: Mettre à jour le produit pour TOUS les catalogues
        db.query(
          "UPDATE products SET nom = ?, description = ? WHERE id = ?",
          [produit, description, productId],
          (err) => {
            // Puis mettre à jour le prix pour CE catalogue
            db.query(
              "UPDATE catalog_products SET prix = ?, unite = ? WHERE id = ?",
              [prix, unite, cpId],
              (err) => {
                res.redirect(`/admin/catalogues/${req.params.cat_id}/edit`);
              }
            );
          }
        );
      } else {
        // Option B: Mettre à jour SEULEMENT le prix/unité pour ce catalogue
        db.query(
          "UPDATE catalog_products SET prix = ?, unite = ? WHERE id = ?",
          [prix, unite, cpId],
          (err) => {
            res.redirect(`/admin/catalogues/${req.params.cat_id}/edit`);
          }
        );
      }
    }
  );
});
```

**IMPORTANT:** Maintenant il faut demander à l'utilisateur s'il veut:
- Modifier le produit globalement (tous les catalogues)
- OU modifier seulement le prix/unité pour ce catalogue

---

## 7. Upload d'image d'article

### ❌ AVANT

```javascript
router.post("/catalogues/:cat_id/articles/:article_id/image", upload, (req, res) => {
  const articleId = req.params.article_id;
  const imagePath = processImage(req.file);

  db.query(
    "UPDATE articles SET image_filename = ? WHERE id = ?",
    [imagePath, articleId],
    (err) => {
      res.redirect(`/admin/catalogues/${req.params.cat_id}/edit`);
    }
  );
});
```

### ✅ APRÈS

```javascript
router.post("/catalogues/:cat_id/articles/:catalog_product_id/image", upload, (req, res) => {
  const cpId = req.params.catalog_product_id;
  const imagePath = processImage(req.file);

  // Récupérer le product_id
  db.query(
    "SELECT product_id FROM catalog_products WHERE id = ?",
    [cpId],
    (err, rows) => {
      const productId = rows[0].product_id;

      // Mettre à jour l'image du PRODUIT (pas de la liaison)
      // Cela met à jour l'image dans TOUS les catalogues
      db.query(
        "UPDATE products SET image_filename = ? WHERE id = ?",
        [imagePath, productId],
        (err) => {
          res.redirect(`/admin/catalogues/${req.params.cat_id}/edit`);
        }
      );
    }
  );
});
```

**Note:** L'image est maintenant au niveau du produit, donc elle est partagée entre tous les catalogues.

---

## 8. Rechercher des produits (NOUVELLE FONCTIONNALITÉ)

### ✅ Nouveau endpoint pour chercher dans la bibliothèque de produits

```javascript
// Rechercher des produits disponibles pour les ajouter au catalogue
router.get("/products/search", requireReferent, (req, res) => {
  const { q, catalog_id } = req.query;
  const orgId = getCurrentOrgId(req);

  db.query(`
    SELECT
      p.id,
      p.nom,
      p.description,
      p.image_filename,
      -- Vérifier si déjà dans le catalogue
      CASE WHEN cp.id IS NOT NULL THEN 1 ELSE 0 END as deja_dans_catalogue,
      -- Prix du dernier catalogue où il a été utilisé
      (SELECT cp2.prix FROM catalog_products cp2
       WHERE cp2.product_id = p.id
       ORDER BY cp2.created_at DESC LIMIT 1) as dernier_prix
    FROM products p
    LEFT JOIN catalog_products cp ON (cp.product_id = p.id AND cp.catalog_file_id = ?)
    WHERE p.organization_id = ?
      AND (p.nom LIKE ? OR p.description LIKE ?)
    ORDER BY p.nom
    LIMIT 20
  `, [catalog_id, orgId, `%${q}%`, `%${q}%`], (err, products) => {
    res.json(products);
  });
});
```

**Utilité:** Permet de chercher dans la bibliothèque et d'ajouter des produits existants.

---

## 9. Vue EJS - Affichage des articles

### ❌ AVANT

```html
<% articles.forEach(article => { %>
  <tr>
    <td><%= article.produit %></td>
    <td><%= article.prix %> €</td>
    <td>
      <a href="/admin/catalogues/<%= catalogue.id %>/articles/<%= article.id %>/edit">
        Modifier
      </a>
    </td>
  </tr>
<% }); %>
```

### ✅ APRÈS

```html
<% articles.forEach(article => { %>
  <tr>
    <td>
      <%= article.produit %>
      <% if (article.product_id) { %>
        <span class="badge bg-info" title="Produit réutilisable ID <%= article.product_id %>">
          <i class="bi bi-recycle"></i>
        </span>
      <% } %>
    </td>
    <td><%= article.prix %> €</td>
    <td>
      <!-- Maintenant on utilise catalog_product_id au lieu de article.id -->
      <a href="/admin/catalogues/<%= catalogue.id %>/articles/<%= article.id %>/edit">
        Modifier prix
      </a>
      <a href="/admin/products/<%= article.product_id %>/edit">
        Modifier produit
      </a>
    </td>
  </tr>
<% }); %>
```

**Note:** On peut maintenant distinguer "modifier le prix" vs "modifier le produit global".

---

## 10. Export de commandes

### ❌ AVANT

```javascript
router.get("/commandes/export", (req, res) => {
  db.query(`
    SELECT
      u.username,
      a.produit,
      pa.quantity,
      a.prix,
      (pa.quantity * a.prix) as total
    FROM panier_articles pa
    INNER JOIN articles a ON pa.article_id = a.id
    INNER JOIN paniers p ON pa.panier_id = p.id
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.is_submitted = 1
  `, (err, rows) => {
    exportToExcel(rows, res);
  });
});
```

### ✅ APRÈS

```javascript
router.get("/commandes/export", (req, res) => {
  db.query(`
    SELECT
      u.username,
      prod.nom as produit,
      pa.quantity,
      cp.prix,
      (pa.quantity * cp.prix) as total
    FROM panier_articles pa
    INNER JOIN catalog_products cp ON pa.catalog_product_id = cp.id
    INNER JOIN products prod ON cp.product_id = prod.id
    INNER JOIN paniers p ON pa.panier_id = p.id
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.is_submitted = 1
  `, (err, rows) => {
    exportToExcel(rows, res);
  });
});
```

---

## 📋 Récapitulatif des changements

| Changement | Avant | Après |
|------------|-------|-------|
| **Table principale** | `articles` | `catalog_products` + `products` |
| **ID dans formulaires** | `article_id` | `catalog_product_id` |
| **Nom du produit** | `articles.produit` | `products.nom` |
| **Prix** | `articles.prix` | `catalog_products.prix` |
| **Image** | `articles.image_filename` | `products.image_filename` |
| **Duplication** | Copie tous les articles | Copie seulement les liaisons |
| **Modification** | Modifie 1 article | Modifie le produit OU le prix |

---

## ⚠️ Points d'attention

1. **Double JOIN** : Maintenant presque toutes les requêtes nécessitent un JOIN entre `catalog_products` et `products`

2. **IDs différents** :
   - `catalog_products.id` = identifiant de la liaison (utilisé dans panier_articles)
   - `products.id` = identifiant du produit global

3. **Modification d'images** : Modifier l'image d'un produit l'impacte dans TOUS les catalogues

4. **Prix** : Le prix est dans `catalog_products`, donc spécifique au catalogue

5. **Ordre d'affichage** : Utiliser `catalog_products.ordre` pour l'ordre dans le catalogue

6. **Isolation** : Vérifier `products.organization_id` pour la sécurité

---

## 🎯 Prochaines étapes recommandées

1. **Interface de gestion de produits** (`/admin/products`)
   - Liste de tous les produits de l'organisation
   - Recherche/filtre
   - CRUD complet

2. **Amélioration de l'ajout au catalogue**
   - Sélecteur de produits existants
   - Création de nouveau produit
   - Prix suggéré (dernier prix utilisé)

3. **Statistiques produits**
   - Produits les plus commandés
   - Évolution des prix
   - Produits jamais commandés

4. **Import/Export de produits**
   - Importer une bibliothèque de produits
   - Exporter pour partage (entre sites)
