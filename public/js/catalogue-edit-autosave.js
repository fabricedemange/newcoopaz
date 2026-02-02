// Auto-save pour le formulaire d'édition de catalogue
(function() {
  let autoSaveTimeout = null;
  const AUTOSAVE_DELAY = 2000; // 2 secondes après la dernière modification

  // Fonction pour afficher le statut d'enregistrement
  function showSaveStatus(message, type = 'info') {
    const statusEl = document.getElementById('autoSaveStatus');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = type === 'success' ? 'text-success' :
                        type === 'error' ? 'text-danger' :
                        'text-muted';
  }

  // Fonction pour sauvegarder automatiquement
  function autoSaveCatalogue() {
    const form = document.getElementById('catalogueInfoForm');
    if (!form) return;

    const formData = new FormData(form);

    // Pour les checkboxes non cochées, ajouter une valeur vide explicitement
    // (FormData n'inclut pas les checkboxes non cochées)
    const checkbox = document.getElementById('referent_order_reminder_enabled');
    if (checkbox && !checkbox.checked) {
      formData.set('referent_order_reminder_enabled', '');
    }

    showSaveStatus('Enregistrement...', 'info');

    // Construire l'URL complète avec le protocole actuel
    const actionPath = form.getAttribute('action');
    const actionUrl = window.location.protocol + '//' + window.location.host + actionPath;

    fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams(formData)
    })
    .then(response => {
      if (response.ok) {
        showSaveStatus('✓ Enregistré automatiquement', 'success');
        setTimeout(() => showSaveStatus('', 'info'), 3000);
      } else {
        showSaveStatus('✗ Erreur d\'enregistrement', 'error');
      }
    })
    .catch(error => {
      console.error('Erreur auto-save:', error);
      showSaveStatus('✗ Erreur d\'enregistrement', 'error');
    });
  }

  // Écouteur sur tous les champs avec la classe "catalogue-auto-save"
  document.addEventListener('DOMContentLoaded', function() {
    const autoSaveFields = document.querySelectorAll('.catalogue-auto-save');

    autoSaveFields.forEach(field => {
      field.addEventListener('input', function() {
        clearTimeout(autoSaveTimeout);
        showSaveStatus('Modification détectée...', 'info');
        autoSaveTimeout = setTimeout(autoSaveCatalogue, AUTOSAVE_DELAY);
      });

      field.addEventListener('change', function() {
        clearTimeout(autoSaveTimeout);
        showSaveStatus('Modification détectée...', 'info');
        autoSaveTimeout = setTimeout(autoSaveCatalogue, AUTOSAVE_DELAY);
      });
    });
  });
})();
