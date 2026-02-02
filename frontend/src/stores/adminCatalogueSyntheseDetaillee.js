import { defineStore } from 'pinia';
import { fetchAdminCatalogueSyntheseDetaillee } from '@/api';

export const useAdminCatalogueSyntheseDetailleeStore = defineStore('adminCatalogueSyntheseDetaillee', {
  state: () => ({
    catalogueId: typeof window !== 'undefined' ? (window.CATALOGUE_ID || null) : null,
    catalogueName: '',
    organizationName: '',
    organizationEmail: '',
    details: [],
    loading: true,
    error: null,
    search: '',
  }),

  getters: {
    filteredDetails(state) {
      if (!state.search) return state.details;
      const term = state.search.toLowerCase();
      return state.details.filter(
        (item) =>
          (item.username2 && item.username2.toLowerCase().includes(term)) ||
          (item.produit && item.produit.toLowerCase().includes(term)) ||
          (item.categorie && item.categorie.toLowerCase().includes(term)) ||
          (item.note && item.note.toLowerCase().includes(term)) ||
          (item.note_article && item.note_article.toLowerCase().includes(term))
      );
    },
    statistics(state) {
      const data = state.search
        ? state.details.filter(
            (item) =>
              (item.username2 && item.username2.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.produit && item.produit.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.categorie && item.categorie.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.note && item.note.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.note_article && item.note_article.toLowerCase().includes(state.search.toLowerCase()))
          )
        : state.details;
      const nbLines = data.length;
      const uniqueUsers = new Set(data.map((item) => item.username2)).size;
      const uniqueProducts = new Set(data.map((item) => item.produit)).size;
      const totalQuantity = data.reduce((sum, item) => sum + parseFloat(item.quantite || 0), 0);
      const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.montant_utilisateur || 0), 0);
      const averageAmount = nbLines > 0 ? totalAmount / nbLines : 0;
      return {
        nbLines,
        uniqueUsers,
        uniqueProducts,
        totalQuantity,
        totalAmount,
        averageAmount,
      };
    },
  },

  actions: {
    async loadData() {
      const id = this.catalogueId;
      if (!id) {
        this.error = 'ID catalogue manquant';
        this.loading = false;
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminCatalogueSyntheseDetaillee(id);
        if (data.success) {
          this.catalogueName = data.catalogueName || '';
          this.organizationName = data.organizationName || '';
          this.organizationEmail = data.organizationEmail || '';
          this.details = data.details || [];
        } else {
          throw new Error(data.error || 'Erreur lors du chargement');
        }
      } catch (e) {
        this.error = e.message || 'Erreur lors du chargement';
      } finally {
        this.loading = false;
      }
    },
    formatPrice(price) {
      return parseFloat(price || 0).toFixed(2) + ' €';
    },
    formatQuantity(qty) {
      return parseFloat(qty || 0).toFixed(2);
    },
  },
});
