# Configuration EasyHoster - Guide Rapide

## 🚨 Problème courant : "Vue.js is installed successfully"

Si vous voyez ce message, c'est que le serveur pointe vers `public/` au lieu de démarrer l'application Node.js.

## ✅ Solution : Configuration dans le panneau EasyHoster

### Étape 1 : Configuration du domaine

Dans le panneau de contrôle EasyHoster :

1. **Allez dans "Domaines" ou "Hébergement Web"**
2. **Trouvez `new.coopaz.fr`**
3. **Cliquez sur "Modifier" ou "Paramètres"**
4. **Configurez :**

```
Nom de domaine : new.coopaz.fr
Document Root : /home/VOTRE_USER/new.coopaz.fr
Type d'application : Node.js
Version Node.js : 22.x ou 20.x (dernière disponible)
Fichier de démarrage : app.js
Mode : Production
```

**IMPORTANT** : Le Document Root doit pointer vers la **racine** du projet, **PAS vers `/public/`**

### Étape 2 : Activer Passenger (si disponible)

Si votre hébergement a une option "Activer Passenger" ou "Activer Node.js" :
- ✅ Cocher/Activer cette option
- Spécifier : `app.js` comme fichier de démarrage

### Étape 3 : Configuration via SSH (alternative)

Si le panneau ne permet pas de configurer Node.js, faites via SSH :

```bash
# Se connecter
ssh votre_user@easyhoster.com

# Aller dans le dossier
cd ~/new.coopaz.fr

# Vérifier que les fichiers de config existent
ls -la | grep -E "htaccess|passenger"

# Devrait afficher :
# .htaccess
# .passenger
# passenger_wsgi.py
# tmp/restart.txt

# Redémarrer
touch tmp/restart.txt
```

### Étape 4 : Structure des dossiers attendue par EasyHoster

```
/home/votre_user/new.coopaz.fr/          ← Document Root du domaine
├── app.js                                ← Fichier de démarrage
├── package.json
├── .htaccess                             ← Config Passenger
├── .passenger                            ← Config Passenger alternative
├── passenger_wsgi.py                     ← Config Passenger (si nécessaire)
├── .env                                  ← Variables d'environnement
├── node_modules/                         ← Dépendances
├── public/                               ← Assets statiques (CSS, JS, images)
│   ├── .htaccess                         ← Config pour désactiver Passenger
│   ├── css/
│   ├── js/
│   └── vue/
├── views/                                ← Templates EJS
├── routes/                               ← Routes Express
└── tmp/
    └── restart.txt                       ← Redémarrer avec touch
```

## 🔧 Vérifications

### 1. Vérifier que Node.js est installé sur le serveur

```bash
ssh votre_user@easyhoster.com
node --version    # Devrait afficher v20.x.x ou v22.x.x
npm --version     # Devrait afficher v9.x.x ou v10.x.x
```

### 2. Vérifier que les dépendances sont installées

```bash
cd ~/new.coopaz.fr
ls -la node_modules | wc -l   # Devrait afficher > 100
```

### 3. Vérifier que le .env existe et est configuré

```bash
cat .env | grep -E "^(NODE_ENV|DB_|SESSION_SECRET)"

# Devrait afficher :
# NODE_ENV=production
# DB_HOST=localhost
# DB_USER=...
# DB_PASS=...
# SESSION_SECRET=...
```

### 4. Tester manuellement le démarrage

```bash
# Démarrer l'app manuellement pour voir les erreurs
cd ~/new.coopaz.fr
node app.js

# Si erreur, lire le message
# Si OK, vous verrez : "Serveur démarré"
# Arrêter avec Ctrl+C
```

## 🎯 Commandes de redémarrage

```bash
# Méthode 1 : Via le script
cd ~/new.coopaz.fr
./restart.sh

# Méthode 2 : Manuellement
cd ~/new.coopaz.fr
touch tmp/restart.txt

# Méthode 3 : Alternative
cd ~/new.coopaz.fr
touch .passenger_restart

# Attendre 5-10 secondes, puis tester
curl -I https://new.coopaz.fr
```

## 📞 Support EasyHoster

Si le problème persiste :

1. **Vérifier les logs :**
   ```bash
   tail -100 ~/logs/error.log
   ```

2. **Contacter le support EasyHoster :**
   - Demander si Node.js est activé pour votre compte
   - Demander la configuration Passenger correcte
   - Demander où doivent pointer les Document Root

3. **Fournir ces informations au support :**
   - Domaine : `new.coopaz.fr`
   - Type d'application : Node.js Express
   - Fichier de démarrage : `app.js`
   - Version Node.js souhaitée : 22.x ou 20.x

## ✅ Test final

Une fois configuré, vous devriez voir :
- ✅ `https://new.coopaz.fr` → Page de login de l'application
- ✅ `https://new.coopaz.fr/public/style.css` → Fichier CSS
- ❌ Plus de message "Vue.js is installed successfully"

## 🔒 Sécurité

N'oubliez pas :
- [ ] Fichier `.env` configuré avec vrais identifiants
- [ ] `NODE_ENV=production` dans `.env`
- [ ] HTTPS activé (certificat SSL)
- [ ] Session secret fort et aléatoire
- [ ] Base de données MySQL créée et importée
