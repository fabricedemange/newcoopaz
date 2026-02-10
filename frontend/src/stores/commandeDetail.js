import { defineStore } from 'pinia';
import {
  fetchCommandeDetail,
  saveArticleNote,
  reopenCommande as apiReopenCommande,
  sendCommandePdfByEmail as apiSendCommandePdfByEmail,
  AuthRequiredError,
} from '@/api';

export const useCommandeDetailStore = defineStore('commandeDetail', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    commande: null,
    articles: [],
    editingNoteId: null,
    sendingPdf: false,
    sendPdfMessage: null,
  }),

  getters: {
    articlesByCategory(state) {
      const grouped = {};
      (state.articles || []).forEach((article) => {
        const category = article.categorie || 'Sans catégorie';
        if (!grouped[category]) {
          grouped[category] = {
            name: category,
            color: article.categorie_couleur || '#6c757d',
            ordre: article.categorie_ordre ?? 999,
            articles: [],
          };
        }
        grouped[category].articles.push(article);
      });
      return Object.values(grouped).sort((a, b) => a.ordre - b.ordre);
    },

    totalCommande(state) {
      return (state.articles || []).reduce(
        (sum, a) => sum + (parseFloat(a.prix) || 0) * (parseFloat(a.quantity) || 0),
        0
      );
    },
  },

  actions: {
    async loadDetail(commandeId) {
      this.loading = true;
      this.error = null;
      this.authRequired = false;
      this.commande = null;
      this.articles = [];
      try {
        const data = await fetchCommandeDetail(commandeId);
        if (data.success) {
          this.commande = data.commande;
          this.articles = data.articles || [];
        } else throw new Error(data.error || 'Erreur chargement');
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('commandeDetail loadDetail:', e);
      } finally {
        this.loading = false;
      }
    },

    setEditingNoteId(id) {
      this.editingNoteId = this.editingNoteId === id ? null : id;
    },

    async saveNote(panierArticleId, note, csrfToken) {
      await saveArticleNote(panierArticleId, note, csrfToken);
      const article = this.articles.find((a) => a.id === panierArticleId);
      if (article) article.note = note;
      this.editingNoteId = null;
    },

    async reopenCommande(commandeId, csrfToken) {
      await apiReopenCommande(commandeId, csrfToken);
      if (typeof window !== 'undefined') {
        window.location.href = `/panier/${commandeId}/modifier/vue`;
      }
    },

    async sendPdfByEmail(commandeId, csrfToken) {
      this.sendingPdf = true;
      this.sendPdfMessage = null;
      try {
        const data = await apiSendCommandePdfByEmail(commandeId, csrfToken);
        this.sendPdfMessage = { type: 'success', text: data.message || 'PDF envoyé par email.' };
      } catch (e) {
        this.sendPdfMessage = { type: 'error', text: e.message || 'Erreur lors de l\'envoi.' };
      } finally {
        this.sendingPdf = false;
      }
    },
  },
});
