# Import depuis Google Sheets

## Description

Scripts temporaires pour importer les données depuis Google Sheets vers la base de données.
Toutes les données importées sont préfixées avec "C_" pour faciliter les tests et le nettoyage.

⚠️ **IMPORTANT pour serveurs avec limitation mémoire** : Si vous avez des contraintes mémoire sur votre serveur de production, utilisez la méthode **CSV** au lieu de l'import direct Google Sheets (voir section "Import via CSV").

## Prérequis

1. **Fichier credentials.json**
   - Doit être présent à la racine du projet
   - Contient les clés d'authentification Google API

2. **Google Sheets formaté correctement**
   - Un onglet "Fournisseurs" avec les colonnes fournisseurs
   - Un onglet "Categories" avec les colonnes catégories
   - Un onglet "Produits" avec les colonnes produits

## Structure attendue des Google Sheets

### Onglet "Fournisseurs"

Colonnes recommandées (l'ordre n'a pas d'importance):
- `nom` (obligatoire) - Nom du fournisseur
- `contact` - Nom du contact
- `email` - Email
- `telephone` - Téléphone
- `adresse` - Adresse complète
- `code_postal` - Code postal
- `ville` - Ville
- `siret` - Numéro SIRET
- `notes` - Remarques

### Onglet "Categories"

Colonnes recommandées:
- `nom` (obligatoire) - Nom de la catégorie
- `description` - Description
- `ordre` - Ordre d'affichage (numérique)
- `couleur` - Code couleur (ex: #FF0000)
- `icon` - Icône Bootstrap (ex: bi-cart)

### Onglet "Produits"

Colonnes recommandées:
- `nom` (obligatoire) - Nom du produit
- `description` - Description
- `fournisseur` - Nom du fournisseur (doit correspondre à un fournisseur importé)
- `categorie` - Nom de la catégorie (doit correspondre à une catégorie importée)
- `reference` - Référence fournisseur
- `ean` - Code EAN / Code-barres
- `conditionnement` - Unité de conditionnement (ex: "kg", "pièce", "carton de 6")
- `dlc_jours` - Durée de conservation en jours
- `allergenes` - Liste des allergènes
- `origine` - Origine du produit
- `label` - Labels / Certifications (ex: "Bio", "Label Rouge")

## Configuration

1. Ouvrir le fichier `scripts/import-from-googlesheets.js`

2. Modifier les constantes en haut du fichier:

```javascript
const SPREADSHEET_ID = 'VOTRE_SPREADSHEET_ID_ICI'; // Remplacer par l'ID de votre Google Sheet
const ORGANIZATION_ID = 1; // ID de votre organisation

const RANGES = {
  suppliers: 'Fournisseurs!A1:Z1000',   // Nom de l'onglet fournisseurs
  categories: 'Categories!A1:Z1000',    // Nom de l'onglet catégories
  products: 'Produits!A1:Z1000'         // Nom de l'onglet produits
};
```

### Comment trouver le SPREADSHEET_ID ?

L'ID se trouve dans l'URL de votre Google Sheet:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_ICI/edit
                                        ^^^^^^^^^^^^^^^^^^
```

## Utilisation

### Méthode 1: Import direct (nécessite beaucoup de mémoire)

**⚠️ Ne fonctionne PAS sur serveurs avec limitation mémoire (LVE limits)**

```bash
cd /Users/fabrice.demange/1coopaz/coopazv13
node scripts/import-from-googlesheets.js
```

### Méthode 2: Import via CSV (recommandé pour serveurs limités)

**✅ Fonctionne sur serveurs avec contraintes mémoire**

#### Étape 1: Export en CSV (sur votre machine locale)

```bash
# Sur votre machine locale
cd /Users/fabrice.demange/1coopaz/coopazv13
node scripts/export-to-csv.js
```

Cela crée les fichiers:
- `data/suppliers.csv` (142 fournisseurs)
- `data/products.csv` (2612 produits)

**Note sur les catégories** : Il n'y a pas de fichier séparé pour les catégories. Les catégories sont **automatiquement extraites et créées** depuis la colonne "categorie" du fichier products.csv lors de l'import.

#### Étape 2: Transférer vers le serveur

```bash
# Transférer les CSV vers le serveur
scp data/*.csv user@server:/path/to/coopazv13/data/
```

#### Étape 3: Import sur le serveur

```bash
# Sur le serveur de production
cd /path/to/coopazv13
node scripts/import-from-csv.js
```

Le script importe les données **par petits lots de 50 lignes** pour limiter l'usage mémoire.

Le script va:
1. Se connecter à Google Sheets
2. Importer les fournisseurs (avec préfixe C_)
3. Importer les catégories (avec préfixe C_)
4. Importer les produits (avec préfixe C_) en les liant aux fournisseurs et catégories

### 2. Vérification des données

Vérifier que les données sont bien importées:

```bash
# Se connecter à MySQL
mysql -u root coopazfr_commandes

# Vérifier les imports
SELECT COUNT(*) FROM suppliers WHERE nom LIKE 'C_%';
SELECT COUNT(*) FROM categories WHERE nom LIKE 'C_%';
SELECT COUNT(*) FROM products WHERE nom LIKE 'C_%';

# Voir quelques exemples
SELECT * FROM products WHERE nom LIKE 'C_%' LIMIT 5;
```

### 3. Nettoyage des données de test

Quand vous avez terminé vos tests:

```bash
node scripts/cleanup-import-test.js
```

Ce script va:
1. Compter toutes les données préfixées "C_"
2. Demander confirmation
3. Supprimer toutes les données de test

## Gestion des erreurs

### Erreur "Column not found"

Si une colonne obligatoire n'est pas trouvée, le script affichera les colonnes détectées.
Vérifiez que vos en-têtes correspondent aux noms attendus (voir structure ci-dessus).

### Erreur "credentials.json not found"

Le fichier credentials.json doit être à la racine du projet.

### Erreur de connexion Google Sheets

Vérifiez que:
- Le SPREADSHEET_ID est correct
- Le fichier credentials.json a les bonnes permissions
- Les onglets existent dans le Google Sheet

### Produits sans fournisseur/catégorie

Si un produit référence un fournisseur ou une catégorie qui n'existe pas encore,
les champs supplier_id ou category_id seront NULL.

Assurez-vous d'importer les fournisseurs et catégories AVANT les produits.

## Nettoyage manuel

Si nécessaire, vous pouvez supprimer manuellement les données de test:

```sql
-- Supprimer tous les produits de test
DELETE FROM products WHERE nom LIKE 'C_%';

-- Supprimer toutes les catégories de test
DELETE FROM categories WHERE nom LIKE 'C_%';

-- Supprimer tous les fournisseurs de test
DELETE FROM suppliers WHERE nom LIKE 'C_%';
```

## Notes importantes

- ⚠️ Ces scripts sont temporaires et destinés aux tests
- ✅ Toutes les données importées ont le préfixe "C_" pour faciliter l'identification
- 🔒 Les données ne sont créées que si la colonne "nom" est présente
- 📊 L'ordre d'import est important: Suppliers → Categories → Products
- 🧹 Utilisez le script de nettoyage pour supprimer facilement les données de test

## Support

En cas de problème, vérifiez:
1. Les logs du script (affichés dans la console)
2. La structure de votre Google Sheet
3. Les permissions du fichier credentials.json
4. La connexion à la base de données (.env)
