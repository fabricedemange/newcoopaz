# Frontend CoopAz (Vite + Vue 3)

## Prérequis

- Node 18+
- Backend Express sur le port **3000** (API + pages EJS)

## Dev

```bash
# Terminal 1 : backend (port 3000)
npm run dev

# Terminal 2 : front Vite (port 3200)
npm run dev:frontend
```

Ouvre **http://localhost:3200** : la page d’accueil Vue est servie par Vite avec HMR. Les appels `/api/*` et `/uploads` sont proxyfiés vers `http://localhost:3000`.

## Build

```bash
npm run build:frontend
```

Génère les fichiers dans `public/dist/` (ex. `home.js`). Les vues EJS (ex. `index_vue.ejs`) chargent `/dist/home.js` ; Express sert `public/` donc `/dist/` est déjà pris en charge.

## Structure

- `src/entries/home.js` : point d’entrée de la page d’accueil
- `src/views/HomePage.vue` : composant page
- `src/stores/home.js` : store Pinia
- `src/api/index.js` : appels API
