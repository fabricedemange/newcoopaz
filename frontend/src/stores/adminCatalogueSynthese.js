import { defineStore } from 'pinia';
import { fetchAdminCatalogueSynthese } from '@/api';

export const useAdminCatalogueSyntheseStore = defineStore('adminCatalogueSynthese', {
  state: () => ({
    catalogueId: typeof window !== 'undefined' ? (window.CATALOGUE_ID || null) : null,
    catalogueName: '',
    organizationName: '',
    organizationEmail: '',
    synthese: [],
    loading: true,
    error: null,
    search: '',
  }),

  getters: {
    filteredSynthese(state) {
      if (!state.search) return state.synthese;
      const term = state.search.toLowerCase();
      return state.synthese.filter(
        (item) =>
          (item.produit && item.produit.toLowerCase().includes(term)) ||
          (item.categorie && item.categorie.toLowerCase().includes(term)) ||
          (item.note && item.note.toLowerCase().includes(term)) ||
          (item.note_article && item.note_article.toLowerCase().includes(term))
      );
    },
    statistics(state) {
      const data = state.search
        ? state.synthese.filter(
            (item) =>
              (item.produit && item.produit.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.categorie && item.categorie.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.note && item.note.toLowerCase().includes(state.search.toLowerCase())) ||
              (item.note_article && item.note_article.toLowerCase().includes(state.search.toLowerCase()))
          )
        : state.synthese;
      const nbProducts = data.length;
      const totalQuantity = data.reduce((sum, item) => sum + parseFloat(item.total_commande || 0), 0);
      const totalAmount = data.reduce(
        (sum, item) => sum + parseFloat(item.prix || 0) * parseFloat(item.total_commande || 0),
        0
      );
      const averageAmount = nbProducts > 0 ? totalAmount / nbProducts : 0;
      return { nbProducts, totalQuantity, totalAmount, averageAmount };
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
        const data = await fetchAdminCatalogueSynthese(id);
        if (data.success) {
          this.catalogueName = data.catalogueName || '';
          this.organizationName = data.organizationName || '';
          this.organizationEmail = data.organizationEmail || '';
          this.synthese = data.synthese || [];
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
