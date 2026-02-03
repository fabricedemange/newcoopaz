/**
 * AdminEmailQueueApp - Interface de gestion de la file d'attente email
 *
 * Features:
 * - Vue des notifications groupées (catalogues et commandes)
 * - Vue des emails individuels
 * - Recherche et filtres
 * - Statistiques en temps réel
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      entries: [],
      subjectSummary: [],
      loading: true,
      error: null,
      searchQuery: '',
      currentTab: 'notifications', // 'notifications' or 'individual'
      limit: 500,
      statusFilter: 'all' // 'all', 'sent', 'pending', 'failed'
    };
  },
  computed: {
    filteredSummary() {
      if (!this.searchQuery) return this.subjectSummary;

      const query = this.searchQuery.toLowerCase();
      return this.subjectSummary.filter(item => {
        return (
          (item.subject && item.subject.toLowerCase().includes(query)) ||
          (item.initiated_by_display && item.initiated_by_display.toLowerCase().includes(query))
        );
      });
    },
    filteredEntries() {
      let filtered = this.entries;

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(entry => {
          return (
            (entry.subject && entry.subject.toLowerCase().includes(query)) ||
            (entry.to_display && entry.to_display.toLowerCase().includes(query)) ||
            (entry.initiated_by_display && entry.initiated_by_display.toLowerCase().includes(query))
          );
        });
      }

      // Filter by status
      if (this.statusFilter !== 'all') {
        if (this.statusFilter === 'pending') {
          filtered = filtered.filter(e => e.status === 'pending' || e.status === 'sending');
        } else if (this.statusFilter === 'failed') {
          filtered = filtered.filter(e => e.status === 'failed');
        } else {
          filtered = filtered.filter(e => e.status === this.statusFilter);
        }
      }

      return filtered;
    },
    stats() {
      const totalNotifications = this.subjectSummary.reduce((sum, item) => sum + (item.total_count || 0), 0);
      const sentNotifications = this.subjectSummary.reduce((sum, item) => sum + (item.sent_count || 0), 0);
      const pendingNotifications = this.subjectSummary.reduce((sum, item) => sum + (item.pending_count || 0), 0);

      const totalIndividual = this.entries.length;
      const sentIndividual = this.entries.filter(e => e.status === 'sent').length;
      const pendingIndividual = this.entries.filter(e => e.status === 'pending' || e.status === 'sending').length;
      const failedIndividual = this.entries.filter(e => e.status === 'failed').length;

      return {
        notifications: {
          total: totalNotifications,
          sent: sentNotifications,
          pending: pendingNotifications
        },
        individual: {
          total: totalIndividual,
          sent: sentIndividual,
          pending: pendingIndividual,
          failed: failedIndividual
        }
      };
    }
  },
  methods: {
    async loadEmailQueue() {
      try {
        this.loading = true;
        const response = await fetch(`/api/admin/email-queue?limit=${this.limit}`, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.entries = data.entries || [];
          this.subjectSummary = data.subjectSummary || [];
        } else {
          this.error = data.error || 'Erreur lors du chargement de la file d\'attente';
        }
      } catch (err) {
        console.error('Error loading email queue:', err);
        this.error = 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    formatDate(dateStr) {
      if (!dateStr || dateStr === '—') return '—';
      return dateStr;
    },
    getStatusBadgeClass(status) {
      const classes = {
        'sent': 'bg-success',
        'pending': 'bg-warning text-dark',
        'sending': 'bg-info text-dark',
        'failed': 'bg-danger'
      };
      return classes[status] || 'bg-secondary';
    },
    getStatusLabel(status) {
      const labels = {
        'sent': 'Envoyé',
        'pending': 'En attente',
        'sending': 'Envoi en cours',
        'failed': 'Échec'
      };
      return labels[status] || status;
    },
    truncate(str, maxLength = 60) {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    }
  },
  mounted() {
    this.loadEmailQueue();
  },
  template: `
    <div class="container-fluid mt-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement de la file d'attente...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-envelope-paper me-2"></i>File d'attente email</h2>
          <button @click="loadEmailQueue" class="btn btn-outline-primary">
            <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
          </button>
        </div>

        <!-- Stats Cards -->
        <div class="row g-3 mb-4">
          <div class="col-md-3">
            <div class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">Notifications</h6>
                    <h3 class="mb-0">{{ stats.notifications.total }}</h3>
                  </div>
                  <i class="bi bi-bell text-primary" style="font-size: 2rem;"></i>
                </div>
                <small class="text-success">{{ stats.notifications.sent }} envoyées</small>
                <span class="text-muted mx-1">·</span>
                <small class="text-warning">{{ stats.notifications.pending }} en attente</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">Emails individuels</h6>
                    <h3 class="mb-0">{{ stats.individual.total }}</h3>
                  </div>
                  <i class="bi bi-envelope text-info" style="font-size: 2rem;"></i>
                </div>
                <small class="text-success">{{ stats.individual.sent }} envoyés</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">En attente</h6>
                    <h3 class="mb-0">{{ stats.individual.pending }}</h3>
                  </div>
                  <i class="bi bi-hourglass-split text-warning" style="font-size: 2rem;"></i>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="text-muted mb-1">Échecs</h6>
                    <h3 class="mb-0">{{ stats.individual.failed }}</h3>
                  </div>
                  <i class="bi bi-exclamation-triangle text-danger" style="font-size: 2rem;"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <a class="nav-link" :class="{ active: currentTab === 'notifications' }" @click="currentTab = 'notifications'" href="javascript:void(0)">
              <i class="bi bi-bell me-1"></i>Notifications groupées ({{ stats.notifications.total }})
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" :class="{ active: currentTab === 'individual' }" @click="currentTab = 'individual'" href="javascript:void(0)">
              <i class="bi bi-envelope me-1"></i>Emails individuels ({{ stats.individual.total }})
            </a>
          </li>
        </ul>

        <!-- Search and Filters -->
        <div class="row g-3 mb-4">
          <div class="col-md-8">
            <input
              v-model="searchQuery"
              type="text"
              class="form-control"
              placeholder="Rechercher par sujet, destinataire ou expéditeur..."
            />
          </div>
          <div class="col-md-4" v-if="currentTab === 'individual'">
            <select v-model="statusFilter" class="form-select">
              <option value="all">Tous les statuts</option>
              <option value="sent">Envoyés</option>
              <option value="pending">En attente</option>
              <option value="failed">Échecs</option>
            </select>
          </div>
        </div>

        <!-- Notifications Tab -->
        <div v-if="currentTab === 'notifications'" class="card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 45%;">Sujet</th>
                  <th style="width: 20%;">Initié par</th>
                  <th class="text-center">Envoyés</th>
                  <th class="text-center">En attente</th>
                  <th class="text-center">Total</th>
                  <th style="width: 15%;">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredSummary.length === 0">
                  <td colspan="6" class="text-center text-muted py-4">
                    Aucune notification trouvée
                  </td>
                </tr>
                <tr v-for="item in filteredSummary" :key="item.subject">
                  <td>{{ truncate(item.subject, 80) }}</td>
                  <td>{{ item.initiated_by_display }}</td>
                  <td class="text-center">
                    <span class="badge bg-success">{{ item.sent_count }}</span>
                  </td>
                  <td class="text-center">
                    <span class="badge bg-warning text-dark">{{ item.pending_count }}</span>
                  </td>
                  <td class="text-center">
                    <strong>{{ item.total_count }}</strong>
                  </td>
                  <td>
                    <small class="text-muted">{{ formatDate(item.last_activity) }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Individual Emails Tab -->
        <div v-if="currentTab === 'individual'" class="card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 60px;">ID</th>
                  <th>Statut</th>
                  <th style="width: 30%;">Sujet</th>
                  <th style="width: 20%;">Destinataires</th>
                  <th>Tentatives</th>
                  <th>Dernière MAJ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredEntries.length === 0">
                  <td colspan="6" class="text-center text-muted py-4">
                    Aucun email trouvé
                  </td>
                </tr>
                <tr v-for="entry in filteredEntries" :key="entry.id">
                  <td>{{ entry.id }}</td>
                  <td>
                    <span class="badge" :class="getStatusBadgeClass(entry.status)">
                      {{ getStatusLabel(entry.status) }}
                    </span>
                  </td>
                  <td>
                    <div>{{ truncate(entry.subject, 50) }}</div>
                    <small v-if="entry.last_error" class="text-danger">{{ truncate(entry.last_error, 60) }}</small>
                  </td>
                  <td>
                    <small class="text-muted">{{ truncate(entry.to_display, 40) }}</small>
                  </td>
                  <td class="text-center">
                    <span v-if="entry.attempt_count > 0" class="badge" :class="entry.attempt_count > 1 ? 'bg-warning text-dark' : 'bg-secondary'">
                      {{ entry.attempt_count }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td>
                    <small class="text-muted">{{ formatDate(entry.updated_at_formatted) }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Info -->
        <div class="mt-3 text-muted text-center">
          <small>Limite: {{ limit }} emails · Les notifications de catalogues et commandes sont groupées</small>
        </div>
      </div>
    </div>
  `
}).mount('#admin-email-queue-app');
