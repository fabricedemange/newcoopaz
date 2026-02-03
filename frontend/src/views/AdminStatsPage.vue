<template>
  <div class="container-fluid mt-4">
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des statistiques...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="alert alert-danger">
      {{ store.error }}
    </div>

    <!-- Main Content -->
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-bar-chart-fill me-2"></i>Statistiques générales</h2>
        <button type="button" class="btn btn-outline-primary" @click="store.loadStats()">
          <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
        </button>
      </div>

      <!-- Stats Cards (toujours visibles) -->
      <div class="row g-4 mb-4">
        <div class="col-md-3">
          <div class="card stat-card" style="cursor: pointer" @click="store.showDetails('commandes')">
            <div class="card-body text-center">
              <div class="stat-icon text-primary mb-2">
                <i class="bi bi-bag-check-fill" style="font-size: 2.5rem"></i>
              </div>
              <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8">
                {{ store.stats.total_commandes || 0 }}
              </div>
              <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem">
                Commandes validées
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card stat-card" style="cursor: pointer" @click="store.showDetails('utilisateurs')">
            <div class="card-body text-center">
              <div class="stat-icon text-warning mb-2">
                <i class="bi bi-people-fill" style="font-size: 2.5rem"></i>
              </div>
              <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8">
                {{ store.stats.total_utilisateurs || 0 }}
              </div>
              <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem">
                Utilisateurs inscrits
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card stat-card" style="cursor: pointer" @click="store.showDetails('catalogues')">
            <div class="card-body text-center">
              <div class="stat-icon text-info mb-2">
                <i class="bi bi-book-fill" style="font-size: 2.5rem"></i>
              </div>
              <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8">
                {{ store.stats.total_catalogues || 0 }}
              </div>
              <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem">
                Catalogues
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card stat-card" style="cursor: pointer" @click="store.showDetails('periodes')">
            <div class="card-body text-center">
              <div class="stat-icon text-success mb-2">
                <i class="bi bi-calendar-week" style="font-size: 2.5rem"></i>
              </div>
              <div class="stat-value" style="font-size: 2.2rem; font-weight: 600; color: #4e54c8">
                {{ store.stats.total_commandes || 0 }}
              </div>
              <div class="stat-label" style="color: #888; margin-top: 0.2rem; font-size: 1.05rem">
                Commandes par période
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tableau de détail (affiché en dessous des cartes) -->
      <div v-if="store.currentView" class="mt-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0 text-muted">
            <i class="bi bi-table me-2"></i>Détail : {{ detailTitle }}
          </h5>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click="store.closeDetails()">
            <i class="bi bi-x-lg me-1"></i>Fermer
          </button>
        </div>

        <div v-if="store.detailsLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
        </div>

        <div v-else>
          <div class="mb-3">
            <input
              v-model="store.searchQuery"
              type="text"
              class="form-control"
              placeholder="Rechercher..."
            />
          </div>

          <!-- Commandes Table -->
          <div v-if="store.currentView === 'commandes'" class="card">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0"><i class="bi bi-bag-check-fill me-2"></i>Détail des commandes validées</h5>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="thead-admin-site">
                  <tr>
                    <th style="cursor: pointer" @click="store.sortBy('commande_id')">
                      ID <i :class="'bi ms-1 ' + getSortIcon('commande_id')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('username')">
                      Utilisateur <i :class="'bi ms-1 ' + getSortIcon('username')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('catalogue')">
                      Catalogue <i :class="'bi ms-1 ' + getSortIcon('catalogue')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('created_at')">
                      Date <i :class="'bi ms-1 ' + getSortIcon('created_at')"></i>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="store.sortedDetails.length === 0">
                    <td colspan="4" class="text-center text-muted py-4">Aucune commande</td>
                  </tr>
                  <tr v-for="cmd in store.sortedDetails" :key="cmd.commande_id">
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
          <div v-if="store.currentView === 'utilisateurs'" class="card">
            <div class="card-header bg-warning">
              <h5 class="mb-0"><i class="bi bi-people-fill me-2"></i>Détail des utilisateurs inscrits</h5>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="thead-admin-site">
                  <tr>
                    <th style="cursor: pointer" @click="store.sortBy('id')">
                      ID <i :class="'bi ms-1 ' + getSortIcon('id')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('username')">
                      Nom d'utilisateur <i :class="'bi ms-1 ' + getSortIcon('username')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('email')">
                      Email <i :class="'bi ms-1 ' + getSortIcon('email')"></i>
                    </th>
                    <th>Rôle</th>
                    <th style="cursor: pointer" @click="store.sortBy('last_login')">
                      Dernière connexion <i :class="'bi ms-1 ' + getSortIcon('last_login')"></i>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="store.sortedDetails.length === 0">
                    <td colspan="5" class="text-center text-muted py-4">Aucun utilisateur</td>
                  </tr>
                  <tr v-for="user in store.sortedDetails" :key="user.id">
                    <td>
                      <a href="/admin/users/vue" class="btn btn-outline-primary btn-sm">
                        <i class="bi bi-eye me-1"></i>{{ user.id }}
                      </a>
                    </td>
                    <td>
                      {{ user.username }}
                      <span class="text-muted">({{ user.organization_name || 'N/A' }})</span>
                    </td>
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
          <div v-if="store.currentView === 'catalogues'" class="card">
            <div class="card-header bg-info">
              <h5 class="mb-0"><i class="bi bi-book-fill me-2"></i>Détail des catalogues</h5>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="thead-admin-site">
                  <tr>
                    <th style="cursor: pointer" @click="store.sortBy('catalogue_id')">
                      Action <i :class="'bi ms-1 ' + getSortIcon('catalogue_id')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('originalname_id')">
                      Nom du catalogue <i :class="'bi ms-1 ' + getSortIcon('originalname_id')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('expiration_date')">
                      Date d'expiration <i :class="'bi ms-1 ' + getSortIcon('expiration_date')"></i>
                    </th>
                    <th style="cursor: pointer" @click="store.sortBy('nombre_commandes')">
                      Commandes <i :class="'bi ms-1 ' + getSortIcon('nombre_commandes')"></i>
                    </th>
                    <th style="cursor: pointer" class="text-end" @click="store.sortBy('montant_total')">
                      Montant total <i :class="'bi ms-1 ' + getSortIcon('montant_total')"></i>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="store.sortedDetails.length === 0">
                    <td colspan="5" class="text-center text-muted py-4">Aucun catalogue</td>
                  </tr>
                  <tr v-for="cat in store.sortedDetails" :key="cat.catalogue_id">
                    <td>
                      <a
                        :href="'/admin/catalogues/' + cat.catalogue_id + '/synthese-detaillee/vue'"
                        class="btn btn-outline-primary btn-sm"
                      >
                        <i class="bi bi-eye me-1"></i>{{ cat.catalogue_id }}
                      </a>
                    </td>
                    <td>
                      {{ cat.originalname_id }}
                      <span class="text-muted">({{ cat.organization_name || 'N/A' }})</span>
                    </td>
                    <td>{{ formatDate(cat.expiration_date) }}</td>
                    <td>
                      <span class="badge bg-primary">{{ cat.nombre_commandes }}</span>
                    </td>
                    <td class="text-end">
                      <strong>{{ formatMontant(cat.montant_total) }} €</strong>
                    </td>
                  </tr>
                </tbody>
                <tfoot v-if="store.currentView === 'catalogues' && store.sortedDetails.length > 0" class="table-light">
                  <tr>
                    <td colspan="3" class="text-end fw-bold">Total</td>
                    <td>
                      <span class="badge bg-primary">{{ cataloguesTotalCommandes }}</span>
                    </td>
                    <td class="text-end">
                      <strong>{{ formatMontant(cataloguesTotalMontant) }} €</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Périodes Table -->
          <div v-if="store.currentView === 'periodes'" class="card">
            <div class="card-header bg-success text-white">
              <h5 class="mb-0"><i class="bi bi-calendar-week me-2"></i>Commandes par semaine et par mois</h5>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="thead-admin-site">
                  <tr>
                    <th>Type</th>
                    <th>Période</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Commandes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="periodesGroupedByMonth.length === 0">
                    <td colspan="5" class="text-center text-muted py-4">Aucune données</td>
                  </tr>
                  <tr
                    v-for="periode in periodesGroupedByMonth"
                    :key="periode.periode_type + '-' + periode.periode_label + (periode.date_debut || '')"
                    :class="{
                      'table-primary': periode.periode_type === 'mois',
                      'periodes-week-row': periode.periode_type === 'semaine',
                    }"
                  >
                    <td :class="{ 'periodes-semaine-cell': periode.periode_type === 'semaine' }">
                      <span v-if="periode.periode_type === 'mois'" class="me-2" title="Mois">
                        <i class="bi bi-calendar3 text-secondary"></i>
                      </span>
                      <span v-else class="periodes-week-branch me-2" title="Semaine du mois">
                        <i class="bi bi-arrow-return-right text-info"></i>
                      </span>
                      <span
                        class="badge"
                        :class="periode.periode_type === 'mois' ? 'bg-secondary' : 'bg-info'"
                      >
                        {{ periode.periode_type === 'mois' ? 'Mois' : 'Semaine' }}
                      </span>
                    </td>
                    <td :class="{ 'periodes-semaine-cell': periode.periode_type === 'semaine' }">
                      {{ formatPeriodeLabel(periode.periode_type, periode.periode_label) }}
                    </td>
                    <td>{{ formatDate(periode.date_debut) }}</td>
                    <td>{{ formatDate(periode.date_fin) }}</td>
                    <td>
                      <span
                        class="badge"
                        :class="periode.periode_type === 'mois' ? 'bg-primary' : 'bg-light text-dark'"
                      >
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
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useAdminStatsStore } from '@/stores/adminStats';

const store = useAdminStatsStore();

const detailTitle = computed(() => {
  const titles = {
    commandes: 'Commandes validées',
    utilisateurs: 'Utilisateurs inscrits',
    catalogues: 'Catalogues',
    periodes: 'Commandes par période',
  };
  return titles[store.currentView] || '';
});

const cataloguesTotalCommandes = computed(() => {
  if (store.currentView !== 'catalogues') return 0;
  return store.sortedDetails.reduce((sum, cat) => sum + (Number(cat.nombre_commandes) || 0), 0);
});

const cataloguesTotalMontant = computed(() => {
  if (store.currentView !== 'catalogues') return 0;
  return store.sortedDetails.reduce((sum, cat) => sum + (parseFloat(cat.montant_total) || 0), 0);
});

/** Périodes ordonnées : chaque mois suivi de ses semaines (semaines dont date_debut est dans le mois). */
const periodesGroupedByMonth = computed(() => {
  if (store.currentView !== 'periodes' || !store.sortedDetails.length) return [];
  const periodes = store.sortedDetails;
  const months = periodes
    .filter((p) => p.periode_type === 'mois')
    .sort((a, b) => (b.periode_label || '').localeCompare(a.periode_label || ''));
  const weeks = periodes.filter((p) => p.periode_type === 'semaine');
  const result = [];
  for (const month of months) {
    result.push(month);
    const monthKey = month.periode_label; // 'YYYY-MM'
    const monthWeeks = weeks.filter((w) => {
      const d = w.date_debut;
      if (!d) return false;
      const str = typeof d === 'string' ? d : (d.toISOString ? d.toISOString().slice(0, 7) : String(d).slice(0, 7));
      return str.slice(0, 7) === monthKey;
    });
    monthWeeks.sort((a, b) => (b.periode_label || '').localeCompare(a.periode_label || ''));
    result.push(...monthWeeks);
  }
  return result;
});

onMounted(() => {
  store.loadStats();
});

function getSortIcon(column) {
  if (store.sortColumn !== column) return '';
  return store.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('fr-FR');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('fr-FR');
}

function formatMontant(value) {
  if (!value) return '0,00';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '0,00';
  return num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getRoleBadge(role) {
  const badges = {
    SuperAdmin: 'bg-dark',
    admin: 'bg-danger',
    referent: 'bg-warning text-dark',
    utilisateur: 'bg-primary',
    epicier: 'bg-info text-dark',
  };
  return badges[role] || 'bg-secondary';
}

function formatPeriodeLabel(type, label) {
  if (type === 'mois') {
    const [year, month] = label.split('-');
    const date = new Date(year, parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  if (type === 'semaine') {
    const parts = label.split('-');
    return `Semaine ${parts[1]} · ${parts[0]}`;
  }
  return label;
}
</script>

<style scoped>
.stat-card {
  transition: transform 0.15s, box-shadow 0.15s;
  border: none;
  border-radius: 1rem;
}

.stat-card:hover {
  transform: translateY(-8px) scale(1.03);
  box-shadow: 0 8px 32px rgba(78, 84, 200, 0.2);
  z-index: 2;
}

.periodes-semaine-cell {
  padding-left: 2rem !important;
  border-left: 3px solid rgba(13, 110, 253, 0.35) !important;
}

.periodes-week-row {
  background-color: rgba(13, 202, 240, 0.06);
}

.periodes-week-row:hover {
  background-color: rgba(13, 202, 240, 0.12) !important;
}

.periodes-week-branch {
  display: inline-flex;
  align-items: center;
}
</style>
