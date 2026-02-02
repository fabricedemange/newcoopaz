import { defineStore } from 'pinia';
import {
  fetchAdminStats,
  fetchAdminStatsCommandes,
  fetchAdminStatsUtilisateurs,
  fetchAdminStatsCatalogues,
  fetchAdminStatsCommandesPeriode,
} from '@/api';

export const useAdminStatsStore = defineStore('adminStats', {
  state: () => ({
    stats: {
      total_commandes: 0,
      total_utilisateurs: 0,
      total_catalogues: 0,
    },
    loading: true,
    error: null,
    currentView: null, // null | 'commandes' | 'utilisateurs' | 'catalogues' | 'periodes'
    detailsLoading: false,
    detailsData: [],
    searchQuery: '',
    sortColumn: null,
    sortDirection: 'desc',
  }),

  getters: {
    filteredDetails(state) {
      if (!state.searchQuery) return state.detailsData;
      const q = state.searchQuery.toLowerCase();
      return state.detailsData.filter((item) =>
        Object.values(item).some((val) => val && String(val).toLowerCase().includes(q))
      );
    },
    sortedDetails(state) {
      const filtered = state.searchQuery
        ? state.detailsData.filter((item) =>
            Object.values(item).some((val) => val && String(val).toLowerCase().includes(state.searchQuery.toLowerCase()))
          )
        : state.detailsData;
      if (!state.sortColumn) return filtered;
      const details = [...filtered];
      details.sort((a, b) => {
        let aVal = a[state.sortColumn];
        let bVal = b[state.sortColumn];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (
          state.sortColumn.includes('date') ||
          state.sortColumn.includes('login') ||
          state.sortColumn === 'created_at' ||
          state.sortColumn === 'last_login'
        ) {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }
        if (typeof aVal === 'number' || !Number.isNaN(parseFloat(aVal))) {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        if (aVal < bVal) return state.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      return details;
    },
  },

  actions: {
    async loadStats() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminStats();
        if (data.success) this.stats = data.stats || this.stats;
        else throw new Error(data.error);
      } catch (e) {
        this.error = e.message || 'Erreur lors du chargement des statistiques';
      } finally {
        this.loading = false;
      }
    },
    async showDetails(type) {
      this.currentView = type;
      this.detailsLoading = true;
      this.detailsData = [];
      this.searchQuery = '';
      this.sortColumn = null;
      if (type === 'commandes') this.sortColumn = 'commande_id';
      else if (type === 'utilisateurs') this.sortColumn = 'id';
      else if (type === 'catalogues') this.sortColumn = 'catalogue_id';
      else if (type === 'periodes') this.sortColumn = 'periode_label';
      this.error = null;
      try {
        let data;
        if (type === 'commandes') data = await fetchAdminStatsCommandes();
        else if (type === 'utilisateurs') data = await fetchAdminStatsUtilisateurs();
        else if (type === 'catalogues') data = await fetchAdminStatsCatalogues();
        else if (type === 'periodes') data = await fetchAdminStatsCommandesPeriode();
        else return;
        if (data.success) {
          this.detailsData =
            data[type] || data.commandes || data.utilisateurs || data.catalogues || data.periodes || [];
        } else throw new Error(data.error);
      } catch (e) {
        this.error = e.message || 'Erreur lors du chargement des détails';
      } finally {
        this.detailsLoading = false;
      }
    },
    closeDetails() {
      this.currentView = null;
      this.detailsData = [];
      this.searchQuery = '';
    },
    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'desc';
      }
    },
  },
});
