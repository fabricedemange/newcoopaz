import { defineStore } from 'pinia';
import { fetchAdminTrace } from '@/api';

export const useAdminTraceStore = defineStore('adminTrace', {
  state: () => ({
    traces: [],
    loading: true,
    error: null,
    searchQuery: '',
    currentPage: 1,
    pageSize: 50,
    sortColumn: 'id',
    sortDirection: 'desc',
  }),

  getters: {
    filteredTraces(state) {
      if (!state.searchQuery) return state.traces;
      const q = state.searchQuery.toLowerCase();
      return state.traces.filter(
        (t) =>
          (t.id && String(t.id).includes(q)) ||
          (t.username && t.username.toLowerCase().includes(q)) ||
          (t.query && t.query.toLowerCase().includes(q)) ||
          (t.params && t.params.toLowerCase().includes(q))
      );
    },
    sortedTraces(state) {
      const filtered = state.searchQuery
        ? state.traces.filter(
            (t) =>
              (t.id && String(t.id).toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (t.username && t.username.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (t.query && t.query.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (t.params && t.params.toLowerCase().includes(state.searchQuery.toLowerCase()))
          )
        : state.traces;
      const traces = [...filtered];
      traces.sort((a, b) => {
        let aVal = a[state.sortColumn];
        let bVal = b[state.sortColumn];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (state.sortColumn === 'created_at') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }
        if (state.sortColumn === 'id') {
          aVal = parseInt(aVal);
          bVal = parseInt(bVal);
        }
        if (aVal < bVal) return state.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      return traces;
    },
    paginatedTraces(state) {
      const sorted = this.sortedTraces;
      const start = (state.currentPage - 1) * state.pageSize;
      return sorted.slice(start, start + state.pageSize);
    },
    totalPages(state) {
      const len = this.sortedTraces.length;
      return Math.ceil(len / state.pageSize) || 1;
    },
    paginationInfo(state) {
      const len = this.sortedTraces.length;
      const start = (state.currentPage - 1) * state.pageSize + 1;
      const end = Math.min(state.currentPage * state.pageSize, len);
      return `${start}-${end} sur ${len}`;
    },
  },

  actions: {
    async loadTraces() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminTrace();
        if (data.success) this.traces = data.traces || [];
        else throw new Error(data.error);
      } catch (e) {
        this.error = e.message || 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'desc';
      }
    },
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) this.currentPage = page;
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    },
    truncate(str, maxLength = 100) {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    },
    getSortIcon(column) {
      if (this.sortColumn !== column) return '';
      return this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
    },
  },
});
