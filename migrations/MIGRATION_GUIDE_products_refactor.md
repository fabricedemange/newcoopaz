# Guide de Migration - Refactorisation Produits Réutilisables

## 📋 Vue d'ensemble

Cette migration transforme la structure actuelle où chaque produit est dupliqué dans chaque catalogue vers une structure avec des produits réutilisables.

### Situation actuelle
- ❌ **1036 articles** (avec duplication)
- ❌ **211 produits uniques** répétés ~5 fois chacun
- ❌ Certains produits apparaissent dans **18 catalogues** différents
- ❌ Modifications d'un produit = modifier dans tous les catalogues

### Après migration
- ✅ **211 produits** dans la table `products` (master)
- ✅ **1036 catalog_products** (liaisons avec prix spécifiques)
- ✅ Modifier un produit = mise à jour automatique partout
- ✅ Images centralisées (1 image par produit unique)
- ✅ Prix personnalisables par catalogue

---

## 🏗️ Nouvelle Structure

```
┌──────────────────┐
│    products      │  Produits réutilisables (211 entrées)
├──────────────────┤
│ id               │
│ organization_id  │  ← Isolation par organisation
│ nom              │  ← "Pain de Campagne Miche 2000g"
│ description      │
│ image_filename   │  ← UNE image par produit
│ created_at       │
│ updated_at       │
└──────────────────┘
         ↓ 1:N
┌─────────────────────┐
│ catalog_products    │  Liaison catalogue-produit (1036 entrées)
├─────────────────────┤
│ id                  │
│ catalog_file_id     │  ← Quel catalogue
│ product_id          │  ← Quel produit
│ prix                │  ← Prix dans CE catalogue (variable!)
│ unite               │  ← Unité dans CE catalogue
│ ordre               │  ← Ordre d'affichage
│ created_at          │
└─────────────────────┘
         ↓ 1:N
┌─────────────────┐
│ panier_articles │
├─────────────────┤
│ id              │
│ panier_id       │
│ catalog_product_id  │  ← Modifié (était article_id)
│ quantity        │
│ note            │
└─────────────────┘
```

---

## 🚀 Procédure de Migration

### ⚠️ AVANT TOUTE CHOSE

```bash
# 1. BACKUP COMPLET (OBLIGATOIRE!)
mysqldump -u root coopazfr_commandes > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Arrêter l'application
npm stop  # ou PM2: pm2 stop coopaz

# 3. Vérifier que personne n'utilise la base
mysql -u root coopazfr_commandes -e "SHOW PROCESSLIST;"
```

### Étape 1: Exécuter la migration (partie sûre)

```bash
mysql -u root coopazfr_commandes < migrations/20260123_refactor_products_structure.sql
```

Cette étape:
- ✅ Crée `products` et `catalog_products`
- ✅ Migre les données existantes
- ✅ Ajoute `catalog_product_id` dans `panier_articles` (garde `article_id`)
- ✅ Crée la table de mapping `_migration_article_mapping`

**À ce stade, l'ancienne structure fonctionne encore!**

### Étape 2: Vérifications importantes

```sql
-- Vérifier que tous les produits ont été créés
SELECT COUNT(*) as produits_crees FROM products;
-- Attendu: ~211

-- Vérifier les catalog_products
SELECT COUNT(*) as liaisons_creees FROM catalog_products;
-- Attendu: 1036

-- CRITIQUE: Vérifier que tous les paniers ont été migrés
SELECT COUNT(*) as paniers_non_migres
FROM panier_articles
WHERE article_id IS NOT NULL AND catalog_product_id IS NULL;
-- Attendu: 0 (zéro!)

-- Si > 0, NE PAS CONTINUER! Investiguer le problème.
```

### Étape 3: Tester l'application avec la nouvelle structure

**À ce stade, modifier le code pour utiliser `catalog_products` au lieu de `articles`**

Relancer l'application et tester:
- ✅ Affichage des catalogues
- ✅ Ajout au panier
- ✅ Modification de panier
- ✅ Passation de commande
- ✅ Export des commandes

### Étape 4: Finalisation (DESTRUCTIF - après tests OK)

**⚠️ Cette étape est irréversible sans backup!**

Décommenter et exécuter l'étape 6 du script de migration:

```sql
-- Supprimer l'ancienne colonne article_id
ALTER TABLE panier_articles DROP FOREIGN KEY panier_articles_ibfk_2;
ALTER TABLE panier_articles DROP COLUMN article_id;

-- Contrainte FK sur catalog_product_id
ALTER TABLE panier_articles
  ADD CONSTRAINT fk_panier_articles_catalog_product
  FOREIGN KEY (catalog_product_id)
  REFERENCES catalog_products(id) ON DELETE RESTRICT;

-- Rendre catalog_product_id obligatoire
ALTER TABLE panier_articles MODIFY catalog_product_id INT(11) NOT NULL;

-- Archiver l'ancienne table
RENAME TABLE articles TO _old_articles_backup;

-- Nettoyer la table de mapping
DROP TABLE _migration_article_mapping;
```

---

## 🔄 Rollback (en cas de problème)

Si vous devez annuler la migration **avant l'étape 4**:

```bash
mysql -u root coopazfr_commandes < migrations/20260123_rollback_products_refactor.sql
```

Si vous avez finalisé (étape 4), vous devez restaurer depuis le backup:

```bash
mysql -u root coopazfr_commandes < backup_YYYYMMDD_HHMMSS.sql
```

---

## 💻 Impacts sur le Code Applicatif

### Fichiers à modifier

Voici les principaux changements à faire dans le code:

#### 1. Routes et contrôleurs (`routes/admin.routes.js`, etc.)

**AVANT:**
```javascript
// Récupérer les articles d'un catalogue
db.query(
  "SELECT id, catalog_file_id, produit, description, prix, unite, image_filename FROM articles WHERE catalog_file_id = ?",
  [catalogueId],
  (err, articles) => { ... }
);
```

**APRÈS:**
```javascript
// Récupérer les produits d'un catalogue avec leurs infos
db.query(`
  SELECT
    cp.id as catalog_product_id,
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
  ORDER BY cp.ordre
`, [catalogueId], (err, articles) => { ... }
);
```

#### 2. Ajout d'article au panier

**AVANT:**
```javascript
db.query(
  "INSERT INTO panier_articles (panier_id, article_id, quantity) VALUES (?, ?, ?)",
  [panierId, articleId, quantity]
);
```

**APRÈS:**
```javascript
db.query(
  "INSERT INTO panier_articles (panier_id, catalog_product_id, quantity) VALUES (?, ?, ?)",
  [panierId, catalogProductId, quantity]
);
```

#### 3. Duplication de catalogue

**AVANT:**
```javascript
// Dupliquer les articles
db.query(
  "INSERT INTO articles (catalog_file_id, produit, description, prix, unite, image_filename) SELECT ?, produit, description, prix, unite, image_filename FROM articles WHERE catalog_file_id = ?",
  [newCatalogId, oldCatalogId]
);
```

**APRÈS:**
```javascript
// Dupliquer uniquement les liaisons (pas les produits!)
db.query(`
  INSERT INTO catalog_products (catalog_file_id, product_id, prix, unite, ordre)
  SELECT ?, product_id, prix, unite, ordre
  FROM catalog_products
  WHERE catalog_file_id = ?
`, [newCatalogId, oldCatalogId]);
```

#### 4. Nouvelle fonctionnalité: Gestion des produits

**À créer:**
- Page de gestion des produits (`/admin/products`)
- CRUD produits (Create, Read, Update, Delete)
- Sélecteur de produits lors de la création de catalogue
- Interface pour ajouter des produits existants à un catalogue

### Vues à modifier

- `admin_catalogue_edit_form.ejs` : Remplacer `article.id` par `article.catalog_product_id`
- `catalogue_articles.ejs` : Idem
- `panier_*.ejs` : Adapter les références

---

## 📊 Gains attendus

### Base de données
- **-80% d'entrées** dans la table articles (1036 → 211 produits + 1036 liaisons)
- **-75% de stockage** images (1036 images → 211 images)
- **Maintenance simplifiée** : 1 modification au lieu de 18

### Fonctionnalités nouvelles
- ✅ **Bibliothèque de produits** : Sélectionner des produits existants
- ✅ **Mise à jour globale** : Modifier un produit met à jour tous les catalogues
- ✅ **Historique des prix** : Voir l'évolution du prix d'un produit
- ✅ **Statistiques produits** : Produits les plus commandés, etc.

### Exemple concret

**Avant:**
```
Pain de Campagne Miche 2000g existe 18 fois dans la base
→ Pour changer l'image: modifier 18 articles
→ Pour changer la description: modifier 18 articles
```

**Après:**
```
Pain de Campagne Miche 2000g existe 1 fois dans products
→ Pour changer l'image: modifier 1 produit → impacte automatiquement les 18 catalogues
→ Le prix reste personnalisable par catalogue (dans catalog_products)
```

---

## ✅ Checklist de migration

- [ ] Backup complet effectué
- [ ] Application arrêtée
- [ ] Migration SQL exécutée (étapes 1-5)
- [ ] Vérification: 0 panier non migré
- [ ] Vérification: nombre de produits correct (~211)
- [ ] Vérification: nombre de catalog_products correct (1036)
- [ ] Code modifié pour utiliser la nouvelle structure
- [ ] Tests fonctionnels OK (affichage, panier, commande)
- [ ] Finalisation SQL exécutée (étape 6)
- [ ] Backup post-migration effectué
- [ ] Documentation mise à jour
- [ ] Équipe formée sur la nouvelle structure

---

## 🆘 Support

En cas de problème:
1. **NE PAS PANIQUER**
2. Si migration non finalisée (étape 4 non faite): exécuter le rollback
3. Si finalisée: restaurer depuis le backup
4. Vérifier les logs de l'application
5. Vérifier les tables de mapping et backup

**Contact:** [Votre contact support]

---

## 📝 Notes importantes

### Comportement de la duplication
Lors de la duplication d'un catalogue:
- ✅ Les **produits ne sont PAS dupliqués** (ils sont partagés)
- ✅ Les **liaisons catalog_products sont dupliquées** avec les prix
- ✅ Le **prix du catalogue précédent est repris** automatiquement
- ✅ Vous pouvez ensuite **modifier les prix** indépendamment

### Isolation par organisation
- Chaque organisation a ses propres produits
- Un produit ne peut pas être utilisé par une autre organisation
- Les super-admins voient tous les produits mais ne peuvent pas les partager entre organisations

### Images
- Une seule image par produit (stockée au niveau `products`)
- Si plusieurs articles avaient des images différentes, la première est prise
- Vous pouvez mettre à jour l'image d'un produit → impacte tous les catalogues

### Prix
- Le prix est stocké dans `catalog_products` (pas dans `products`)
- Chaque catalogue peut avoir un prix différent pour le même produit
- La duplication reprend le prix du catalogue source
