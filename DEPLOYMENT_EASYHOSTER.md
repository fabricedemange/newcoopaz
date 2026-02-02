# Guide de Déploiement sur EasyHoster

## 📋 Prérequis

- Hébergement EasyHoster avec Node.js activé
- Accès SSH à votre hébergement
- Base de données MySQL créée sur EasyHoster
- Sous-domaine configuré (ex: new.coopaz.fr)

## 🚀 Étapes de déploiement

### 1. Connexion SSH

```bash
ssh votre_user@easyhoster.com
cd ~/new.coopaz.fr
```

### 2. Cloner ou mettre à jour le dépôt

**Première installation :**
```bash
cd ~
git clone https://github.com/votre-repo/coopazv13.git new.coopaz.fr
cd new.coopaz.fr
```

**Mises à jour ultérieures :**
```bash
cd ~/new.coopaz.fr
git pull origin multi-tenant
```

### 3. Configurer les variables d'environnement

```bash
# Copier le fichier exemple
cp .env.production.example .env

# Éditer avec vos valeurs
nano .env
```

**Valeurs à modifier dans `.env` :**

```env
NODE_ENV=production

# Base de données EasyHoster
DB_HOST=localhost
DB_USER=votre_user_mysql        # Fourni par EasyHoster
DB_PASS=votre_password_mysql     # Fourni par EasyHoster
DB_NAME=votre_database           # Créé dans phpMyAdmin

# Session (générer un secret aléatoire)
SESSION_SECRET=VOTRE_SECRET_TRES_LONG_ET_ALEATOIRE

# SMTP
SMTP_HOST=smtp.easyhoster.com
SMTP_PORT=587
SMTP_USER=contact@coopaz.fr
SMTP_PASS=votre_password_email

# Application
APP_URL=https://new.coopaz.fr
```

**Générer un secret de session sécurisé :**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Éditer le fichier .htaccess

Adapter le chemin dans `.htaccess` :

```bash
nano .htaccess
```

Modifier la ligne :
```apache
PassengerAppRoot /home/VOTRE_USER/new.coopaz.fr
```

Remplacer `VOTRE_USER` par votre nom d'utilisateur EasyHoster.

### 5. Installer les dépendances

```bash
# Supprimer les anciennes dépendances (si présentes)
rm -rf node_modules package-lock.json

# Installer les dépendances en production
npm install --production

# Si erreur, réinstaller tous les modules natifs
npm rebuild bcrypt
npm rebuild sharp
npm rebuild mysql2
```

### 6. Vérifier la version de Node.js

```bash
node --version
# Doit afficher v22.x.x ou supérieur

# Si version incorrecte, utiliser nvm
nvm install 22
nvm use 22
nvm alias default 22
```

### 7. Importer la base de données

**Si première installation :**

```bash
# Via phpMyAdmin EasyHoster :
# 1. Créer la base de données
# 2. Importer le fichier SQL de structure
# 3. (Optionnel) Importer les données de test

# Ou via ligne de commande :
mysql -u votre_user -p votre_database < backup.sql
```

**Exécuter les migrations (si nécessaire) :**
```bash
mysql -u votre_user -p votre_database < migrations/MIGRATION_COMPLETE_CONSOLIDATED.sql
```

### 8. Créer les dossiers nécessaires

```bash
# Créer les dossiers uploads
mkdir -p uploads/catalogue-images
mkdir -p uploads/product-images

# Donner les permissions
chmod -R 755 uploads/
```

### 9. Redémarrer l'application

```bash
# Méthode 1: Toucher tmp/restart.txt
mkdir -p tmp
touch tmp/restart.txt

# Méthode 2: Alternative
touch .passenger_restart

# Attendre 5-10 secondes
sleep 10
```

### 10. Vérifier le déploiement

```bash
# Tester l'URL
curl -I https://new.coopaz.fr

# Devrait retourner HTTP 200
```

**Dans le navigateur :**
- Ouvrir https://new.coopaz.fr
- Tester la connexion
- Vérifier les logs

### 11. Consulter les logs

```bash
# Logs Passenger
tail -50 ~/logs/error.log

# Logs de l'application (si configurés)
tail -50 ~/new.coopaz.fr/logs/app.log
```

## 🔧 Résolution de problèmes

### Erreur 500 Internal Server Error

**Cause 1 : Variables d'environnement manquantes**
```bash
# Vérifier que .env existe
ls -la .env

# Vérifier les variables critiques
grep -E "^(DB_HOST|DB_USER|SESSION_SECRET)" .env
```

**Cause 2 : Modules natifs non compilés**
```bash
rm -rf node_modules
npm install --production
npm rebuild bcrypt sharp mysql2
touch tmp/restart.txt
```

**Cause 3 : Base de données inaccessible**
```bash
# Tester la connexion MySQL
mysql -u votre_user -p votre_database -e "SELECT 1;"
```

**Cause 4 : Mauvaise version Node.js**
```bash
node --version
# Si < v18, mettre à jour avec nvm
```

### L'application ne redémarre pas

```bash
# Forcer le redémarrage
touch tmp/restart.txt
sleep 5
touch tmp/restart.txt

# Vérifier les processus
ps aux | grep node
```

### Erreur de permissions

```bash
# Donner les bonnes permissions
chmod -R 755 ~/new.coopaz.fr
chmod 644 .env
chmod 644 .htaccess
chmod -R 755 uploads/
chmod -R 755 public/
```

### Module introuvable (MODULE_NOT_FOUND)

```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --production
touch tmp/restart.txt
```

### Base de données vide après migration

```bash
# Vérifier les tables
mysql -u votre_user -p votre_database -e "SHOW TABLES;"

# Si vide, importer le backup
mysql -u votre_user -p votre_database < backup.sql

# Puis exécuter les migrations
mysql -u votre_user -p votre_database < migrations/MIGRATION_COMPLETE_CONSOLIDATED.sql
```

## 🔄 Déploiement de mises à jour

Pour déployer une nouvelle version :

```bash
cd ~/new.coopaz.fr

# 1. Sauvegarder la base de données
mysqldump -u votre_user -p votre_database > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Mettre à jour le code
git pull origin multi-tenant

# 3. Mettre à jour les dépendances (si package.json modifié)
npm install --production

# 4. Exécuter les migrations (si nécessaire)
mysql -u votre_user -p votre_database < migrations/nouvelle_migration.sql

# 5. Redémarrer
touch tmp/restart.txt
```

## 📊 Monitoring

### Vérifier que l'application tourne

```bash
# Voir les processus Node
ps aux | grep node

# Vérifier les logs en temps réel
tail -f ~/logs/error.log
```

### Tester les endpoints

```bash
# Page d'accueil
curl -I https://new.coopaz.fr

# API
curl -I https://new.coopaz.fr/api/health

# Login
curl -I https://new.coopaz.fr/login
```

## 🔒 Sécurité

### Checklist de sécurité

- [ ] `.env` configuré avec des secrets forts
- [ ] `NODE_ENV=production` dans `.env`
- [ ] HTTPS activé (certificat SSL)
- [ ] Permissions correctes (755 pour dossiers, 644 pour fichiers)
- [ ] `.env` et fichiers sensibles exclus de Git
- [ ] Backups de base de données réguliers
- [ ] Logs surveillés régulièrement

### Permissions recommandées

```bash
# Dossiers
chmod 755 ~/new.coopaz.fr
chmod 755 ~/new.coopaz.fr/public
chmod 755 ~/new.coopaz.fr/uploads
chmod 755 ~/new.coopaz.fr/views

# Fichiers sensibles
chmod 600 ~/new.coopaz.fr/.env
chmod 644 ~/new.coopaz.fr/.htaccess
chmod 644 ~/new.coopaz.fr/package.json

# Fichiers exécutables
chmod 755 ~/new.coopaz.fr/app.js
```

## 📞 Support EasyHoster

En cas de problème persistant :
- Support EasyHoster : https://www.easyhoster.com/support
- Documentation Passenger : https://www.phusionpassenger.com/docs
- Forums Node.js : https://nodejs.org/en/community

## ✅ Checklist de déploiement

- [ ] Code mis à jour (git pull)
- [ ] Fichier .env configuré avec bonnes valeurs
- [ ] .htaccess adapté avec bon chemin
- [ ] Base de données créée sur EasyHoster
- [ ] Structure de base importée
- [ ] node_modules installés (npm install)
- [ ] Modules natifs compilés (npm rebuild)
- [ ] Dossiers uploads créés
- [ ] Permissions correctes (chmod)
- [ ] Application redémarrée (touch tmp/restart.txt)
- [ ] Tests effectués (curl + navigateur)
- [ ] Logs vérifiés (pas d'erreur)
- [ ] HTTPS fonctionne
- [ ] Connexion utilisateur OK
- [ ] Création de commande OK

## 🎉 Déploiement réussi !

Une fois toutes ces étapes effectuées, votre application devrait être accessible sur https://new.coopaz.fr

Pour toute question ou problème, consultez les logs et la section "Résolution de problèmes" ci-dessus.
