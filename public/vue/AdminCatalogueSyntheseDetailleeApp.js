// Application Vue pour la synthèse détaillée d'un catalogue
(function() {
  console.log('🚀 Chargement de AdminCatalogueSyntheseDetailleeApp.js...');

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
        catalogueId: window.CATALOGUE_ID,
        catalogueName: '',
        organizationName: '',
        organizationEmail: '',
        details: [],
        search: ''
      });

      const loadData = async () => {
        state.loading = true;
        state.error = null;

        try {
          const url = window.location.protocol + '//' + window.location.host + `/api/admin/catalogues/${state.catalogueId}/synthese-detaillee`;
          const response = await fetch(url, {
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
            state.catalogueName = data.catalogueName;
            state.organizationName = data.organizationName;
            state.organizationEmail = data.organizationEmail;
            state.details = data.details || [];
          } else {
            throw new Error(data.error || 'Erreur lors du chargement');
          }
        } catch (error) {
          console.error('❌ Erreur loadData:', error);
          state.error = error.message;
        } finally {
          state.loading = false;
        }
      };

      // Charger les données au montage
      loadData();

      return { state };
    },

    computed: {
      filteredDetails() {
        if (!this.state.search) return this.state.details;
        const term = this.state.search.toLowerCase();
        return this.state.details.filter(item =>
          item.username2?.toLowerCase().includes(term) ||
          item.produit?.toLowerCase().includes(term) ||
          item.categorie?.toLowerCase().includes(term) ||
          item.note?.toLowerCase().includes(term) ||
          item.note_article?.toLowerCase().includes(term)
        );
      },

      statistics() {
        const data = this.filteredDetails;
        const nbLines = data.length;
        const uniqueUsers = new Set(data.map(item => item.username2)).size;
        const uniqueProducts = new Set(data.map(item => item.produit)).size;
        const totalQuantity = data.reduce((sum, item) => sum + parseFloat(item.quantite || 0), 0);
        const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.montant_utilisateur || 0), 0);
        const averageAmount = nbLines > 0 ? totalAmount / nbLines : 0;

        return {
          nbLines,
          uniqueUsers,
          uniqueProducts,
          totalQuantity,
          totalAmount,
          averageAmount
        };
      }
    },

    methods: {
      exportExcel() {
        window.location.href = `/admin/catalogues/${this.state.catalogueId}/synthese-detaillee/export/xlsx`;
      },

      exportPDF() {
        window.location.href = `/admin/catalogues/${this.state.catalogueId}/synthese-detaillee/export/pdf/S`;
      },

      async sendPDFByEmail() {
        if (!confirm(`Envoyer la synthèse détaillée par email à ${this.state.organizationEmail} ?`)) {
          return;
        }

        try {
          const response = await fetch(`/admin/catalogues/${this.state.catalogueId}/synthese-detaillee/export/pdf/M`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (response.ok) {
            alert('Email envoyé avec succès !');
          } else {
            throw new Error('Erreur lors de l\'envoi de l\'email');
          }
        } catch (error) {
          console.error('Erreur sendPDFByEmail:', error);
          alert('Erreur lors de l\'envoi de l\'email');
        }
      },

      goBack() {
        window.location.href = '/admin/catalogues/vue';
      },

      formatPrice(price) {
        return parseFloat(price || 0).toFixed(2) + ' €';
      },

      formatQuantity(qty) {
        return parseFloat(qty || 0).toFixed(2);
      },

      render() {
        const s = this.state;

        if (s.loading) {
          return `
            <div class="admin-content-wrapper">
              <div class="container-fluid mt-4">
                <div class="text-center py-5">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Chargement...</span>
                  </div>
                  <p class="mt-3 text-muted">Chargement de la synthèse détaillée...</p>
                </div>
              </div>
            </div>
          `;
        }

        if (s.error) {
          return `
            <div class="admin-content-wrapper">
              <div class="container-fluid mt-4">
                <div class="alert alert-danger">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  ${s.error}
                </div>
                <button class="btn btn-primary" onclick="adminCatalogueSyntheseDetailleeApp.goBack()">
                  <i class="bi bi-arrow-left me-1"></i>Retour
                </button>
              </div>
            </div>
          `;
        }

        const stats = this.statistics;

        let html = `
            <div class="container-fluid mt-4">
              <!-- Bouton retour mobile uniquement -->
              <button class="btn btn-outline-secondary d-md-none mb-3" onclick="adminCatalogueSyntheseDetailleeApp.goBack()">
                <i class="bi bi-arrow-left me-2"></i>Retour
              </button>

              <!-- Header -->
              <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2><i class="bi bi-file-earmark-spreadsheet me-2"></i>Synthèse détaillée du catalogue</h2>
                  <h5 class="text-muted">${s.catalogueName}</h5>
                  ${s.organizationName ? `<p class="text-muted mb-0"><i class="bi bi-building me-1"></i>${s.organizationName}</p>` : ''}
                </div>
                <div class="d-none d-md-block">
                  <button class="btn btn-outline-secondary" onclick="adminCatalogueSyntheseDetailleeApp.goBack()">
                    <i class="bi bi-arrow-left me-1"></i>Retour
                  </button>
                </div>
              </div>

              <!-- Actions - Desktop -->
              <div class="card mb-4 d-none d-md-block">
                <div class="card-body">
                  <div class="row g-2">
                    <div class="col-md-auto">
                      <button class="btn btn-success" onclick="adminCatalogueSyntheseDetailleeApp.exportExcel()">
                        <i class="bi bi-file-earmark-excel me-1"></i>Export Excel
                      </button>
                    </div>
                    <div class="col-md-auto">
                      <button class="btn btn-danger" onclick="adminCatalogueSyntheseDetailleeApp.exportPDF()">
                        <i class="bi bi-file-earmark-pdf me-1"></i>Export PDF
                      </button>
                    </div>
                    ${s.organizationEmail ? `
                      <div class="col-md-auto">
                        <button class="btn btn-primary" onclick="adminCatalogueSyntheseDetailleeApp.sendPDFByEmail()">
                          <i class="bi bi-envelope me-1"></i>Envoyer par email
                        </button>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- Actions - Mobile (menu déroulant) -->
              <div class="card mb-4 d-md-none">
                <div class="card-body">
                  <div class="dropdown">
                    <button class="btn btn-primary dropdown-toggle w-100" type="button" data-bs-toggle="dropdown">
                      <i class="bi bi-gear me-2"></i>Actions
                    </button>
                    <ul class="dropdown-menu w-100">
                      <li>
                        <a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCatalogueSyntheseDetailleeApp.exportExcel()">
                          <i class="bi bi-file-earmark-excel me-2"></i>Export Excel
                        </a>
                      </li>
                      <li>
                        <a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCatalogueSyntheseDetailleeApp.exportPDF()">
                          <i class="bi bi-file-earmark-pdf me-2"></i>Export PDF
                        </a>
                      </li>
                      ${s.organizationEmail ? `
                        <li>
                          <a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCatalogueSyntheseDetailleeApp.sendPDFByEmail()">
                            <i class="bi bi-envelope me-2"></i>Envoyer par email
                          </a>
                        </li>
                      ` : ''}
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Statistiques -->
              <div class="card mb-4">
                <div class="card-body py-2">
                  <div class="row text-center">
                    <div class="col">
                      <small class="text-muted d-block">Lignes</small>
                      <strong class="fs-5">${stats.nbLines}</strong>
                    </div>
                    <div class="col">
                      <small class="text-muted d-block">Utilisateurs</small>
                      <strong class="fs-5">${stats.uniqueUsers}</strong>
                    </div>
                    <div class="col">
                      <small class="text-muted d-block">Produits</small>
                      <strong class="fs-5">${stats.uniqueProducts}</strong>
                    </div>
                    <div class="col">
                      <small class="text-muted d-block">Quantité totale</small>
                      <strong class="fs-5">${this.formatQuantity(stats.totalQuantity)}</strong>
                    </div>
                    <div class="col">
                      <small class="text-muted d-block">Montant total</small>
                      <strong class="fs-5 text-success">${this.formatPrice(stats.totalAmount)}</strong>
                    </div>
                    <div class="col">
                      <small class="text-muted d-block">Moyenne</small>
                      <strong class="fs-5">${this.formatPrice(stats.averageAmount)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Recherche -->
              <div class="card mb-4">
                <div class="card-body">
                  <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control search-input" placeholder="Rechercher un utilisateur, produit, catégorie ou note..." value="${s.search}">
                  </div>
                </div>
              </div>

              <!-- Tableau -->
              <div class="card">
                <div class="card-header bg-primary text-white">
                  <h5 class="mb-0">Détail des commandes par utilisateur</h5>
                </div>
                <div class="card-body p-0">
                  <div class="table-responsive">
                    <table class="table table-striped table-hover mb-0">
                      <thead class="table-light">
                        <tr>
                          <th>Utilisateur</th>
                          <th>Produit</th>
                          <th>Catégorie</th>
                          <th class="text-end">Prix unitaire</th>
                          <th class="text-end">Quantité</th>
                          <th class="text-end">Montant</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
        `;

        const filtered = this.filteredDetails;

        if (filtered.length === 0) {
          html += `
            <tr>
              <td colspan="7" class="text-center text-muted py-4">
                ${s.search ? 'Aucun résultat trouvé' : 'Aucune commande'}
              </td>
            </tr>
          `;
        } else {
          filtered.forEach(item => {
            const categoryBadge = item.categorie
              ? `<span class="badge" style="background-color: #6c757d">${item.categorie}</span>`
              : '';

            html += `
              <tr>
                <td><strong>${item.username2}</strong></td>
                <td>${item.produit}</td>
                <td>${categoryBadge}</td>
                <td class="text-end">${this.formatPrice(item.prix)}</td>
                <td class="text-end"><strong>${this.formatQuantity(item.quantite)}</strong></td>
                <td class="text-end"><strong>${this.formatPrice(item.montant_utilisateur)}</strong></td>
                <td>
                  ${item.note ? `<div class="small"><i class="bi bi-chat-square-text me-1"></i>${item.note}</div>` : ''}
                  ${item.note_article ? `<div class="small text-info"><i class="bi bi-info-circle me-1"></i>${item.note_article}</div>` : ''}
                </td>
              </tr>
            `;
          });
        }

        html += `
                      </tbody>
                      <tfoot class="table-light">
                        <tr>
                          <th colspan="4" class="text-end">TOTAL</th>
                          <th class="text-end">${this.formatQuantity(stats.totalQuantity)}</th>
                          <th class="text-end">${this.formatPrice(stats.totalAmount)}</th>
                          <th></th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
        `;

        return html;
      },

      attachEventListeners() {
        // Gestion de la recherche
        const searchInput = this.$el.querySelector('.search-input');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.state.search = e.target.value;
            // Mettre à jour seulement le tableau, pas tout le DOM
            this.updateTableOnly();
          });
        }
      },

      updateTableOnly() {
        // Re-render uniquement le tableau sans perdre le focus
        const tableContainer = this.$el.querySelector('.card:last-child');
        if (!tableContainer) return;

        const s = this.state;
        const stats = this.statistics;
        const filtered = this.filteredDetails;

        let tableHtml = `
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0">Détail des commandes par utilisateur</h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-striped table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Utilisateur</th>
                    <th>Produit</th>
                    <th>Catégorie</th>
                    <th class="text-end">Prix unitaire</th>
                    <th class="text-end">Quantité</th>
                    <th class="text-end">Montant</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
        `;

        if (filtered.length === 0) {
          tableHtml += `
            <tr>
              <td colspan="7" class="text-center text-muted py-4">
                ${s.search ? 'Aucun résultat trouvé' : 'Aucune commande'}
              </td>
            </tr>
          `;
        } else {
          filtered.forEach(item => {
            const categoryBadge = item.categorie
              ? `<span class="badge" style="background-color: #6c757d">${item.categorie}</span>`
              : '';

            tableHtml += `
              <tr>
                <td><strong>${item.username2}</strong></td>
                <td>${item.produit}</td>
                <td>${categoryBadge}</td>
                <td class="text-end">${this.formatPrice(item.prix)}</td>
                <td class="text-end"><strong>${this.formatQuantity(item.quantite)}</strong></td>
                <td class="text-end"><strong>${this.formatPrice(item.montant_utilisateur)}</strong></td>
                <td>
                  ${item.note ? `<div class="small"><i class="bi bi-chat-square-text me-1"></i>${item.note}</div>` : ''}
                  ${item.note_article ? `<div class="small text-info"><i class="bi bi-info-circle me-1"></i>${item.note_article}</div>` : ''}
                </td>
              </tr>
            `;
          });
        }

        tableHtml += `
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <th colspan="4" class="text-end">TOTAL</th>
                    <th class="text-end">${this.formatQuantity(stats.totalQuantity)}</th>
                    <th class="text-end">${this.formatPrice(stats.totalAmount)}</th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        `;

        tableContainer.innerHTML = tableHtml;
      }
    },

    mounted() {
      this.$nextTick(() => {
        this.$el.innerHTML = this.render();
        this.attachEventListeners();
      });

      // Watcher uniquement pour les données serveur (pas pour search)
      this.$watch(() => [this.state.loading, this.state.error, this.state.details], () => {
        this.$nextTick(() => {
          this.$el.innerHTML = this.render();
          this.attachEventListeners();
        });
      }, { deep: true });
    }
  });

  // Monter l'application
  const mountedApp = app.mount('#admin-catalogue-synthese-detaillee-app');
  window.adminCatalogueSyntheseDetailleeApp = mountedApp;

  console.log('✅ AdminCatalogueSyntheseDetailleeApp monté avec succès');
})();
