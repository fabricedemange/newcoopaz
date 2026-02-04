<template>
  <div class="container-fluid mt-4">
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des catalogues...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="alert alert-danger">
      {{ store.error }}
      <button type="button" class="btn btn-primary ms-2" @click="store.loadData()">Réessayer</button>
    </div>

    <!-- Content -->
    <template v-else>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <h2>Gestion des catalogues</h2>
        <div class="d-flex gap-2 align-items-center">
          <BackButton />
          <a href="/admin/catalogues/new" class="btn btn-success">
            <i class="bi bi-plus-circle me-1"></i>Nouveau catalogue
          </a>
          <button
            v-if="store.referentScopeActive"
            type="button"
            class="btn btn-outline-primary"
            @click="toggleScope"
          >
            {{ store.showAllScope ? 'Voir mes catalogues uniquement' : 'Voir tous les catalogues' }}
          </button>
        </div>
      </div>

      <!-- Catalogues actifs -->
      <div class="card mb-4">
        <div class="card-header">
          <h5 class="mb-0">Catalogues actifs</h5>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <input
              v-model="store.searchActive"
              type="text"
              class="form-control"
              placeholder="Rechercher (nom, référent, org...)"
            />
          </div>
          <div v-if="store.activeCataloguesSorted.length === 0" class="alert alert-info">
            Aucun catalogue actif
          </div>
          <div v-else class="table-responsive d-none d-lg-block">
            <table class="table table-hover">
              <thead class="thead-administration">
                <tr>
                  <th style="cursor: pointer" @click="store.handleSort('id', false)">ID</th>
                  <th v-if="store.isSuperAdmin">Org</th>
                  <th style="cursor: pointer" @click="store.handleSort('originalname', false)">Catalogue</th>
                  <th style="cursor: pointer" @click="store.handleSort('username', false)">Référent</th>
                  <th style="cursor: pointer" @click="store.handleSort('expiration_date', false)">Expiration</th>
                  <th style="cursor: pointer" @click="store.handleSort('nb_paniers', false)">Commandes</th>
                  <th>Visibilité</th>
                  <th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in store.activeCataloguesSorted" :key="c.id">
                  <td><strong>{{ c.id }}</strong></td>
                  <td v-if="store.isSuperAdmin"><small class="text-muted">{{ c.organization_name || '-' }}</small></td>
                  <td>
                    <div>{{ c.originalname }}</div>
                    <small v-if="c.description" class="text-muted">{{ truncate(c.description, 80) }}</small>
                  </td>
                  <td>{{ c.username }}</td>
                  <td :class="c.isExpired ? 'text-danger fw-bold' : ''">
                    {{ c.expiration_formatted || '-' }}
                    <br v-if="c.expiration_day" /><small v-if="c.expiration_day">{{ c.expiration_day }}</small>
                  </td>
                  <td><span class="badge bg-primary">{{ c.nb_paniers || 0 }}</span></td>
                  <td>
                    <span :class="'badge ' + store.getVisibilityBadge(c.is_archived).class">
                      {{ store.getVisibilityBadge(c.is_archived).label }}
                    </span>
                  </td>
                  <td class="text-end">
                    <a :href="`/admin/catalogues/${c.id}/edit`" class="btn btn-sm btn-outline-primary me-1">Modifier</a>
                    <a :href="`/admin/catalogues/${c.id}/synthese/vue`" class="btn btn-sm btn-outline-info me-1">Synthèse</a>
                    <a :href="`/admin/catalogues/${c.id}/synthese-detaillee/vue`" class="btn btn-sm btn-outline-success me-1">Détail</a>
                    <div class="btn-group btn-group-sm d-inline">
                      <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">Actions</button>
                      <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="#" @click.prevent="store.changeVisibility(c.id, 0)">Visible de tous</a></li>
                        <li><a class="dropdown-item" href="#" @click.prevent="store.changeVisibility(c.id, 2)">Référents seulement</a></li>
                        <li><hr class="dropdown-divider" /></li>
                        <li><a class="dropdown-item" href="#" @click.prevent="store.sendAlerteMail(c.id)">Notifier dispo</a></li>
                        <li><a class="dropdown-item" href="#" @click.prevent="store.sendRappelMail(c.id)">Rappel commande</a></li>
                        <li><hr class="dropdown-divider" /></li>
                        <li><a class="dropdown-item text-warning" href="#" @click.prevent="store.archiveCatalogue(c.id)">Archiver</a></li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="d-lg-none">
            <div v-for="c in store.activeCataloguesSorted" :key="'a-' + c.id" class="card mb-3 shadow-sm">
              <div class="card-body">
                <h6 class="card-title">#{{ c.id }} - {{ c.originalname }}</h6>
                <p class="text-muted small mb-2">{{ c.username }} · {{ c.nb_paniers || 0 }} commandes</p>
                <p :class="c.isExpired ? 'text-danger' : ''">{{ c.expiration_formatted || '-' }}</p>
                <div class="d-flex gap-2 flex-wrap">
                  <a :href="`/admin/catalogues/${c.id}/edit`" class="btn btn-sm btn-primary">Modifier</a>
                  <a :href="`/admin/catalogues/${c.id}/synthese/vue`" class="btn btn-sm btn-info">Synthèse</a>
                  <a :href="`/admin/catalogues/${c.id}/synthese-detaillee/vue`" class="btn btn-sm btn-success">Détail</a>
                  <button type="button" class="btn btn-sm btn-warning" @click="store.archiveCatalogue(c.id)">Archiver</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Catalogues archivés -->
      <div class="card">
        <div class="card-header">
          <h5 class="mb-0">Catalogues archivés</h5>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <input
              v-model="store.searchArchived"
              type="text"
              class="form-control"
              placeholder="Rechercher..."
            />
          </div>
          <div v-if="store.archivedCataloguesSorted.length === 0" class="alert alert-info">
            Aucun catalogue archivé
          </div>
          <div v-else class="table-responsive d-none d-lg-block">
            <table class="table table-hover">
              <thead class="thead-administration">
                <tr>
                  <th style="cursor: pointer" @click="store.handleSort('id', true)">ID</th>
                  <th v-if="store.isSuperAdmin">Org</th>
                  <th style="cursor: pointer" @click="store.handleSort('originalname', true)">Catalogue</th>
                  <th>Référent</th>
                  <th>Expiration</th>
                  <th>Commandes</th>
                  <th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in store.archivedCataloguesSorted" :key="c.id">
                  <td><strong>{{ c.id }}</strong></td>
                  <td v-if="store.isSuperAdmin"><small class="text-muted">{{ c.organization_name || '-' }}</small></td>
                  <td>{{ c.originalname }}</td>
                  <td>{{ c.username }}</td>
                  <td>{{ c.expiration_formatted || '-' }}</td>
                  <td><span class="badge bg-primary">{{ c.nb_paniers || 0 }}</span></td>
                  <td class="text-end">
                    <a :href="`/admin/catalogues/${c.id}/synthese/vue`" class="btn btn-sm btn-outline-info me-1">Synthèse</a>
                    <a :href="`/admin/catalogues/${c.id}/synthese-detaillee/vue`" class="btn btn-sm btn-outline-success me-1">Détail</a>
                    <button type="button" class="btn btn-sm btn-outline-warning me-1" @click="store.unarchiveCatalogue(c.id)">Désarchiver</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" @click="store.deleteCatalogue(c.id)">Masquer</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="d-lg-none">
            <div v-for="c in store.archivedCataloguesSorted" :key="'ar-' + c.id" class="card mb-3 shadow-sm">
              <div class="card-body">
                <h6 class="card-title">#{{ c.id }} - {{ c.originalname }}</h6>
                <p class="text-muted small mb-2">{{ c.username }} · {{ c.nb_paniers || 0 }} commandes</p>
                <div class="d-flex gap-2 flex-wrap">
                  <a :href="`/admin/catalogues/${c.id}/synthese/vue`" class="btn btn-sm btn-info">Synthèse</a>
                  <a :href="`/admin/catalogues/${c.id}/synthese-detaillee/vue`" class="btn btn-sm btn-success">Détail</a>
                  <button type="button" class="btn btn-sm btn-warning" @click="store.unarchiveCatalogue(c.id)">Désarchiver</button>
                  <button type="button" class="btn btn-sm btn-danger" @click="store.deleteCatalogue(c.id)">Masquer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { useAdminCataloguesStore } from '@/stores/adminCatalogues';

const store = useAdminCataloguesStore();

function truncate(text, maxLength = 200) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function toggleScope() {
  const newScope = store.showAllScope ? 'referent' : 'all';
  window.location.href = `/admin/catalogues/vue?scope=${newScope}`;
}

onMounted(() => {
  store.loadData();
});
</script>
