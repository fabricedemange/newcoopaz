import { defineStore } from 'pinia';
import { fetchHomeData, AuthRequiredError } from '@/api';

export const useHomeStore = defineStore('home', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    user: null,
    stats: { paniers: 0, commandes: 0, catalogues: 0 },
    paniersDetails: [],
    commandesDetails: [],
    nouveauxCatalogues: [],
  }),

  actions: {
    async loadHomeData() {
      this.loading = true;
      this.error = null;
      this.authRequired = false;
      try {
        const data = await fetchHomeData();
        if (data.success) {
          this.user = data.user;
          this.stats = data.stats;
          this.paniersDetails = data.paniersDetails ?? [];
          this.commandesDetails = data.commandesDetails ?? [];
          this.nouveauxCatalogues = data.nouveauxCatalogues ?? [];
        } else {
          throw new Error(data.error || 'Erreur lors du chargement');
        }
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('loadHomeData:', e);
      } finally {
        this.loading = false;
      }
    },
  },

  getters: {
    hasPaniers: (state) => state.paniersDetails.length > 0,
    hasCommandes: (state) => state.commandesDetails.length > 0,
    hasNouveauxCatalogues: (state) => state.nouveauxCatalogues.length > 0,
  },
});
