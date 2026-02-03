<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <button class="btn btn-outline-precommandes d-md-none mb-3" @click="history.back()">
        <i class="bi bi-arrow-left me-2"></i>Retour
      </button>

      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="text-precommandes"><i class="bi bi-book me-2"></i>Catalogues disponibles</h2>
      </div>

      <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i><strong>Erreur :</strong> {{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-precommandes" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement des catalogues...</p>
      </div>

      <template v-else>
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                v-model="store.searchTerm"
                type="text"
                class="form-control"
                placeholder="Rechercher par nom, description ou auteur..."
              />
            </div>
          </div>
        </div>

        <div v-if="store.sortedCatalogues.length === 0" class="text-center py-5">
          <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
          <p class="text-muted">Aucun catalogue trouvé</p>
        </div>

        <template v-else>
          <!-- Desktop: table -->
          <div class="card border-0 shadow-sm d-none d-md-block">
            <div class="card-header card-header-precommandes">
              <h5 class="mb-0"><i class="bi bi-journal-text me-2"></i>Liste des catalogues</h5>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover mb-0 catalogues-table">
                  <thead class="thead-precommandes">
                    <tr>
                      <th
                        class="sortable text-nowrap catalogue-col-id"
                        style="cursor: pointer; user-select: none;"
                        role="button"
                        tabindex="0"
                        @click.prevent="sortByColumn('id')"
                        @keydown.enter.prevent="sortByColumn('id')"
                        @keydown.space.prevent="sortByColumn('id')"
                      >
                        ID <i class="bi" :class="'bi-' + store.sortIcon('id') + ' ms-1'"></i>
                      </th>
                      <th class="sortable" style="width: 28%; cursor: pointer;" @click="store.sortBy('originalname')">
                        Nom du catalogue <i class="bi" :class="'bi-' + store.sortIcon('originalname') + ' ms-1'"></i>
                      </th>
                      <th class="sortable" style="width: 15%; cursor: pointer;" @click="store.sortBy('expiration_date')">
                        Expiration <i class="bi" :class="'bi-' + store.sortIcon('expiration_date') + ' ms-1'"></i>
                      </th>
                      <th class="sortable" style="width: 15%; cursor: pointer;" @click="store.sortBy('date_livraison')">
                        Livraison <i class="bi" :class="'bi-' + store.sortIcon('date_livraison') + ' ms-1'"></i>
                      </th>
                      <th class="sortable" style="width: 15%; cursor: pointer;" @click="store.sortBy('username')">
                        Publié par <i class="bi" :class="'bi-' + store.sortIcon('username') + ' ms-1'"></i>
                      </th>
                      <th class="text-center" style="width: 10%;">Statut</th>
                      <th class="text-end" style="width: 15%;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in store.sortedCatalogues" :key="c.id">
                      <td class="text-muted catalogue-col-id"><strong>{{ c.id }}</strong></td>
                      <td>
                        <div class="d-flex align-items-center">
                          <span v-if="c.image_filename" class="catalogue-thumbnail me-2">
                            <img :src="`/uploads/catalogue-images/${c.image_filename}`" alt="Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                          </span>
                          <div>
                            <strong>{{ c.originalname }}</strong>
                            <br v-if="c.description"><small v-if="c.description" class="text-muted">{{ c.description }}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {{ c.expiration_formatted || '-' }}
                        <br v-if="daysRemaining(c.expiration_date) >= 0">
                        <span v-if="daysRemaining(c.expiration_date) >= 0" class="badge" :class="badgeClass(daysRemaining(c.expiration_date))">{{ badgeText(daysRemaining(c.expiration_date)) }}</span>
                      </td>
                      <td>{{ c.livraison_formatted || '-' }}</td>
                      <td>
                        <i class="bi bi-person-circle me-1"></i>{{ c.username }}
                        <br><small class="text-muted">{{ c.upload_formatted || '-' }}</small>
                      </td>
                      <td class="text-center">
                        <span v-if="c.nb_paniers_non_submis > 0" class="badge bg-warning text-dark me-1" title="Paniers en cours">
                          <i class="bi bi-cart3"></i> {{ c.nb_paniers_non_submis }}
                        </span>
                        <span v-if="c.nb_paniers_submis > 0" class="badge bg-success" title="Commandes validées">
                          <i class="bi bi-check-circle"></i> {{ c.nb_paniers_submis }}
                        </span>
                        <span v-if="!c.nb_paniers_non_submis && !c.nb_paniers_submis" class="text-muted">-</span>
                      </td>
                      <td class="text-end">
                        <a v-if="daysRemaining(c.expiration_date) >= 0" :href="`/catalogues/${c.id}/vue?nouveau=1`" class="btn btn-sm btn-precommandes">
                          <i class="bi bi-cart-plus me-1"></i>Faire un panier
                        </a>
                        <span v-else class="badge bg-secondary">Expiré</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Mobile: cards -->
          <div class="d-md-none">
            <div v-for="c in store.sortedCatalogues" :key="'m-' + c.id" class="card mb-3 shadow-sm">
              <div class="card-body">
                <div class="d-flex mb-3" :class="{ 'gap-3': c.image_filename }">
                  <div v-if="c.image_filename" class="flex-shrink-0">
                    <img :src="`/uploads/catalogue-images/${c.image_filename}`" alt="Photo" style="width: 66px; height: 66px; object-fit: cover; border-radius: 4px;">
                  </div>
                  <div class="flex-grow-1">
                    <h5 class="card-title mb-2">{{ c.originalname }}</h5>
                    <small class="text-muted">ID : {{ c.id }}</small>
                    <p v-if="c.description" class="card-text text-muted small mb-0 mt-1">{{ c.description }}</p>
                  </div>
                </div>
                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <small class="text-muted d-block">Expiration</small>
                    <strong>{{ c.expiration_formatted || '-' }}</strong>
                    <div v-if="daysRemaining(c.expiration_date) >= 0">
                      <span class="badge mt-1" :class="badgeClass(daysRemaining(c.expiration_date))">{{ badgeText(daysRemaining(c.expiration_date)) }}</span>
                    </div>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block">Livraison</small>
                    <strong>{{ c.livraison_formatted || '-' }}</strong>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block">Publié par</small>
                    <strong>{{ c.username }}</strong>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block">Statut</small>
                    <span v-if="c.nb_paniers_non_submis > 0" class="badge bg-warning text-dark me-1"><i class="bi bi-cart3"></i> {{ c.nb_paniers_non_submis }}</span>
                    <span v-if="c.nb_paniers_submis > 0" class="badge bg-success"><i class="bi bi-check-circle"></i> {{ c.nb_paniers_submis }}</span>
                    <span v-if="!c.nb_paniers_non_submis && !c.nb_paniers_submis" class="text-muted">-</span>
                  </div>
                </div>
                <a v-if="daysRemaining(c.expiration_date) >= 0" :href="`/catalogues/${c.id}/vue?nouveau=1`" class="btn btn-precommandes w-100">
                  <i class="bi bi-cart-plus me-2"></i>Faire un panier
                </a>
                <div v-else class="alert alert-secondary mb-0 text-center">
                  <i class="bi bi-clock-history me-2"></i>Catalogue expiré
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 text-muted small">
            <i class="bi bi-info-circle me-1"></i>
            {{ store.sortedCatalogues.length }} catalogue(s) affiché(s)
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useCataloguesStore } from '@/stores/catalogues';
import { onMounted } from 'vue';

const store = useCataloguesStore();

function daysRemaining(expirationDate) {
  if (!expirationDate) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

function badgeClass(days) {
  if (days < 0) return 'bg-secondary';
  if (days === 0) return 'bg-danger';
  if (days === 1) return 'bg-warning text-dark';
  if (days <= 3) return 'bg-info';
  return 'bg-success';
}

function badgeText(days) {
  if (days < 0) return 'Expiré';
  if (days === 0) return "Expire aujourd'hui";
  if (days === 1) return 'Expire demain';
  return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
}

function sortByColumn(column) {
  store.sortBy(column);
}

onMounted(() => {
  store.loadAll();
});
</script>

<style scoped>
.catalogues-table .catalogue-col-id {
  min-width: 60px;
  width: 60px;
  pointer-events: auto;
}
.catalogues-table thead th.sortable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
