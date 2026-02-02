# Guide de Migration V2 - Produits avec Fournisseurs et Catégories

## 📋 Vue d'ensemble

Cette migration complète transforme la structure pour:
1. **Éliminer la duplication** des produits entre catalogues
2. **Structurer les produits** avec fournisseurs et catégories
3. **Catégoriser automatiquement** les produits existants

## 🎯 Nouvelle Structure Complète

```
┌────────────────┐          ┌──────────────────┐
│  organizations │          │    suppliers     │
└────────────────┘          └──────────────────┘
        ↓                           ↓
        └──────────┬────────────────┘
                   ↓
        ┌──────────────────┐
        │    categories    │  (hiérarchiques)
        └──────────────────┘
                   ↓
        ┌──────────────────┐
        │     products     │  (211 produits uniques)
        │ ───────────────  │
        │ + supplier_id    │
        │ + category_id    │
        │ + nom            │
        │ + description    │
        │ + image          │
        │ + code_ean       │
        │ + origine        │
        │ + label (Bio..)  │
        └──────────────────┘
                   ↓ 1:N
        ┌─────────────────────┐
        │  catalog_products   │  (1036 liaisons)
        │ ─────────────────── │
        │ + prix (variable!)  │
        │ + unite             │
        │ + ordre             │
        └─────────────────────┘
                   ↓ 1:N
        ┌─────────────────┐
        │ panier_articles │
        └─────────────────┘
```

---

## 🚀 Procédure Complète de Migration

### ⚠️ PRÉREQUIS OBLIGATOIRES

1. **Backup complet**
```bash
mysqldump -u root coopazfr_commandes > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Arrêter l'application**
```bash
npm stop
```

3. **Vérifier l'accès exclusif**
```bash
mysql -u root coopazfr_commandes -e "SHOW PROCESSLIST;"
```

---

### ÉTAPE 1: Créer les tables de référence

```bash
mysql -u root coopazfr_commandes < migrations/20260123_create_suppliers_categories.sql
```

**Ce script crée:**
- ✅ Table `suppliers` (fournisseurs)
- ✅ Table `categories` (catégories hiérarchiques)
- ✅ 11 catégories principales par défaut
- ✅ ~15 sous-catégories
- ✅ 9 fournisseurs d'exemple

**Vérification:**
```sql
SELECT COUNT(*) FROM suppliers;  -- Attendu: 9
SELECT COUNT(*) FROM categories; -- Attendu: ~26
```

---

### ÉTAPE 2: Adapter les catégories et fournisseurs (OPTIONNEL)

Avant de continuer, vous pouvez personnaliser:

**A. Ajouter vos vrais fournisseurs:**
```sql
INSERT INTO suppliers (organization_id, nom, contact_nom, email, telephone, ville, notes)
VALUES (1, 'Nom du fournisseur', 'Contact', 'email@example.com', '0123456789', 'Ville', 'Notes');
```

**B. Ajouter des catégories spécifiques:**
```sql
INSERT INTO categories (organization_id, nom, description, parent_id, ordre, couleur)
VALUES (1, 'Ma catégorie', 'Description', NULL, 11, '#FF0000');
```

**C. Modifier la fonction de détection automatique:**
Si la fonction `detect_category_id()` ne catégorise pas bien vos produits, vous pouvez:
- La modifier dans le script V2 avant exécution
- OU recatégoriser manuellement après migration

---

### ÉTAPE 3: Exécuter la migration principale

```bash
mysql -u root coopazfr_commandes < migrations/20260123_refactor_products_structure_v2.sql
```

**Ce script:**
1. ✅ Crée la table `products` avec colonnes supplier_id et category_id
2. ✅ Crée la table `catalog_products`
3. ✅ Migre automatiquement les 1036 articles → 211 produits
4. ✅ Assigne automatiquement les catégories (fonction intelligente)
5. ✅ Crée les 1036 liaisons catalog_products
6. ✅ Migre les paniers existants
7. ✅ Génère des statistiques

**Durée estimée:** 10-30 secondes selon la taille de la base

---

### ÉTAPE 4: Vérifications critiques

```bash
mysql -u root coopazfr_commandes < migrations/20260123_verify_migration.sql
```

**À vérifier impérativement:**

```sql
-- CRITIQUE: Doit retourner 0!
SELECT COUNT(*) as paniers_non_migres
FROM panier_articles
WHERE article_id IS NOT NULL AND catalog_product_id IS NULL;
```

**Si > 0:** ❌ Ne pas continuer! Investiguer le problème.

**Autres vérifications:**
```sql
-- Nombre de produits créés
SELECT COUNT(*) FROM products;
-- Attendu: ~211

-- Distribution par catégorie
SELECT c.nom, COUNT(p.id) as nb
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY c.nom;

-- Produits sans catégorie (à réviser)
SELECT COUNT(*) FROM products WHERE category_id IS NULL;
```

---

### ÉTAPE 5: Corrections post-migration

#### A. Assigner les fournisseurs

```sql
-- Par produit
UPDATE products
SET supplier_id = 1
WHERE nom LIKE '%Pain%';

-- Ou globalement
UPDATE products
SET supplier_id = (SELECT id FROM suppliers WHERE nom = 'Le Pain d''Ici' LIMIT 1)
WHERE category_id = (SELECT id FROM categories WHERE nom = 'Boulangerie' LIMIT 1);
```

#### B. Corriger les catégories mal assignées

```sql
-- Voir les produits sans catégorie
SELECT id, nom FROM products WHERE category_id IS NULL;

-- Assigner manuellement
UPDATE products
SET category_id = (SELECT id FROM categories WHERE nom = 'Fromagerie' LIMIT 1)
WHERE id = 123;
```

#### C. Compléter les informations produits

```sql
-- Ajouter des labels
UPDATE products
SET label = 'Bio'
WHERE nom LIKE '%bio%';

-- Ajouter des origines
UPDATE products
SET origine = 'France - Jura'
WHERE nom LIKE '%Comté%';
```

---

### ÉTAPE 6: Adapter le code applicatif

Voir `CODE_EXAMPLES_refactor.md` pour les exemples détaillés.

**Principales modifications:**

1. **Requêtes SELECT:**
```javascript
// AVANT
SELECT * FROM articles WHERE catalog_file_id = ?

// APRÈS
SELECT cp.*, p.*, c.nom as categorie, s.nom as fournisseur
FROM catalog_products cp
INNER JOIN products p ON cp.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE cp.catalog_file_id = ?
```

2. **Ajout au panier:**
```javascript
// Remplacer article_id par catalog_product_id
```

3. **Duplication de catalogue:**
```javascript
// Copier catalog_products, pas articles
```

---

### ÉTAPE 7: Tests intensifs

**Checklist de test:**

- [ ] Afficher un catalogue
- [ ] Afficher les produits avec catégories et fournisseurs
- [ ] Ajouter un produit au panier
- [ ] Modifier le panier
- [ ] Valider une commande
- [ ] Exporter les commandes
- [ ] Dupliquer un catalogue
- [ ] Modifier un produit
- [ ] Upload image produit
- [ ] Filtrer par catégorie
- [ ] Filtrer par fournisseur

---

### ÉTAPE 8: Finalisation (IRRÉVERSIBLE!)

⚠️ **ATTENTION: Cette étape supprime l'ancienne structure!**

Décommenter et exécuter l'ÉTAPE 9 du script de migration:

```sql
-- Supprimer article_id, renommer articles, etc.
```

**Avant de finaliser:**
- ✅ Tous les tests passent
- ✅ Backup post-migration effectué
- ✅ Équipe formée sur la nouvelle structure
- ✅ Code adapté et déployé

---

## 📚 Tables et Relations

### Table: `suppliers`

| Champ | Type | Description |
|-------|------|-------------|
| id | INT | Clé primaire |
| organization_id | INT | Organisation propriétaire |
| nom | VARCHAR(255) | Nom du fournisseur |
| contact_nom | VARCHAR(255) | Nom du contact |
| email | VARCHAR(255) | Email |
| telephone | VARCHAR(50) | Téléphone |
| adresse | TEXT | Adresse complète |
| siret | VARCHAR(50) | SIRET |
| notes | TEXT | Notes libres |
| is_active | TINYINT | Actif/Inactif |

### Table: `categories`

| Champ | Type | Description |
|-------|------|-------------|
| id | INT | Clé primaire |
| organization_id | INT | Organisation propriétaire |
| nom | VARCHAR(255) | Nom de la catégorie |
| description | TEXT | Description |
| parent_id | INT | Catégorie parente (hiérarchie) |
| ordre | INT | Ordre d'affichage |
| couleur | VARCHAR(20) | Code couleur hex |
| icon | VARCHAR(50) | Icône Bootstrap |
| is_active | TINYINT | Actif/Inactif |

**Catégories par défaut:**
- Boulangerie (+ Pains, Viennoiseries, Pâtisseries, Biscuits)
- Fromagerie (+ Pâte dure, Pâte molle, Chèvre, Brebis, Bleus)
- Viandes (+ Bœuf, Porc, Agneau, Veau)
- Charcuterie
- Volailles
- Poissons
- Fruits & Légumes
- Épicerie
- Boissons
- Produits laitiers
- Autres

### Table: `products` (enrichie)

| Champ | Type | Description |
|-------|------|-------------|
| id | INT | Clé primaire |
| organization_id | INT | Organisation |
| **supplier_id** | INT | ⭐ Fournisseur |
| **category_id** | INT | ⭐ Catégorie |
| nom | VARCHAR(255) | Nom du produit |
| description | VARCHAR(1000) | Description |
| image_filename | VARCHAR(255) | Image |
| **reference_fournisseur** | VARCHAR(100) | ⭐ Réf. fournisseur |
| **code_ean** | VARCHAR(50) | ⭐ Code-barres |
| **conditionnement** | VARCHAR(100) | ⭐ Ex: "Par 6" |
| **dlc_jours** | INT | ⭐ DLC en jours |
| **allergenes** | TEXT | ⭐ Liste allergènes |
| **origine** | VARCHAR(100) | ⭐ Origine géo |
| **label** | VARCHAR(100) | ⭐ Bio, AOP, etc. |
| is_active | TINYINT | Actif/Inactif |

---

## 🎨 Nouvelles Fonctionnalités Possibles

Grâce aux fournisseurs et catégories, vous pouvez maintenant:

### 1. Filtrage avancé
```javascript
// Filtrer par catégorie
SELECT p.* FROM products p WHERE p.category_id = ?

// Filtrer par fournisseur
SELECT p.* FROM products p WHERE p.supplier_id = ?

// Produits bio
SELECT p.* FROM products p WHERE p.label LIKE '%Bio%'

// Produits AOP
SELECT p.* FROM products p WHERE p.label LIKE '%AOP%'
```

### 2. Interface de gestion des fournisseurs
- Liste des fournisseurs
- CRUD complet
- Voir tous les produits d'un fournisseur
- Statistiques par fournisseur

### 3. Navigation par catégorie
- Menu avec arborescence de catégories
- Catalogue filtré par catégorie
- Badges de couleur par catégorie

### 4. Statistiques enrichies
```sql
-- Top fournisseurs
SELECT s.nom, COUNT(p.id) as nb_produits
FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.id
GROUP BY s.id;

-- Distribution par catégorie
SELECT c.nom, COUNT(p.id) as nb_produits
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id;

-- Produits les plus commandés par catégorie
SELECT c.nom, p.nom, SUM(pa.quantity) as total
FROM panier_articles pa
JOIN catalog_products cp ON pa.catalog_product_id = cp.id
JOIN products p ON cp.product_id = p.id
JOIN categories c ON p.category_id = c.id
JOIN paniers pan ON pa.panier_id = pan.id
WHERE pan.is_submitted = 1
GROUP BY c.id, p.id
ORDER BY c.id, total DESC;
```

### 5. Gestion des allergènes
```sql
-- Produits avec gluten
SELECT * FROM products WHERE allergenes LIKE '%gluten%';

-- Alerter sur les allergènes dans un panier
SELECT DISTINCT p.nom, p.allergenes
FROM panier_articles pa
JOIN catalog_products cp ON pa.catalog_product_id = cp.id
JOIN products p ON cp.product_id = p.id
WHERE pa.panier_id = ? AND p.allergenes IS NOT NULL;
```

---

## 🔧 Maintenance et Optimisation

### Recatégoriser en masse
```sql
-- Tous les fromages → Fromagerie
UPDATE products
SET category_id = (SELECT id FROM categories WHERE nom = 'Fromagerie' LIMIT 1)
WHERE nom LIKE '%fromage%' OR nom LIKE '%comté%';
```

### Assigner des fournisseurs par catégorie
```sql
-- Tous les pains → Le Pain d'Ici
UPDATE products p
SET p.supplier_id = (SELECT id FROM suppliers WHERE nom = 'Le Pain d''Ici' LIMIT 1)
WHERE p.category_id = (SELECT id FROM categories WHERE nom = 'Boulangerie' LIMIT 1);
```

### Nettoyer les catégories vides
```sql
-- Trouver les catégories sans produits
SELECT c.nom, COUNT(p.id) as nb_produits
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id
HAVING nb_produits = 0;
```

---

## 📊 Gains et Bénéfices

### Gains de la V2 vs V1

| Aspect | V1 (produits seuls) | V2 (avec suppliers/categories) |
|--------|---------------------|--------------------------------|
| Structure | ✅ Produits réutilisables | ✅ + Catégorisés + Fournisseurs |
| Recherche | Nom/description | + Catégorie + Fournisseur + Labels |
| Filtrage | Basique | Avancé (multicritères) |
| Statistiques | Simple | Riches (par catégorie, par fournisseur) |
| Traçabilité | Limitée | Complète (origine, label, allergènes) |
| Navigation | Liste | Arborescence de catégories |
| Gestion | Manuelle | Semi-automatique (catégorisation auto) |

---

## ✅ Checklist Finale

- [ ] Backup effectué
- [ ] Tables suppliers et categories créées
- [ ] Catégories et fournisseurs personnalisés (optionnel)
- [ ] Migration V2 exécutée
- [ ] 0 panier non migré (CRITIQUE!)
- [ ] Produits ont des catégories (~100%)
- [ ] Fournisseurs assignés (recommandé >50%)
- [ ] Vérifications OK
- [ ] Code adapté
- [ ] Tests complets OK
- [ ] Documentation mise à jour
- [ ] Équipe formée
- [ ] Backup post-migration
- [ ] Finalisation exécutée

---

## 🆘 Support

**Produits sans catégorie:**
```sql
SELECT id, nom FROM products WHERE category_id IS NULL;
-- Assigner manuellement ou améliorer detect_category_id()
```

**Catégories mal assignées:**
```sql
-- Lister pour revue
SELECT p.nom, c.nom as categorie
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.nom LIKE '%pain%' AND c.nom != 'Boulangerie';
```

---

**Bonne migration! 🚀**

Les fournisseurs et catégories structurent parfaitement votre base pour la gestion à long terme!
