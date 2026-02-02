// Application Vue pour la page d'accueil (version avec fonctions de rendu)
(function() {
  console.log('🚀 Chargement de HomeApp-render.js...');
  console.log('Vue disponible:', typeof Vue !== 'undefined');
  console.log('Pinia disponible:', typeof Pinia !== 'undefined');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  if (typeof Pinia === 'undefined') {
    console.error('❌ Pinia n\'est pas chargé !');
    return;
  }

  const { createApp, h } = Vue;
  const { createPinia, defineStore } = Pinia;

  // Service API
  const apiService = {
    baseURL: window.location.origin,

    async fetchHomeData() {
      try {
        const response = await fetch(`${this.baseURL}/api/home`, {
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
        return data;
      } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        throw error;
      }
    }
  };

  // Store Pinia
  const useHomeStore = defineStore('home', {
    state: () => ({
      loading: false,
      error: null,
      user: null,
      stats: {
        paniers: 0,
        commandes: 0,
        catalogues: 0
      },
      paniersDetails: [],
      commandesDetails: [],
      nouveauxCatalogues: []
    }),

    actions: {
      async loadHomeData() {
        this.loading = true;
        this.error = null;

        try {
          const data = await apiService.fetchHomeData();

          if (data.success) {
            this.user = data.user;
            this.stats = data.stats;
            this.paniersDetails = data.paniersDetails;
            this.commandesDetails = data.commandesDetails;
            this.nouveauxCatalogues = data.nouveauxCatalogues;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des données');
          }
        } catch (error) {
          this.error = error.message;
          console.error('Erreur dans loadHomeData:', error);
        } finally {
          this.loading = false;
        }
      }
    }
  });

  // Application principale avec rendu innerHTML (pas de template Vue)
  const app = createApp({
    setup() {
      const homeStore = useHomeStore();
      homeStore.loadHomeData();
      return { homeStore };
    },

    mounted() {
      // Watcher pour mettre à jour le DOM quand les données changent
      this.$watch(() => this.homeStore.loading, () => this.updateDOM());
      this.$watch(() => this.homeStore.error, () => this.updateDOM());
      this.$watch(() => this.homeStore.stats, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.homeStore.paniersDetails, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.homeStore.commandesDetails, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.homeStore.nouveauxCatalogues, () => this.updateDOM(), { deep: true });
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

        const store = this.homeStore;

        let html = `
          <div class="admin-content-wrapper">
            <div class="container mt-5">
              <h2 class="mb-4">
                <i class="bi bi-house-door me-2"></i>Tableau de bord
              </h2>`;

        // Message d'erreur
        if (store.error) {
          html += `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Erreur :</strong> ${store.error}
              <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>`;
        }

        // Loader
        if (store.loading) {
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
                    <h3 class="display-4 fw-bold mb-2">${store.stats.paniers}</h3>
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
                    <h3 class="display-4 fw-bold mb-2">${store.stats.commandes}</h3>
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
                    <h3 class="display-4 fw-bold mb-2">${store.stats.catalogues}</h3>
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

          if (store.paniersDetails.length === 0) {
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

            store.paniersDetails.forEach(panier => {
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

          if (store.commandesDetails.length === 0) {
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

            store.commandesDetails.forEach(commande => {
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

          if (store.nouveauxCatalogues.length === 0) {
            html += `
                    <div class="text-center text-muted">
                      <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                      <p>Aucun nouveau catalogue</p>
                    </div>`;
          } else {
            html += `
                    <div class="row g-3">`;

            store.nouveauxCatalogues.forEach(catalogue => {
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

    render() {
      return h('div', { id: 'home-app-content' });
    }
  });

  // Utiliser Pinia
  console.log('📦 Création du store Pinia...');
  const pinia = createPinia();
  app.use(pinia);

  // Monter l'application
  console.log('🎯 Montage de l\'application Vue...');
  try {
    const instance = app.mount('#home-app');
    console.log('✅ Application Vue montée avec succès !');

    // Forcer le premier rendu
    setTimeout(() => {
      instance.updateDOM();
    }, 100);
  } catch (error) {
    console.error('❌ Erreur lors du montage de l\'application:', error);
  }
})();
