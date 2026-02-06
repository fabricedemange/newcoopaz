# Guide de Vérification des Contraintes de Base de Données

Ce guide explique comment vérifier que toutes les contraintes de base de données (clés primaires, clés étrangères, UNIQUE, NOT NULL) sont bien appliquées dans votre base de données MySQL.

## 📋 Vue d'ensemble

Deux méthodes sont disponibles pour vérifier les contraintes :

1. **Script SQL** (`migrations/verify_constraints.sql`) - À exécuter directement dans MySQL
2. **Script Node.js** (`scripts/verify-constraints.js`) - Script automatisé avec rapport formaté

## 🚀 Méthode 1 : Script SQL (Recommandé pour analyse détaillée)

### Utilisation

```bash
# Via MySQL en ligne de commande
mysql -u root -p coopazfr_commandes < migrations/verify_constraints.sql

# Ou via phpMyAdmin
# 1. Ouvrir phpMyAdmin
# 2. Sélectionner votre base de données
# 3. Aller dans l'onglet "SQL"
# 4. Copier-coller le contenu de migrations/verify_constraints.sql
# 5. Cliquer sur "Exécuter"
```

### Ce que le script vérifie

1. **Contraintes de clés étrangères (FOREIGN KEY)**
   - Liste toutes les relations entre tables
   - Affiche les règles UPDATE et DELETE

2. **Contraintes de clés primaires (PRIMARY KEY)**
   - Liste toutes les clés primaires par table

3. **Contraintes UNIQUE**
   - Liste toutes les contraintes d'unicité

4. **Vérification de l'intégrité référentielle**
   - Détecte les enregistrements orphelins (données qui violent les contraintes FK)
   - Vérifie les relations pour :
     - `products` → `organizations`, `suppliers`, `categories`
     - `catalog_products` → `catalog_files`, `products`
     - `role_permissions` → `roles`, `permissions`
     - `user_roles` → `utilisateurs`, `roles`
     - `roles` → `organizations`

5. **Contraintes NOT NULL**
   - Liste toutes les colonnes qui ne peuvent pas être NULL

6. **Contraintes CHECK** (MySQL 8.0+)
   - Liste les contraintes de validation

7. **Statistiques par table**
   - Nombre de lignes, taille des données et index

8. **Résumé des contraintes**
   - Compte total par type de contrainte

## 🚀 Méthode 2 : Script Node.js (Recommandé pour intégration CI/CD)

### Prérequis

- Node.js installé
- Variables d'environnement configurées (`.env`)

### Utilisation

```bash
# Depuis la racine du projet
node scripts/verify-constraints.js

# Ou avec des variables d'environnement personnalisées
DB_HOST=localhost DB_USER=root DB_PASS=password DB_NAME=mydb node scripts/verify-constraints.js
```

### Avantages du script Node.js

- ✅ Rapport formaté et lisible
- ✅ Détection automatique des erreurs
- ✅ Code de sortie approprié pour CI/CD
- ✅ Messages d'erreur clairs
- ✅ Gestion des tables manquantes

### Exemple de sortie

```
🔍 VÉRIFICATION DES CONTRAINTES DE BASE DE DONNÉES

Base de données: coopazfr_commandes
Serveur: localhost

✅ Connexion à la base de données établie

================================================================================
  1. CONTRAINTES DE CLÉS ÉTRANGÈRES
================================================================================

  table_name        | constraint_name              | column_name      | referenced_table_name | update_rule | delete_rule
  ----------------- | ---------------------------- | ---------------- | --------------------- | ----------- | -----------
  catalog_products  | fk_catalog_products_catalog  | catalog_file_id  | catalog_files         | RESTRICT    | CASCADE
  catalog_products  | fk_catalog_products_product  | product_id       | products              | RESTRICT    | RESTRICT
  products          | fk_products_category         | category_id      | categories            | RESTRICT    | SET NULL
  ...

================================================================================
  4. VÉRIFICATION DE L'INTÉGRITÉ RÉFÉRENTIELLE
================================================================================

  constraint                    | orphaned_records | status
  ---------------------------- | ---------------- | --------
  products.organization_id     | 0                | ✅ OK
  products.supplier_id          | 0                | ✅ OK
  catalog_products.product_id  | 0                | ✅ OK
  ...

  ✅ Toutes les vérifications d'intégrité référentielle sont OK.
```

## 🔍 Interprétation des résultats

### ✅ Tout est OK

Si toutes les vérifications passent :
- Toutes les contraintes sont correctement appliquées
- Aucune donnée orpheline détectée
- L'intégrité référentielle est respectée

### ⚠️ Problèmes détectés

Si des enregistrements orphelins sont trouvés :

1. **Identifier le problème**
   - Le rapport indique quelle contrainte est violée
   - Exemple : `products.supplier_id` avec 5 enregistrements orphelins

2. **Trouver les données problématiques**
   ```sql
   -- Exemple : trouver les produits avec un supplier_id invalide
   SELECT p.id, p.nom, p.supplier_id
   FROM products p
   LEFT JOIN suppliers s ON p.supplier_id = s.id
   WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;
   ```

3. **Corriger les données**
   - Option 1 : Mettre à jour les IDs invalides vers des valeurs valides
   - Option 2 : Mettre les valeurs à NULL si la contrainte le permet
   - Option 3 : Supprimer les enregistrements si nécessaire

4. **Réexécuter la vérification**
   ```bash
   node scripts/verify-constraints.js
   ```

## 📝 Exemples de corrections

### Correction d'un supplier_id invalide

```sql
-- Trouver les produits avec supplier_id invalide
SELECT p.id, p.nom, p.supplier_id
FROM products p
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;

-- Option 1 : Mettre à NULL (si la contrainte le permet)
UPDATE products p
LEFT JOIN suppliers s ON p.supplier_id = s.id
SET p.supplier_id = NULL
WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;

-- Option 2 : Assigner un fournisseur par défaut
UPDATE products p
LEFT JOIN suppliers s ON p.supplier_id = s.id
SET p.supplier_id = (
  SELECT id FROM suppliers 
  WHERE organization_id = p.organization_id 
  LIMIT 1
)
WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;
```

### Vérification avant une migration

```bash
# 1. Vérifier l'état actuel
node scripts/verify-constraints.js

# 2. Si tout est OK, exécuter la migration
mysql -u root -p coopazfr_commandes < migrations/ma_migration.sql

# 3. Vérifier à nouveau après la migration
node scripts/verify-constraints.js
```

## 🔄 Intégration dans un workflow CI/CD

Le script Node.js retourne un code de sortie approprié :

- `0` : Toutes les contraintes sont OK
- `1` : Des problèmes d'intégrité ont été détectés

Exemple pour GitHub Actions :

```yaml
- name: Vérifier les contraintes de base de données
  run: |
    node scripts/verify-constraints.js
  env:
    DB_HOST: ${{ secrets.DB_HOST }}
    DB_USER: ${{ secrets.DB_USER }}
    DB_PASS: ${{ secrets.DB_PASS }}
    DB_NAME: ${{ secrets.DB_NAME }}
```

## 📚 Ressources supplémentaires

- [Documentation MySQL - Contraintes](https://dev.mysql.com/doc/refman/8.0/en/constraints.html)
- [Documentation MySQL - Clés étrangères](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html)
- [INFORMATION_SCHEMA - MySQL](https://dev.mysql.com/doc/refman/8.0/en/information-schema.html)

## ❓ Questions fréquentes

### Q: Pourquoi certaines tables ne sont pas vérifiées ?

R: Le script vérifie les tables principales avec des contraintes de clés étrangères. Si une table n'apparaît pas, c'est qu'elle n'a pas de contraintes FK définies ou qu'elle n'existe pas encore.

### Q: Le script peut-il corriger automatiquement les problèmes ?

R: Non, le script est en lecture seule. Il détecte les problèmes mais ne les corrige pas automatiquement pour éviter toute perte de données.

### Q: Puis-je ajouter mes propres vérifications ?

R: Oui ! Modifiez le fichier `scripts/verify-constraints.js` et ajoutez vos propres vérifications dans la fonction `checkReferentialIntegrity()`.

### Q: Le script fonctionne-t-il avec d'autres bases de données ?

R: Non, ce script est spécifique à MySQL/MariaDB. Pour PostgreSQL ou d'autres SGBD, il faudrait adapter les requêtes SQL.
