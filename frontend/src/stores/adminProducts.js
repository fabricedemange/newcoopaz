import { defineStore } from 'pinia';
import { fetchAdminProducts, postAdminProductsBulkUpdate } from '@/api';

export const useAdminProductsStore = defineStore('adminProducts', {
  state: () => ({
    products: [],
    categories: [],
    suppliers: [],
    filters: {
      categoryId: '',
      supplierId: '',
      label: '',
      search: '',
      isActive: '',
    },
    loading: true,
    error: null,
    sortColumn: 'nom',
    sortDirection: 'asc',
    selectedProducts: [],
    showBulkActions: false,
    bulkCategoryId: '',
    bulkSupplierId: '',
    bulkUnite: '',
    bulkQuantiteMin: '',
    processingBulk: false,
  }),

  getters: {
    filteredProducts(state) {
      let filtered = [...state.products];
      if (state.filters.categoryId != null && state.filters.categoryId !== '') {
        const cid = String(state.filters.categoryId);
        filtered = filtered.filter((p) => p != null && String(p.category_id ?? '') === cid);
      }
      if (state.filters.supplierId != null && state.filters.supplierId !== '') {
        const sid = String(state.filters.supplierId);
        filtered = filtered.filter((p) => p != null && String(p.supplier_id ?? '') === sid);
      }
      if (state.filters.label) {
        const labelLower = state.filters.label.toLowerCase();
        filtered = filtered.filter(
          (p) => p.label && p.label.toLowerCase().includes(labelLower)
        );
      }
      if (state.filters.search) {
        const searchLower = state.filters.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            (p.nom && p.nom.toLowerCase().includes(searchLower)) ||
            (p.description && p.description.toLowerCase().includes(searchLower))
        );
      }
      if (state.filters.isActive !== '') {
        const isActive = state.filters.isActive === '1';
        filtered = filtered.filter((p) => p.is_active === (isActive ? 1 : 0));
      }
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
  },

  actions: {
    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminProducts();
        if (data.success) {
          this.products = data.products || [];
          this.categories = data.categories || [];
          this.suppliers = data.suppliers || [];
        } else {
          throw new Error(data.error || 'Erreur inconnue');
        }
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
    resetFilters() {
      this.filters = {
        categoryId: '',
        supplierId: '',
        label: '',
        search: '',
        isActive: '',
      };
    },
    toggleProductSelection(productId) {
      const index = this.selectedProducts.indexOf(productId);
      if (index > -1) {
        this.selectedProducts = this.selectedProducts.filter((id) => id !== productId);
      } else {
        this.selectedProducts = [...this.selectedProducts, productId];
      }
    },
    toggleSelectAll() {
      if (this.selectedProducts.length === this.filteredProducts.length) {
        this.selectedProducts = [];
      } else {
        this.selectedProducts = this.filteredProducts.map((p) => p.id);
      }
    },
    isSelected(productId) {
      return this.selectedProducts.includes(productId);
    },
    async bulkUpdate() {
      if (
        !this.bulkCategoryId &&
        !this.bulkSupplierId &&
        !this.bulkUnite &&
        !this.bulkQuantiteMin
      ) {
        alert('Veuillez sélectionner au moins un champ à modifier');
        return;
      }
      if (this.selectedProducts.length === 0) {
        alert('Veuillez sélectionner au moins un produit');
        return;
      }
      let confirmMsg = `Modifier ${this.selectedProducts.length} produit(s) ?\n`;
      if (this.bulkCategoryId) confirmMsg += '- Nouvelle catégorie\n';
      if (this.bulkSupplierId) confirmMsg += '- Nouveau fournisseur\n';
      if (this.bulkUnite) confirmMsg += `- Unité: ${this.bulkUnite}\n`;
      if (this.bulkQuantiteMin) confirmMsg += `- Quantité minimale: ${this.bulkQuantiteMin}\n`;
      if (!confirm(confirmMsg)) return;
      this.processingBulk = true;
      try {
        const data = await postAdminProductsBulkUpdate({
          productIds: this.selectedProducts,
          categoryId: this.bulkCategoryId || null,
          supplierId: this.bulkSupplierId || null,
          unite: this.bulkUnite || null,
          quantiteMin: this.bulkQuantiteMin || null,
        });
        if (data.success) {
          alert(`${data.updated} produit(s) mis à jour avec succès`);
          this.selectedProducts = [];
          this.bulkCategoryId = '';
          this.bulkSupplierId = '';
          this.bulkUnite = '';
          this.bulkQuantiteMin = '';
          this.showBulkActions = false;
          await this.loadData();
        } else {
          throw new Error(data.error);
        }
      } catch (e) {
        alert(e.message || 'Erreur lors de la mise à jour');
      } finally {
        this.processingBulk = false;
      }
    },
    cancelBulkActions() {
      this.selectedProducts = [];
      this.bulkCategoryId = '';
      this.bulkSupplierId = '';
      this.bulkUnite = '';
      this.bulkQuantiteMin = '';
      this.showBulkActions = false;
    },
  },
});
