/**
 * AdminTraceApp - Interface de gestion des traces d'actions
 *
 * Features:
 * - Liste de toutes les traces avec tri et filtres
 * - Recherche par utilisateur, query ou params
 * - Pagination et tri par colonnes
 * - Formatage automatique des dates
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      traces: [],
      loading: true,
      error: null,
      searchQuery: '',
      currentPage: 1,
      pageSize: 50,
      sortColumn: 'id',
      sortDirection: 'desc'
    };
  },
  computed: {
    filteredTraces() {
      if (!this.searchQuery) return this.traces;

      const query = this.searchQuery.toLowerCase();
      return this.traces.filter(trace => {
        return (
          (trace.id && trace.id.toString().includes(query)) ||
          (trace.username && trace.username.toLowerCase().includes(query)) ||
          (trace.query && trace.query.toLowerCase().includes(query)) ||
          (trace.params && trace.params.toLowerCase().includes(query))
        );
      });
    },
    sortedTraces() {
      const traces = [...this.filteredTraces];

      traces.sort((a, b) => {
        let aVal = a[this.sortColumn];
        let bVal = b[this.sortColumn];

        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        // For dates
        if (this.sortColumn === 'created_at') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        // For numbers
        if (this.sortColumn === 'id') {
          aVal = parseInt(aVal);
          bVal = parseInt(bVal);
        }

        // Compare
        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      return traces;
    },
    paginatedTraces() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.sortedTraces.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.sortedTraces.length / this.pageSize);
    },
    paginationInfo() {
      const start = (this.currentPage - 1) * this.pageSize + 1;
      const end = Math.min(this.currentPage * this.pageSize, this.sortedTraces.length);
      return `${start}-${end} sur ${this.sortedTraces.length}`;
    }
  },
  methods: {
    async loadTraces() {
      try {
        this.loading = true;
        const response = await fetch('/api/admin/trace', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.traces = data.traces || [];
        } else {
          this.error = data.error || 'Erreur lors du chargement des traces';
        }
      } catch (err) {
        console.error('Error loading traces:', err);
        this.error = 'Erreur de connexion au serveur';
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
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },
    getSortIcon(column) {
      if (this.sortColumn !== column) return '';
      return this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
    }
  },
  mounted() {
    this.loadTraces();
  },
  template: `
    <div class="container-fluid mt-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement des traces...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-activity me-2"></i>Traces de MAJ</h2>
          <button @click="loadTraces" class="btn btn-outline-primary">
            <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
          </button>
        </div>

        <!-- Search -->
        <div class="mb-4">
          <input
            v-model="searchQuery"
            @input="currentPage = 1"
            type="text"
            class="form-control"
            placeholder="Rechercher par ID, utilisateur, requête ou paramètres..."
          />
        </div>

        <!-- Pagination Info -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="text-muted">
            {{ paginationInfo }} traces
          </div>
          <div class="d-flex align-items-center gap-2">
            <label class="mb-0">Lignes par page:</label>
            <select v-model.number="pageSize" @change="currentPage = 1" class="form-select form-select-sm" style="width: auto;">
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
            </select>
          </div>
        </div>

        <!-- Table -->
        <div class="card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th @click="sortBy('id')" style="cursor: pointer; width: 80px;">
                    ID <i :class="'bi ms-1 ' + getSortIcon('id')"></i>
                  </th>
                  <th @click="sortBy('created_at')" style="cursor: pointer; width: 160px;">
                    Date Action <i :class="'bi ms-1 ' + getSortIcon('created_at')"></i>
                  </th>
                  <th @click="sortBy('username')" style="cursor: pointer; width: 120px;">
                    Username <i :class="'bi ms-1 ' + getSortIcon('username')"></i>
                  </th>
                  <th style="width: 50%;">Query</th>
                  <th style="width: 150px;">Params</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="paginatedTraces.length === 0">
                  <td colspan="5" class="text-center text-muted py-4">
                    Aucune trace trouvée
                  </td>
                </tr>
                <tr v-for="trace in paginatedTraces" :key="trace.id">
                  <td>{{ trace.id }}</td>
                  <td>{{ formatDate(trace.created_at) }}</td>
                  <td>
                    <span class="badge bg-primary">{{ trace.username || '—' }}</span>
                  </td>
                  <td>
                    <code class="text-wrap" style="font-size: 0.85rem;">{{ trace.query }}</code>
                  </td>
                  <td>
                    <code class="text-wrap" style="font-size: 0.85rem;">{{ truncate(trace.params, 80) }}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="d-flex justify-content-center mt-4">
          <nav>
            <ul class="pagination">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <a class="page-link" @click="goToPage(1)" href="javascript:void(0)">
                  <i class="bi bi-chevron-double-left"></i>
                </a>
              </li>
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <a class="page-link" @click="goToPage(currentPage - 1)" href="javascript:void(0)">
                  <i class="bi bi-chevron-left"></i>
                </a>
              </li>

              <template v-for="page in totalPages" :key="page">
                <li v-if="page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)"
                    class="page-item"
                    :class="{ active: page === currentPage }">
                  <a class="page-link" @click="goToPage(page)" href="javascript:void(0)">
                    {{ page }}
                  </a>
                </li>
                <li v-else-if="page === currentPage - 3 || page === currentPage + 3"
                    class="page-item disabled">
                  <span class="page-link">...</span>
                </li>
              </template>

              <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                <a class="page-link" @click="goToPage(currentPage + 1)" href="javascript:void(0)">
                  <i class="bi bi-chevron-right"></i>
                </a>
              </li>
              <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                <a class="page-link" @click="goToPage(totalPages)" href="javascript:void(0)">
                  <i class="bi bi-chevron-double-right"></i>
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  `
}).mount('#admin-trace-app');
