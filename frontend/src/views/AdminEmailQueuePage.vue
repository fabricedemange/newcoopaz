<template>
  <div class="container-fluid mt-4">
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3 text-muted">Chargement de la file d'attente...</p>
    </div>
    <div v-else-if="store.error" class="alert alert-danger">{{ store.error }}</div>
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0"><i class="bi bi-envelope-paper me-2"></i>File d'attente email</h2>
        <div class="d-flex gap-2">
          <BackButton />
          <button @click="store.loadEmailQueue()" class="btn btn-outline-primary">
          <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
        </button>
        </div>
      </div>
      <div class="row g-3 mb-4">
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="text-muted mb-1">Notifications</h6>
                  <h3 class="mb-0">{{ store.stats.notifications.total }}</h3>
                </div>
                <i class="bi bi-bell text-primary" style="font-size: 2rem"></i>
              </div>
              <small class="text-success">{{ store.stats.notifications.sent }} envoyées</small>
              <span class="text-muted mx-1">·</span>
              <small class="text-warning">{{ store.stats.notifications.pending }} en attente</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="text-muted mb-1">Emails individuels</h6>
                  <h3 class="mb-0">{{ store.stats.individual.total }}</h3>
                </div>
                <i class="bi bi-envelope text-info" style="font-size: 2rem"></i>
              </div>
              <small class="text-success">{{ store.stats.individual.sent }} envoyés</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="text-muted mb-1">En attente</h6>
                  <h3 class="mb-0">{{ store.stats.individual.pending }}</h3>
                </div>
                <i class="bi bi-hourglass-split text-warning" style="font-size: 2rem"></i>
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
                  <h3 class="mb-0">{{ store.stats.individual.failed }}</h3>
                </div>
                <i class="bi bi-exclamation-triangle text-danger" style="font-size: 2rem"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item">
          <a class="nav-link" :class="{ active: store.currentTab === 'notifications' }" href="javascript:void(0)" @click.prevent="store.currentTab = 'notifications'">
            <i class="bi bi-bell me-1"></i>Notifications groupées ({{ store.stats.notifications.total }})
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" :class="{ active: store.currentTab === 'individual' }" href="javascript:void(0)" @click.prevent="store.currentTab = 'individual'">
            <i class="bi bi-envelope me-1"></i>Emails individuels ({{ store.stats.individual.total }})
          </a>
        </li>
      </ul>
      <div class="row g-3 mb-4">
        <div class="col-md-8">
          <input
            v-model="store.searchQuery"
            type="text"
            class="form-control"
            placeholder="Rechercher par sujet, destinataire ou expéditeur..."
          />
        </div>
        <div v-if="store.currentTab === 'individual'" class="col-md-4">
          <select v-model="store.statusFilter" class="form-select">
            <option value="all">Tous les statuts</option>
            <option value="sent">Envoyés</option>
            <option value="pending">En attente</option>
            <option value="failed">Échecs</option>
          </select>
        </div>
      </div>
      <div v-if="store.currentTab === 'notifications'" class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="thead-admin-site">
              <tr>
                <th style="width: 45%">Sujet</th>
                <th style="width: 20%">Initié par</th>
                <th class="text-center">Envoyés</th>
                <th class="text-center">En attente</th>
                <th class="text-center">Total</th>
                <th style="width: 15%">Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="store.filteredSummary.length === 0">
                <td colspan="6" class="text-center text-muted py-4">Aucune notification trouvée</td>
              </tr>
              <tr v-for="item in store.filteredSummary" :key="item.subject">
                <td>{{ store.truncate(item.subject, 80) }}</td>
                <td>{{ item.initiated_by_display }}</td>
                <td class="text-center"><span class="badge bg-success">{{ item.sent_count }}</span></td>
                <td class="text-center"><span class="badge bg-warning text-dark">{{ item.pending_count }}</span></td>
                <td class="text-center"><strong>{{ item.total_count }}</strong></td>
                <td><small class="text-muted">{{ store.formatDate(item.last_activity) }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="store.currentTab === 'individual'" class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="thead-admin-site">
              <tr>
                <th style="width: 60px">ID</th>
                <th>Statut</th>
                <th style="width: 30%">Sujet</th>
                <th style="width: 20%">Destinataires</th>
                <th>Tentatives</th>
                <th>Dernière MAJ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="store.filteredEntries.length === 0">
                <td colspan="6" class="text-center text-muted py-4">Aucun email trouvé</td>
              </tr>
              <tr v-for="entry in store.filteredEntries" :key="entry.id">
                <td>{{ entry.id }}</td>
                <td>
                  <span :class="['badge', store.getStatusBadgeClass(entry.status)]">{{ store.getStatusLabel(entry.status) }}</span>
                </td>
                <td>
                  <div>{{ store.truncate(entry.subject, 50) }}</div>
                  <small v-if="entry.last_error" class="text-danger">{{ store.truncate(entry.last_error, 60) }}</small>
                </td>
                <td><small class="text-muted">{{ store.truncate(entry.to_display, 40) }}</small></td>
                <td class="text-center">
                  <span v-if="entry.attempt_count > 0" :class="['badge', entry.attempt_count > 1 ? 'bg-warning text-dark' : 'bg-secondary']">{{ entry.attempt_count }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td><small class="text-muted">{{ store.formatDate(entry.updated_at_formatted) }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-3 text-muted text-center">
        <small>Limite: {{ store.limit }} emails · Les notifications de catalogues et commandes sont groupées</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { useAdminEmailQueueStore } from '@/stores/adminEmailQueue';

const store = useAdminEmailQueueStore();

onMounted(() => {
  store.loadEmailQueue();
});
</script>
