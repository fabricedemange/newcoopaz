// Helper pour affichage responsive (tableau desktop / cartes mobile)
window.ResponsiveHelper = {
  /**
   * Détecte si on est sur mobile
   */
  isMobile() {
    return window.innerWidth < 768;
  },

  /**
   * Wrapper pour afficher tableau sur desktop, cartes sur mobile
   * @param {Function} renderDesktopTable - Fonction qui retourne le HTML du tableau
   * @param {Function} renderMobileCards - Fonction qui retourne le HTML des cartes
   * @returns {string} HTML responsive
   */
  renderResponsive(renderDesktopTable, renderMobileCards) {
    let html = '';

    // Affichage desktop (tableau)
    html += '<div class="d-none d-md-block">';
    html += renderDesktopTable();
    html += '</div>';

    // Affichage mobile (cartes)
    html += '<div class="d-md-none">';
    html += renderMobileCards();
    html += '</div>';

    return html;
  },

  /**
   * Crée une carte mobile simple
   * @param {Object} options - {title, subtitle, rows: [{label, value}], actions: string}
   */
  createMobileCard(options) {
    const { title, subtitle, rows, actions, badge, note } = options;

    let html = '<div class="card mb-3 shadow-sm"><div class="card-body">';

    // Titre avec badge optionnel
    html += `<div class="d-flex justify-content-between align-items-start mb-2">`;
    html += `<h6 class="card-title mb-0">${title}</h6>`;
    if (badge) {
      html += `<span class="badge ${badge.class}">${badge.text}</span>`;
    }
    html += `</div>`;

    // Sous-titre
    if (subtitle) {
      html += `<p class="text-muted small mb-3">${subtitle}</p>`;
    }

    // Note
    if (note) {
      html += `<div class="alert alert-info py-2 px-2 mb-3 small">
        <i class="bi bi-sticky me-1"></i>${note}
      </div>`;
    }

    // Lignes d'information
    if (rows && rows.length > 0) {
      html += '<div class="row g-2 mb-3">';
      rows.forEach(row => {
        html += `<div class="col-6">
          <small class="text-muted d-block">${row.label}</small>
          <div>${row.value}</div>
        </div>`;
      });
      html += '</div>';
    }

    // Actions
    if (actions) {
      html += `<div class="d-grid gap-2">${actions}</div>`;
    }

    html += '</div></div>';
    return html;
  }
};

console.log('✅ ResponsiveHelper chargé');
