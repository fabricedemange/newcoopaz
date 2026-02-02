# 🔄 Migrations de Base de Données - COOPAZ

## 📋 Vue d'ensemble

Ce dossier contient les scripts de migration pour restructurer la base de données COOPAZ et éliminer la duplication des produits.

---

## 🎯 Objectif de la Migration

### Problème actuel
- **1036 articles** avec beaucoup de duplication
- **211 produits uniques** répétés ~5 fois chacun
- Aucune structure pour les fournisseurs et catégories
- Maintenance difficile (modifier un produit = modifier dans tous les catalogues)

### Solution apportée
- ✅ **Bibliothèque de 211 produits réutilisables**
- ✅ **Table `suppliers`** pour gérer les fournisseurs
- ✅ **Table `categories`** hiérarchique pour organiser les produits
- ✅ **Catégorisation automatique** lors de la migration
- ✅ **Prix flexibles** par catalogue
- ✅ **Gain de ~80%** en stockage

---

## 📁 Fichiers de Migration (dans l'ordre)

### 1️⃣ Création des références
| Fichier | Description |
|---------|-------------|
| `20260123_create_suppliers_categories.sql` | ⭐ **À exécuter en PREMIER** - Crée les tables `suppliers` et `categories` |

### 2️⃣ Migration principale
| Fichier | Description |
|---------|-------------|
| `20260123_refactor_products_structure_v2.sql` | ⭐ **Migration complète V2** - Crée `products` et `catalog_products` avec références fournisseurs/catégories |
| `20260123_refactor_products_structure.sql` | Version V1 (sans suppliers/categories) - **Ne plus utiliser** |

### 3️⃣ Vérification et rollback
| Fichier | Description |
|---------|-------------|
| `20260123_verify_migration.sql` | Script de vérification post-migration (10 tests automatiques) |
| `20260123_rollback_products_refactor.sql` | Annulation de la migration en cas de problème |

### 4️⃣ Documentation
| Fichier | Description |
|---------|-------------|
| `README.md` | 📖 Ce fichier |
| `MIGRATION_GUIDE_v2.md` | 📘 **Guide complet V2** (fournisseurs + catégories) |
| `MIGRATION_GUIDE_products_refactor.md` | Guide V1 (sans suppliers/categories) |
| `CODE_EXAMPLES_refactor.md` | Exemples de code avant/après |
| `README_PRODUCTS_REFACTOR.md` | Vue d'ensemble V1 |

---

## ⚡ Démarrage Rapide (3 commandes)

```bash
# 1. BACKUP OBLIGATOIRE!
mysqldump -u root coopazfr_commandes > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Créer les tables de référence
mysql -u root coopazfr_commandes < migrations/20260123_create_suppliers_categories.sql

# 3. Exécuter la migration V2
mysql -u root coopazfr_commandes < migrations/20260123_refactor_products_structure_v2.sql

# 4. Vérifier
mysql -u root coopazfr_commandes < migrations/20260123_verify_migration.sql
```

**⚠️ Vérification critique:**
```sql
SELECT COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL;
-- Doit retourner 0 (zéro)!
```

---

## 🏗️ Architecture Finale

```
┌─────────────────┐
│  organizations  │
└─────────────────┘
        ↓
   ┌────┴────┐
   ↓         ↓
┌──────────┐ ┌──────────┐
│suppliers │ │categories│  (hiérarchiques)
└──────────┘ └──────────┘
        ↓         ↓
        └────┬────┘
             ↓
    ┌─────────────────┐
    │    products     │  (211 produits)
    │ ─────────────── │
    │ + supplier_id   │
    │ + category_id   │
    │ + nom           │
    │ + description   │
    │ + image         │
    │ + code_ean      │
    │ + origine       │
    │ + label (Bio..) │
    └─────────────────┘
             ↓ 1:N
    ┌─────────────────────┐
    │ catalog_products    │  (1036 liaisons)
    │ ─────────────────── │
    │ + catalog_file_id   │
    │ + product_id        │
    │ + prix (variable!)  │
    │ + unite             │
    └─────────────────────┘
             ↓ 1:N
    ┌─────────────────┐
    │ panier_articles │
    │ ─────────────── │
    │ catalog_product_id │
    └─────────────────┘
```

---

## 🆕 Nouveautés de la V2

La Version 2 ajoute:

### 📦 Table `suppliers` (fournisseurs)
- Gestion centralisée des fournisseurs
- Informations de contact complètes
- Isolation par organisation
- 9 fournisseurs d'exemple créés

### 📂 Table `categories` (catégories)
- **11 catégories principales** par défaut:
  - Boulangerie, Fromagerie, Viandes, Charcuterie, Volailles
  - Poissons, Fruits & Légumes, Épicerie, Boissons, Produits laitiers, Autres
- **~15 sous-catégories**
- Hiérarchie (parent/enfant)
- Couleurs et icônes pour l'interface
- **Catégorisation automatique** lors de la migration

### 🤖 Fonction `detect_category_id()`
- Détecte automatiquement la catégorie d'un produit
- Basée sur le nom du produit
- Patterns intelligents (pain, fromage, viande, etc.)
- Fallback sur "Autres"

### 📊 Champs enrichis dans `products`
- `supplier_id` - Fournisseur principal
- `category_id` - Catégorie
- `reference_fournisseur` - Référence chez le fournisseur
- `code_ean` - Code-barres
- `conditionnement` - Ex: "Par 6", "Au kilo"
- `dlc_jours` - Durée de vie en jours
- `allergenes` - Liste des allergènes
- `origine` - Origine géographique
- `label` - Bio, AOP, IGP, etc.

---

## 📖 Quel Guide Suivre ?

### ✅ **Migration V2** (Recommandé - avec fournisseurs et catégories)

**À lire:** `MIGRATION_GUIDE_v2.md`

**Avantages:**
- Structure complète et professionnelle
- Fournisseurs et catégories intégrés
- Catégorisation automatique
- Plus de fonctionnalités (filtres, stats, etc.)
- Préparé pour l'avenir

**Exécution:**
1. `20260123_create_suppliers_categories.sql`
2. `20260123_refactor_products_structure_v2.sql`

---

### ⚠️ Migration V1 (Basique - sans fournisseurs ni catégories)

**À lire:** `MIGRATION_GUIDE_products_refactor.md`

**Si vous choisissez V1:**
- Structure minimale (produits réutilisables uniquement)
- Pas de fournisseurs, pas de catégories
- Migration plus simple mais moins de fonctionnalités

**Exécution:**
1. ~~20260123_create_suppliers_categories.sql~~ (ignorer)
2. `20260123_refactor_products_structure.sql`

**Note:** Vous pourrez toujours ajouter fournisseurs/catégories plus tard.

---

## 🎯 Fonctionnalités Débloquées par la V2

### Filtrage avancé
```sql
-- Par catégorie
SELECT * FROM products WHERE category_id = ?

-- Par fournisseur
SELECT * FROM products WHERE supplier_id = ?

-- Produits bio
SELECT * FROM products WHERE label LIKE '%Bio%'
```

### Statistiques enrichies
```sql
-- Top fournisseurs
SELECT s.nom, COUNT(p.id) FROM suppliers s
JOIN products p ON p.supplier_id = s.id
GROUP BY s.id;

-- Distribution par catégorie
SELECT c.nom, COUNT(p.id) FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id;
```

### Navigation par catégorie
- Menu arborescent
- Badges de couleur
- Icônes visuelles

### Gestion des allergènes
```sql
SELECT * FROM products WHERE allergenes LIKE '%gluten%';
```

### Traçabilité
- Origine géographique
- Labels (Bio, AOP, etc.)
- Référence fournisseur

---

## ⚠️ Points d'Attention

### 1. Backup OBLIGATOIRE
```bash
mysqldump -u root coopazfr_commandes > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Migration en 2 phases

**Phase 1** (réversible):
- Création des nouvelles tables
- Migration des données
- Garde l'ancienne structure intacte

**Phase 2** (irréversible):
- Suppression de `articles`
- Suppression de `article_id` dans `panier_articles`
- ⚠️ À faire APRÈS tests complets!

### 3. Vérification critique

**AVANT de continuer, vérifier:**
```sql
-- Doit être 0!
SELECT COUNT(*) FROM panier_articles
WHERE catalog_product_id IS NULL;
```

### 4. Catégorisation automatique

La fonction `detect_category_id()` catégorise automatiquement ~90% des produits.

**Révision manuelle recommandée:**
```sql
-- Produits non catégorisés
SELECT id, nom FROM products WHERE category_id IS NULL;

-- Produits mal catégorisés
SELECT p.nom, c.nom FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.nom LIKE '%pain%' AND c.nom != 'Boulangerie';
```

---

## 🧪 Tests Recommandés

Après migration, tester:

- [ ] Affichage d'un catalogue
- [ ] Affichage avec catégories et fournisseurs
- [ ] Ajout au panier
- [ ] Modification du panier
- [ ] Validation de commande
- [ ] Export de commandes
- [ ] Duplication de catalogue
- [ ] Modification d'un produit
- [ ] Upload d'image produit
- [ ] **Filtre par catégorie**
- [ ] **Filtre par fournisseur**
- [ ] **Recherche par label (Bio, AOP, etc.)**

---

## 📊 Statistiques Attendues

Après migration V2 réussie:

```sql
-- ~211 produits
SELECT COUNT(*) FROM products;

-- ~1036 liaisons
SELECT COUNT(*) FROM catalog_products;

-- 0 panier non migré (CRITIQUE!)
SELECT COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL;

-- 9 fournisseurs
SELECT COUNT(*) FROM suppliers;

-- ~26 catégories
SELECT COUNT(*) FROM categories;

-- Distribution
SELECT c.nom, COUNT(p.id) FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.id;
```

---

## 🔄 Rollback

**En cas de problème AVANT finalisation (phase 2):**
```bash
mysql -u root coopazfr_commandes < migrations/20260123_rollback_products_refactor.sql
```

**Si finalisé (phase 2 exécutée):**
```bash
mysql -u root coopazfr_commandes < backup_YYYYMMDD_HHMMSS.sql
```

---

## 🚀 Prochaines Étapes Après Migration

### Immédiat (obligatoire)
1. ✅ Adapter le code (voir `CODE_EXAMPLES_refactor.md`)
2. ✅ Tester intensivement
3. ✅ Assigner les fournisseurs aux produits
4. ✅ Vérifier/corriger les catégories

### Court terme (recommandé)
1. 📱 Interface de gestion des fournisseurs
2. 📂 Interface de gestion des catégories
3. 🏷️ Interface de gestion des produits
4. 🔍 Recherche avancée (par catégorie, fournisseur, label)
5. 📊 Tableau de bord avec statistiques

### Moyen terme (optionnel)
1. 📥 Import/export de produits
2. 📈 Historique des prix
3. 🔔 Alertes allergènes
4. 🏷️ Gestion des labels et certifications
5. 📸 Upload multiple d'images

---

## 📞 Support

### Documentation
- **Guide complet:** `MIGRATION_GUIDE_v2.md`
- **Exemples de code:** `CODE_EXAMPLES_refactor.md`
- **Vue d'ensemble:** `README_PRODUCTS_REFACTOR.md`

### En cas de problème
1. Vérifier les logs de migration
2. Exécuter le script de vérification
3. Consulter la documentation
4. Utiliser le rollback si nécessaire

### Commandes utiles
```sql
-- État de la migration
SHOW TABLES LIKE '%products%';
SHOW TABLES LIKE '%suppliers%';
SHOW TABLES LIKE '%categories%';

-- Vérification rapide
SELECT
  (SELECT COUNT(*) FROM products) as products,
  (SELECT COUNT(*) FROM catalog_products) as liaisons,
  (SELECT COUNT(*) FROM suppliers) as fournisseurs,
  (SELECT COUNT(*) FROM categories) as categories;
```

---

## ✅ Checklist Complète

### Avant migration
- [ ] Backup complet effectué
- [ ] Application arrêtée
- [ ] Base en accès exclusif
- [ ] Documentation lue

### Migration
- [ ] Suppliers et categories créés
- [ ] Migration V2 exécutée
- [ ] Vérification OK (0 panier non migré)
- [ ] Statistiques cohérentes

### Post-migration
- [ ] Fournisseurs assignés (>50%)
- [ ] Catégories vérifiées (>90%)
- [ ] Code adapté
- [ ] Tests complets OK
- [ ] Backup post-migration

### Finalisation
- [ ] Phase 2 exécutée (après tests)
- [ ] Ancienne structure supprimée
- [ ] Documentation mise à jour
- [ ] Équipe formée

---

## 🎉 Résultat Final

**Avant:**
```
articles (1036 entrées avec duplication)
  ↓
paniers
```

**Après V2:**
```
suppliers (9) → products (211) ← categories (26)
                   ↓
         catalog_products (1036)
                   ↓
               paniers
```

**Gains:**
- ✅ **-80% de stockage** (duplication éliminée)
- ✅ **Structure professionnelle** (fournisseurs + catégories)
- ✅ **Maintenance simplifiée** (1 modif au lieu de 18)
- ✅ **Fonctionnalités enrichies** (filtres, stats, traçabilité)
- ✅ **Évolutivité** (base solide pour l'avenir)

---

**Bonne migration! 🚀**

Questions? Consultez `MIGRATION_GUIDE_v2.md` pour tous les détails.
