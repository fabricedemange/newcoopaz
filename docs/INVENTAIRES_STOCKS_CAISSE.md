# Inventaires, stocks et cohérence caisse

Documentation des principes (inventaires, stocks, cohérence caisse), du rapprochement stocks/inventaires et de la conservation de l’historique des mouvements de stock et des sessions d’inventaire.

---

## 1. Grands principes

### Stock

- **Stock théorique** : quantité en base dans `products.stock`.
- Toute **vente** en caisse décrémente ce stock (dans la même transaction que l’insertion en `ventes` et `lignes_vente`).
- Comportement actuel : **pas de blocage** si stock &lt; 0 (stocks négatifs autorisés).

### Inventaire

- **Inventaire** = comptage physique (réel) en magasin.
- Il sert à **rapprocher** le stock théorique du réel.
- Peut être fait par **scan code-barres** (caméra) ou par **recherche produit** (nom + catégorie), puis saisie de la quantité comptée.

### Cohérence caisse

- Une vente = une ligne dans `ventes` + lignes dans `lignes_vente` + décrémentation de `products.stock` dans la **même transaction**.
- Les lignes **sans produit** (cotisation, avoir) ne touchent **pas** au stock.

---

## 2. Faire des inventaires facilement

### Avec code-barres

- Page **Caisse > Inventaire** : scan caméra pour collecter les codes-barres.
- Enregistrer une **session d’inventaire** (tables `inventaires` + `inventaire_lignes`).
- Afficher le **stock théorique** à côté de chaque article scanné, calculer l’**écart** (quantité comptée − stock théorique).
- Proposer un **rapprochement** : bouton « Appliquer l’inventaire » met à jour `products.stock` avec les quantités comptées et enregistre les mouvements dans l’historique.

### Sans code-barres (recherche produit)

- Même page **Caisse > Inventaire** : **recherche par nom** et **filtre par catégorie** (même UX que la caisse).
- L’utilisateur choisit un produit dans la liste filtrée, saisit la **quantité comptée**, la ligne est ajoutée à la session d’inventaire (même modèle que les lignes issues du scan).
- Une seule session, une seule liste de lignes (produit, quantité comptée, stock théorique, écart).

### Conservation de l’historique

- Chaque changement de stock (vente, ajustement, inventaire) est enregistré dans la table **`stock_movements`**.
- Chaque session d’inventaire est conservée dans **`inventaires`** avec ses lignes dans **`inventaire_lignes`** (produit, quantité comptée, stock théorique, écart).

---

## 3. Rapprochement stocks / inventaires

- **Données** : stock théorique (`products.stock`) et quantités comptées (`inventaire_lignes.quantite_comptee`).
- **Écart** : `quantite_comptee - stock_theorique` pour chaque produit inventorié.
- **Affichage** : écarts positifs/négatifs dans l’UI.
- **Appliquer l’inventaire** : pour chaque ligne, mettre à jour `products.stock` avec la quantité comptée et insérer une entrée dans `stock_movements` (type `inventaire`).

---

## 4. Implémentation technique

### 4.1 Tables (migration)

- **`stock_movements`** : id, organization_id, product_id, type (vente, ajustement, inventaire), quantite (signée), stock_avant, stock_apres, reference_type, reference_id, created_by, created_at, comment.
- **`inventaires`** : id, organization_id, statut (draft, complete), created_by, created_at, completed_at, comment.
- **`inventaire_lignes`** : id, inventaire_id, product_id, quantite_comptee, stock_theorique, ecart.

### 4.2 Backend

- **Ventes** : après chaque `UPDATE products SET stock = stock - ?`, insérer une ligne dans `stock_movements` (type `vente`).
- **API inventaires** : POST/GET inventaires, POST lignes, POST appliquer ; GET stock-mouvements ; GET inventaires (liste).

### 4.3 Frontend

- **Page Inventaire** : deux modes d’ajout (scan code-barres + recherche produit) ; session draft ; liste des lignes avec stock théorique et écart ; bouton « Appliquer l’inventaire ».
- **Historique mouvements stock** : liste des mouvements avec filtres (produit, type, date).
- **Historique inventaires** : liste des sessions avec détail (lignes + écarts).

### 4.4 Permissions

- `caisse.sell` : créer/appliquer un inventaire depuis la caisse.
- `stock.view_movements` : consulter l’historique des mouvements.
- `inventory.view_history` : consulter l’historique des inventaires.
- `stock.adjust` : ajustements manuels (si implémenté).
