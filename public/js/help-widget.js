window.HelpWidget = (function() {
  function createWidget(helpText) {
    // Crée un container pour le widget si non présent
    let container = document.getElementById('help-widget');
    if (!container) {
      container = document.createElement('div');
      container.id = 'help-widget';
      document.body.appendChild(container);
    }
    container.style.position = 'fixed';
    container.style.bottom = '30px';
    container.style.right = '30px';
    container.style.zIndex = 1000;
    container.style.background = '#f9f9f9';
    container.style.border = '1px solid #bbb';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    container.style.padding = '16px';
    container.style.maxWidth = '320px';
    container.style.display = 'none';

    // Ajoute le texte d'aide
    container.innerHTML = `
      <div style="font-weight:bold; margin-bottom:8px;">Aide</div>
      <div style="white-space:pre-line;">${helpText || "Aucune aide pour cette page."}</div>
      <button id="close-help-widget" style="margin-top:12px;padding:3px 10px;border:none;background:#bbb;border-radius:4px;cursor:pointer;">Fermer</button>
    `;

    // Bouton pour fermer le widget
    document.getElementById('close-help-widget').onclick = function() {
      container.style.display = 'none';
    };
    return container;
  }

  function createHelpButton() {
    // Crée un bouton pour ouvrir l'aide
    const button = document.createElement('button');
    button.innerText = '?';
    button.title = 'Afficher l’aide';
    button.id = 'show-help-widget-btn';
    button.style.position = 'fixed';
    button.style.bottom = '30px';
    button.style.right = '30px';
    button.style.width = '40px';
    button.style.height = '40px';
    button.style.borderRadius = '50%';
    button.style.border = 'none';
    button.style.background = '#1976d2';
    button.style.color = 'white';
    button.style.fontSize = '24px';
    button.style.cursor = 'pointer';
    button.style.zIndex = 1001;
    document.body.appendChild(button);
    return button;
  }

  return {
    init: function({ helpText }) {
      // Si le bouton existe déjà, ne rien faire
      if (document.getElementById('show-help-widget-btn')) return;

      // Crée le widget (caché par défaut)
      const widget = createWidget(helpText);

      // Crée le bouton flottant
      const btn = createHelpButton();

      btn.onclick = function() {
        widget.style.display = widget.style.display === 'none' ? 'block' : 'none';
      };
    }
  };
})();