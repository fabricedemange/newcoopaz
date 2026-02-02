# Guide de test - Version Vue.js de la page d'accueil

## ✅ Installation terminée et corrigée

L'implémentation progressive de Vue.js utilise maintenant les **builds globaux** (IIFE) au lieu des modules ES, ce qui évite les problèmes de dépendances.

## 🧪 Comment tester

### 1. Connectez-vous à l'application

Ouvrez votre navigateur et allez sur :
```
http://localhost:3100/
```

Connectez-vous avec vos identifiants habituels.

### 2. Accédez à la version Vue.js

Une fois connecté, allez sur :
```
http://localhost:3100/vue
```

Vous devriez voir la même page d'accueil, mais cette fois rendue par Vue.js !

## 🔍 Ce qui a changé (corrections)

### Problème résolu : Erreur "vue-demi"
- ❌ **Avant** : Utilisation des modules ES qui nécessitaient des dépendances complexes
- ✅ **Maintenant** : Utilisation des builds globaux (IIFE) de Vue et Pinia
- Les scripts sont chargés via `<script src="">` classique au lieu de `type="module"`

### Problème résolu : Console error datatables
- ❌ **Avant** : `console.error("Table #usersTable non trouvée !")` s'affichait sur toutes les pages
- ✅ **Maintenant** : Le script ignore silencieusement les tables absentes

### Architecture simplifiée
- **Vue 3** : `vue.global.prod.js` (build global optimisé)
- **Pinia** : `pinia.iife.prod.js` (build IIFE optimisé)
- **Pas de build step** : Tout fonctionne directement dans le navigateur
- **Un seul fichier** : `HomeApp-global.js` contient tout (store, composants, app)

## 🎯 Ce que vous devriez voir

1. **Loader initial** : Spinner pendant le chargement
2. **Tableau de bord** avec 3 cartes de statistiques :
   - 📦 Paniers en cours
   - 🚚 Commandes en attente
   - 📚 Catalogues disponibles
3. **Table des paniers** avec badges d'alerte colorés
4. **Table des commandes** en attente de livraison
5. **Cartes des nouveaux catalogues**
6. **Sidebar** visible à gauche

## 🔧 Debugging

### Si la page est blanche

1. **Ouvrez la console** (F12) → Onglet "Console"
2. Cherchez les erreurs JavaScript
3. Vérifiez que Vue et Pinia sont chargés :
   ```javascript
   console.log(Vue);  // Devrait afficher un objet
   console.log(Pinia); // Devrait afficher un objet
   ```

### Si les données ne s'affichent pas

1. **Onglet Network** (F12)
2. Rafraîchissez la page
3. Cherchez l'appel `/api/home`
4. Cliquez dessus et vérifiez :
   - **Status** : Devrait être 200
   - **Response** : Devrait contenir `{"success":true, "stats": {...}}`

### Erreurs possibles

**Erreur 302 sur /api/home** :
- Vous n'êtes pas connecté
- Solution : Connectez-vous d'abord sur `/`

**Erreur "Vue is not defined"** :
- Le script Vue n'a pas été chargé
- Vérifiez votre connexion internet
- Vérifiez que unpkg.com est accessible

**Erreur "Pinia is not defined"** :
- Le script Pinia n'a pas été chargé
- Même solution que pour Vue

## 📊 Tester les fonctionnalités

### Loader
- Rafraîchissez la page (F5)
- Vous devriez voir un spinner pendant ~1 seconde

### Badges d'alerte sur les paniers
Les badges changent selon la date d'expiration :
- 🔴 **Rouge** : Expire aujourd'hui
- 🟡 **Jaune** : Expire demain
- 🔵 **Bleu** : Expire dans 2-3 jours
- Pas de badge si > 3 jours

### Actions
- **Bouton "Modifier"** : Va sur `/panier/{id}/modifier`
- **Bouton "Voir"** : Va sur `/panier/{id}/catalogue/{catalogue_id}`
- **Bouton "Commander"** (catalogues) : Va sur `/catalogues/{id}`

### Réactivité
Dans la console, testez la réactivité Vue :
```javascript
// Accéder au store (nécessite Vue DevTools ou inspection)
// Les données se mettent à jour automatiquement dans l'UI
```

## 🆚 Comparaison EJS vs Vue.js

| Aspect | EJS (/) | Vue.js (/vue) |
|--------|---------|---------------|
| Rendu | Serveur | Client |
| Données | Intégrées au HTML | Chargées via API |
| Réactivité | ❌ Rechargement complet | ✅ Mise à jour automatique |
| Taille initiale | Plus légère | Légèrement plus lourde |
| Interactivité | Limitée | Complète |
| SEO | Meilleur | Bon (avec SSR) |

## 🚀 Prochaines étapes

Si tout fonctionne bien :

### Option 1 : Remplacer la page principale
```bash
# Renommer l'ancienne
mv views/index.ejs views/index_ejs_old.ejs

# Renommer la nouvelle
mv views/index_vue.ejs views/index.ejs

# Maintenant / utilisera Vue.js
```

### Option 2 : Garder les deux versions
- Laisser `/` en EJS (stable)
- Utiliser `/vue` pour tester
- Migrer progressivement les autres pages

### Option 3 : Ajouter un toggle
Permettre à l'utilisateur de choisir entre les deux versions.

## 📁 Fichiers modifiés

- ✅ `views/index_vue.ejs` - Template avec builds globaux
- ✅ `public/vue/HomeApp-global.js` - Application Vue en un seul fichier
- ✅ `public/js/datatables-init.js` - Suppression des console.error inutiles
- ✅ `routes/index.routes.js` - Route `/vue` ajoutée
- ✅ `routes/api.home.routes.js` - API REST pour les données
- ✅ `app.js` - CSP mise à jour, route API enregistrée

## 💡 Conseil

La version Vue.js offre une meilleure expérience utilisateur avec :
- ⚡ Interactions instantanées
- 🔄 Mises à jour réactives
- 🎨 Interface moderne
- 🛠️ Code maintenable

Bon test ! 🎉
