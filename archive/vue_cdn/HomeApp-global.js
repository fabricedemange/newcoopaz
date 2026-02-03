// Application Vue pour la page d'accueil (version globale)
(function() {
  console.log('🚀 Chargement de HomeApp-global.js...');
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

  const { createApp } = Vue;
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
    },

    getters: {
      hasPaniers: (state) => state.paniersDetails.length > 0,
      hasCommandes: (state) => state.commandesDetails.length > 0,
      hasNouveauxCatalogues: (state) => state.nouveauxCatalogues.length > 0
    }
  });

  // Composant StatCard
  const StatCard = {
    name: 'StatCard',
    props: {
      title: String,
      value: Number,
      icon: { type: String, default: 'bi-graph-up' },
      color: { type: String, default: 'primary' }
    },
    template: `
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body text-center p-4">
          <div class="mb-3">
            <i :class="['bi', icon, 'fs-1', 'text-' + color]"></i>
          </div>
          <h3 class="display-4 fw-bold mb-2">{{ value }}</h3>
          <p class="text-muted mb-0">{{ title }}</p>
        </div>
      </div>
    `
  };

  // Composant PanierTable
  const PanierTable = {
    name: 'PanierTable',
    props: {
      paniers: Array
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
      }
    },
    template: `
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-white border-bottom">
          <h5 class="mb-0">
            <i class="bi bi-cart3 me-2"></i>Mes paniers en cours
          </h5>
        </div>
        <div class="card-body p-0">
          <div v-if="paniers.length === 0" class="p-4 text-center text-muted">
            <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>Aucun panier en cours</p>
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Catalogue</th>
                  <th>Articles</th>
                  <th>Date d'expiration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="panier in paniers" :key="panier.id">
                  <td>{{ panier.catalogue_nom }}</td>
                  <td>
                    <span class="badge bg-secondary">{{ panier.nb_articles }}</span>
                  </td>
                  <td>
                    {{ panier.expiration }}
                    <span
                      v-if="calculateDiffDays(panier.expiration_commande) <= 3"
                      :class="['badge', 'ms-2', getBadgeClass(calculateDiffDays(panier.expiration_commande))]"
                    >
                      {{ getBadgeText(calculateDiffDays(panier.expiration_commande)) }}
                    </span>
                  </td>
                  <td>
                    <a :href="'/panier/' + panier.id + '/modifier'" class="btn btn-sm btn-outline-primary">
                      <i class="bi bi-pencil me-1"></i>Modifier
                    </a>
                    <a :href="'/panier/' + panier.id + '/catalogue/' + panier.catalogue_id" class="btn btn-sm btn-outline-secondary ms-1">
                      <i class="bi bi-eye me-1"></i>Voir
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `
  };

  // Composant CommandeTable
  const CommandeTable = {
    name: 'CommandeTable',
    props: {
      commandes: Array
    },
    template: `
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-white border-bottom">
          <h5 class="mb-0">
            <i class="bi bi-truck me-2"></i>Mes commandes en attente de livraison
          </h5>
        </div>
        <div class="card-body p-0">
          <div v-if="commandes.length === 0" class="p-4 text-center text-muted">
            <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>Aucune commande en attente</p>
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Catalogue</th>
                  <th>Articles</th>
                  <th>Date de livraison</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="commande in commandes" :key="commande.id">
                  <td>{{ commande.catalogue_nom }}</td>
                  <td>
                    <span class="badge bg-secondary">{{ commande.nb_articles }}</span>
                  </td>
                  <td>{{ commande.livraison }}</td>
                  <td>
                    <span class="badge bg-success">
                      <i class="bi bi-check-circle me-1"></i>{{ commande.statut }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `
  };

  // Composant NouveauxCatalogues
  const NouveauxCatalogues = {
    name: 'NouveauxCatalogues',
    props: {
      catalogues: Array
    },
    template: `
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-white border-bottom">
          <h5 class="mb-0">
            <i class="bi bi-star me-2"></i>Nouveaux catalogues disponibles
          </h5>
        </div>
        <div class="card-body">
          <div v-if="catalogues.length === 0" class="text-center text-muted">
            <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>Aucun nouveau catalogue</p>
          </div>
          <div v-else class="row g-3">
            <div v-for="catalogue in catalogues" :key="catalogue.id" class="col-md-4">
              <div class="card h-100 border">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">{{ catalogue.originalname }}</h6>
                    <span class="badge bg-primary">Nouveau</span>
                  </div>
                  <p v-if="catalogue.description" class="card-text small text-muted mb-3">
                    {{ catalogue.description }}
                  </p>
                  <div class="small mb-2">
                    <i class="bi bi-calendar-event text-primary me-1"></i>
                    <strong>Commandes avant le :</strong> {{ catalogue.expiration }}
                  </div>
                  <div class="small mb-3">
                    <i class="bi bi-truck text-success me-1"></i>
                    <strong>Livraison le :</strong> {{ catalogue.livraison }}
                  </div>
                  <a :href="'/catalogues/' + catalogue.id" class="btn btn-sm btn-primary w-100">
                    <i class="bi bi-cart-plus me-1"></i>Commander
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  };

  // Application principale
  const app = createApp({
    components: {
      StatCard,
      PanierTable,
      CommandeTable,
      NouveauxCatalogues
    },
    setup() {
      const homeStore = useHomeStore();

      // Charger les données au montage
      homeStore.loadHomeData();

      return {
        homeStore
      };
    },
    template: `
      <div class="admin-content-wrapper">
        <div class="container mt-5">
          <h2 class="mb-4">
            <i class="bi bi-house-door me-2"></i>Tableau de bord
          </h2>

          <!-- Message d'erreur -->
          <div v-if="homeStore.error" class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Erreur :</strong> {{ homeStore.error }}
            <button type="button" class="btn-close" @click="homeStore.error = null"></button>
          </div>

          <!-- Loader -->
          <div v-if="homeStore.loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3 text-muted">Chargement des données...</p>
          </div>

          <!-- Contenu principal -->
          <div v-else>
            <!-- Cartes de statistiques -->
            <div class="row mb-5">
              <div class="col-md-4 mb-3">
                <stat-card
                  title="Paniers en cours"
                  :value="homeStore.stats.paniers"
                  icon="bi-cart3"
                  color="primary"
                />
              </div>
              <div class="col-md-4 mb-3">
                <stat-card
                  title="Commandes en attente"
                  :value="homeStore.stats.commandes"
                  icon="bi-truck"
                  color="success"
                />
              </div>
              <div class="col-md-4 mb-3">
                <stat-card
                  title="Catalogues disponibles"
                  :value="homeStore.stats.catalogues"
                  icon="bi-book"
                  color="info"
                />
              </div>
            </div>

            <!-- Tables et détails -->
            <div class="row mb-4">
              <div class="col-12 mb-4">
                <panier-table :paniers="homeStore.paniersDetails" />
              </div>
              <div class="col-12 mb-4">
                <commande-table :commandes="homeStore.commandesDetails" />
              </div>
              <div class="col-12 mb-4">
                <nouveaux-catalogues :catalogues="homeStore.nouveauxCatalogues" />
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  });

  // Utiliser Pinia
  console.log('📦 Création du store Pinia...');
  const pinia = createPinia();
  app.use(pinia);

  // Monter l'application
  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#home-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage de l\'application:', error);
  }
})();
