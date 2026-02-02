# Guide de Migration Complète - Modèle Historique → Nouveau Modèle

## 📋 Vue d'ensemble

Ce guide décrit la migration complète de l'ancien modèle de base de données (basé sur la table `articles`) vers le nouveau modèle avec **fournisseurs**, **catégories**, **produits réutilisables** et **catalog_products**.

## 🎯 Objectifs de la migration

### Ancien modèle (AVANT)
```
articles
├── id
├── catalog_file_id
├── produit (nom du produit)
├── description
├── prix
├── unite
└── image_filename

panier_articles
├── panier_id
├── article_id  ← référence directe à articles
├── quantity
└── note
```

**Problème**: Chaque catalogue contient ses propres articles. Même produit = multiples entrées.

### Nouveau modèle (APRÈS)
```
suppliers (fournisseurs)
├── nom
├── contact
├── email
└── ...

categories (catégories)
├── nom
├── description
├── couleur
└── ordre

products (produits réutilisables)
├── organization_id
├── supplier_id
├── category_id
├── nom
├── description
└── image_filename

catalog_products (déclinaisons par catalogue)
├── catalog_file_id
├── product_id
├── prix (spécifique au catalogue)
└── unite (spécifique au catalogue)

panier_articles
├── panier_id
├── catalog_product_id  ← référence à catalog_products
├── quantity
└── note
```

**Avantages**:
- ✅ Produits réutilisables entre catalogues
- ✅ Catégorisation automatique
- ✅ Gestion centralisée des images
- ✅ Liaison avec fournisseurs
- ✅ Prix et unités spécifiques par catalogue
- ✅ Historique conservé via catalog_products

## ⚠️ PRÉREQUIS CRITIQUES

### 1. Backup de la base de données
```bash
# Créer un backup COMPLET avant toute migration
mysqldump -u root -p coopaz_db > backup_avant_migration_$(date +%Y%m%d_%H%M%S).sql

# Vérifier que le backup est bien créé
ls -lh backup_avant_migration_*.sql
```

### 2. Vérifier les prérequis
- ✅ Table `organizations` existe
- ✅ Table `articles` existe avec des données
- ✅ Table `catalog_files` existe
- ✅ Table `paniers` existe
- ✅ Table `panier_articles` existe
- ✅ Droits MySQL suffisants (CREATE, ALTER, INSERT, UPDATE)

### 3. Environnement de test recommandé
```bash
# Créer une base de données de test
mysql -u root -p -e "CREATE DATABASE coopaz_test;"

# Restaurer le backup dans la base de test
mysql -u root -p coopaz_test < backup_avant_migration_*.sql

# Tester la migration sur coopaz_test d'abord!
```

## 🚀 Exécution de la migration

### Option 1: Via MySQL CLI (recommandé)

```bash
# Se connecter à MySQL
mysql -u root -p coopaz_db

# Exécuter le script de migration
source /chemin/vers/migrations/MIGRATION_COMPLETE_CONSOLIDATED.sql

# Ou en une ligne
mysql -u root -p coopaz_db < migrations/MIGRATION_COMPLETE_CONSOLIDATED.sql
```

### Option 2: Via PHPMyAdmin
1. Ouvrir PHPMyAdmin
2. Sélectionner la base de données `coopaz_db`
3. Aller dans l'onglet **SQL**
4. Copier-coller le contenu de `MIGRATION_COMPLETE_CONSOLIDATED.sql`
5. Cliquer sur **Exécuter**
6. Vérifier les statistiques affichées

### Option 3: Via script Node.js

```bash
# Créer un script de migration
node migrations/run_migration.js
```

```javascript
// migrations/run_migration.js
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const sql = fs.readFileSync('./migrations/MIGRATION_COMPLETE_CONSOLIDATED.sql', 'utf8');

  console.log('🚀 Démarrage de la migration...');
  const [results] = await connection.query(sql);
  console.log('✅ Migration terminée!');
  console.log(results);

  await connection.end();
}

runMigration().catch(console.error);
```

## 📊 Phases de la migration

Le script exécute automatiquement ces 11 phases:

### Phase 1-2: Création des tables de référence
- ✅ Table `suppliers` (fournisseurs)
- ✅ Table `categories` (catégories hiérarchiques)
- ✅ Insertion des catégories par défaut (11 catégories principales)

### Phase 3: Insertion des fournisseurs
- ✅ Fournisseur général par défaut pour chaque organisation

### Phase 4-5: Création des nouvelles tables produits
- ✅ Table `products` (produits réutilisables)
- ✅ Table `catalog_products` (liaison catalogue ↔ produit)

### Phase 6: Migration des données articles → products
- ✅ Dédoublonnage des produits (même nom + description = 1 seul produit)
- ✅ Catégorisation automatique par mots-clés
- ✅ Récupération de la première image disponible

### Phase 7: Création des liaisons catalog_products
- ✅ Lien entre chaque article historique et son produit
- ✅ Conservation des prix/unités spécifiques à chaque catalogue

### Phase 8: Migration de panier_articles
- ✅ Ajout de la colonne `catalog_product_id`
- ✅ Mise à jour de tous les paniers existants
- ✅ Mapping complet article_id → catalog_product_id

### Phase 9: Optimisations
- ✅ Création des index pour performances

### Phase 10: Vérifications
- ✅ Statistiques de migration
- ✅ Distribution par catégorie
- ✅ Détection des orphelins

### Phase 11: Nettoyage (optionnel)
- ⚠️ Suppression de la table `articles` (commenté par défaut)

## 🔍 Vérifications post-migration

### 1. Vérifier les compteurs
```sql
-- Doit afficher les statistiques complètes
SELECT 'Products' AS table_name, COUNT(*) AS count FROM products
UNION ALL
SELECT 'Catalog_products', COUNT(*) FROM catalog_products
UNION ALL
SELECT 'Panier_articles migrés', COUNT(*) FROM panier_articles WHERE catalog_product_id IS NOT NULL
UNION ALL
SELECT 'Panier_articles NON migrés', COUNT(*) FROM panier_articles WHERE catalog_product_id IS NULL;
```

**Le compteur "Panier_articles NON migrés" DOIT être à 0!**

### 2. Vérifier la catégorisation
```sql
-- Distribution des produits par catégorie
SELECT
  c.nom AS categorie,
  COUNT(p.id) AS nb_produits
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY c.nom
ORDER BY nb_produits DESC;
```

### 3. Tester une requête complète
```sql
-- Récupérer tous les produits d'un catalogue avec leurs infos
SELECT
  p.nom AS produit,
  p.description,
  c.nom AS categorie,
  c.couleur,
  s.nom AS fournisseur,
  cp.prix,
  cp.unite,
  p.image_filename
FROM catalog_products cp
JOIN products p ON cp.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE cp.catalog_file_id = 204  -- Remplacer par un ID de catalogue existant
ORDER BY c.ordre, p.nom;
```

### 4. Tester un panier
```sql
-- Vérifier qu'un panier fonctionne toujours
SELECT
  u.username,
  p.nom AS produit,
  pa.quantity,
  cp.prix,
  (pa.quantity * cp.prix) AS total,
  pa.note
FROM paniers pan
JOIN panier_articles pa ON pa.panier_id = pan.id
JOIN catalog_products cp ON pa.catalog_product_id = cp.id
JOIN products p ON cp.product_id = p.id
JOIN users u ON pan.user_id = u.id
WHERE pan.id = 1  -- Remplacer par un ID de panier existant
ORDER BY p.nom;
```

## 🔧 Adaptation du code applicatif

### Avant (ancien code)
```javascript
// ❌ Ancienne requête avec articles
db.query(`
  SELECT a.produit, a.prix, a.unite, a.description
  FROM articles a
  WHERE a.catalog_file_id = ?
`, [catalogId]);

// ❌ Ancienne liaison panier_articles
db.query(`
  SELECT a.produit, pa.quantity
  FROM panier_articles pa
  JOIN articles a ON pa.article_id = a.id
  WHERE pa.panier_id = ?
`, [panierId]);
```

### Après (nouveau code)
```javascript
// ✅ Nouvelle requête avec catalog_products + products
db.query(`
  SELECT
    p.nom AS produit,
    p.description,
    cp.prix,
    cp.unite,
    c.nom AS categorie,
    c.couleur AS categorie_couleur,
    p.image_filename
  FROM catalog_products cp
  JOIN products p ON cp.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE cp.catalog_file_id = ?
  ORDER BY c.ordre, p.nom
`, [catalogId]);

// ✅ Nouvelle liaison panier_articles
db.query(`
  SELECT
    p.nom AS produit,
    p.description,
    pa.quantity,
    cp.prix,
    (pa.quantity * cp.prix) AS total,
    c.nom AS categorie,
    c.couleur AS categorie_couleur
  FROM panier_articles pa
  JOIN catalog_products cp ON pa.catalog_product_id = cp.id
  JOIN products p ON cp.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE pa.panier_id = ?
  ORDER BY c.ordre, p.nom
`, [panierId]);
```

## 🗑️ Nettoyage final (après validation)

### Étape 1: Attendre 1-2 semaines
Ne **jamais** supprimer les anciennes tables immédiatement. Laissez l'application tourner avec le nouveau modèle pendant au moins 1-2 semaines.

### Étape 2: Vérifier qu'aucune erreur
```bash
# Vérifier les logs de l'application
pm2 logs coopazv13 --lines 500 | grep -i "error\|article"

# S'assurer qu'il n'y a plus de références à la table articles
grep -r "FROM articles" routes/
grep -r "article_id" routes/ | grep -v "catalog_product_id"
```

### Étape 3: Renommer la table articles
```sql
-- Renommer au lieu de supprimer (backup de sécurité)
RENAME TABLE articles TO articles_old_backup;

-- Supprimer la table de mapping temporaire
DROP TABLE IF EXISTS _migration_article_mapping;
```

### Étape 4: Après 1 mois (optionnel)
```sql
-- Si vraiment certain, supprimer définitivement
DROP TABLE IF EXISTS articles_old_backup;
```

## 📈 Catégories créées automatiquement

Le script crée ces catégories pour chaque organisation:

| Nom | Couleur | Icône | Ordre |
|-----|---------|-------|-------|
| Boulangerie | #D2691E | bi-cake2 | 1 |
| Fromagerie | #FFD700 | bi-egg-fried | 2 |
| Viandes | #8B0000 | bi-egg | 3 |
| Charcuterie | #CD5C5C | bi-award | 4 |
| Volailles | #FF6347 | bi-egg | 5 |
| Poissons | #4682B4 | bi-water | 6 |
| Fruits & Légumes | #32CD32 | bi-apple | 7 |
| Épicerie | #DAA520 | bi-cart3 | 8 |
| Boissons | #8B008B | bi-cup-straw | 9 |
| Produits laitiers | #F0F8FF | bi-droplet | 10 |
| Biscuits | #CD853F | bi-cookie | 11 |
| Autres | #808080 | bi-three-dots | 99 |

## 🧪 Tests à effectuer après migration

### Test 1: Affichage d'un catalogue
- [ ] Accéder à `/catalogues`
- [ ] Ouvrir un catalogue
- [ ] Vérifier que tous les produits s'affichent
- [ ] Vérifier les catégories et couleurs
- [ ] Vérifier les images

### Test 2: Création de panier
- [ ] Ajouter des produits au panier
- [ ] Vérifier les quantités
- [ ] Vérifier les totaux
- [ ] Valider la commande

### Test 3: Consultation des commandes
- [ ] Accéder à `/commandes`
- [ ] Ouvrir une commande existante
- [ ] Vérifier que tous les articles sont visibles
- [ ] Vérifier les totaux

### Test 4: Admin catalogues
- [ ] Accéder à `/admin/catalogues`
- [ ] Créer un nouveau catalogue
- [ ] Ajouter des produits existants
- [ ] Éditer un catalogue
- [ ] Générer les synthèses (Excel/PDF)

### Test 5: Admin produits
- [ ] Accéder à `/admin/products` (nouvelles routes)
- [ ] Créer un nouveau produit
- [ ] Éditer un produit existant
- [ ] Changer sa catégorie
- [ ] Ajouter une image

## 🆘 Résolution de problèmes

### Problème: "Foreign key constraint fails"
**Solution**: Vérifier que la table `organizations` existe et contient des données.
```sql
SELECT * FROM organizations;
```

### Problème: "Panier_articles NON migrés > 0"
**Solution**: Certains articles n'ont pas été migrés. Vérifier les orphelins:
```sql
SELECT pa.id, pa.article_id, a.produit
FROM panier_articles pa
LEFT JOIN articles a ON pa.article_id = a.id
WHERE pa.catalog_product_id IS NULL;
```

### Problème: "Products créés = 0"
**Solution**: La table articles est vide ou le mapping a échoué.
```sql
-- Vérifier les articles
SELECT COUNT(*) FROM articles;

-- Vérifier les catalog_files
SELECT COUNT(*) FROM catalog_files;
```

### Problème: "Tous les produits sont dans 'Autres'"
**Solution**: Les mots-clés de catégorisation ne correspondent pas. Mettre à jour manuellement:
```sql
-- Exemple: recatégoriser les pains
UPDATE products p
JOIN categories c ON c.organization_id = p.organization_id AND c.nom = 'Boulangerie'
SET p.category_id = c.id
WHERE LOWER(p.nom) LIKE '%pain%' OR LOWER(p.nom) LIKE '%baguette%';
```

## 📞 Support

En cas de problème pendant la migration:
1. **NE PAS PANIQUER** - Vous avez un backup!
2. Restaurer le backup si nécessaire
3. Vérifier les logs MySQL pour identifier l'erreur
4. Consulter ce guide pour les solutions communes
5. Tester sur une base de données de test d'abord

## ✅ Checklist finale

Avant de considérer la migration comme réussie:

- [ ] Backup créé et vérifié
- [ ] Script exécuté sans erreur
- [ ] Statistiques vérifiées (0 panier non migré)
- [ ] Tests manuels effectués (catalogues, paniers, commandes)
- [ ] Application redémarrée avec PM2
- [ ] Logs vérifiés (aucune erreur)
- [ ] Toutes les routes testées
- [ ] Synthèses Excel/PDF générées correctement
- [ ] Performance acceptable (pas de régression)
- [ ] Documentation mise à jour

## 🎉 Après la migration

Nouvelles fonctionnalités disponibles:
- ✨ Gestion centralisée des produits (`/admin/products`)
- ✨ Gestion des fournisseurs (`/admin/suppliers`)
- ✨ Gestion des catégories (`/admin/categories`)
- ✨ Réutilisation des produits entre catalogues
- ✨ Catégorisation avec couleurs
- ✨ Images centralisées par produit

Profitez du nouveau modèle! 🚀
