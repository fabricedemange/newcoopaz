# Migration Progressive vers Vue.js

## État actuel

La page d'accueil a été migrée vers Vue.js 3 en approche progressive, permettant de tester la nouvelle architecture tout en conservant la version EJS existante.

## Structure mise en place

### Backend

1. **Route API** : `/routes/api.home.routes.js`
   - Endpoint REST `/api/home` qui retourne les données en JSON
   - Utilise les mêmes requêtes SQL que la version EJS
   - Retourne : stats, paniers détails, commandes détails, nouveaux catalogues

2. **Enregistrement** : `app.js`
   - Import : `const apiHomeRoutes = require("./routes/api.home.routes");`
   - Route : `app.use("/api", apiHomeRoutes);`

### Frontend

1. **Structure des fichiers** : `/public/vue/`
   ```
   /public/vue/
   ├── HomeApp.js              # Application Vue principale
   ├── services/
   │   └── api.js              # Service API pour fetch
   ├── stores/
   │   └── home.js             # Store Pinia pour state management
   └── components/
       ├── StatCard.js         # Composant carte de statistique
       ├── PanierTable.js      # Table des paniers
       ├── CommandeTable.js    # Table des commandes
       └── NouveauxCatalogues.js # Cartes nouveaux catalogues
   ```

2. **Templates EJS**
   - `/views/index_vue.ejs` : Version Vue.js (accessible via `/vue`)
   - `/views/index.ejs` : Version EJS classique (accessible via `/`)

## Comment tester

1. **Version EJS (actuelle)** : `http://localhost:3100/`
2. **Version Vue.js (nouvelle)** : `http://localhost:3100/vue`

Les deux versions utilisent exactement les mêmes données mais :
- La version EJS fait le rendu côté serveur
- La version Vue.js charge les données via API et fait le rendu côté client

## Architecture Vue.js

### Technologies utilisées

- **Vue 3** : Framework progressif avec Composition API
- **Pinia** : State management moderne pour Vue
- **ES Modules** : Chargement via CDN pour éviter un build step
- **Fetch API** : Communication avec le backend

### Composants créés

1. **StatCard** : Affiche une statistique (paniers, commandes, catalogues)
   - Props : title, value, icon, color
   - Utilise Bootstrap Icons

2. **PanierTable** : Liste des paniers en cours
   - Calcul automatique des jours avant expiration
   - Badges d'alerte colorés
   - Actions : Modifier, Voir

3. **CommandeTable** : Liste des commandes en attente
   - Affichage de la date de livraison
   - Badge de statut

4. **NouveauxCatalogues** : Cartes des nouveaux catalogues
   - Affichage des dates importantes
   - Bouton de commande

### Store Pinia

Le store `home.js` gère :
- **State** : loading, error, stats, paniersDetails, commandesDetails, nouveauxCatalogues
- **Actions** : loadHomeData() pour charger les données via API
- **Getters** : hasPaniers, hasCommandes, hasNouveauxCatalogues

## Prochaines étapes

### Migration progressive

1. **Tester la version Vue** : Utiliser `/vue` pour valider le fonctionnement
2. **Feedback utilisateurs** : Recueillir les retours sur la nouvelle interface
3. **Basculer progressivement** : Quand prêt, remplacer `/` par la version Vue

### Autres pages à migrer

- Catalogues list
- Panier
- Commandes
- Admin

### Améliorations possibles

1. **Build step avec Vite** : Pour optimiser le bundle
2. **Composants SFC** : Utiliser des Single File Components (.vue)
3. **TypeScript** : Ajouter le typage pour plus de robustesse
4. **Tests** : Ajouter Vitest pour les tests unitaires
5. **Lazy loading** : Charger les composants à la demande
6. **Transitions** : Ajouter des animations Vue

## Avantages de Vue.js

✅ **Réactivité** : Mise à jour automatique de l'interface
✅ **Composants réutilisables** : DRY principle
✅ **State management** : Gestion centralisée avec Pinia
✅ **Performance** : Virtual DOM optimisé
✅ **Developer experience** : Hot reload, debugging
✅ **Écosystème** : Nombreux plugins et composants

## Notes techniques

- Les imports utilisent `https://unpkg.com` pour Vue et Pinia (pas de build nécessaire)
- La CSP dans `app.js` autorise déjà `cdn.jsdelivr.net`
- Le sidebar reste visible grâce à `hideSidebar: false`
- L'authentification est gérée côté serveur avec `requireLogin`
