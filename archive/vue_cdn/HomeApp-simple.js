// Application Vue pour la page d'accueil (version simple sans Pinia)
(function() {
  console.log('🚀 Chargement de HomeApp-simple.js...');
  console.log('Vue disponible:', typeof Vue !== 'undefined');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive } = Vue;

  // Application principale
  const app = createApp({
    setup() {
      // State réactif (sans Pinia)
      const state = reactive({
        loading: false,
        error: null,
        stats: {
          paniers: 0,
          commandes: 0,
          catalogues: 0
        },
        paniersDetails: [],
        commandesDetails: [],
        nouveauxCatalogues: []
      });

      // Charger les données
      const loadHomeData = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch(`${window.location.origin}/api/home`, {
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
            state.stats = data.stats;
            state.paniersDetails = data.paniersDetails;
            state.commandesDetails = data.commandesDetails;
            state.nouveauxCatalogues = data.nouveauxCatalogues;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des données');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadHomeData:', error);
        } finally {
          state.loading = false;
        }
      };

      // Charger au montage
      loadHomeData();

      return {
        state
      };
    },

    methods: {
      calculateDiffDays(expirationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(expirationDate);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      },

      getBadgeClass(diffDays) {
        if (diffDays === 0) return 'bg-danger';
        if (diffDays === 1) return 'bg-warning text-dark';
        if (diffDays <= 3) return 'bg-info';
        return '';
      },

      getBadgeText(diffDays) {
        if (diffDays === 0) return "Expire aujourd'hui !";
        if (diffDays === 1) return 'Expire demain !';
        if (diffDays === 2) return 'Expire dans 2 jours';
        if (diffDays === 3) return 'Expire dans 3 jours';
        return '';
      },

      updateDOM() {
        const container = this.$el;
        if (!container) return;

        const s = this.state;

        let html = `
          <div class="admin-content-wrapper">
            <div class="container mt-5">
              <h2 class="mb-4">
                <i class="bi bi-house-door me-2"></i>Tableau de bord
              </h2>`;

        // Message d'erreur
        if (s.error) {
          html += `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Erreur :</strong> ${s.error}
              <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>`;
        }

        // Loader
        if (s.loading) {
          html += `
            <div class="text-center py-5">
              <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="mt-3 text-muted">Chargement des données...</p>
            </div>`;
        } else {
          // Statistiques
          html += `
            <div class="row mb-5">
              <div class="col-md-4 mb-3">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body text-center p-4">
                    <div class="mb-3">
                      <i class="bi bi-cart3 fs-1 text-primary"></i>
                    </div>
                    <h3 class="display-4 fw-bold mb-2">${s.stats.paniers}</h3>
                    <p class="text-muted mb-0">Paniers en cours</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body text-center p-4">
                    <div class="mb-3">
                      <i class="bi bi-truck fs-1 text-success"></i>
                    </div>
                    <h3 class="display-4 fw-bold mb-2">${s.stats.commandes}</h3>
                    <p class="text-muted mb-0">Commandes en attente</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body text-center p-4">
                    <div class="mb-3">
                      <i class="bi bi-book fs-1 text-info"></i>
                    </div>
                    <h3 class="display-4 fw-bold mb-2">${s.stats.catalogues}</h3>
                    <p class="text-muted mb-0">Catalogues disponibles</p>
                  </div>
                </div>
              </div>
            </div>`;

          // Table paniers
          html += `
            <div class="row mb-4">
              <div class="col-12 mb-4">
                <div class="card border-0 shadow-sm">
                  <div class="card-header bg-white border-bottom">
                    <h5 class="mb-0">
                      <i class="bi bi-cart3 me-2"></i>Mes paniers en cours
                    </h5>
                  </div>
                  <div class="card-body p-0">`;

          if (s.paniersDetails.length === 0) {
            html += `
                    <div class="p-4 text-center text-muted">
                      <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                      <p>Aucun panier en cours</p>
                    </div>`;
          } else {
            html += `
                    <div class="table-responsive">
                      <table class="table table-hover mb-0">
                        <thead class="table-light">
                          <tr>
                            <th>Catalogue</th>
                            <th>Articles</th>
                            <th>Date d'expiration</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>`;

            s.paniersDetails.forEach(panier => {
              const diffDays = this.calculateDiffDays(panier.expiration_commande);
              const badgeClass = this.getBadgeClass(diffDays);
              const badgeText = this.getBadgeText(diffDays);

              html += `
                          <tr>
                            <td>${panier.catalogue_nom}</td>
                            <td>
                              <span class="badge bg-secondary">${panier.nb_articles}</span>
                            </td>
                            <td>
                              ${panier.expiration}
                              ${diffDays <= 3 ? `<span class="badge ms-2 ${badgeClass}">${badgeText}</span>` : ''}
                            </td>
                            <td>
                              <a href="/panier/${panier.id}/modifier" class="btn btn-sm btn-outline-primary">
                                <i class="bi bi-pencil me-1"></i>Modifier
                              </a>
                              <a href="/panier/${panier.id}/catalogue/${panier.catalogue_id}" class="btn btn-sm btn-outline-secondary ms-1">
                                <i class="bi bi-eye me-1"></i>Voir
                              </a>
                            </td>
                          </tr>`;
            });

            html += `
                        </tbody>
                      </table>
                    </div>`;
          }

          html += `
                  </div>
                </div>
              </div>`;

          // Table commandes
          html += `
              <div class="col-12 mb-4">
                <div class="card border-0 shadow-sm">
                  <div class="card-header bg-white border-bottom">
                    <h5 class="mb-0">
                      <i class="bi bi-truck me-2"></i>Mes commandes en attente de livraison
                    </h5>
                  </div>
                  <div class="card-body p-0">`;

          if (s.commandesDetails.length === 0) {
            html += `
                    <div class="p-4 text-center text-muted">
                      <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                      <p>Aucune commande en attente</p>
                    </div>`;
          } else {
            html += `
                    <div class="table-responsive">
                      <table class="table table-hover mb-0">
                        <thead class="table-light">
                          <tr>
                            <th>Catalogue</th>
                            <th>Articles</th>
                            <th>Date de livraison</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>`;

            s.commandesDetails.forEach(commande => {
              html += `
                          <tr>
                            <td>${commande.catalogue_nom}</td>
                            <td>
                              <span class="badge bg-secondary">${commande.nb_articles}</span>
                            </td>
                            <td>${commande.livraison}</td>
                            <td>
                              <span class="badge bg-success">
                                <i class="bi bi-check-circle me-1"></i>${commande.statut}
                              </span>
                            </td>
                          </tr>`;
            });

            html += `
                        </tbody>
                      </table>
                    </div>`;
          }

          html += `
                  </div>
                </div>
              </div>`;

          // Nouveaux catalogues
          html += `
              <div class="col-12 mb-4">
                <div class="card border-0 shadow-sm">
                  <div class="card-header bg-white border-bottom">
                    <h5 class="mb-0">
                      <i class="bi bi-star me-2"></i>Nouveaux catalogues disponibles
                    </h5>
                  </div>
                  <div class="card-body">`;

          if (s.nouveauxCatalogues.length === 0) {
            html += `
                    <div class="text-center text-muted">
                      <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                      <p>Aucun nouveau catalogue</p>
                    </div>`;
          } else {
            html += `
                    <div class="row g-3">`;

            s.nouveauxCatalogues.forEach(catalogue => {
              html += `
                      <div class="col-md-4">
                        <div class="card h-100 border">
                          <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                              <h6 class="card-title mb-0">${catalogue.originalname}</h6>
                              <span class="badge bg-primary">Nouveau</span>
                            </div>
                            ${catalogue.description ? `<p class="card-text small text-muted mb-3">${catalogue.description}</p>` : ''}
                            <div class="small mb-2">
                              <i class="bi bi-calendar-event text-primary me-1"></i>
                              <strong>Commandes avant le :</strong> ${catalogue.expiration}
                            </div>
                            <div class="small mb-3">
                              <i class="bi bi-truck text-success me-1"></i>
                              <strong>Livraison le :</strong> ${catalogue.livraison}
                            </div>
                            <a href="/catalogues/${catalogue.id}" class="btn btn-sm btn-primary w-100">
                              <i class="bi bi-cart-plus me-1"></i>Commander
                            </a>
                          </div>
                        </div>
                      </div>`;
            });

            html += `
                    </div>`;
          }

          html += `
                  </div>
                </div>
              </div>
            </div>`;
        }

        html += `
            </div>
          </div>`;

        container.innerHTML = html;
      }
    },

    mounted() {
      // Premier rendu
      this.updateDOM();

      // Watcher pour mettre à jour le DOM quand les données changent
      this.$watch(() => this.state.loading, () => this.updateDOM());
      this.$watch(() => this.state.error, () => this.updateDOM());
      this.$watch(() => this.state.stats, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.paniersDetails, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.commandesDetails, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.nouveauxCatalogues, () => this.updateDOM(), { deep: true });
    }
  });

  // Monter l'application directement sans compiler de template
  console.log('🎯 Montage de l\'application Vue...');

  // Créer l'élément racine manuellement pour éviter le compilateur de templates
  const rootElement = document.querySelector('#home-app');
  if (!rootElement) {
    console.error('❌ Élément #home-app introuvable');
    return;
  }

  try {
    // Vider le contenu initial (loader)
    rootElement.innerHTML = '';

    // Monter l'app
    const instance = app.mount('#home-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage de l\'application:', error);
    console.error('Détails:', error.stack);
  }
})();
