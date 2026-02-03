// Store Pinia pour la page d'accueil
import { defineStore } from 'pinia';
import apiService from '../services/api.js';

export const useHomeStore = defineStore('home', {
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
