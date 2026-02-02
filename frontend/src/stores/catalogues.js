import { defineStore } from 'pinia';
import { fetchCatalogues, AuthRequiredError } from '@/api';

export const useCataloguesStore = defineStore('catalogues', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    catalogues: [],
    searchTerm: '',
    sortColumn: 'expiration_date',
    sortDirection: 'asc',
  }),

  getters: {
    sortedCatalogues(state) {
      let list = [...(state.catalogues || [])];
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        list = list.filter(
          (c) =>
            (c.originalname && c.originalname.toLowerCase().includes(term)) ||
            (c.username && c.username.toLowerCase().includes(term)) ||
            (c.description && c.description.toLowerCase().includes(term))
        );
      }
      const col = state.sortColumn;
      const dir = state.sortDirection;
      return list.sort((a, b) => {
        let aVal = a[col];
        let bVal = b[col];
        if (col === 'id') {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        } else if (col && col.includes('date')) {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        if (aVal === bVal) return 0;
        const cmp = aVal > bVal ? 1 : -1;
        return dir === 'asc' ? cmp : -cmp;
      });
    },

    sortIcon(state) {
      return (column) => {
        if (state.sortColumn !== column) return 'arrow-down-up';
        return state.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down';
      };
    },
  },

  actions: {
    async loadAll() {
      this.loading = true;
      this.error = null;
      this.authRequired = false;
      try {
        const data = await fetchCatalogues();
        if (data.success) this.catalogues = data.catalogues || [];
        else throw new Error(data.error || 'Erreur chargement');
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('catalogues loadAll:', e);
      } finally {
        this.loading = false;
      }
    },

    setSearchTerm(term) {
      this.searchTerm = term;
    },

    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    },
  },
});
