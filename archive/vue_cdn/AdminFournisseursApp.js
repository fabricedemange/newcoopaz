/**
 * AdminFournisseursApp.js - Application Vue.js pour la gestion des fournisseurs
 * Version: 1
 */

(function() {
  console.log('🎨 AdminFournisseursApp.js - Chargement...');

  const { createApp } = Vue;

  const app = createApp({
    data() {
      return {
        suppliers: [],
        loading: true,
        error: null,
        sortColumn: 'nom',
        sortDirection: 'asc',
        searchTerm: '',
        showMergeModal: false,
        mergeSourceId: null,
        mergeTargetId: null,
        merging: false
      };
    },

    computed: {
      filteredAndSortedSuppliers() {
        let filtered = [...this.suppliers];

        // Filtre par recherche
        if (this.searchTerm) {
          const searchLower = this.searchTerm.toLowerCase();
          filtered = filtered.filter(s =>
            (s.nom && s.nom.toLowerCase().includes(searchLower)) ||
            (s.email && s.email.toLowerCase().includes(searchLower)) ||
            (s.ville && s.ville.toLowerCase().includes(searchLower))
          );
        }

        // Tri
        filtered.sort((a, b) => {
          let aVal = a[this.sortColumn] || '';
          let bVal = b[this.sortColumn] || '';

          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();

          if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
          return 0;
        });

        return filtered;
      },

      // Fournisseurs triés alphabétiquement pour les listes déroulantes
      suppliersAlpha() {
        return [...this.suppliers].sort((a, b) => {
          const aName = (a.nom || '').toLowerCase();
          const bName = (b.nom || '').toLowerCase();
          return aName.localeCompare(bName);
        });
      }
    },

    methods: {
      async loadData() {
        this.loading = true;
        this.error = null;

        try {
          const url = window.location.protocol + '//' + window.location.host + '/api/admin/suppliers';
          const response = await fetch(url, {
            headers: {
              'CSRF-Token': window.CSRF_TOKEN
            }
          });

          if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
          }

          const data = await response.json();

          if (data.success) {
            this.suppliers = data.suppliers || [];
          } else {
            throw new Error(data.error || 'Erreur inconnue');
          }
        } catch (error) {
          console.error('❌ Erreur:', error);
          this.error = error.message;
        } finally {
          this.loading = false;
        }
      },

      sortBy(column) {
        if (this.sortColumn === column) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = column;
          this.sortDirection = 'asc';
        }
      },

      getSortIcon(column) {
        if (this.sortColumn !== column) return 'bi-arrow-down-up';
        return this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
      },

      goToSupplier(supplierId) {
        window.location.href = `/admin/suppliers/${supplierId}`;
      },

      goToEditSupplier(supplierId) {
        window.location.href = `/admin/suppliers/${supplierId}/edit`;
      },

      goToNewSupplier() {
        window.location.href = '/admin/suppliers/new';
      },

      openMergeModal() {
        this.showMergeModal = true;
        this.mergeSourceId = null;
        this.mergeTargetId = null;
      },

      closeMergeModal() {
        this.showMergeModal = false;
        this.mergeSourceId = null;
        this.mergeTargetId = null;
      },

      async mergeSuppliers() {
        if (!this.mergeSourceId || !this.mergeTargetId) {
          alert('Veuillez sélectionner les deux fournisseurs');
          return;
        }

        if (this.mergeSourceId === this.mergeTargetId) {
          alert('Impossible de fusionner un fournisseur avec lui-même');
          return;
        }

        const sourceSupplier = this.suppliers.find(s => s.id === parseInt(this.mergeSourceId));
        const targetSupplier = this.suppliers.find(s => s.id === parseInt(this.mergeTargetId));

        if (!confirm(`Êtes-vous sûr de vouloir fusionner "${sourceSupplier.nom}" dans "${targetSupplier.nom}" ?\n\nTous les produits seront transférés, puis "${sourceSupplier.nom}" sera supprimé.`)) {
          return;
        }

        this.merging = true;

        try {
          const response = await fetch('/api/admin/suppliers/merge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': window.CSRF_TOKEN
            },
            body: JSON.stringify({
              sourceId: this.mergeSourceId,
              targetId: this.mergeTargetId
            })
          });

          if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.success) {
            alert(`Fusion réussie !\n${data.productsUpdated} produit(s) transféré(s).`);
            this.closeMergeModal();
            await this.loadData();
          } else {
            alert('Erreur: ' + (data.error || 'Erreur inconnue'));
          }
        } catch (error) {
          console.error('Erreur:', error);
          alert('Erreur lors de la fusion');
        } finally {
          this.merging = false;
        }
      },

      render() {
        // Sauvegarder l'élément actif et la position du curseur avant de régénérer le HTML
        const activeElement = document.activeElement;
        const activeId = activeElement?.id;
        const cursorPosition = activeElement?.selectionStart || 0;

        let html = '';

        if (this.loading) {
          html = `
            <div class="text-center py-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="mt-3 text-muted">Chargement des fournisseurs...</p>
            </div>
          `;
        } else if (this.error) {
          html = `
            <div class="alert alert-danger">
              <h4><i class="bi bi-exclamation-triangle me-2"></i>Erreur</h4>
              <p>${this.error}</p>
              <button class="btn btn-primary" onclick="location.reload()">
                <i class="bi bi-arrow-clockwise me-2"></i>Réessayer
              </button>
            </div>
          `;
        } else {
          html = `
            <div class="container-fluid px-3 mt-4">
              <!-- En-tête -->
              <div class="row">
                <div class="col-12">
                  <h2 class="mb-4">Gestion des fournisseurs</h2>
                  <p class="text-muted mb-4">Gérer les fournisseurs de produits</p>
                </div>
              </div>

              <!-- Boutons actions -->
              <div class="row">
                <div class="col-12">
                  <div class="d-flex flex-column flex-sm-row gap-2 mb-3">
                    <button class="btn btn-success" onclick="app.goToNewSupplier()">
                      <i class="bi bi-plus-circle me-2"></i>Ajouter un fournisseur
                    </button>
                    <button class="btn btn-outline-warning" onclick="app.openMergeModal()">
                      <i class="bi bi-union me-2"></i>Fusionner des fournisseurs
                    </button>
                  </div>
                </div>
              </div>

              <!-- Barre de recherche -->
              <div class="row mb-3">
                <div class="col-12 col-md-6">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input
                      type="text"
                      class="form-control"
                      id="search-input"
                      placeholder="Rechercher par nom, email ou ville..."
                      value="${this.searchTerm}"
                      oninput="app.searchTerm = this.value">
                    ${this.searchTerm ? `
                      <button class="btn btn-outline-secondary" type="button" onclick="app.searchTerm = ''">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- Liste des fournisseurs -->
              <div class="row">
                <div class="col-12">
          `;

          if (this.filteredAndSortedSuppliers.length === 0) {
            html += `
              <div class="alert alert-info text-center">
                <h4>Aucun fournisseur trouvé</h4>
                <p>${this.searchTerm ? 'Modifiez votre recherche ou créez un nouveau fournisseur.' : 'Commencez par créer votre premier fournisseur.'}</p>
                <button class="btn btn-primary" onclick="app.goToNewSupplier()">
                  Créer un fournisseur
                </button>
              </div>
            `;
          } else {
            html += `
              <div class="card">
                <div class="card-header">
                  <h5 class="card-title mb-0">
                    <i class="bi bi-truck me-2"></i>
                    Liste des fournisseurs (${this.filteredAndSortedSuppliers.length})
                  </h5>
                </div>
                <div class="card-body">
                  <!-- Version desktop -->
                  <div class="table-responsive d-none d-md-block">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th style="cursor: pointer" onclick="app.sortBy('nom')">
                            Nom <i class="${this.getSortIcon('nom')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('email')">
                            Email <i class="${this.getSortIcon('email')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('telephone')">
                            Téléphone <i class="${this.getSortIcon('telephone')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('ville')">
                            Ville <i class="${this.getSortIcon('ville')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('nb_products')">
                            Produits <i class="${this.getSortIcon('nb_products')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('is_active')">
                            Statut <i class="${this.getSortIcon('is_active')}"></i>
                          </th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
            `;

            this.filteredAndSortedSuppliers.forEach(supplier => {
              html += `
                <tr>
                  <td><strong>${supplier.nom}</strong></td>
                  <td>
                    ${supplier.email ? `<a href="mailto:${supplier.email}">${supplier.email}</a>` : '<span class="text-muted">-</span>'}
                  </td>
                  <td>${supplier.telephone || '-'}</td>
                  <td>${supplier.ville || '-'}</td>
                  <td>
                    <span class="badge bg-info">${supplier.nb_products || 0} produit(s)</span>
                  </td>
                  <td>
                    ${supplier.is_active
                      ? '<span class="badge bg-success">Actif</span>'
                      : '<span class="badge bg-secondary">Inactif</span>'}
                  </td>
                  <td>
                    <div class="btn-group btn-group-sm">
                      <button
                        class="btn btn-outline-primary"
                        onclick="app.goToSupplier(${supplier.id})"
                        title="Voir les détails">
                        <i class="bi bi-eye"></i>
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        onclick="app.goToEditSupplier(${supplier.id})"
                        title="Modifier">
                        <i class="bi bi-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            });

            html += `
                      </tbody>
                    </table>
                  </div>

                  <!-- Version mobile -->
                  <div class="d-md-none">
            `;

            this.filteredAndSortedSuppliers.forEach(supplier => {
              html += `
                <div class="card mb-3 shadow-sm">
                  <div class="card-body">
                    <h5 class="card-title mb-3">${supplier.nom}</h5>

                    <div class="row g-2 mb-3">
                      <div class="col-12">
                        <small class="text-muted d-block">Email</small>
                        ${supplier.email ? `<a href="mailto:${supplier.email}">${supplier.email}</a>` : '<span class="text-muted">-</span>'}
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Téléphone</small>
                        <strong>${supplier.telephone || '-'}</strong>
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Ville</small>
                        <strong>${supplier.ville || '-'}</strong>
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Produits</small>
                        <span class="badge bg-info">${supplier.nb_products || 0}</span>
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Statut</small>
                        ${supplier.is_active
                          ? '<span class="badge bg-success">Actif</span>'
                          : '<span class="badge bg-secondary">Inactif</span>'}
                      </div>
                    </div>

                    <div class="d-flex gap-2">
                      <button
                        class="btn btn-sm btn-outline-primary flex-fill"
                        onclick="app.goToSupplier(${supplier.id})">
                        <i class="bi bi-eye me-1"></i>Voir
                      </button>
                      <button
                        class="btn btn-sm btn-outline-secondary flex-fill"
                        onclick="app.goToEditSupplier(${supplier.id})">
                        <i class="bi bi-pencil me-1"></i>Modifier
                      </button>
                    </div>
                  </div>
                </div>
              `;
            });

            html += `
                  </div>
                </div>
              </div>
            `;
          }

          html += `
                </div>
              </div>
            </div>
          `;
        }

        // Modale de fusion
        if (this.showMergeModal) {
          html += `
            <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">
                      <i class="bi bi-union me-2"></i>Fusionner des fournisseurs
                    </h5>
                    <button type="button" class="btn-close" onclick="app.closeMergeModal()"></button>
                  </div>
                  <div class="modal-body">
                    <div class="alert alert-warning">
                      <i class="bi bi-exclamation-triangle me-2"></i>
                      <strong>Attention :</strong> Cette action est irréversible. Tous les produits du fournisseur source seront transférés vers la cible, puis la source sera supprimée.
                    </div>

                    <div class="mb-3">
                      <label for="merge-source" class="form-label">Fournisseur à fusionner (source) :</label>
                      <select class="form-select" id="merge-source" onchange="app.mergeSourceId = this.value">
                        <option value="">-- Sélectionner --</option>
                        ${this.suppliersAlpha.map(s => `
                          <option value="${s.id}" ${this.mergeSourceId == s.id ? 'selected' : ''}>
                            ${s.nom} (${s.nb_products || 0} produits)
                          </option>
                        `).join('')}
                      </select>
                    </div>

                    <div class="mb-3">
                      <label for="merge-target" class="form-label">Fournisseur de destination (cible) :</label>
                      <select class="form-select" id="merge-target" onchange="app.mergeTargetId = this.value">
                        <option value="">-- Sélectionner --</option>
                        ${this.suppliersAlpha.map(s => `
                          <option value="${s.id}" ${this.mergeTargetId == s.id ? 'selected' : ''}>
                            ${s.nom} (${s.nb_products || 0} produits)
                          </option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="app.closeMergeModal()">Annuler</button>
                    <button
                      type="button"
                      class="btn btn-warning"
                      onclick="app.mergeSuppliers()"
                      ${this.merging ? 'disabled' : ''}>
                      ${this.merging ? '<span class="spinner-border spinner-border-sm me-2"></span>Fusion en cours...' : '<i class="bi bi-union me-2"></i>Fusionner'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // Mettre à jour le DOM
        const container = this.$refs.container;
        if (container) {
          container.innerHTML = html;

          // Restaurer le focus et la position du curseur
          if (activeId) {
            this.$nextTick(() => {
              const element = document.getElementById(activeId);
              if (element) {
                element.focus();
                if (element.type === 'text' || element.tagName === 'TEXTAREA') {
                  if (typeof element.setSelectionRange === 'function') {
                    element.setSelectionRange(cursorPosition, cursorPosition);
                  }
                }
              }
            });
          }
        }
      }
    },

    mounted() {
      console.log('✅ AdminFournisseursApp monté');
      this.loadData();
      this.render();
    },

    watch: {
      searchTerm() {
        this.render();
      },
      suppliers() {
        this.render();
      },
      sortColumn() {
        this.render();
      },
      sortDirection() {
        this.render();
      },
      showMergeModal() {
        this.render();
      },
      merging() {
        this.render();
      }
    }
  });

  // Montage de l'application
  window.app = app.mount('#admin-fournisseurs-app');
  console.log('✅ AdminFournisseursApp initialisé');
})();
