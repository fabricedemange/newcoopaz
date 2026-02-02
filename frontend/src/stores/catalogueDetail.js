import { defineStore } from 'pinia';
import {
  fetchCatalogueDetail,
  updatePanierQuantity as apiUpdateQuantity,
  updatePanierArticleNote as apiUpdateNote,
  updatePanierNote as apiUpdatePanierNote,
  submitPanier as apiSubmitPanier,
  changePanierOwner as apiChangePanierOwner,
  AuthRequiredError,
} from '@/api';

export const useCatalogueDetailStore = defineStore('catalogueDetail', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    catalogue: null,
    products: [],
    panier: null,
    panierArticles: {},
    searchTerm: '',
    selectedCategory: 'all',
    canChangeOwner: false,
    users: [],
    selectedUserId: null,
    changingOwner: false,
  }),

  getters: {
    categories(state) {
      const categories = new Map();
      (state.products || []).forEach((product) => {
        if (product.categorie) {
          categories.set(product.categorie, {
            nom: product.categorie,
            couleur: product.categorie_couleur,
            ordre: product.categorie_ordre,
          });
        }
      });
      return Array.from(categories.values()).sort((a, b) => a.ordre - b.ordre);
    },

    filteredProducts(state) {
      let filtered = [...(state.products || [])];
      if (state.selectedCategory !== 'all') {
        filtered = filtered.filter((p) => p.categorie === state.selectedCategory);
      }
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            (p.produit && p.produit.toLowerCase().includes(term)) ||
            (p.description && p.description.toLowerCase().includes(term))
        );
      }
      return filtered;
    },

    getProductQuantity: (state) => (catalogProductId) => {
      return state.panierArticles[catalogProductId]?.quantity ?? 0;
    },

    getProductNote: (state) => (catalogProductId) => {
      return state.panierArticles[catalogProductId]?.note ?? '';
    },

    totalArticles(state) {
      return Object.values(state.panierArticles || {}).reduce(
        (sum, article) => sum + (article.quantity || 0),
        0
      );
    },

    totalPrice(state) {
      let total = 0;
      (state.products || []).forEach((product) => {
        const qty = state.panierArticles?.[product.id]?.quantity ?? 0;
        if (qty > 0) {
          total += qty * (product.prix || 0) * (product.unite || 1);
        }
      });
      return total;
    },

    productsByCategory(state) {
      let filtered = [...(state.products || [])];
      if (state.selectedCategory !== 'all') {
        filtered = filtered.filter((p) => p.categorie === state.selectedCategory);
      }
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            (p.produit && p.produit.toLowerCase().includes(term)) ||
            (p.description && p.description.toLowerCase().includes(term))
        );
      }
      const grouped = {};
      filtered.forEach((product) => {
        const cat = product.categorie || 'Sans catégorie';
        if (!grouped[cat]) {
          grouped[cat] = {
            name: cat,
            color: product.categorie_couleur || '#6c757d',
            ordre: product.categorie_ordre ?? 999,
            products: [],
          };
        }
        grouped[cat].products.push(product);
      });
      return Object.values(grouped).sort((a, b) => a.ordre - b.ordre);
    },
  },

  actions: {
    async loadDetail(catalogueId, nouveauPanier = false) {
      this.loading = true;
      this.error = null;
      this.authRequired = false;
      this.catalogue = null;
      this.products = [];
      this.panier = null;
      this.panierArticles = {};
      try {
        const data = await fetchCatalogueDetail(catalogueId, nouveauPanier);
        if (data.success) {
          this.catalogue = data.catalogue;
          this.products = data.products || [];
          this.panier = data.panier || null;
          this.panierArticles = data.panierArticles || {};
          this.canChangeOwner = data.canChangeOwner === true;
          this.users = data.users || [];
          this.selectedUserId = null;
        } else {
          throw new Error(data.error || 'Erreur chargement catalogue');
        }
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('catalogueDetail loadDetail:', e);
      } finally {
        this.loading = false;
      }
    },

    async updateQuantity(catalogProductId, newQuantity, catalogueId, nouveauPanier, csrfToken) {
      const quantity = parseInt(newQuantity) || 0;
      const forceNewPanier = !this.panier && nouveauPanier === true;
      try {
        const data = await apiUpdateQuantity(
          catalogueId,
          catalogProductId,
          quantity,
          forceNewPanier,
          csrfToken
        );
        if (data.success) {
          if (quantity === 0) {
            const { [catalogProductId]: _, ...rest } = this.panierArticles;
            this.panierArticles = rest;
          } else {
            if (!this.panierArticles[catalogProductId]) {
              this.panierArticles = { ...this.panierArticles, [catalogProductId]: {} };
            }
            this.panierArticles[catalogProductId] = {
              ...this.panierArticles[catalogProductId],
              quantity,
            };
          }
          if (data.panier_id && !this.panier) {
            this.panier = { id: data.panier_id };
          }
        } else {
          throw new Error(data.error || 'Erreur mise à jour');
        }
      } catch (e) {
        console.error('updateQuantity:', e);
        throw e;
      }
    },

    async updateNote(catalogProductId, newNote, catalogueId, csrfToken) {
      try {
        const data = await apiUpdateNote(catalogueId, catalogProductId, newNote ?? '', csrfToken);
        if (data.success) {
          if (!this.panierArticles[catalogProductId]) {
            this.panierArticles = { ...this.panierArticles, [catalogProductId]: {} };
          }
          this.panierArticles[catalogProductId] = {
            ...this.panierArticles[catalogProductId],
            note: newNote ?? '',
          };
        } else {
          throw new Error(data.error || 'Erreur mise à jour note');
        }
      } catch (e) {
        console.error('updateNote:', e);
        throw e;
      }
    },

    async updatePanierNote(newNote, csrfToken) {
      if (!this.panier?.id) return;
      try {
        const data = await apiUpdatePanierNote(this.panier.id, newNote ?? '', csrfToken);
        if (data.success) {
          this.panier = { ...this.panier, note: newNote ?? '' };
        } else {
          throw new Error(data.error || 'Erreur mise à jour note panier');
        }
      } catch (e) {
        console.error('updatePanierNote:', e);
        throw e;
      }
    },

    async validerPanier(csrfToken) {
      if (!this.panier?.id) {
        throw new Error('Aucun panier à valider');
      }
      if (this.totalArticles === 0) {
        throw new Error('Votre panier est vide');
      }
      const data = await apiSubmitPanier(this.panier.id, csrfToken);
      if (!data.success) {
        throw new Error(data.error || 'Erreur validation');
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/commandes/vue';
      }
    },

    async changeOwner(userId, csrfToken) {
      if (!this.panier?.id) {
        throw new Error('Aucun panier');
      }
      this.changingOwner = true;
      try {
        const data = await apiChangePanierOwner(this.panier.id, userId, csrfToken);
        if (!data.success) {
          throw new Error(data.error || 'Erreur changement propriétaire');
        }
        this.panier = { ...this.panier, user_id: userId, username: (this.users.find((u) => u.id === userId) || {}).username };
      } finally {
        this.changingOwner = false;
      }
    },
  },
});
