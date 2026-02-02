import { defineStore } from 'pinia';
import { fetchPaniers, deletePanier as apiDeletePanier, AuthRequiredError } from '@/api';

export const usePaniersStore = defineStore('paniers', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    paniers: [],
    searchTerm: '',
    sortColumn: 'created_at',
    sortDirection: 'desc',
  }),

  getters: {
    sortedPaniers(state) {
      let list = [...(state.paniers || [])];
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        list = list.filter(
          (p) =>
            (p.catalogue_nom && p.catalogue_nom.toLowerCase().includes(term)) ||
            (p.catalog_description && p.catalog_description.toLowerCase().includes(term)) ||
            (p.panier_note && p.panier_note.toLowerCase().includes(term)) ||
            (p.articles_notes && p.articles_notes.toLowerCase().includes(term)) ||
            String(p.id).includes(term)
        );
      }
      const col = state.sortColumn;
      const dir = state.sortDirection;
      return list.sort((a, b) => {
        let valA, valB;
        switch (col) {
          case 'id':
            valA = a.id;
            valB = b.id;
            break;
          case 'catalogue':
            valA = (a.catalogue_nom || '').toLowerCase();
            valB = (b.catalogue_nom || '').toLowerCase();
            break;
          case 'nb_articles':
            valA = a.nb_articles || 0;
            valB = b.nb_articles || 0;
            break;
          case 'total':
            valA = parseFloat(a.total) || 0;
            valB = parseFloat(b.total) || 0;
            break;
          case 'expiration_date':
            valA = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
            valB = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
            break;
          case 'created_at':
            valA = a.created_at ? new Date(a.created_at).getTime() : 0;
            valB = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
          default:
            return 0;
        }
        if (typeof valA === 'string') {
          const cmp = valA.localeCompare(valB);
          return dir === 'asc' ? cmp : -cmp;
        }
        return dir === 'asc' ? (valA > valB ? 1 : valA < valB ? -1 : 0) : valA < valB ? 1 : valA > valB ? -1 : 0;
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
        const data = await fetchPaniers();
        if (data.success) this.paniers = data.paniers || [];
        else throw new Error(data.error || 'Erreur chargement');
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('paniers loadAll:', e);
      } finally {
        this.loading = false;
      }
    },

    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    },

    async deletePanier(panierId, csrfToken) {
      await apiDeletePanier(panierId, csrfToken);
      this.paniers = (this.paniers || []).filter((p) => p.id !== panierId);
    },
  },
});
