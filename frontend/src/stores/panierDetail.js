import { defineStore } from 'pinia';
import {
  fetchPanierDetail,
  fetchUsersForPanier,
  updatePanierQuantity as apiUpdateQuantity,
  updatePanierArticleNote as apiUpdateNote,
  updatePanierNote as apiUpdatePanierNote,
  submitPanier as apiSubmitPanier,
  changePanierOwner as apiChangeOwner,
  deletePanierById,
  AuthRequiredError,
} from '@/api';

export const usePanierDetailStore = defineStore('panierDetail', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    panier: null,
    articles: [],
    panierArticlesMap: {},
    searchTerm: '',
    selectedCategory: 'all',
    users: [],
    selectedUserId: null,
    changingOwner: false,
    savingPanierNote: false,
    panierNoteSaved: false,
    panierNoteError: false,
  }),

  getters: {
    categories(state) {
      const categories = new Map();
      (state.articles || []).forEach((article) => {
        if (article.categorie) {
          categories.set(article.categorie, {
            nom: article.categorie,
            couleur: article.categorie_couleur,
            ordre: article.categorie_ordre,
          });
        }
      });
      return Array.from(categories.values()).sort((a, b) => a.ordre - b.ordre);
    },

    filteredArticles(state) {
      let filtered = [...(state.articles || [])];
      if (state.selectedCategory !== 'all') {
        filtered = filtered.filter((a) => a.categorie === state.selectedCategory);
      }
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            (a.produit && a.produit.toLowerCase().includes(term)) ||
            (a.description && a.description.toLowerCase().includes(term))
        );
      }
      return filtered;
    },

    totalArticles(state) {
      return (state.articles || []).reduce((sum, a) => sum + (a.quantity || 0), 0);
    },

    totalPrice(state) {
      return (state.articles || []).reduce(
        (sum, a) => sum + (a.quantity || 0) * (a.prix || 0) * (a.unite || 1),
        0
      );
    },

    articlesByCategory(state) {
      let filtered = [...(state.articles || [])];
      if (state.selectedCategory !== 'all') {
        filtered = filtered.filter((a) => a.categorie === state.selectedCategory);
      }
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            (a.produit && a.produit.toLowerCase().includes(term)) ||
            (a.description && a.description.toLowerCase().includes(term))
        );
      }
      const grouped = {};
      filtered.forEach((article) => {
        const cat = article.categorie || 'Sans catégorie';
        if (!grouped[cat]) {
          grouped[cat] = {
            name: cat,
            color: article.categorie_couleur || '#6c757d',
            ordre: article.categorie_ordre ?? 999,
            articles: [],
          };
        }
        grouped[cat].articles.push(article);
      });
      return Object.values(grouped).sort((a, b) => a.ordre - b.ordre);
    },
  },

  actions: {
    async loadDetail(panierId) {
      this.loading = true;
      this.error = null;
      this.authRequired = false;
      this.panier = null;
      this.articles = [];
      this.panierArticlesMap = {};
      try {
        const data = await fetchPanierDetail(panierId);
        if (data.success) {
          this.panier = data.panier;
          this.articles = data.articles || [];
          this.panierArticlesMap = data.panierArticlesMap || {};
          if (this.panier?.canChangeOwner) {
            this.loadUsers();
          }
        } else {
          throw new Error(data.error || 'Erreur chargement panier');
        }
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('panierDetail loadDetail:', e);
      } finally {
        this.loading = false;
      }
    },

    async loadUsers() {
      try {
        const data = await fetchUsersForPanier();
        if (data.success) {
          this.users = data.users || [];
        }
      } catch (e) {
        console.error('panierDetail loadUsers:', e);
      }
    },

    async updateQuantity(catalogProductId, newQuantity, csrfToken) {
      const quantity = parseInt(newQuantity) || 0;
      const catalogFileId = this.panier?.catalog_file_id;
      if (!catalogFileId) return;
      try {
        const data = await apiUpdateQuantity(catalogFileId, catalogProductId, quantity, false, csrfToken);
        if (data.success) {
          if (!this.panierArticlesMap[catalogProductId]) {
            this.panierArticlesMap = { ...this.panierArticlesMap, [catalogProductId]: {} };
          }
          this.panierArticlesMap[catalogProductId] = {
            ...this.panierArticlesMap[catalogProductId],
            quantity,
          };
          const article = this.articles.find((a) => a.catalog_product_id === catalogProductId);
          if (article) article.quantity = quantity;
        } else {
          throw new Error(data.error || 'Erreur mise à jour');
        }
      } catch (e) {
        console.error('updateQuantity:', e);
        throw e;
      }
    },

    async updateNote(catalogProductId, newNote, csrfToken) {
      const catalogFileId = this.panier?.catalog_file_id;
      if (!catalogFileId) return;
      try {
        const data = await apiUpdateNote(catalogFileId, catalogProductId, newNote ?? '', csrfToken);
        if (data.success) {
          if (!this.panierArticlesMap[catalogProductId]) {
            this.panierArticlesMap = { ...this.panierArticlesMap, [catalogProductId]: {} };
          }
          this.panierArticlesMap[catalogProductId] = {
            ...this.panierArticlesMap[catalogProductId],
            note: newNote ?? '',
          };
          const article = this.articles.find((a) => a.catalog_product_id === catalogProductId);
          if (article) article.note = newNote ?? '';
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
        this.savingPanierNote = true;
        const data = await apiUpdatePanierNote(this.panier.id, newNote ?? '', csrfToken);
        if (data.success) {
          this.panier = { ...this.panier, note: newNote ?? '' };
          this.panierNoteSaved = true;
          this.panierNoteError = false;
          setTimeout(() => {
            this.panierNoteSaved = false;
          }, 2000);
        } else {
          throw new Error(data.error || 'Erreur mise à jour note panier');
        }
      } catch (e) {
        console.error('updatePanierNote:', e);
        this.panierNoteError = true;
        setTimeout(() => {
          this.panierNoteError = false;
        }, 3000);
        throw e;
      } finally {
        this.savingPanierNote = false;
      }
    },

    async validerPanier(csrfToken) {
      if (!this.panier?.id) throw new Error('Aucun panier à valider');
      const data = await apiSubmitPanier(this.panier.id, csrfToken);
      if (!data.success) throw new Error(data.error || 'Erreur validation');
      if (typeof window !== 'undefined') {
        window.location.href = '/commandes/vue';
      }
    },

    async changeOwner(userId, csrfToken) {
      if (!this.panier?.id) throw new Error('Panier non chargé');
      this.changingOwner = true;
      try {
        const data = await apiChangeOwner(this.panier.id, userId, csrfToken);
        if (!data.success) throw new Error(data.error || 'Erreur changement propriétaire');
        await this.loadDetail(this.panier.id);
      } finally {
        this.changingOwner = false;
      }
    },

    async deletePanier(csrfToken) {
      if (!this.panier?.id) throw new Error('Panier non chargé');
      const data = await deletePanierById(this.panier.id, csrfToken);
      if (!data.success) throw new Error(data.error || 'Erreur suppression');
      if (typeof window !== 'undefined') {
        window.location.href = '/catalogues/vue';
      }
    },
  },
});
