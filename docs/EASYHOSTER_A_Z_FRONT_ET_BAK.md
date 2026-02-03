# EasyHoster : déploiement Front + Backup de A à Z

Guide pas à pas pour mettre en production l’application sur EasyHoster et gérer les sauvegardes (base + code).

---

## Partie 1 — Prérequis (avant de commencer)

- [ ] Compte EasyHoster avec **Node.js** activé
- [ ] Accès **SSH** à l’hébergement
- [ ] Base **MySQL** créée dans le panneau EasyHoster (phpMyAdmin)
- [ ] Sous-domaine ou domaine configuré (ex. `new.coopaz.fr`)
- [ ] Identifiants MySQL (utilisateur, mot de passe, nom de la base) notés

---

## Partie 2 — Créer le backup (BAK) avant toute mise à jour

À faire **avant** chaque déploiement ou modification importante.

### 2.1 Backup de la base de données

**En local (si vous avez accès MySQL en local) :**

```bash
# Remplacez par vos identifiants EasyHoster
mysqldump -h VOTRE_HOST -u VOTRE_USER_MYSQL -p VOTRE_DATABASE > backups/coopaz_$(date +%Y%m%d_%H%M%S).sql
```

**Sur le serveur EasyHoster (recommandé) :**

```bash
# 1. Connexion SSH
ssh votre_user@easyhoster.com

# 2. Aller dans le dossier du site
cd ~/new.coopaz.fr

# 3. Créer un dossier backups si besoin
mkdir -p backups

# 4. Dump de la base (remplacer par vos identifiants MySQL EasyHoster)
mysqldump -u VOTRE_USER_MYSQL -p VOTRE_DATABASE > backups/coopaz_$(date +%Y%m%d_%H%M%S).sql

# Exemple : mysqldump -u coopaz_user -p coopaz_db > backups/coopaz_20260203_140000.sql
```

**Via phpMyAdmin (sans SSH) :**

1. Connexion à phpMyAdmin (lien fourni par EasyHoster).
2. Sélectionner la base de données.
3. Onglet **Exporter** → **Exécuter** → télécharger le `.sql`.

Conserver ce fichier dans un dossier `backups/` (local ou serveur) avec la date dans le nom.

### 2.2 Backup du code (optionnel)

Pour garder une copie du code déployé :

```bash
# Sur le serveur, depuis le dossier du site
cd ~/new.coopaz.fr
tar -czvf ~/backup_code_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='.env' \
  --exclude='uploads' \
  --exclude='logs' \
  --exclude='.git' \
  .
# Le fichier est dans votre home : ~/backup_code_YYYYMMDD.tar.gz
```

Vous pouvez ensuite le télécharger en SFTP pour archivage local.

---

## Partie 3 — Déploiement du FRONT (site en production) de A à Z

### Étape A — Connexion SSH

```bash
ssh votre_user@easyhoster.com
```

(Remplacez `votre_user` par votre identifiant EasyHoster.)

---

### Étape B — Emplacement du site

**Première fois (nouveau déploiement) :**

```bash
cd ~
# Cloner le dépôt (remplacer l’URL par la vôtre)
git clone https://github.com/votre-repo/coopazv13.git new.coopaz.fr
cd new.coopaz.fr
```

**Mises à jour (site déjà déployé) :**

```bash
cd ~/new.coopaz.fr
git pull origin NOM_DE_LA_BRANCHE
```

(Si vous déployez avec une archive `.tar.gz` au lieu de Git : extraire l’archive dans `~/new.coopaz.fr` et passer à l’étape C.)

---

### Étape C — Fichier .env

```bash
cd ~/new.coopaz.fr

# Créer .env (s’il n’existe pas)
nano .env
```

Contenu minimal (adapter à votre hébergement) :

```env
NODE_ENV=production

DB_HOST=localhost
DB_USER=votre_user_mysql
DB_PASS=votre_password_mysql
DB_NAME=votre_database

SESSION_SECRET=UN_SECRET_TRES_LONG_ET_ALEATOIRE

SMTP_HOST=smtp.easyhoster.com
SMTP_PORT=587
SMTP_USER=contact@coopaz.fr
SMTP_PASS=votre_password_email

APP_URL=https://new.coopaz.fr
```

Générer un `SESSION_SECRET` fort :

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copier le résultat dans `SESSION_SECRET=`.

Sauvegarder : `Ctrl+O`, Entrée, `Ctrl+X`.

Sécuriser le fichier :

```bash
chmod 600 .env
```

---

### Étape D — .htaccess (Passenger)

```bash
nano .htaccess
```

Vérifier / adapter la ligne (remplacer `VOTRE_USER` par votre login EasyHoster) :

```apache
PassengerAppRoot /home/VOTRE_USER/new.coopaz.fr
```

Sauvegarder et quitter.

---

### Étape E — Node.js (version)

```bash
node --version
```

Souhaité : **v20.x** ou **v22.x**. Si ce n’est pas le cas :

```bash
nvm use 22
# ou
nvm use 20
nvm alias default 22
```

---

### Étape F — Dépendances backend

```bash
cd ~/new.coopaz.fr

rm -rf node_modules
npm install --production

# Si erreurs avec des modules natifs
npm rebuild bcrypt
npm rebuild sharp
npm rebuild mysql2
```

---

### Étape G — Build du frontend (Vue / Vite)

Les pages Vue sont servies depuis `public/dist/`. **Deux possibilités :**

#### Option 1 — Build en local (recommandé si le serveur manque de mémoire)

Sur votre machine (pas sur EasyHoster) :

```bash
cd /chemin/vers/coopazv13
npm run build:frontend
```

Cela crée ou met à jour `public/dist/`. Ensuite, déployez tout le projet (git push + pull sur le serveur, ou archive avec `public/dist/` inclus). **Ne pas lancer le build sur le serveur** : le dossier `public/dist/` est déjà prêt.

#### Option 2 — Build sur le serveur

Si `public/dist/` n’est pas présent ou pas à jour, et que vous voulez builder sur le serveur :

```bash
cd ~/new.coopaz.fr/frontend
npm ci
npm run build
```

Si vous voyez **« Out of memory »** ou **« Cannot allocate Wasm memory »** : l’hébergement limite la RAM par processus (souvent 4 Go). Dans ce cas, **utilisez l’option 1** (build en local et déployer avec `public/dist/`).

Pour tenter quand même sur le serveur (sans garantie) :

```bash
cd ~/new.coopaz.fr
NODE_OPTIONS="--max-old-space-size=3072" npm run build:frontend
```

---

### Étape H — Base de données

**Première installation :**

1. Dans le panneau EasyHoster : créer la base MySQL et noter utilisateur / mot de passe / nom de la base.
2. Importer la structure :
   - soit via **phpMyAdmin** (importer le fichier SQL de structure / migration consolidée),
   - soit en SSH :

```bash
mysql -u VOTRE_USER -p VOTRE_DATABASE < migrations/MIGRATION_COMPLETE_CONSOLIDATED.sql
```

3. Exécuter les migrations supplémentaires si besoin (RBAC, cotisation, etc.) :

```bash
mysql -u VOTRE_USER -p VOTRE_DATABASE < migrations/20260202_utilisateur_remove_admin_permissions.sql
# et les autres .sql indiqués dans la doc du projet
```

**Mise à jour (site déjà en prod) :** exécuter uniquement les nouveaux fichiers SQL de migration (un par un, dans l’ordre des dates/noms).

---

### Étape I — Dossiers et permissions

```bash
cd ~/new.coopaz.fr

mkdir -p uploads/catalogue-images uploads/product-images tmp logs
chmod -R 755 uploads tmp
chmod 755 .
chmod 644 .htaccess
chmod 600 .env
```

---

### Étape J — Redémarrage de l’application

```bash
cd ~/new.coopaz.fr
touch tmp/restart.txt
# ou
touch .passenger_restart
```

Attendre 5–10 secondes.

---

### Étape K — Vérification

```bash
curl -I https://new.coopaz.fr
```

Vous devez obtenir un **HTTP 200** (ou une redirection 302 vers la page de login).

Dans le navigateur :

- Ouvrir `https://new.coopaz.fr`
- Tester la connexion, une commande, la caisse si besoin.

En cas d’erreur 500 :

```bash
tail -50 ~/logs/error.log
tail -50 ~/new.coopaz.fr/logs/app.log
```

---

### Étape L — Panneau EasyHoster (Document Root)

Dans le panneau de contrôle EasyHoster :

1. **Domaines** → votre domaine (ex. `new.coopaz.fr`).
2. **Document Root** = racine du projet : `/home/VOTRE_USER/new.coopaz.fr` (et **pas** `/public`).
3. **Type d’application** = **Node.js**.
4. **Fichier de démarrage** = `app.js`.
5. **Version Node.js** = 20.x ou 22.x.

Sauvegarder. Si besoin, refaire un `touch tmp/restart.txt` après modification.

---

## Partie 4 — Récapitulatif : ordre des étapes

| Ordre | Action |
|-------|--------|
| 1 | Faire un **backup BDD** (et optionnellement code) |
| 2 | Connexion SSH → aller dans `~/new.coopaz.fr` |
| 3 | Mise à jour du code (`git pull` ou extraction archive) |
| 4 | Vérifier / créer `.env` |
| 5 | Vérifier `.htaccess` (PassengerAppRoot) |
| 6 | Vérifier Node.js (v20/v22) |
| 7 | `npm install --production` |
| 8 | Build frontend : `cd frontend && npm ci && npm run build` |
| 9 | Migrations SQL si nécessaire |
| 10 | Créer dossiers (uploads, tmp, logs) et permissions |
| 11 | `touch tmp/restart.txt` |
| 12 | Tester l’URL et la connexion |

---

## Partie 5 — Mise à jour rapide (déjà déployé)

### 5A — Avec Git (mise à jour par git pull)

#### Prérequis (une seule fois)

1. **Dépôt distant** : votre code doit être poussé sur un dépôt Git (GitHub, GitLab, Bitbucket, ou autre). Créez un dépôt si besoin, puis en local :
   ```bash
   cd /chemin/vers/coopazv13
   git remote add origin https://github.com/VOTRE_USER/VOTRE_REPO.git
git push -u origin NOM_DE_LA_BRANCHE
```
(Remplacez par l’URL de votre dépôt et le nom de votre branche : souvent `main` ou `multi-tenant`. Vérifiez avec `git branch`.)

2. **Sur le serveur (première fois)** : cloner le dépôt dans le dossier du site (ou le faire à la place d’une archive) :
   ```bash
   ssh votre_user@easyhoster.com
   cd ~
   git clone https://github.com/VOTRE_USER/VOTRE_REPO.git new.coopaz.fr
   cd new.coopaz.fr
git checkout NOM_DE_LA_BRANCHE
```
(Remplacez par le nom de votre branche, ex. `main`.)
   Ensuite : créer le `.env`, faire `npm install --production`, build frontend si besoin, migrations, `touch tmp/restart.txt` (voir Partie 3).

#### À chaque mise à jour

**Sur votre ordinateur** : pousser les changements vers le dépôt distant.

```bash
cd /chemin/vers/coopazv13
git add .
git commit -m "Description des changements"
git push origin NOM_DE_LA_BRANCHE
```
(Ex. `main` — vérifiez avec `git branch`.)

**Sur le serveur (SSH)** : récupérer le code et redémarrer.

```bash
ssh votre_user@easyhoster.com
cd ~/new.coopaz.fr

# 1. Backup BDD (recommandé avant chaque mise à jour)
mkdir -p backups
mysqldump -u USER_MYSQL -p DATABASE > backups/coopaz_$(date +%Y%m%d_%H%M%S).sql

# 2. Récupérer le code
git pull origin NOM_DE_LA_BRANCHE

# 3. Dépendances (si package.json ou package-lock.json a changé)
npm install --production

# 4. Frontend (si le code Vue/frontend a changé — sinon le build en local peut être versionné)
cd frontend && npm ci && npm run build && cd ..

# 5. Migrations SQL (s’il y a de nouveaux fichiers .sql)
# mysql -u USER_MYSQL -p DATABASE < migrations/NOM_MIGRATION.sql

# 6. Redémarrage
touch tmp/restart.txt
```

**Résumé :** en local vous faites `git push`, sur le serveur vous faites `git pull` puis npm / migrations / redémarrage selon ce qui a changé.

### 5B — Sans Git (mise à jour par archive / SFTP)

Si vous n’utilisez pas Git sur le serveur, vous mettez à jour la prod en **envoyant les fichiers modifiés** (ou une archive) puis en **redémarrant** l’app.

#### Étape 1 — Sur votre ordinateur : préparer ce qui a changé

**Option A : tout le projet (recommandé si beaucoup de changements)**  
Créez une archive **sans** `node_modules`, `.env`, `archive/`, `backups/`, `uploads/`, `logs/`, `.git` :

```bash
cd /chemin/vers/coopazv13
tar -czvf coopaz-prod-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='archive' \
  --exclude='backups' \
  --exclude='uploads' \
  --exclude='logs' \
  --exclude='.git' \
  --exclude='*.tar.gz' \
  --exclude='credentials.json' \
  .
```

Vous obtenez `coopaz-prod-YYYYMMDD.tar.gz`.  
**Important :** le frontend (Vue) doit être **déjà buildé** en local : lancez `npm run build:frontend` avant de créer l’archive, pour que `public/dist/` soit à jour dans l’archive.

**Option B : seulement quelques fichiers**  
Si vous n’avez modifié que `app.js`, `config/logger.js`, une route, une vue, etc., vous pouvez ne transférer que ces fichiers (voir étape 2).

#### Étape 2 — Envoyer les fichiers sur le serveur

- **SFTP** : avec FileZilla, WinSCP ou la commande `scp` : connectez-vous à votre compte EasyHoster (même identifiants que SSH, port 22). Envoyez soit l’archive dans `~/new.coopaz.fr/`, soit les dossiers/fichiers modifiés **au bon emplacement** (ex. `app.js` à la racine du site, `config/logger.js` dans `config/`, etc.).
- **Panneau EasyHoster** : si un gestionnaire de fichiers est proposé, uploadez l’archive ou les fichiers dans le dossier du site (`new.coopaz.fr` ou équivalent).

#### Étape 3 — Sur le serveur (SSH)

```bash
ssh votre_user@easyhoster.com
cd ~/new.coopaz.fr
```

**Si vous avez envoyé une archive :**

```bash
# Sauvegarder l’ancien .env (il ne doit pas être écrasé)
cp .env .env.bak   # au cas où

# Extraire l’archive (écrase les fichiers existants, pas le dossier .env s’il n’est pas dans l’archive)
tar -xzvf coopaz-prod-YYYYMMDD.tar.gz

# Remettre le .env si besoin (normalement vous ne mettez pas .env dans l’archive)
# Rien à faire si vous n’avez pas extrait par-dessus .env
```

**Si vous avez seulement envoyé des fichiers** (option B) : rien à extraire, les fichiers sont déjà en place.

Ensuite :

```bash
# Dépendances (uniquement si vous avez mis à jour package.json)
npm install --production

# Migrations SQL (uniquement s’il y a de nouveaux fichiers dans migrations/)
# Exemple : mysql -u USER_MYSQL -p DATABASE < migrations/20260203_utilisateur_ensure_user_pages.sql

# Redémarrer l’app
touch tmp/restart.txt
```

#### Étape 4 — Vérifier

Ouvrir le site dans le navigateur et tester (connexion, une page catalogue, panier, etc.).

#### Récapitulatif sans Git

| Action | Quand |
|--------|--------|
| Backup BDD | Avant chaque mise à jour (souvent en SSH : `mysqldump ... > backups/coopaz_*.sql`) |
| Build frontend en local | Si le code Vue/frontend a changé → `npm run build:frontend` avant de faire l’archive |
| Archive ou fichiers | Créer l’archive (sans node_modules, .env, etc.) ou préparer les fichiers modifiés |
| Envoi | SFTP / panneau : envoyer l’archive ou les fichiers vers le dossier du site |
| Extraction | Si archive : `tar -xzvf ...` dans le dossier du site |
| npm install | Seulement si `package.json` ou `package-lock.json` a changé |
| Migrations SQL | Seulement s’il y a de nouveaux .sql à exécuter |
| Redémarrage | Toujours : `touch tmp/restart.txt` |

---

## Partie 6 — Le site ne s'ouvre pas : quels logs regarder ?

En SSH sur le serveur, regarder **dans cet ordre** :

### 6.1 Logs Passenger / Apache (hébergeur)

Erreurs de démarrage de l'app ou du serveur web :

```bash
tail -100 ~/logs/error.log
```

Souvent le chemin est `~/logs/error.log` ou `~/log/error.log`. Vérifier aussi dans le panneau EasyHoster (section « Logs » ou « Fichiers »).

### 6.2 Logs de l'application (dans le projet)

Erreurs et requêtes enregistrées par l'app (Winston) :

```bash
cd ~/new.coopaz.fr

# Dernières erreurs
tail -100 logs/error.log

# Tous les logs récents
tail -100 logs/combined.log

# Avertissements / sécurité
tail -50 logs/security.log
```

Si le dossier `logs/` n'existe pas ou est vide, l'app n'a peut‑être pas démarré (voir 6.1).

### 6.3 Voir les logs en direct

```bash
# Logs Apache/Passenger
tail -f ~/logs/error.log

# Logs applicatifs (dans le dossier du site)
cd ~/new.coopaz.fr && tail -f logs/combined.log
```

Ouvrir le site dans le navigateur pendant que `tail -f` tourne pour voir les messages au moment du chargement.

### 6.4 Redémarrer le bon processus (important)

Sur EasyHoster, **c’est Passenger qui sert le site**, pas un `node app.js` lancé à la main. Si vous modifiez `.env` ou `app.js` puis lancez seulement `node app.js` dans un terminal, vous démarrez un **second** processus ; le site continue d’être servi par l’**ancien** processus Passenger. Les logs peuvent ne pas changer car c’est l’ancien processus qui écrit dedans, ou le nouveau écrit ailleurs.

**Pour appliquer vos changements et que les logs se mettent à jour :**

```bash
cd ~/new.coopaz.fr
touch tmp/restart.txt
```

Attendre 5–10 secondes, puis recharger le site. Les logs (`logs/combined.log`, `logs/error.log`) seront alors écrits par le processus redémarré (nouveau code, nouveau `.env`).

### 6.5 Tester le démarrage manuel (sans Passenger)

Pour voir l’erreur exacte au lancement de Node (et le **chemin des logs** affiché dans le terminal) :

```bash
cd ~/new.coopaz.fr
node app.js
```

Au démarrage, la ligne `Logs écrits dans: /chemin/absolu/vers/logs` confirme où sont écrits les fichiers. Si une variable manque ou une dépendance plante, le message s’affiche dans le terminal. Arrêter avec `Ctrl+C` après le test.

### 6.6 Vérifications rapides

```bash
# Le fichier .env existe ?
ls -la ~/new.coopaz.fr/.env

# Node et npm OK ?
node --version
cd ~/new.coopaz.fr && node -e "require('./app.js')" 2>&1 | head -20

# Réponse HTTP
curl -I https://new.coopaz.fr
```

---

## Partie 7 — En cas de problème (résumé)

- **On voit les fichiers du site (listing) au lieu de l'app** : le serveur sert le dossier au lieu de lancer Node. Vérifier dans le panneau EasyHoster : (1) **Document Root** = racine du projet (ex. `/home/VOTRE_USER/new.coopaz.fr`), **pas** `public/` ; (2) **Type d'application** = **Node.js** ; (3) **Fichier de démarrage** = **app.js**. Vérifier que le **.htaccess** est à la racine (directives Passenger) et que Node.js est **activé** pour ce domaine. Voir « Étape L ».
- **500 Internal Server Error** : vérifier `.env`, `node --version`, `npm rebuild bcrypt sharp mysql2`, logs `~/logs/error.log` et `~/new.coopaz.fr/logs/error.log`.
- **Page blanche ou “Vue.js is installed successfully”** : Document Root doit être la **racine** du projet, pas `public/`, et type d’app = Node.js, fichier = `app.js`.
- **Base inaccessible** : vérifier `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` dans `.env` et tester la connexion MySQL (phpMyAdmin ou `mysql -u ... -p ... -e "SELECT 1;"`).
- **Site ne s'ouvre pas** : voir **Partie 6** ci‑dessus.
- **« Serveur démarré » une seule fois puis plus** : souvent une Unhandled Rejection (ou une erreur) fait planter le processus juste après le premier démarrage ; les redémarrages suivants affichent les workers mais pas « Serveur démarré » si le processus recrash avant le callback de `app.listen()`. Déployer la version de `app.js` qui logue les rejets avec `message`, `stack`, `reason` pour identifier la cause.
- **EADDRINUSE (port déjà utilisé)** : sur le serveur, **ne pas lancer `npm start`** (ou `node app.js`) à la main quand le site tourne : Passenger utilise déjà le port (ex. 3100). Pour redémarrer l’app, utiliser **`touch tmp/restart.txt`**. Pour tester à la main en SSH sans conflit : **`PORT=3101 node app.js`**.

Pour plus de détails : `DEPLOYMENT_EASYHOSTER.md`, `EASYHOSTER_SETUP.md`, `docs/DEPLOY_PROD_ARBO.md`.
