// Application Vue pour la page Catalogues
(function() {
  console.log('🚀 Chargement de CataloguesApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive } = Vue;

  const app = createApp({
    setup() {
      const state = reactive({
        loading: false,
        error: null,
        catalogues: [],
        sortColumn: 'expiration_date',
        sortDirection: 'asc',
        searchTerm: ''
      });

      const loadCatalogues = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch(`${''}/api/catalogues`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            state.catalogues = data.catalogues;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des catalogues');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadCatalogues:', error);
        } finally {
          state.loading = false;
        }
      };

      loadCatalogues();

      return {
        state
      };
    },

    methods: {
      calculateDaysRemaining(expirationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(expirationDate);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      },

      getBadgeClass(daysRemaining) {
        if (daysRemaining < 0) return 'bg-secondary';
        if (daysRemaining === 0) return 'bg-danger';
        if (daysRemaining === 1) return 'bg-warning text-dark';
        if (daysRemaining <= 3) return 'bg-info';
        return 'bg-success';
      },

      getBadgeText(daysRemaining) {
        if (daysRemaining < 0) return 'Expiré';
        if (daysRemaining === 0) return 'Expire aujourd\'hui';
        if (daysRemaining === 1) return 'Expire demain';
        return `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`;
      },

      sortBy(column) {
        if (this.state.sortColumn === column) {
          this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortColumn = column;
          this.state.sortDirection = 'asc';
        }
        this.updateDOM();
      },

      getFilteredAndSortedCatalogues() {
        let filtered = [...this.state.catalogues];

        // Filtrer par recherche
        if (this.state.searchTerm) {
          const term = this.state.searchTerm.toLowerCase();
          filtered = filtered.filter(c =>
            c.originalname.toLowerCase().includes(term) ||
            c.username.toLowerCase().includes(term) ||
            (c.description && c.description.toLowerCase().includes(term))
          );
        }

        // Trier
        filtered.sort((a, b) => {
          let aVal = a[this.state.sortColumn];
          let bVal = b[this.state.sortColumn];

          // Pour les dates
          if (this.state.sortColumn.includes('date')) {
            aVal = new Date(a[this.state.sortColumn]);
            bVal = new Date(b[this.state.sortColumn]);
          }

          if (this.state.sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
          } else {
            return aVal < bVal ? 1 : -1;
          }
        });

        return filtered;
      },

      updateDOM() {
        const container = this.$refs.container;
        if (!container) return;

        const s = this.state;

        // Sauvegarder l'élément actif et sa position de curseur
        const activeElement = document.activeElement;
        const wasSearchFocused = activeElement && activeElement.id === 'searchInput';
        const cursorPosition = wasSearchFocused ? activeElement.selectionStart : 0;

        let html = '<div class="admin-content-wrapper"><div class="container-fluid mt-4">';

        // Bouton retour mobile uniquement
        html += `
          <button class="btn btn-outline-secondary d-md-none mb-3" onclick="window.history.back()">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </button>
        `;

        html += '<div class="d-flex justify-content-between align-items-center mb-4">';
        html += '<h2><i class="bi bi-book me-2"></i>Catalogues disponibles</h2>';
        html += '</div>';

        if (s.error) {
          html += `<div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Erreur :</strong> ${s.error}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>`;
        }

        if (s.loading) {
          html += `<div class="text-center py-5">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3 text-muted">Chargement des catalogues...</p>
          </div>`;
        } else {
          // Barre de recherche
          html += `<div class="row mb-3">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text"
                       class="form-control"
                       id="searchInput"
                       placeholder="Rechercher par nom, description ou auteur..."
                       value="${s.searchTerm}">
              </div>
            </div>
          </div>`;

          const catalogues = this.getFilteredAndSortedCatalogues();

          if (catalogues.length === 0) {
            html += `<div class="text-center py-5">
              <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
              <p class="text-muted">Aucun catalogue trouvé</p>
            </div>`;
          } else {
            // Affichage desktop : tableau
            html += `<div class="card border-0 shadow-sm d-none d-md-block">
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead class="table-light">
                      <tr>
                        <th class="sortable" data-column="originalname" style="width: 30%;">
                          Nom du catalogue
                          ${this.getSortIcon('originalname')}
                        </th>
                        <th class="sortable" data-column="expiration_date" style="width: 15%;">
                          Expiration
                          ${this.getSortIcon('expiration_date')}
                        </th>
                        <th class="sortable" data-column="date_livraison" style="width: 15%;">
                          Livraison
                          ${this.getSortIcon('date_livraison')}
                        </th>
                        <th class="sortable" data-column="username" style="width: 15%;">
                          Publié par
                          ${this.getSortIcon('username')}
                        </th>
                        <th class="text-center" style="width: 10%;">Statut</th>
                        <th class="text-end" style="width: 15%;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>`;

            catalogues.forEach(catalogue => {
              const daysRemaining = this.calculateDaysRemaining(catalogue.expiration_date);
              const badgeClass = this.getBadgeClass(daysRemaining);
              const badgeText = this.getBadgeText(daysRemaining);

              html += `<tr>
                <td>
                  <div class="d-flex align-items-center">
                    ${catalogue.image_filename ? `
                      <span class="catalogue-thumbnail me-2">
                        <img src="/uploads/catalogue-images/${catalogue.image_filename}" alt="Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                      </span>
                    ` : ''}
                    <div>
                      <strong>${catalogue.originalname}</strong>
                      ${catalogue.description ? `<br><small class="text-muted">${catalogue.description}</small>` : ''}
                    </div>
                  </div>
                </td>
                <td>
                  ${catalogue.expiration_formatted || '-'}
                  ${daysRemaining >= 0 ? `<br><span class="badge ${badgeClass}">${badgeText}</span>` : ''}
                </td>
                <td>${catalogue.livraison_formatted || '-'}</td>
                <td>
                  <i class="bi bi-person-circle me-1"></i>${catalogue.username}
                  <br><small class="text-muted">${catalogue.upload_formatted || '-'}</small>
                </td>
                <td class="text-center">`;

              if (catalogue.nb_paniers_non_submis > 0) {
                html += `<span class="badge bg-warning text-dark me-1" title="Paniers en cours">
                  <i class="bi bi-cart3"></i> ${catalogue.nb_paniers_non_submis}
                </span>`;
              }
              if (catalogue.nb_paniers_submis > 0) {
                html += `<span class="badge bg-success" title="Commandes validées">
                  <i class="bi bi-check-circle"></i> ${catalogue.nb_paniers_submis}
                </span>`;
              }
              if (catalogue.nb_paniers_non_submis === 0 && catalogue.nb_paniers_submis === 0) {
                html += `<span class="text-muted">-</span>`;
              }

              html += `</td>
                <td class="text-end">`;

              if (daysRemaining >= 0) {
                html += `<a href="/catalogues/${catalogue.id}/vue?nouveau=1" class="btn btn-sm btn-primary">
                    <i class="bi bi-cart-plus me-1"></i>Faire un panier
                  </a>`;
              } else {
                html += `<span class="badge bg-secondary">Expiré</span>`;
              }

              html += `</td>
              </tr>`;
            });

            html += `</tbody>
                  </table>
                </div>
              </div>
            </div>`;

            // Affichage mobile : cartes
            html += `<div class="d-md-none">`;
            catalogues.forEach(catalogue => {
              const daysRemaining = this.calculateDaysRemaining(catalogue.expiration_date);
              const badgeClass = this.getBadgeClass(daysRemaining);
              const badgeText = this.getBadgeText(daysRemaining);

              html += `<div class="card mb-3 shadow-sm">
                <div class="card-body">
                  <div class="d-flex ${catalogue.image_filename ? 'gap-3' : ''} mb-3">
                    ${catalogue.image_filename ? `
                      <div class="flex-shrink-0">
                        <img src="/uploads/catalogue-images/${catalogue.image_filename}" alt="Photo" style="width: 66px; height: 66px; object-fit: cover; border-radius: 4px;">
                      </div>
                    ` : ''}
                    <div class="flex-grow-1">
                      <h5 class="card-title mb-2">${catalogue.originalname}</h5>
                      ${catalogue.description ? `<p class="card-text text-muted small mb-0">${catalogue.description}</p>` : ''}
                    </div>
                  </div>

                  <div class="row g-2 mb-3">
                    <div class="col-6">
                      <small class="text-muted d-block">Expiration</small>
                      <strong>${catalogue.expiration_formatted || '-'}</strong>
                      ${daysRemaining >= 0 ? `<div><span class="badge ${badgeClass} mt-1">${badgeText}</span></div>` : ''}
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block">Livraison</small>
                      <strong>${catalogue.livraison_formatted || '-'}</strong>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block">Publié par</small>
                      <strong>${catalogue.username}</strong>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block">Statut</small>`;

              if (catalogue.nb_paniers_non_submis > 0) {
                html += `<span class="badge bg-warning text-dark me-1">
                  <i class="bi bi-cart3"></i> ${catalogue.nb_paniers_non_submis}
                </span>`;
              }
              if (catalogue.nb_paniers_submis > 0) {
                html += `<span class="badge bg-success">
                  <i class="bi bi-check-circle"></i> ${catalogue.nb_paniers_submis}
                </span>`;
              }
              if (catalogue.nb_paniers_non_submis === 0 && catalogue.nb_paniers_submis === 0) {
                html += `<span class="text-muted">-</span>`;
              }

              html += `</div>
                  </div>`;

              if (daysRemaining >= 0) {
                html += `<a href="/catalogues/${catalogue.id}/vue?nouveau=1" class="btn btn-primary w-100">
                  <i class="bi bi-cart-plus me-2"></i>Faire un panier
                </a>`;
              } else {
                html += `<div class="alert alert-secondary mb-0 text-center">
                  <i class="bi bi-clock-history me-2"></i>Catalogue expiré
                </div>`;
              }

              html += `</div>
              </div>`;
            });
            html += `</div>`;

            html += `<div class="mt-3 text-muted small">
              <i class="bi bi-info-circle me-1"></i>
              ${catalogues.length} catalogue${catalogues.length > 1 ? 's' : ''} affiché${catalogues.length > 1 ? 's' : ''}
            </div>`;
          }
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Restaurer le focus et la position du curseur si nécessaire
        if (wasSearchFocused) {
          const searchInput = document.getElementById('searchInput');
          if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        }

        // Ajouter les événements après le rendu
        this.attachEventListeners();
      },

      getSortIcon(column) {
        if (this.state.sortColumn !== column) {
          return '<i class="bi bi-arrow-down-up ms-1 text-muted"></i>';
        }
        return this.state.sortDirection === 'asc'
          ? '<i class="bi bi-arrow-up ms-1"></i>'
          : '<i class="bi bi-arrow-down ms-1"></i>';
      },

      attachEventListeners() {
        // Recherche
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.updateDOM();
          });
        }

        // Tri sur les colonnes
        const sortableCells = document.querySelectorAll('.sortable');
        sortableCells.forEach(cell => {
          cell.style.cursor = 'pointer';
          cell.addEventListener('click', () => {
            const column = cell.getAttribute('data-column');
            this.sortBy(column);
          });
        });
      }
    },

    mounted() {
      this.updateDOM();
      this.$watch(() => this.state.catalogues, () => this.updateDOM(), { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'catalogues-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#catalogues-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
