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
    commandesSortColumn: 'created_at',
    commandesSortDirection: 'desc',
  }),

  getters: {
    sortedCommandes(state) {
      const list = [...(state.commandes || [])];
      const col = state.commandesSortColumn || 'created_at';
      const dir = state.commandesSortDirection || 'desc';
      list.sort((a, b) => {
        let aVal = a[col];
        let bVal = b[col];
        if (col === 'created_at' || col === 'date_livraison') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
          return dir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        if (col === 'nb_produits' || col === 'montant_total' || col === 'id') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
          return dir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        aVal = (aVal ?? '').toString().toLowerCase();
        bVal = (bVal ?? '').toString().toLowerCase();
        const cmp = aVal.localeCompare(bVal, 'fr');
        return dir === 'asc' ? cmp : -cmp;
      });
      return list;
    },
  },

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

    setCommandesSort(column) {
      if (this.commandesSortColumn === column) {
        this.commandesSortDirection = this.commandesSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.commandesSortColumn = column;
        this.commandesSortDirection = column === 'created_at' || column === 'id' ? 'desc' : 'asc';
      }
    },
  },
});
