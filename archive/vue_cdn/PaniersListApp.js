// Application Vue pour la liste des paniers
(function() {
  console.log('🚀 Chargement de PaniersListApp.js...');

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
        paniers: [],
        searchTerm: '',
        sortColumn: 'created_at',
        sortDirection: 'desc'
      });

      const loadPaniers = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch('/api/paniers', {
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
            state.paniers = data.paniers;
            console.log('📦 Paniers reçus:', data.paniers.length);
            if (data.paniers.length > 0) {
              console.log('📝 Premier panier:', data.paniers[0]);
            }
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des paniers');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadPaniers:', error);
        } finally {
          state.loading = false;
        }
      };

      loadPaniers();

      return {
        state
      };
    },

    methods: {
      formatPrice(price) {
        if (!price) return '0,00 €';
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(price);
      },

      getFilteredPaniers() {
        let filtered = [...this.state.paniers];

        // Filtrer par recherche
        if (this.state.searchTerm) {
          const term = this.state.searchTerm.toLowerCase();
          filtered = filtered.filter(p =>
            p.catalogue_nom.toLowerCase().includes(term) ||
            (p.catalog_description && p.catalog_description.toLowerCase().includes(term)) ||
            (p.panier_note && p.panier_note.toLowerCase().includes(term)) ||
            (p.articles_notes && p.articles_notes.toLowerCase().includes(term)) ||
            String(p.id).includes(term)
          );
        }

        return filtered;
      },

      getSortedPaniers() {
        const filtered = this.getFilteredPaniers();
        const column = this.state.sortColumn;
        const direction = this.state.sortDirection;

        return filtered.sort((a, b) => {
          let valA, valB;

          switch (column) {
            case 'id':
              valA = a.id;
              valB = b.id;
              break;
            case 'catalogue':
              valA = a.catalogue_nom || '';
              valB = b.catalogue_nom || '';
              break;
            case 'nb_articles':
              valA = a.nb_articles || 0;
              valB = b.nb_articles || 0;
              break;
            case 'total':
              valA = a.total || 0;
              valB = b.total || 0;
              break;
            case 'expiration_date':
              valA = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
              valB = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
              break;
            case 'created_at':
              valA = a.created_at ? new Date(a.created_at).getTime() : 0;
              valB = b.created_at ? new Date(b.created_at).getTime() : 0;
              break;
            default:
              return 0;
          }

          if (typeof valA === 'string') {
            return direction === 'asc'
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          } else {
            return direction === 'asc' ? valA - valB : valB - valA;
          }
        });
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

      handleSearch(event) {
        this.state.searchTerm = event.target.value;
        this.updateDOM();
      },

      getSortIcon(column) {
        if (this.state.sortColumn !== column) {
          return '<i class="bi bi-arrow-down-up text-muted"></i>';
        }
        return this.state.sortDirection === 'asc'
          ? '<i class="bi bi-arrow-up text-primary"></i>'
          : '<i class="bi bi-arrow-down text-primary"></i>';
      },

      async deletePanier(panierId) {
        if (!confirm('Confirmer la suppression de ce panier ?')) {
          return;
        }

        try {
          const response = await fetch(`/panier/${panierId}/supprimer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({ source: '' })
          });

          if (response.ok) {
            // Recharger la liste
            this.state.paniers = this.state.paniers.filter(p => p.id !== panierId);
            this.updateDOM();
          } else {
            throw new Error('Erreur lors de la suppression');
          }
        } catch (error) {
          console.error('Erreur deletePanier:', error);
          alert('Erreur lors de la suppression du panier');
        }
      },

      getBadgeClass(panier) {
        if (panier.isExpired) return 'bg-danger';
        if (panier.modifiable) return 'bg-success';
        return 'bg-secondary';
      },

      getBadgeText(panier) {
        if (panier.isExpired) return 'Expiré';
        if (panier.modifiable) return 'Modifiable';
        return 'Non modifiable';
      },

      updateDOM() {
        console.log('📋 updateDOM appelé');
        const container = this.$refs.container;
        if (!container) {
          console.error('❌ Container non trouvé !');
          return;
        }

        // Sauvegarder l'élément actif et la position du curseur
        const activeElement = document.activeElement;
        const isSearchInput = activeElement?.classList.contains('search-input');
        const cursorPosition = isSearchInput ? activeElement.selectionStart : 0;

        const s = this.state;
        const sortedPaniers = this.getSortedPaniers();

        let html = '<div class="admin-content-wrapper"><div class="container-fluid mt-4">';

        // Bouton retour mobile uniquement
        html += `
          <button class="btn btn-outline-secondary d-md-none mb-3" onclick="window.history.back()">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </button>
        `;

        // En-tête
        html += `<div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-cart me-2"></i>Mes paniers en cours</h2>
          <a href="/catalogues/vue" class="btn btn-primary">
            <i class="bi bi-plus-circle me-1"></i>Nouveau panier
          </a>
        </div>`;

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
            <p class="mt-3 text-muted">Chargement des paniers...</p>
          </div>`;
        } else {
          // Barre de recherche
          html += `<div class="card mb-3">
            <div class="card-body">
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-search"></i>
                </span>
                <input type="text"
                       class="form-control search-input"
                       placeholder="Rechercher par catalogue, description, note ou numéro..."
                       value="${s.searchTerm}">
              </div>
            </div>
          </div>`;

          if (sortedPaniers.length === 0) {
            if (s.searchTerm) {
              html += `<div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Aucun panier ne correspond à votre recherche.
              </div>`;
            } else {
              html += `<div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Aucun panier en cours.
                <a href="/catalogues/vue" class="alert-link">Commencer un nouveau panier</a>
              </div>`;
            }
          } else {
            // Vue DESKTOP: Tableau (visible uniquement sur écrans ≥768px)
            html += `<div class="card d-none d-md-block">
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover align-middle">
                    <thead class="table-light">
                      <tr>
                        <th style="cursor: pointer;" class="sort-header" data-column="id">
                          # ${this.getSortIcon('id')}
                        </th>
                        <th style="cursor: pointer;" class="sort-header" data-column="catalogue">
                          Catalogue ${this.getSortIcon('catalogue')}
                        </th>
                        <th style="cursor: pointer; text-align: center;" class="sort-header" data-column="nb_articles">
                          Articles ${this.getSortIcon('nb_articles')}
                        </th>
                        <th style="cursor: pointer; text-align: right;" class="sort-header" data-column="total">
                          Total ${this.getSortIcon('total')}
                        </th>
                        <th style="cursor: pointer;" class="sort-header" data-column="expiration_date">
                          Expiration ${this.getSortIcon('expiration_date')}
                        </th>
                        <th>Statut</th>
                        <th style="width: 200px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>`;

            sortedPaniers.forEach(panier => {
              const badgeClass = this.getBadgeClass(panier);
              const badgeText = this.getBadgeText(panier);

              html += `<tr>
                <td><span class="badge bg-light text-dark">#${panier.id}</span></td>
                <td>
                  <strong>${panier.catalogue_nom}</strong>
                  ${panier.catalog_description ? `<br><small class="text-muted">${panier.catalog_description}</small>` : ''}
                  ${panier.panier_note ? `<br><small class="text-info"><i class="bi bi-sticky"></i> ${panier.panier_note}</small>` : ''}
                </td>
                <td class="text-center">
                  <span class="badge bg-secondary">${panier.nb_articles || 0}</span>
                </td>
                <td class="text-end">
                  <strong>${this.formatPrice(panier.total)}</strong>
                </td>
                <td>
                  <div>${panier.expiration_formatted}</div>
                  <small class="text-muted"><i class="bi bi-truck"></i> ${panier.livraison_formatted}</small>
                </td>
                <td>
                  <span class="badge ${badgeClass}">${badgeText}</span>
                </td>
                <td>
                  <div class="d-flex gap-1">`;

              if (panier.modifiable) {
                html += `<a href="/panier/${panier.id}/modifier/vue" class="btn btn-sm btn-primary" title="Éditer le panier">
                      <i class="bi bi-pencil"></i> Éditer
                    </a>`;
              } else {
                html += `<span class="text-muted small">Catalogue expiré</span>`;
              }

              html += `<button class="btn btn-sm btn-outline-danger delete-panier-btn ms-1"
                            data-panier-id="${panier.id}"
                            title="Supprimer">
                      <i class="bi bi-trash"></i>
                    </button>`;

              html += `</div>
                </td>
              </tr>`;
            });

            html += `</tbody>
                  </table>
                </div>
                <div class="text-muted small mt-2">
                  ${sortedPaniers.length} panier${sortedPaniers.length > 1 ? 's' : ''}
                  ${s.searchTerm ? ' (filtré' + (s.paniers.length !== sortedPaniers.length ? ' sur ' + s.paniers.length + ' total)' : ')') : ''}
                </div>
              </div>
            </div>`;

            // Vue MOBILE: Cartes (visible uniquement sur écrans <768px)
            html += `<div class="d-md-none">`;

            sortedPaniers.forEach(panier => {
              const badgeClass = this.getBadgeClass(panier);
              const badgeText = this.getBadgeText(panier);

              html += `<div class="card mb-2 shadow-sm">
                <div class="card-body p-2">
                  <div class="d-flex justify-content-between align-items-start mb-1">
                    <h6 class="card-title mb-0 small">
                      <span class="badge bg-light text-dark me-1">#${panier.id}</span>
                      <strong>${panier.catalogue_nom}</strong>
                    </h6>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                  </div>

                  ${panier.catalog_description ? `<p class="text-muted mb-1" style="font-size: 0.75rem;">${panier.catalog_description}</p>` : ''}
                  ${panier.panier_note ? `<div class="alert alert-info py-1 px-2 mb-1" style="font-size: 0.7rem;">
                    <i class="bi bi-sticky me-1"></i>${panier.panier_note}
                  </div>` : ''}

                  <div class="row g-1 mb-2">
                    <div class="col-6">
                      <small class="text-muted d-block" style="font-size: 0.65rem;">Articles</small>
                      <span class="badge bg-secondary" style="font-size: 0.7rem;">${panier.nb_articles || 0}</span>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block" style="font-size: 0.65rem;">Total</small>
                      <strong style="font-size: 0.85rem;">${this.formatPrice(panier.total)}</strong>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block" style="font-size: 0.65rem;">Expiration</small>
                      <div style="font-size: 0.75rem;">${panier.expiration_formatted}</div>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block" style="font-size: 0.65rem;">Livraison</small>
                      <div style="font-size: 0.75rem;"><i class="bi bi-truck"></i> ${panier.livraison_formatted}</div>
                    </div>
                  </div>

                  <div class="d-grid gap-1">`;

              if (panier.modifiable) {
                html += `<a href="/panier/${panier.id}/modifier/vue" class="btn btn-sm btn-primary">
                  <i class="bi bi-pencil me-1"></i>Éditer
                </a>`;
              }

              html += `<button class="btn btn-sm btn-outline-danger delete-panier-btn" data-panier-id="${panier.id}">
                <i class="bi bi-trash me-1"></i>Supprimer
              </button>`;

              html += `</div>
                </div>
              </div>`;
            });

            html += `<div class="text-muted small text-center mt-3">
              ${sortedPaniers.length} panier${sortedPaniers.length > 1 ? 's' : ''}
              ${s.searchTerm ? ' (filtré' + (s.paniers.length !== sortedPaniers.length ? ' sur ' + s.paniers.length + ' total)' : ')') : ''}
            </div>`;
            html += `</div>`;
          }
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Attacher les événements
        this.attachEventListeners();

        // Restaurer le focus sur l'input de recherche si c'était l'élément actif
        if (isSearchInput) {
          const searchInput = document.querySelector('.search-input');
          if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        }
      },

      attachEventListeners() {
        // Boutons de suppression
        document.querySelectorAll('.delete-panier-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const panierId = parseInt(e.currentTarget.dataset.panierId);
            this.deletePanier(panierId);
          });
        });

        // En-têtes de tri
        document.querySelectorAll('.sort-header').forEach(header => {
          header.addEventListener('click', (e) => {
            const column = e.currentTarget.dataset.column;
            this.sortBy(column);
          });
        });

        // Champ de recherche
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }
      }
    },

    mounted() {
      this.$nextTick(() => {
        this.updateDOM();
      });

      // Watcher pour les changements de state
      this.$watch(() => this.state, () => {
        this.$nextTick(() => {
          this.updateDOM();
        });
      }, { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'vue-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#paniers-list-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
