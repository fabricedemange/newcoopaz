import { defineStore } from 'pinia';
import { fetchDashboardData, AuthRequiredError } from '@/api';

export const useAdminDashboardStore = defineStore('adminDashboard', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    catalogues: [],
    commandes: [],
    totalCommandes: 0,
    paniers: [],
    referentScopeActive: false,
    showAllScope: false,
  }),

  actions: {
    async loadDashboard(scope = 'all') {
      this.loading = true;
      this.error = null;
      this.authRequired = false;
      try {
        const data = await fetchDashboardData(scope);
        if (data.success) {
          this.catalogues = data.catalogues ?? [];
          this.commandes = data.commandes ?? [];
          this.totalCommandes = data.totalCommandes ?? 0;
          this.paniers = data.paniers ?? [];
          this.referentScopeActive = data.referentScopeActive ?? false;
          this.showAllScope = data.showAllScope ?? false;
        } else {
          throw new Error(data.error || 'Erreur lors du chargement du dashboard');
        }
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('loadDashboard:', e);
      } finally {
        this.loading = false;
      }
    },

    toggleScope() {
      const newScope = this.showAllScope ? 'referent' : 'all';
      window.location.href = `?scope=${newScope}#catalogues`;
    },
  },
});
