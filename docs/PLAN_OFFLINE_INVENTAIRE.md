# Plan : Page inventaire hors ligne (`/caisse/inventaire`)

## Objectif

Rendre la page `http://localhost:3000/caisse/inventaire` fonctionnelle hors ligne afin de permettre la réalisation d’inventaires en cave, entrepôt ou magasin sans connexion, avec synchronisation à la reconnexion.

---

## Architecture actuelle

| Élément | Détail |
|---------|--------|
| **Stack** | Vue 3 + Pinia, rendu via EJS (`caisse_inventaire_vue.ejs`) |
| **Bundle** | `caisse-inventaire.js` (Vite) + chunks |
| **Données au chargement** | `fetchCaisseProduits()` → GET `/api/caisse/produits` (produits + catégories) |
| **APIs en cours d’usage** | `createInventaire`, `addInventaireLigne`, `appliquerInventaire`, `updateProductCodeEan` |
| **Assets** | Bootstrap CSS/JS (CDN), Bootstrap Icons (CDN), CSS locaux |

---

## Données nécessaires hors ligne

### Lecture (cache)

- **Produits** : `id`, `nom`, `stock`, `prix`, `unite`, `code_ean`, `category_id`, `category_nom`, etc.
- **Catégories** : `id`, `nom`, `couleur`

→ Utilisées pour la recherche produit et le scan code-barres.

### Écriture (file de sync)

- Création de session d’inventaire
- Ajout / mise à jour / suppression de lignes
- Mise à jour de code EAN produit (optionnel en offline)
- Application de l’inventaire (à exécuter uniquement en ligne)

---

## Plan d’implémentation

### Phase 1 : PWA de base (assets et page)

1. **Manifeste web** (`/public/manifest.json`)
   - `name`, `short_name`, `start_url` → `/caisse/inventaire`
   - `display: standalone` pour usage mobile
   - Icône(s) (réutiliser favicon ou créer icône dédiée)

2. **Service worker** (`/public/sw.js` ou généré par Vite/Workbox)
   - Stratégie **Cache First** pour :
     - `/dist/caisse-inventaire.js`, chunks, CSS
     - `/css/vue-tables.css`, `responsive-fix.css`, etc.
   - Stratégie **Network First** pour `/caisse/inventaire` (HTML) si en ligne
   - Fallback : page inventaire en cache si hors ligne

3. **Inscription du SW** dans `caisse_inventaire_vue.ejs` ou dans `caisse-inventaire.js` :
   ```js
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js').catch(() => {});
   }
   ```

4. **Liens Bootstrap**  
   - Soit les inclure dans le cache du SW  
   - Soit passer à des assets locaux pour garantir l’offline (optionnel, phase 2)

---

### Phase 2 : IndexedDB – cache des produits

1. **Module `frontend/src/lib/offline-inventaire.js`** (ou équivalent)
   - Base IndexedDB : `coopaz-inventaire-offline`
   - Stores :
     - `produits` : clé `id`, valeur produit
     - `categories` : clé `id`, valeur catégorie
     - `meta` : `{ lastSync: timestamp, organizationId }` pour invalidation

2. **Stratégie de chargement**
   - En ligne : `fetchCaisseProduits()` → mise à jour IndexedDB → affichage
   - Hors ligne : lecture depuis IndexedDB
   - Si pas de cache : message « Connectez-vous une première fois pour activer le mode hors ligne »

3. **Mise à jour du composant**  
   - Adapter `CaisseInventairePage.vue` pour :
     - Appeler une couche `getProduitsEtCategories()` qui choisit API vs IndexedDB selon `navigator.onLine`

---

### Phase 3 : Inventaire local (session + lignes)

1. **Store IndexedDB**
   - `inventaire_draft` : une entrée `{ id: 'local-uuid', lignes: [...] }` (un seul brouillon)
   - `lignes` : `{ product_id, product_nom, quantite_comptee, stock_theorique, ecart, comment }`

2. **Comportement hors ligne**
   - `demarrerSession()` : crée un ID local (ex. `local-${Date.now()}`), stocke en IndexedDB
   - `addInventaireLigne()` : met à jour le brouillon local
   - `retirerLigne()` : supprime de la ligne du brouillon local
   - `appliquerInventaire()` : **désactivé** hors ligne, avec message « Reconnexion requise pour appliquer »

3. **État UI**
   - Indicateur « Mode hors ligne » (badge ou bannière)
   - Désactiver le bouton « Appliquer » et afficher un message clair

---

### Phase 4 : File de synchronisation

1. **Store IndexedDB** : `sync_queue`
   - Entrées ordonnées : `{ id, action, payload, createdAt }`
   - Types : `create_inventaire`, `add_ligne`, `update_ligne`, `remove_ligne`, `appliquer_inventaire`

2. **Flux de sync**
   - À la reconnexion (`online` event) :
     1. Créer la session via API → récupérer `inventaire.id` serveur
     2. Pour chaque ligne : `addInventaireLigne(inventaireId, ...)`
     3. `appliquerInventaire(inventaireId)`
     4. Vider la file et le brouillon local

3. **Gestion d’erreurs**
   - Si une requête échoue (409, 500, etc.) : garder la file, afficher une alerte, réessayer au prochain `online`

4. **Mapping IDs**
   - Conserver un mapping `localId → serverId` pour les sessions créées hors ligne

---

### Phase 5 : Mise à jour code EAN hors ligne (optionnel)

- Mettre à jour le produit en mémoire (et en IndexedDB) immédiatement
- Enfiler `updateProductCodeEan` dans la file de sync
- À la reconnexion : envoyer les mises à jour de code EAN avant de finaliser l’inventaire

---

## Ordre des tâches

| # | Tâche | Priorité |
|---|-------|----------|
| 1 | Créer `manifest.json` | Haute |
| 2 | Créer le service worker (cache inventaire + assets) | Haute |
| 3 | Inscrire le SW depuis la page inventaire | Haute |
| 4 | Module IndexedDB : cache produits + catégories | Haute |
| 5 | Adapter `fetchCaisseProduits` / chargement données selon online/offline | Haute |
| 6 | Inventaire draft local (session + lignes) en IndexedDB | Haute |
| 7 | File de sync + replay à la reconnexion | Haute |
| 8 | Indicateur « Mode hors ligne » + désactivation « Appliquer » offline | Moyenne |
| 9 | Mise à jour code EAN en file de sync (optionnel) | Basse |
| 10 | Bootstrap en local pour garantir offline (si CDN bloque) | Basse |

---

## Fichiers à créer ou modifier

| Fichier | Action |
|---------|--------|
| `public/manifest.json` | Créer |
| `public/sw.js` | Créer |
| `views/caisse_inventaire_vue.ejs` | Lien manifest + inscription SW |
| `frontend/src/lib/offline-inventaire.js` | Créer (IndexedDB + sync) |
| `frontend/src/api/index.js` | Adapter `fetchCaisseProduits` (stratégie offline) |
| `frontend/src/views/CaisseInventairePage.vue` | Utiliser offline store, indicateur mode, désactiver Appliquer offline |
| `app.js` ou routes | S’assurer que `/sw.js` et `/manifest.json` sont servis en statique |

---

## Contraintes et limites

1. **Première visite** : le mode offline nécessite au moins une visite en ligne pour remplir le cache produits.
2. **Authentification** : la session (cookie) doit être valide avant de passer en offline. Une expiration en cours d’inventaire peut bloquer la sync.
3. **Conflits** : pas de modification concurrente côté serveur pendant l’offline (un seul opérateur par session). Stratégie : dernière écriture gagnante.
4. **Organisation** : le cache produits est lié à `organization_id` (session). Un changement d’organisation en ligne invalide le cache.

---

## Tests manuels

1. Charger `/caisse/inventaire` en ligne → vérifier cache produits
2. Couper le réseau (DevTools → Offline)
3. Rafraîchir → la page et les produits doivent s’afficher
4. Démarrer une session, ajouter des lignes → tout reste local
5. Vérifier que « Appliquer » est désactivé
6. Rétablir le réseau → vérifier la sync (session créée, lignes envoyées, inventaire appliqué)
