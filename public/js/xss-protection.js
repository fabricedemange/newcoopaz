/**
 * Fonction utilitaire pour échapper le HTML et prévenir les attaques XSS
 * À inclure dans les vues EJS qui manipulent du contenu dynamique
 */

/**
 * Échappe les caractères spéciaux HTML pour prévenir les injections XSS
 * @param {string} text - Le texte à échapper
 * @returns {string} - Le texte échappé
 */
function escapeHtml(text) {
  if (!text) return "";

  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
    "/": "&#x2F;",
  };

  return String(text).replace(/[&<>"'\/]/g, function (s) {
    return map[s];
  });
}

/**
 * Alternative : Utiliser textContent au lieu d'innerHTML
 * pour insérer du contenu utilisateur de manière sécurisée
 *
 * Exemple d'utilisation :
 *
 * // ❌ DANGEREUX
 * element.innerHTML = userInput;
 *
 * // ✅ SÉCURISÉ - Option 1 : Échapper le contenu
 * element.innerHTML = escapeHtml(userInput);
 *
 * // ✅ SÉCURISÉ - Option 2 : Utiliser textContent (préféré)
 * element.textContent = userInput;
 *
 * // ✅ SÉCURISÉ - Option 3 : Créer des éléments DOM
 * const span = document.createElement('span');
 * span.textContent = userInput;
 * element.appendChild(span);
 */
