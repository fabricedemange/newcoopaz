import { defineStore } from 'pinia';
import {
  fetchVentesHistorique,
  fetchVentesHistoriqueStats,
  fetchVenteDetail,
} from '@/api';

export const useCaisseHistoriqueStore = defineStore('caisseHistorique', {
  state: () => ({
    ventes: [],
    stats: null,
    loading: false,
    selectedVente: null,
    showDetailModal: false,
    dateDebut: '',
    dateFin: '',
    numeroTicket: '',
    caissier_id: null,
    total: 0,
    limit: 50,
    offset: 0,
    error: null,
  }),

  getters: {
    nbPages(state) {
      return Math.ceil(state.total / state.limit) || 1;
    },
    currentPage(state) {
      return Math.floor(state.offset / state.limit) + 1;
    },
  },

  actions: {
    async chargerVentes() {
      this.loading = true;
      this.error = null;
      try {
        const params = { limit: this.limit, offset: this.offset };
        if (this.dateDebut) params.date_debut = this.dateDebut;
        if (this.dateFin) params.date_fin = this.dateFin;
        if (this.numeroTicket) params.numero_ticket = this.numeroTicket;
        if (this.caissier_id != null) params.caissier_id = this.caissier_id;
        const data = await fetchVentesHistorique(params);
        if (data.success) {
          this.ventes = data.ventes;
          this.total = data.total;
        } else {
          throw new Error(data.error);
        }
      } catch (e) {
        this.error = e.message;
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async chargerStats() {
      try {
        const params = {};
        if (this.dateDebut) params.date_debut = this.dateDebut;
        if (this.dateFin) params.date_fin = this.dateFin;
        const data = await fetchVentesHistoriqueStats(params);
        if (data.success) this.stats = data.stats;
      } catch (e) {
        console.error('Erreur chargement stats:', e);
      }
    },

    async ouvrirDetail(venteId) {
      try {
        const data = await fetchVenteDetail(venteId);
        if (data.success) {
          this.selectedVente = data;
          this.showDetailModal = true;
        } else {
          throw new Error(data.error);
        }
      } catch (e) {
        this.error = e.message;
      }
    },

    fermerDetail() {
      this.showDetailModal = false;
      this.selectedVente = null;
    },

    rechercher() {
      this.offset = 0;
      return Promise.all([this.chargerVentes(), this.chargerStats()]);
    },

    resetFiltres() {
      this.dateDebut = '';
      this.dateFin = '';
      this.numeroTicket = '';
      this.caissier_id = null;
      this.offset = 0;
      return Promise.all([this.chargerVentes(), this.chargerStats()]);
    },

    pageSuivante() {
      if (this.offset + this.limit < this.total) {
        this.offset += this.limit;
        return this.chargerVentes();
      }
    },

    pagePrecedente() {
      if (this.offset > 0) {
        this.offset = Math.max(0, this.offset - this.limit);
        return this.chargerVentes();
      }
    },

    allerPage(page) {
      this.offset = (page - 1) * this.limit;
      return this.chargerVentes();
    },

    formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
  },
});
