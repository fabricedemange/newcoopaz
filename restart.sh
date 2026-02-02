#!/bin/bash
# Script de redémarrage pour EasyHoster/Passenger

echo "🔄 Redémarrage de l'application Coopaz..."

# Créer le dossier tmp s'il n'existe pas
mkdir -p tmp

# Toucher le fichier restart.txt (méthode Passenger standard)
touch tmp/restart.txt
echo "✅ tmp/restart.txt mis à jour"

# Alternative avec .passenger_restart
touch .passenger_restart
echo "✅ .passenger_restart mis à jour"

# Attendre quelques secondes
sleep 3

echo "✅ Redémarrage en cours..."
echo "🌐 Application disponible sur : https://new.coopaz.fr"
echo ""
echo "Pour vérifier les logs :"
echo "  tail -50 ~/logs/error.log"
