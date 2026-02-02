import { defineStore } from 'pinia';
import {
  fetchCommandes,
  fetchVentesCaisse,
  saveCommandeNote,
  reopenCommande as apiReopenCommande,
  fetchVenteDetail,
  sendTicketPDF as apiSendTicketPDF,
  AuthRequiredError,
} from '@/api';

export const useCommandesStore = defineStore('commandes', {
  state: () => ({
    loading: false,
    error: null,
    authRequired: false,
    commandes: [],
    ventes: [],
    activeTab: 'catalogues',
    searchTerm: '',
    sortColumn: 'created_at',
    sortDirection: 'desc',
    savingNotes: {},
    savedNotes: {},
    errorNotes: {},
    showDetailModal: false,
    selectedVente: null,
  }),

  getters: {
    filteredCommandes(state) {
      let list = [...state.commandes];
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        list = list.filter(
          (c) =>
            (c.originalname && c.originalname.toLowerCase().includes(term)) ||
            (c.catalog_description && c.catalog_description.toLowerCase().includes(term)) ||
            (c.note && c.note.toLowerCase().includes(term)) ||
            String(c.id).includes(term)
        );
      }
      return list;
    },

    sortedCommandes(state) {
      let list = [...(state.commandes || [])];
      if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        list = list.filter(
          (c) =>
            (c.originalname && c.originalname.toLowerCase().includes(term)) ||
            (c.catalog_description && c.catalog_description.toLowerCase().includes(term)) ||
            (c.note && c.note.toLowerCase().includes(term)) ||
            String(c.id).includes(term)
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
            valA = (a.originalname || '').toLowerCase();
            valB = (b.originalname || '').toLowerCase();
            break;
          case 'expiration_date':
            valA = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
            valB = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
            break;
          case 'date_livraison':
            valA = a.date_livraison ? new Date(a.date_livraison).getTime() : 0;
            valB = b.date_livraison ? new Date(b.date_livraison).getTime() : 0;
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
        const [cmdRes, ventesRes] = await Promise.all([fetchCommandes(), fetchVentesCaisse()]);
        if (cmdRes.success) this.commandes = cmdRes.commandes || [];
        if (ventesRes.success) this.ventes = ventesRes.ventes || [];
      } catch (e) {
        this.error = e.message;
        if (e.code === AuthRequiredError) this.authRequired = true;
        console.error('commandes loadAll:', e);
      } finally {
        this.loading = false;
      }
    },

    setActiveTab(tab) {
      this.activeTab = tab;
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

    async saveNote(commandeId, note, csrfToken) {
      this.savingNotes[commandeId] = true;
      delete this.savedNotes[commandeId];
      delete this.errorNotes[commandeId];
      try {
        await saveCommandeNote(commandeId, note, csrfToken);
        const c = this.commandes.find((x) => x.id === commandeId);
        if (c) c.note = note;
        this.savedNotes[commandeId] = true;
        setTimeout(() => {
          delete this.savedNotes[commandeId];
        }, 2000);
      } catch (e) {
        this.errorNotes[commandeId] = true;
        setTimeout(() => delete this.errorNotes[commandeId], 3000);
        console.error('saveNote:', e);
      } finally {
        delete this.savingNotes[commandeId];
      }
    },

    async reopenCommande(commandeId, csrfToken) {
      await apiReopenCommande(commandeId, csrfToken);
      if (typeof window !== 'undefined') window.location.reload();
    },

    async loadVenteDetail(venteId) {
      try {
        const data = await fetchVenteDetail(venteId);
        if (data.success) {
          this.selectedVente = data;
          this.showDetailModal = true;
        } else throw new Error(data.error || 'Erreur chargement détail');
      } catch (e) {
        console.error('loadVenteDetail:', e);
        if (typeof window !== 'undefined') alert('Erreur : ' + e.message);
      }
    },

    closeDetailModal() {
      this.showDetailModal = false;
      this.selectedVente = null;
    },

    async sendTicketPDF(venteId) {
      try {
        const data = await apiSendTicketPDF(venteId);
        if (data.success && typeof window !== 'undefined') alert('Email envoyé avec succès.');
        else throw new Error(data.error || 'Erreur envoi');
      } catch (e) {
        console.error('sendTicketPDF:', e);
        if (typeof window !== 'undefined') alert('Erreur : ' + e.message);
      }
    },
  },
});
