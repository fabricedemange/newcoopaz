import { defineStore } from 'pinia';
import { fetchAdminSuppliers, postAdminSuppliersMerge } from '@/api';

export const useAdminSuppliersStore = defineStore('adminSuppliers', {
  state: () => ({
    suppliers: [],
    loading: true,
    error: null,
    sortColumn: 'nom',
    sortDirection: 'asc',
    searchTerm: '',
    showMergeModal: false,
    mergeSourceId: null,
    mergeTargetId: null,
    merging: false,
  }),

  getters: {
    sortedSuppliers(state) {
      let filtered = state.searchTerm
        ? state.suppliers.filter(
            (s) =>
              (s.nom && s.nom.toLowerCase().includes(state.searchTerm.toLowerCase())) ||
              (s.email && s.email.toLowerCase().includes(state.searchTerm.toLowerCase())) ||
              (s.ville && s.ville.toLowerCase().includes(state.searchTerm.toLowerCase()))
          )
        : [...state.suppliers];
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
    suppliersAlpha(state) {
      return [...state.suppliers].sort((a, b) => {
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
        const data = await fetchAdminSuppliers();
        if (data.success) this.suppliers = data.suppliers || [];
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
    async mergeSuppliers() {
      if (!this.mergeSourceId || !this.mergeTargetId) {
        alert('Veuillez sélectionner les deux fournisseurs');
        return;
      }
      if (this.mergeSourceId === this.mergeTargetId) {
        alert('Impossible de fusionner un fournisseur avec lui-même');
        return;
      }
      const sourceSupplier = this.suppliers.find((s) => s.id === parseInt(this.mergeSourceId, 10));
      const targetSupplier = this.suppliers.find((s) => s.id === parseInt(this.mergeTargetId, 10));
      if (
        !confirm(
          `Êtes-vous sûr de vouloir fusionner "${sourceSupplier?.nom}" dans "${targetSupplier?.nom}" ?\n\nTous les produits seront transférés, puis "${sourceSupplier?.nom}" sera supprimé.`
        )
      ) {
        return;
      }
      this.merging = true;
      try {
        const data = await postAdminSuppliersMerge({
          sourceId: this.mergeSourceId,
          targetId: this.mergeTargetId,
        });
        if (data.success) {
          alert(`Fusion réussie !\n${data.productsUpdated} produit(s) transféré(s).`);
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
