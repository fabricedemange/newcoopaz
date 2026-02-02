# 🎨 Interfaces Utilisateur à Créer - Post-Migration

## 📋 Vue d'ensemble

Après la migration, plusieurs interfaces doivent être créées pour gérer les fournisseurs, catégories et utiliser ces nouvelles fonctionnalités.

---

## 🏢 1. Gestion des Fournisseurs

### `/admin/suppliers` - Liste des fournisseurs

**Fonctionnalités:**
- ✅ Liste tous les fournisseurs de l'organisation
- ✅ Recherche par nom
- ✅ Filtres: Actif/Inactif, Ville
- ✅ Actions: Voir, Modifier, Désactiver
- ✅ Bouton "Nouveau fournisseur"

**Colonnes du tableau:**
- Nom
- Contact
- Ville
- Email/Téléphone
- Nb de produits
- Statut (Actif/Inactif)
- Actions

**Exemple de requête:**
```javascript
router.get("/admin/suppliers", requireReferent, (req, res) => {
  const orgId = getCurrentOrgId(req);

  db.query(`
    SELECT
      s.*,
      COUNT(p.id) as nb_produits
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id
    WHERE s.organization_id = ?
    GROUP BY s.id
    ORDER BY s.nom
  `, [orgId], (err, suppliers) => {
    res.render("admin_suppliers_list", { suppliers });
  });
});
```

---

### `/admin/suppliers/new` - Nouveau fournisseur

**Formulaire:**
```html
<form method="POST" action="/admin/suppliers">
  <input type="text" name="nom" required placeholder="Nom du fournisseur">
  <input type="text" name="contact_nom" placeholder="Nom du contact">
  <input type="email" name="email" placeholder="Email">
  <input type="tel" name="telephone" placeholder="Téléphone">

  <textarea name="adresse" placeholder="Adresse"></textarea>
  <input type="text" name="code_postal" placeholder="Code postal">
  <input type="text" name="ville" placeholder="Ville">

  <input type="text" name="siret" placeholder="SIRET">
  <textarea name="notes" placeholder="Notes"></textarea>

  <label>
    <input type="checkbox" name="is_active" checked> Actif
  </label>

  <button type="submit">Créer le fournisseur</button>
</form>
```

**Route POST:**
```javascript
router.post("/admin/suppliers", requireReferent, (req, res) => {
  const { nom, contact_nom, email, telephone, adresse, code_postal, ville, siret, notes, is_active } = req.body;
  const orgId = getCurrentOrgId(req);

  db.query(`
    INSERT INTO suppliers (organization_id, nom, contact_nom, email, telephone, adresse, code_postal, ville, siret, notes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [orgId, nom, contact_nom, email, telephone, adresse, code_postal, ville, siret, notes, is_active ? 1 : 0], (err) => {
    res.redirect("/admin/suppliers");
  });
});
```

---

### `/admin/suppliers/:id/edit` - Modifier un fournisseur

Même formulaire que création, pré-rempli avec les données existantes.

---

### `/admin/suppliers/:id` - Détails d'un fournisseur

**Afficher:**
- Toutes les infos du fournisseur
- **Liste des produits** de ce fournisseur
- Statistiques (nb de produits, nb de catalogues utilisant ces produits)

**Requête:**
```javascript
router.get("/admin/suppliers/:id", requireReferent, (req, res) => {
  db.query("SELECT * FROM suppliers WHERE id = ?", [req.params.id], (err, suppliers) => {
    const supplier = suppliers[0];

    db.query(`
      SELECT p.*, c.nom as categorie
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.supplier_id = ?
    `, [req.params.id], (err, products) => {
      res.render("admin_supplier_detail", { supplier, products });
    });
  });
});
```

---

## 📂 2. Gestion des Catégories

### `/admin/categories` - Liste des catégories

**Affichage:**
- Arborescence (catégories principales + sous-catégories indentées)
- OU tableau avec colonne "Parent"
- Couleurs et icônes visibles
- Nb de produits par catégorie

**Exemple:**
```
📦 Boulangerie (45 produits) 🟤
  └─ 🍞 Pains (30 produits)
  └─ 🥐 Viennoiseries (10 produits)
  └─ 🍪 Biscuits (5 produits)
🧀 Fromagerie (52 produits) 🟡
  └─ Fromages à pâte dure (20 produits)
  └─ Fromages de chèvre (15 produits)
...
```

**Requête:**
```javascript
router.get("/admin/categories", requireReferent, (req, res) => {
  const orgId = getCurrentOrgId(req);

  db.query(`
    SELECT
      c.*,
      p.nom as parent_nom,
      COUNT(prod.id) as nb_produits
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
    LEFT JOIN products prod ON prod.category_id = c.id
    WHERE c.organization_id = ?
    GROUP BY c.id
    ORDER BY COALESCE(p.ordre, c.ordre), c.ordre
  `, [orgId], (err, categories) => {
    res.render("admin_categories_list", { categories });
  });
});
```

---

### `/admin/categories/new` - Nouvelle catégorie

**Formulaire:**
```html
<form method="POST" action="/admin/categories">
  <input type="text" name="nom" required placeholder="Nom de la catégorie">
  <textarea name="description" placeholder="Description"></textarea>

  <!-- Sélecteur de catégorie parente (optionnel) -->
  <select name="parent_id">
    <option value="">-- Catégorie principale --</option>
    <% categories.filter(c => !c.parent_id).forEach(cat => { %>
      <option value="<%= cat.id %>"><%= cat.nom %></option>
    <% }); %>
  </select>

  <input type="number" name="ordre" placeholder="Ordre d'affichage">
  <input type="color" name="couleur" placeholder="Couleur (ex: #FF0000)">
  <input type="text" name="icon" placeholder="Icône Bootstrap (ex: bi-cake2)">

  <label>
    <input type="checkbox" name="is_active" checked> Active
  </label>

  <button type="submit">Créer la catégorie</button>
</form>
```

---

### `/admin/categories/:id/edit` - Modifier une catégorie

Même formulaire, pré-rempli.

**⚠️ Important:** Ne pas permettre de mettre une catégorie comme parente d'elle-même (boucle infinie).

---

## 🛒 3. Gestion des Produits

### `/admin/products` - Liste des produits

**Fonctionnalités:**
- ✅ Liste tous les produits de l'organisation
- ✅ **Filtres:**
  - Par catégorie (dropdown)
  - Par fournisseur (dropdown)
  - Par label (Bio, AOP, etc.)
  - Actif/Inactif
- ✅ Recherche par nom
- ✅ Actions: Voir, Modifier, Désactiver

**Colonnes:**
- Image (miniature)
- Nom
- Catégorie (badge coloré)
- Fournisseur
- Label (Bio, AOP...)
- Nb catalogues utilisant ce produit
- Actions

**Exemple avec filtres:**
```javascript
router.get("/admin/products", requireReferent, (req, res) => {
  const orgId = getCurrentOrgId(req);
  const { category_id, supplier_id, label, search } = req.query;

  let sql = `
    SELECT
      p.*,
      c.nom as categorie,
      c.couleur as categorie_couleur,
      s.nom as fournisseur,
      COUNT(DISTINCT cp.catalog_file_id) as nb_catalogues
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN catalog_products cp ON cp.product_id = p.id
    WHERE p.organization_id = ?
  `;

  const params = [orgId];

  if (category_id) {
    sql += " AND p.category_id = ?";
    params.push(category_id);
  }

  if (supplier_id) {
    sql += " AND p.supplier_id = ?";
    params.push(supplier_id);
  }

  if (label) {
    sql += " AND p.label LIKE ?";
    params.push(`%${label}%`);
  }

  if (search) {
    sql += " AND (p.nom LIKE ? OR p.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " GROUP BY p.id ORDER BY p.nom";

  db.query(sql, params, (err, products) => {
    // Récupérer les catégories et fournisseurs pour les dropdowns
    db.query("SELECT * FROM categories WHERE organization_id = ? ORDER BY nom", [orgId], (e2, categories) => {
      db.query("SELECT * FROM suppliers WHERE organization_id = ? ORDER BY nom", [orgId], (e3, suppliers) => {
        res.render("admin_products_list", { products, categories, suppliers });
      });
    });
  });
});
```

---

### `/admin/products/new` - Nouveau produit

**Formulaire enrichi:**
```html
<form method="POST" action="/admin/products">
  <h3>Informations de base</h3>
  <input type="text" name="nom" required placeholder="Nom du produit">
  <textarea name="description" placeholder="Description"></textarea>

  <h3>Classification</h3>
  <!-- Sélecteur de catégorie -->
  <select name="category_id" required>
    <option value="">-- Choisir une catégorie --</option>
    <% categories.forEach(cat => { %>
      <option value="<%= cat.id %>" style="color: <%= cat.couleur %>">
        <%= cat.parent_id ? '└─ ' : '' %><%= cat.nom %>
      </option>
    <% }); %>
  </select>

  <!-- Sélecteur de fournisseur -->
  <select name="supplier_id">
    <option value="">-- Choisir un fournisseur (optionnel) --</option>
    <% suppliers.forEach(sup => { %>
      <option value="<%= sup.id %>"><%= sup.nom %></option>
    <% }); %>
  </select>

  <h3>Informations complémentaires</h3>
  <input type="text" name="reference_fournisseur" placeholder="Référence fournisseur">
  <input type="text" name="code_ean" placeholder="Code EAN/code-barres">
  <input type="text" name="conditionnement" placeholder="Conditionnement (ex: Par 6, Au kilo)">
  <input type="number" name="dlc_jours" placeholder="DLC en jours">

  <h3>Traçabilité</h3>
  <input type="text" name="origine" placeholder="Origine (ex: France - Jura)">
  <input type="text" name="label" placeholder="Label (ex: Bio, AOP, IGP)">
  <textarea name="allergenes" placeholder="Allergènes (un par ligne)"></textarea>

  <h3>Image</h3>
  <input type="file" name="image" accept="image/*">

  <label>
    <input type="checkbox" name="is_active" checked> Actif
  </label>

  <button type="submit">Créer le produit</button>
</form>
```

---

## 📝 4. Création/Édition de Catalogue

### Modifications dans `/admin/catalogues/:id/edit`

**Ajouter une section "Ajouter des produits existants":**

```html
<!-- Section: Ajouter un produit existant -->
<div class="card mb-4">
  <div class="card-header">
    <h5>Ajouter un produit existant au catalogue</h5>
  </div>
  <div class="card-body">
    <!-- Filtres -->
    <div class="row mb-3">
      <div class="col-md-4">
        <label>Catégorie</label>
        <select id="filter_category" class="form-select">
          <option value="">Toutes les catégories</option>
          <% categories.forEach(cat => { %>
            <option value="<%= cat.id %>"><%= cat.nom %></option>
          <% }); %>
        </select>
      </div>

      <div class="col-md-4">
        <label>Fournisseur</label>
        <select id="filter_supplier" class="form-select">
          <option value="">Tous les fournisseurs</option>
          <% suppliers.forEach(sup => { %>
            <option value="<%= sup.id %>"><%= sup.nom %></option>
          <% }); %>
        </select>
      </div>

      <div class="col-md-4">
        <label>Recherche</label>
        <input type="text" id="search_product" class="form-control" placeholder="Nom du produit...">
      </div>
    </div>

    <!-- Liste des produits disponibles -->
    <div id="products_list">
      <!-- Rempli dynamiquement via AJAX -->
    </div>
  </div>
</div>

<!-- Section: Produits du catalogue -->
<div class="card mb-4">
  <div class="card-header">
    <h5>Produits dans ce catalogue (<%= articles.length %>)</h5>
  </div>
  <div class="card-body">
    <table class="table">
      <thead>
        <tr>
          <th>Image</th>
          <th>Produit</th>
          <th>Catégorie</th>
          <th>Fournisseur</th>
          <th>Prix</th>
          <th>Unité</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <% articles.forEach(article => { %>
          <tr>
            <td>
              <% if (article.image_filename) { %>
                <img src="/uploads/catalogue-images/<%= article.image_filename %>"
                     style="width: 50px; height: 50px; object-fit: cover;">
              <% } %>
            </td>
            <td>
              <%= article.produit %>
              <% if (article.label) { %>
                <span class="badge bg-success"><%= article.label %></span>
              <% } %>
            </td>
            <td>
              <% if (article.categorie) { %>
                <span class="badge" style="background-color: <%= article.categorie_couleur %>">
                  <%= article.categorie %>
                </span>
              <% } %>
            </td>
            <td><%= article.fournisseur || '-' %></td>
            <td>
              <input type="number" step="0.01" value="<%= article.prix %>"
                     class="form-control form-control-sm"
                     data-catalog-product-id="<%= article.id %>">
            </td>
            <td>
              <input type="number" step="0.01" value="<%= article.unite %>"
                     class="form-control form-control-sm">
            </td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="removeFromCatalog(<%= article.id %>)">
                Retirer
              </button>
            </td>
          </tr>
        <% }); %>
      </tbody>
    </table>
  </div>
</div>

<script>
// Recherche de produits disponibles
function searchProducts() {
  const category = document.getElementById('filter_category').value;
  const supplier = document.getElementById('filter_supplier').value;
  const search = document.getElementById('search_product').value;

  fetch(`/admin/products/search?category_id=${category}&supplier_id=${supplier}&search=${search}&catalog_id=<%= catalogue.id %>`)
    .then(res => res.json())
    .then(products => {
      displayProducts(products);
    });
}

function displayProducts(products) {
  const html = products.map(p => `
    <div class="product-item ${p.deja_dans_catalogue ? 'disabled' : ''}">
      <img src="/uploads/catalogue-images/${p.image_filename || 'default.png'}" style="width: 50px;">
      <div>
        <strong>${p.nom}</strong>
        <span class="badge" style="background-color: ${p.categorie_couleur}">${p.categorie}</span>
        ${p.label ? '<span class="badge bg-success">' + p.label + '</span>' : ''}
        <br>
        <small>Fournisseur: ${p.fournisseur || '-'}</small>
        ${p.dernier_prix ? '<small>Dernier prix: ' + p.dernier_prix + ' €</small>' : ''}
      </div>
      <button class="btn btn-sm btn-primary"
              onclick="addToCatalog(${p.id}, ${p.dernier_prix || 0})"
              ${p.deja_dans_catalogue ? 'disabled' : ''}>
        ${p.deja_dans_catalogue ? 'Déjà ajouté' : 'Ajouter'}
      </button>
    </div>
  `).join('');

  document.getElementById('products_list').innerHTML = html;
}

function addToCatalog(productId, suggestedPrice) {
  const prix = prompt(`Prix pour ce produit dans ce catalogue:`, suggestedPrice);
  if (!prix) return;

  fetch(`/admin/catalogues/<%= catalogue.id %>/products/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, prix: parseFloat(prix), unite: 1 })
  }).then(() => {
    location.reload();
  });
}

// Recherche au changement de filtre
document.getElementById('filter_category').addEventListener('change', searchProducts);
document.getElementById('filter_supplier').addEventListener('change', searchProducts);
document.getElementById('search_product').addEventListener('input', searchProducts);

// Charger au démarrage
searchProducts();
</script>
```

---

### Routes API nécessaires

#### Recherche de produits
```javascript
router.get("/admin/products/search", requireReferent, (req, res) => {
  const { category_id, supplier_id, search, catalog_id } = req.query;
  const orgId = getCurrentOrgId(req);

  let sql = `
    SELECT
      p.*,
      c.nom as categorie,
      c.couleur as categorie_couleur,
      s.nom as fournisseur,
      CASE WHEN cp.id IS NOT NULL THEN 1 ELSE 0 END as deja_dans_catalogue,
      (SELECT cp2.prix FROM catalog_products cp2
       WHERE cp2.product_id = p.id
       ORDER BY cp2.created_at DESC LIMIT 1) as dernier_prix
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN catalog_products cp ON (cp.product_id = p.id AND cp.catalog_file_id = ?)
    WHERE p.organization_id = ? AND p.is_active = 1
  `;

  const params = [catalog_id, orgId];

  if (category_id) {
    sql += " AND p.category_id = ?";
    params.push(category_id);
  }

  if (supplier_id) {
    sql += " AND p.supplier_id = ?";
    params.push(supplier_id);
  }

  if (search) {
    sql += " AND (p.nom LIKE ? OR p.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY p.nom LIMIT 50";

  db.query(sql, params, (err, products) => {
    res.json(products);
  });
});
```

#### Ajouter un produit au catalogue
```javascript
router.post("/admin/catalogues/:id/products/add", requireReferent, (req, res) => {
  const catalogueId = req.params.id;
  const { product_id, prix, unite } = req.body;

  db.query(`
    INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite)
    VALUES (?, ?, ?, ?)
  `, [catalogueId, product_id, prix, unite || 1], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});
```

#### Retirer un produit du catalogue
```javascript
router.post("/admin/catalogues/:cat_id/products/:cp_id/remove", requireReferent, (req, res) => {
  const { cat_id, cp_id } = req.params;

  db.query(`
    DELETE FROM catalog_products
    WHERE id = ? AND catalog_file_id = ?
  `, [cp_id, cat_id], (err) => {
    res.redirect(`/admin/catalogues/${cat_id}/edit`);
  });
});
```

---

## 📊 5. Tableaux de Bord et Statistiques

### `/admin/dashboard` - Enrichir avec stats

**Ajouter des widgets:**

```html
<!-- Top fournisseurs -->
<div class="card">
  <div class="card-header">Top Fournisseurs</div>
  <div class="card-body">
    <% topSuppliers.forEach(sup => { %>
      <div class="d-flex justify-content-between">
        <span><%= sup.nom %></span>
        <span class="badge bg-primary"><%= sup.nb_produits %> produits</span>
      </div>
    <% }); %>
  </div>
</div>

<!-- Distribution par catégorie -->
<div class="card">
  <div class="card-header">Produits par catégorie</div>
  <div class="card-body">
    <canvas id="categoryChart"></canvas>
  </div>
</div>
```

---

## ✅ Checklist des Interfaces

### Fournisseurs
- [ ] `/admin/suppliers` - Liste
- [ ] `/admin/suppliers/new` - Création
- [ ] `/admin/suppliers/:id` - Détails
- [ ] `/admin/suppliers/:id/edit` - Édition
- [ ] `/admin/suppliers/:id/delete` - Suppression (soft delete)

### Catégories
- [ ] `/admin/categories` - Liste (arborescence)
- [ ] `/admin/categories/new` - Création
- [ ] `/admin/categories/:id/edit` - Édition
- [ ] `/admin/categories/:id/delete` - Suppression (avec vérif produits)

### Produits
- [ ] `/admin/products` - Liste avec filtres
- [ ] `/admin/products/new` - Création (avec sélecteurs)
- [ ] `/admin/products/:id` - Détails
- [ ] `/admin/products/:id/edit` - Édition
- [ ] `/admin/products/search` (API) - Recherche

### Catalogues (modifications)
- [ ] Ajouter section "Produits existants" dans `/admin/catalogues/:id/edit`
- [ ] Filtres par catégorie/fournisseur
- [ ] Affichage des badges catégorie/fournisseur
- [ ] API: `/admin/catalogues/:id/products/add`
- [ ] API: `/admin/catalogues/:id/products/:id/remove`

### Dashboard
- [ ] Widget "Top fournisseurs"
- [ ] Widget "Distribution par catégorie"
- [ ] Stats globales

---

## 🎨 Conseils UI/UX

### Badges colorés pour catégories
```html
<span class="badge" style="background-color: <%= categorie.couleur %>">
  <i class="<%= categorie.icon %>"></i> <%= categorie.nom %>
</span>
```

### Icônes Bootstrap recommandées
- `bi-cake2` - Boulangerie
- `bi-egg-fried` - Fromagerie
- `bi-egg` - Viandes/Volailles
- `bi-water` - Poissons
- `bi-apple` - Fruits & Légumes
- `bi-cart3` - Épicerie
- `bi-cup-straw` - Boissons

### Autocomplétion
Utiliser une bibliothèque comme **Select2** ou **Choices.js** pour les dropdowns avec recherche.

---

**Toutes ces interfaces permettront d'exploiter pleinement la nouvelle structure de la base de données! 🚀**
