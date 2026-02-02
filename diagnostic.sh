#!/bin/bash
# Script de diagnostic pour EasyHoster

echo "======================================"
echo "🔍 Diagnostic Coopaz EasyHoster"
echo "======================================"
echo ""

# 1. Vérifier le dossier courant
echo "📁 Dossier courant:"
pwd
echo ""

# 2. Vérifier les fichiers critiques
echo "📄 Fichiers critiques:"
echo -n "  app.js: "
[ -f app.js ] && echo "✅ Présent" || echo "❌ MANQUANT"

echo -n "  package.json: "
[ -f package.json ] && echo "✅ Présent" || echo "❌ MANQUANT"

echo -n "  .env: "
if [ -f .env ]; then
  echo "✅ Présent"
  echo "    Variables importantes:"
  grep -E "^(NODE_ENV|DB_HOST|DB_USER|DB_NAME|SESSION_SECRET)" .env | sed 's/=.*/=***/' || echo "    ⚠️ Variables manquantes"
else
  echo "❌ MANQUANT - Créer avec: cp .env.production.example .env"
fi

echo -n "  .htaccess: "
[ -f .htaccess ] && echo "✅ Présent" || echo "❌ MANQUANT"
echo ""

# 3. Vérifier Node.js
echo "🟢 Version Node.js:"
if command -v node &> /dev/null; then
  node --version
  echo "  npm: $(npm --version)"
else
  echo "  ❌ Node.js non installé ou non dans PATH"
fi
echo ""

# 4. Vérifier les dépendances
echo "📦 Dépendances:"
if [ -d node_modules ]; then
  MODULE_COUNT=$(ls -1 node_modules | wc -l | tr -d ' ')
  echo "  ✅ node_modules présent ($MODULE_COUNT modules)"

  # Vérifier modules critiques
  echo "  Modules critiques:"
  for module in express mysql2 bcrypt dotenv ejs; do
    echo -n "    $module: "
    [ -d "node_modules/$module" ] && echo "✅" || echo "❌ MANQUANT"
  done
else
  echo "  ❌ node_modules absent - Exécuter: npm install --production"
fi
echo ""

# 5. Vérifier la base de données
echo "🗄️  Base de données:"
if [ -f .env ]; then
  DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2)
  DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2)

  if [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
    echo "  Configuration trouvée: $DB_USER@localhost/$DB_NAME"
    echo -n "  Test de connexion: "

    if command -v mysql &> /dev/null; then
      mysql -u "$DB_USER" -p"$(grep '^DB_PASS=' .env | cut -d'=' -f2)" "$DB_NAME" -e "SELECT 1;" &>/dev/null
      if [ $? -eq 0 ]; then
        echo "✅ Connexion réussie"
        TABLES=$(mysql -u "$DB_USER" -p"$(grep '^DB_PASS=' .env | cut -d'=' -f2)" "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | wc -l | tr -d ' ')
        echo "    Tables: $((TABLES - 1))"
      else
        echo "❌ Échec de connexion - Vérifier identifiants"
      fi
    else
      echo "⚠️ mysql CLI non disponible"
    fi
  else
    echo "  ⚠️ DB_USER ou DB_NAME non défini dans .env"
  fi
else
  echo "  ⚠️ Fichier .env manquant"
fi
echo ""

# 6. Vérifier les permissions
echo "🔒 Permissions:"
echo "  Dossier racine: $(stat -c '%a' . 2>/dev/null || stat -f '%A' .)"
echo "  app.js: $(stat -c '%a' app.js 2>/dev/null || stat -f '%A' app.js)"
if [ -d uploads ]; then
  echo "  uploads/: $(stat -c '%a' uploads 2>/dev/null || stat -f '%A' uploads)"
else
  echo "  uploads/: ❌ Dossier absent - Créer avec: mkdir -p uploads/{catalogue-images,product-images}"
fi
echo ""

# 7. Tester le démarrage de l'application
echo "🚀 Test de démarrage (5 secondes):"
echo "  Tentative de démarrage de app.js..."
timeout 5 node app.js &>/tmp/coopaz-test.log &
APP_PID=$!
sleep 3

if kill -0 $APP_PID 2>/dev/null; then
  echo "  ✅ L'application démarre correctement"
  kill $APP_PID 2>/dev/null
else
  echo "  ❌ L'application ne démarre pas - Voir les erreurs:"
  cat /tmp/coopaz-test.log | head -20
fi
echo ""

# 8. Vérifier les logs Passenger
echo "📋 Logs récents (10 dernières lignes):"
if [ -f ~/logs/error.log ]; then
  tail -10 ~/logs/error.log
elif [ -f ../logs/error.log ]; then
  tail -10 ../logs/error.log
else
  echo "  ⚠️ Fichier de logs non trouvé"
fi
echo ""

# 9. Recommandations
echo "======================================"
echo "💡 Recommandations:"
echo "======================================"

ISSUES=0

[ ! -f .env ] && echo "  ❗ Créer le fichier .env: cp .env.production.example .env" && ISSUES=$((ISSUES+1))
[ ! -d node_modules ] && echo "  ❗ Installer les dépendances: npm install --production" && ISSUES=$((ISSUES+1))
[ ! -d uploads ] && echo "  ❗ Créer les dossiers uploads: mkdir -p uploads/{catalogue-images,product-images}" && ISSUES=$((ISSUES+1))

if [ $ISSUES -eq 0 ]; then
  echo "  ✅ Configuration semble correcte"
  echo ""
  echo "  Pour redémarrer l'application:"
  echo "    ./restart.sh"
  echo "  ou"
  echo "    touch tmp/restart.txt"
else
  echo ""
  echo "  Nombre de problèmes détectés: $ISSUES"
fi

echo ""
echo "======================================"
