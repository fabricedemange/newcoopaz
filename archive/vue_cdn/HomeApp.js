// Application Vue pour la page d'accueil
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { createPinia } from 'https://unpkg.com/pinia@2/dist/pinia.esm-browser.js';
import { useHomeStore } from './stores/home.js';
import StatCard from './components/StatCard.js';
import PanierTable from './components/PanierTable.js';
import CommandeTable from './components/CommandeTable.js';
import NouveauxCatalogues from './components/NouveauxCatalogues.js';

const app = createApp({
  components: {
    StatCard,
    PanierTable,
    CommandeTable,
    NouveauxCatalogues
  },
  setup() {
    const homeStore = useHomeStore();

    // Charger les données au montage du composant
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
          <div class="spinner-border text-primary" role="status">
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

// Utiliser Pinia pour la gestion d'état
const pinia = createPinia();
app.use(pinia);

// Monter l'application
app.mount('#home-app');
