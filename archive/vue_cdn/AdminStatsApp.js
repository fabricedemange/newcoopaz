/**
 * AdminStatsApp - Interface de statistiques
 *
 * Features:
 * - Statistiques générales (commandes, utilisateurs, catalogues)
 * - Détails cliquables pour chaque catégorie
 * - Tri et recherche dans les tableaux de détails
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      stats: {
        total_commandes: 0,
        total_utilisateurs: 0,
        total_catalogues: 0
      },
      loading: true,
      error: null,
      currentView: null, // null, 'commandes', 'utilisateurs', 'catalogues', 'periodes'
      detailsLoading: false,
      detailsData: [],
      searchQuery: '',
      sortColumn: null,
      sortDirection: 'desc'
    };
  },
  computed: {
    filteredDetails() {
      if (!this.searchQuery) return this.detailsData;

      const query = this.searchQuery.toLowerCase();
      return this.detailsData.filter(item => {
        return Object.values(item).some(val =>
          val && val.toString().toLowerCase().includes(query)
        );
      });
    },
    sortedDetails() {
      if (!this.sortColumn) return this.filteredDetails;

      const details = [...this.filteredDetails];
      details.sort((a, b) => {
        let aVal = a[this.sortColumn];
        let bVal = b[this.sortColumn];

        // Handle null/undefined
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        // Handle dates
        if (this.sortColumn.includes('date') || this.sortColumn.includes('login') || this.sortColumn.includes('created_at')) {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        // Handle numbers
        if (typeof aVal === 'number' || !isNaN(parseFloat(aVal))) {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }

        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      return details;
    }
  },
  methods: {
    async loadStats() {
      try {
        this.loading = true;
        const response = await fetch('/api/admin/stats', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.stats = data.stats;
        } else {
          this.error = data.error || 'Erreur lors du chargement des statistiques';
        }
      } catch (err) {
        console.error('Error loading stats:', err);
        this.error = 'Erreur de connexion au serveur';
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

      try {
        let endpoint = '';
        switch (type) {
          case 'commandes':
            endpoint = '/api/admin/stats/commandes';
            this.sortColumn = 'commande_id';
            break;
          case 'utilisateurs':
            endpoint = '/api/admin/stats/utilisateurs';
            this.sortColumn = 'id';
            break;
          case 'catalogues':
            endpoint = '/api/admin/stats/catalogues';
            this.sortColumn = 'catalogue_id';
            break;
          case 'periodes':
            endpoint = '/api/admin/stats/commandes-periode';
            this.sortColumn = 'periode_label';
            break;
        }

        const response = await fetch(endpoint, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.detailsData = data[type] || data.commandes || data.utilisateurs || data.catalogues || data.periodes || [];
        } else {
          this.error = data.error || 'Erreur lors du chargement des détails';
        }
      } catch (err) {
        console.error('Error loading details:', err);
        this.error = 'Erreur de connexion au serveur';
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
    getSortIcon(column) {
      if (this.sortColumn !== column) return '';
      return this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
    },
    formatDate(dateStr) {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('fr-FR');
    },
    formatDateTime(dateStr) {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleString('fr-FR');
    },
    formatMontant(value) {
      if (!value) return '0,00';
      const num = parseFloat(value);
      if (isNaN(num)) return '0,00';
      return num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },
    getRoleBadge(role) {
      const badges = {
        'SuperAdmin': 'bg-dark',
        'admin': 'bg-danger',
        'referent': 'bg-warning text-dark',
        'utilisateur': 'bg-primary',
        'epicier': 'bg-info text-dark'
      };
      return badges[role] || 'bg-secondary';
    },
    formatPeriodeLabel(type, label) {
      if (type === 'mois') {
        const [year, month] = label.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else if (type === 'semaine') {
        return `Semaine ${label.split('-')[1]} · ${label.split('-')[0]}`;
      }
      return label;
    }
  },
  mounted() {
    this.loadStats();
  },
  template: `
    <div class="container-fluid mt-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement des statistiques...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-bar-chart-fill me-2"></i>Statistiques générales</h2>
          <button @click="loadStats" class="btn btn-outline-primary">
            <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
          </button>
        </div>

        <!-- Stats Cards -->
        <div v-if="!currentView" class="row g-4">
          <div class="col-md-3">
            <div class="card stat-card" @click="showDetails('commandes')" style="cursor: pointer;">
              <div class="card-body text-center">
                <div class="stat-icon text-primary mb-2">
                  <i class="bi bi-bag-check-fill" style="font-size: 2.5rem;"></i>
                </div>
                <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8;">
                  {{ stats.total_commandes || 0 }}
                </div>
                <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem;">
                  Commandes validées
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-3">
            <div class="card stat-card" @click="showDetails('utilisateurs')" style="cursor: pointer;">
              <div class="card-body text-center">
                <div class="stat-icon text-warning mb-2">
                  <i class="bi bi-people-fill" style="font-size: 2.5rem;"></i>
                </div>
                <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8;">
                  {{ stats.total_utilisateurs || 0 }}
                </div>
                <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem;">
                  Utilisateurs inscrits
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-3">
            <div class="card stat-card" @click="showDetails('catalogues')" style="cursor: pointer;">
              <div class="card-body text-center">
                <div class="stat-icon text-info mb-2">
                  <i class="bi bi-book-fill" style="font-size: 2.5rem;"></i>
                </div>
                <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8;">
                  {{ stats.total_catalogues || 0 }}
                </div>
                <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem;">
                  Catalogues
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-3">
            <div class="card stat-card" @click="showDetails('periodes')" style="cursor: pointer;">
              <div class="card-body text-center">
                <div class="stat-icon text-success mb-2">
                  <i class="bi bi-calendar-week" style="font-size: 2.5rem;"></i>
                </div>
                <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8;">
                  {{ stats.total_commandes || 0 }}
                </div>
                <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem;">
                  Commandes par période
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Details View -->
        <div v-if="currentView">
          <div class="mb-4">
            <button @click="closeDetails" class="btn btn-outline-secondary">
              <i class="bi bi-arrow-left me-2"></i>Retour
            </button>
          </div>

          <!-- Loading Details -->
          <div v-if="detailsLoading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
          </div>

          <!-- Details Content -->
          <div v-else>
            <!-- Search -->
            <div class="mb-3">
              <input
                v-model="searchQuery"
                type="text"
                class="form-control"
                placeholder="Rechercher..."
              />
            </div>

            <!-- Commandes Table -->
            <div v-if="currentView === 'commandes'" class="card">
              <div class="card-header bg-primary text-white">
                <h5 class="mb-0"><i class="bi bi-bag-check-fill me-2"></i>Détail des commandes validées</h5>
              </div>
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th @click="sortBy('commande_id')" style="cursor: pointer;">
                        ID <i :class="'bi ms-1 ' + getSortIcon('commande_id')"></i>
                      </th>
                      <th @click="sortBy('username')" style="cursor: pointer;">
                        Utilisateur <i :class="'bi ms-1 ' + getSortIcon('username')"></i>
                      </th>
                      <th @click="sortBy('catalogue')" style="cursor: pointer;">
                        Catalogue <i :class="'bi ms-1 ' + getSortIcon('catalogue')"></i>
                      </th>
                      <th @click="sortBy('created_at')" style="cursor: pointer;">
                        Date <i :class="'bi ms-1 ' + getSortIcon('created_at')"></i>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="sortedDetails.length === 0">
                      <td colspan="4" class="text-center text-muted py-4">Aucune commande</td>
                    </tr>
                    <tr v-for="cmd in sortedDetails" :key="cmd.commande_id">
                      <td>
                        <a :href="'/commandes/' + cmd.commande_id + '/vue'" class="btn btn-outline-primary btn-sm">
                          <i class="bi bi-eye me-1"></i>{{ cmd.commande_id }}
                        </a>
                      </td>
                      <td>{{ cmd.username }} <span class="text-muted">{{ cmd.organization_name }}</span></td>
                      <td>{{ cmd.catalogue }}</td>
                      <td>{{ formatDate(cmd.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Utilisateurs Table -->
            <div v-if="currentView === 'utilisateurs'" class="card">
              <div class="card-header bg-warning">
                <h5 class="mb-0"><i class="bi bi-people-fill me-2"></i>Détail des utilisateurs inscrits</h5>
              </div>
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th @click="sortBy('id')" style="cursor: pointer;">
                        ID <i :class="'bi ms-1 ' + getSortIcon('id')"></i>
                      </th>
                      <th @click="sortBy('username')" style="cursor: pointer;">
                        Nom d'utilisateur <i :class="'bi ms-1 ' + getSortIcon('username')"></i>
                      </th>
                      <th @click="sortBy('email')" style="cursor: pointer;">
                        Email <i :class="'bi ms-1 ' + getSortIcon('email')"></i>
                      </th>
                      <th>Rôle</th>
                      <th @click="sortBy('last_login')" style="cursor: pointer;">
                        Dernière connexion <i :class="'bi ms-1 ' + getSortIcon('last_login')"></i>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="sortedDetails.length === 0">
                      <td colspan="5" class="text-center text-muted py-4">Aucun utilisateur</td>
                    </tr>
                    <tr v-for="user in sortedDetails" :key="user.id">
                      <td>
                        <a :href="'/admin/users/vue'" class="btn btn-outline-primary btn-sm">
                          <i class="bi bi-eye me-1"></i>{{ user.id }}
                        </a>
                      </td>
                      <td>{{ user.username }} <span class="text-muted">({{ user.organization_name || 'N/A' }})</span></td>
                      <td><a :href="'mailto:' + user.email">{{ user.email }}</a></td>
                      <td>
                        <span class="badge" :class="getRoleBadge(user.role)">{{ user.role }}</span>
                      </td>
                      <td>{{ formatDateTime(user.last_login) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Catalogues Table -->
            <div v-if="currentView === 'catalogues'" class="card">
              <div class="card-header bg-info">
                <h5 class="mb-0"><i class="bi bi-book-fill me-2"></i>Détail des catalogues</h5>
              </div>
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th @click="sortBy('catalogue_id')" style="cursor: pointer;">
                        Action <i :class="'bi ms-1 ' + getSortIcon('catalogue_id')"></i>
                      </th>
                      <th @click="sortBy('originalname_id')" style="cursor: pointer;">
                        Nom du catalogue <i :class="'bi ms-1 ' + getSortIcon('originalname_id')"></i>
                      </th>
                      <th @click="sortBy('expiration_date')" style="cursor: pointer;">
                        Date d'expiration <i :class="'bi ms-1 ' + getSortIcon('expiration_date')"></i>
                      </th>
                      <th @click="sortBy('nombre_commandes')" style="cursor: pointer;">
                        Commandes <i :class="'bi ms-1 ' + getSortIcon('nombre_commandes')"></i>
                      </th>
                      <th @click="sortBy('montant_total')" style="cursor: pointer;" class="text-end">
                        Montant total <i :class="'bi ms-1 ' + getSortIcon('montant_total')"></i>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="sortedDetails.length === 0">
                      <td colspan="5" class="text-center text-muted py-4">Aucun catalogue</td>
                    </tr>
                    <tr v-for="cat in sortedDetails" :key="cat.catalogue_id">
                      <td>
                        <a :href="'/admin/catalogues/' + cat.catalogue_id + '/synthese-detaillee/vue'" class="btn btn-outline-primary btn-sm">
                          <i class="bi bi-eye me-1"></i>{{ cat.catalogue_id }}
                        </a>
                      </td>
                      <td>{{ cat.originalname_id }} <span class="text-muted">({{ cat.organization_name || 'N/A' }})</span></td>
                      <td>{{ formatDate(cat.expiration_date) }}</td>
                      <td>
                        <span class="badge bg-primary">{{ cat.nombre_commandes }}</span>
                      </td>
                      <td class="text-end">
                        <strong>{{ formatMontant(cat.montant_total) }} €</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Périodes Table -->
            <div v-if="currentView === 'periodes'" class="card">
              <div class="card-header bg-success text-white">
                <h5 class="mb-0"><i class="bi bi-calendar-week me-2"></i>Commandes par semaine et par mois</h5>
              </div>
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Type</th>
                      <th>Période</th>
                      <th>Début</th>
                      <th>Fin</th>
                      <th>Commandes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="sortedDetails.length === 0">
                      <td colspan="5" class="text-center text-muted py-4">Aucune données</td>
                    </tr>
                    <tr v-for="periode in sortedDetails" :key="periode.periode_label"
                        :class="{ 'table-primary': periode.periode_type === 'mois' }">
                      <td>
                        <span class="badge" :class="periode.periode_type === 'mois' ? 'bg-secondary' : 'bg-info'">
                          {{ periode.periode_type === 'mois' ? 'Mois' : 'Semaine' }}
                        </span>
                      </td>
                      <td :style="periode.periode_type === 'semaine' ? 'padding-left: 2.5rem;' : ''">
                        {{ formatPeriodeLabel(periode.periode_type, periode.periode_label) }}
                      </td>
                      <td>{{ formatDate(periode.date_debut) }}</td>
                      <td>{{ formatDate(periode.date_fin) }}</td>
                      <td>
                        <span class="badge" :class="periode.periode_type === 'mois' ? 'bg-primary' : 'bg-light text-dark'">
                          {{ periode.nombre_commandes }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
    .stat-card {
      transition: transform 0.15s, box-shadow 0.15s;
      border: none;
      border-radius: 1rem;
    }

    .stat-card:hover {
      transform: translateY(-8px) scale(1.03);
      box-shadow: 0 8px 32px rgba(78, 84, 200, 0.20);
      z-index: 2;
    }
    </style>
  `
}).mount('#admin-stats-app');
