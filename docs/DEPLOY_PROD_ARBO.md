# Déploiement en production – Arborescence et fichiers à prendre

## 1. Principe

En prod, vous déployez **tout le dépôt Git** (ou une copie propre), **sans** les dossiers/fichiers listés en « À ne pas déployer ». Vous **créez** sur le serveur le `.env` et vous **installez** les dépendances (`npm install`). Vous **construisez** le frontend si `public/dist` n’est pas versionné.

---

## 2. Arborescence à déployer (à avoir sur le serveur)

```
coopazv13/                    # ou le nom du dossier de déploiement
├── app.js                    # Point d'entrée
├── package.json
├── package-lock.json
├── .htaccess                 # Si hébergement Apache/Passenger (adapter le chemin)
├── config/
│   ├── config.js
│   ├── csrf.js
│   ├── db-trace-wrapper.js
│   └── logger.js
├── middleware/
│   ├── middleware.js
│   └── rbac.middleware.js
│   └── ... (tous les .js)
├── routes/                   # Tous les fichiers .js
├── views/                    # Tous les .ejs
├── public/
│   ├── .htaccess
│   ├── dist/                 # Build Vue (voir § 4)
│   │   ├── *.js
│   │   ├── chunks/
│   │   └── assets/
│   ├── css/
│   ├── js/
│   ├── favicon.ico
│   └── style.css
├── services/
├── utils/
├── models/
├── migrations/               # Tous les .sql utiles (structure + RBAC + cotisation, etc.)
├── fonts/
├── frontend/                 # Sources Vue (nécessaires pour rebuild)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
├── scripts/                  # Scripts éventuels (migrations, cron)
├── docs/                     # Optionnel
├── tmp/                      # Créer sur le serveur (mkdir tmp)
│   └── restart.txt           # Pour Passenger
├── uploads/                  # Créer sur le serveur (mkdir -p uploads/products)
│   └── .gitkeep
├── logs/                     # Optionnel, si l'app écrit des logs ici
└── .env                      # À créer sur le serveur (jamais dans Git)
```

---

## 3. À ne pas déployer (ou à ignorer / ne pas recopier)

| Élément | Raison |
|--------|--------|
| `node_modules/` | Réinstaller avec `npm install --production` sur le serveur |
| `.env`, `.env.local`, `.env.production` | Secrets ; à créer manuellement sur le serveur |
| `archive/` | Ancien code, pas nécessaire en prod |
| `backups/` | Backups locaux, ne pas monter en prod |
| `uploads/*` (fichiers) | Données locales ; en prod, garder le dossier vide ou migrer les fichiers utiles |
| `logs/*.log` | Logs locaux |
| `.git/` | Optionnel : utile pour `git pull` en mise à jour, sinon pas nécessaire |
| `frontend/node_modules/` | Réinstaller pour build ; en prod on peut ne déployer qu’après build (voir § 4) |
| Fichiers listés dans `.gitignore` | Ne pas les copier (credentials, *.key, etc.) |

---

## 4. Build frontend (Vue / Vite)

Les pages Vue sont servies depuis `public/dist/` (fichiers générés par Vite).

- **Si `public/dist/` est versionné dans Git** : après `git clone` / `git pull`, vous n’avez rien à faire de plus pour le frontend.
- **Si `public/dist/` n’est pas versionné** : sur la machine de déploiement (ou en CI) :

```bash
cd frontend
npm ci
npm run build
```

Les binaires sont produits dans `../public/dist/`. Vérifier que le serveur Node sert bien le dossier `public` (Express `express.static('public')`).

---

## 5. Fichier `.env` en production

À créer **sur le serveur** (jamais committé). Au minimum :

```env
NODE_ENV=production
DB_HOST=...
DB_USER=...
DB_PASS=...
DB_NAME=...
SESSION_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
APP_URL=https://votre-domaine.fr
```

Voir `DEPLOYMENT_EASYHOSTER.md` pour une liste détaillée et la génération de `SESSION_SECRET`.

---

## 6. Commandes typiques sur le serveur (résumé)

```bash
# 1. Code (clone ou pull)
git clone https://... coopazv13 && cd coopazv13
# ou: git pull

# 2. Variables d'environnement
cp .env.production.example .env   # si exemple existant
nano .env                          # renseigner les valeurs

# 3. Dépendances backend
npm install --production
# si besoin: npm rebuild bcrypt sharp mysql2

# 4. Build frontend (si public/dist non versionné)
npm run build:frontend

# 5. Dossiers et permissions
mkdir -p uploads/products tmp logs
chmod -R 755 uploads tmp
chmod 600 .env

# 6. Base de données
# Importer structure + exécuter migrations (voir RBAC_DEPLOY_CHECKLIST.md / DEPLOYMENT_EASYHOSTER.md)

# 7. Redémarrage (ex. Passenger)
touch tmp/restart.txt
```

---

## 7. Récapitulatif : quoi prendre pour la prod

- **Prendre** : tout le dépôt (ou une copie) **sans** `node_modules`, sans `.env`, sans `archive/`, sans contenu de `backups/`, en respectant `.gitignore`.
- **Créer sur le serveur** : `.env`, dossiers `uploads/`, `tmp/`, éventuellement `logs/`.
- **Exécuter sur le serveur** : `npm install --production`, éventuellement `npm run build:frontend`, puis exécution des migrations SQL et redémarrage de l’app.

Pour les détails par hébergeur (ex. EasyHoster), voir **`DEPLOYMENT_EASYHOSTER.md`**. Pour RBAC et migrations, voir **`RBAC_DEPLOY_CHECKLIST.md`**.
