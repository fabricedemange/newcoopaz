import { defineStore } from 'pinia';
import { fetchAdminCategories, postAdminCategoriesMerge } from '@/api';

export const useAdminCategoriesStore = defineStore('adminCategories', {
  state: () => ({
    categories: [],
    loading: true,
    error: null,
    sortColumn: 'ordre',
    sortDirection: 'asc',
    searchTerm: '',
    showMergeModal: false,
    mergeSourceId: null,
    mergeTargetId: null,
    merging: false,
  }),

  getters: {
    sortedCategories(state) {
      let filtered = state.searchTerm
        ? state.categories.filter(
            (c) =>
              (c.nom && c.nom.toLowerCase().includes(state.searchTerm.toLowerCase())) ||
              (c.description && c.description.toLowerCase().includes(state.searchTerm.toLowerCase()))
          )
        : [...state.categories];
      filtered = [...filtered];
      filtered.sort((a, b) => {
        let aVal = a[state.sortColumn] ?? '';
        let bVal = b[state.sortColumn] ?? '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return state.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    },
    categoriesAlpha(state) {
      return [...state.categories].sort((a, b) => {
        const aName = (a.nom || '').toLowerCase();
        const bName = (b.nom || '').toLowerCase();
        return aName.localeCompare(bName);
      });
    },
  },

  actions: {
    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminCategories();
        if (data.success) this.categories = data.categories || [];
        else throw new Error(data.error || 'Erreur inconnue');
      } catch (e) {
        this.error = e.message || 'Erreur lors du chargement des données';
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
    openMergeModal() {
      this.showMergeModal = true;
      this.mergeSourceId = null;
      this.mergeTargetId = null;
    },
    closeMergeModal() {
      this.showMergeModal = false;
      this.mergeSourceId = null;
      this.mergeTargetId = null;
    },
    async mergeCategories() {
      if (!this.mergeSourceId || !this.mergeTargetId) {
        alert('Veuillez sélectionner les deux catégories');
        return;
      }
      if (this.mergeSourceId === this.mergeTargetId) {
        alert('Impossible de fusionner une catégorie avec elle-même');
        return;
      }
      const sourceCategory = this.categories.find((c) => c.id === parseInt(this.mergeSourceId, 10));
      const targetCategory = this.categories.find((c) => c.id === parseInt(this.mergeTargetId, 10));
      if (
        !confirm(
          `Êtes-vous sûr de vouloir fusionner "${sourceCategory?.nom}" dans "${targetCategory?.nom}" ?\n\nTous les produits et sous-catégories seront transférés, puis "${sourceCategory?.nom}" sera supprimée.`
        )
      ) {
        return;
      }
      this.merging = true;
      try {
        const data = await postAdminCategoriesMerge({
          sourceId: this.mergeSourceId,
          targetId: this.mergeTargetId,
        });
        if (data.success) {
          alert(
            `Fusion réussie !\n${data.productsUpdated} produit(s) et ${data.subcategoriesUpdated} sous-catégorie(s) transférés.`
          );
          this.closeMergeModal();
          await this.loadData();
        } else throw new Error(data.error);
      } catch (e) {
        alert(e.message || 'Erreur lors de la fusion');
      } finally {
        this.merging = false;
      }
    },
  },
});
