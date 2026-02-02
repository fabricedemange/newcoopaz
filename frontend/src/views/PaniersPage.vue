<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <button class="btn btn-outline-secondary d-md-none mb-3" @click="history.back()">
        <i class="bi bi-arrow-left me-2"></i>Retour
      </button>

      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-cart me-2"></i>Mes paniers en cours</h2>
        <a href="/catalogues/vue" class="btn btn-primary">
          <i class="bi bi-plus-circle me-1"></i>Nouveau panier
        </a>
      </div>

      <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i><strong>Erreur :</strong> {{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement des paniers...</p>
      </div>

      <template v-else>
        <div class="card mb-3">
          <div class="card-body">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                v-model="store.searchTerm"
                type="text"
                class="form-control"
                placeholder="Rechercher par catalogue, description, note ou numéro..."
              />
            </div>
          </div>
        </div>

        <div v-if="store.sortedPaniers.length === 0" class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          <template v-if="store.searchTerm">Aucun panier ne correspond à votre recherche.</template>
          <template v-else>
            Aucun panier en cours.
            <a href="/catalogues/vue" class="alert-link">Commencer un nouveau panier</a>
          </template>
        </div>

        <template v-else>
          <!-- Desktop: table -->
          <div class="card d-none d-md-block">
            <div class="card-body">
              <div class="table-responsive">
                <table class="table table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th style="cursor: pointer;" @click="store.sortBy('id')"># <i class="bi" :class="'bi-' + store.sortIcon('id') + ' ms-1'"></i></th>
                      <th style="cursor: pointer;" @click="store.sortBy('catalogue')">Catalogue <i class="bi" :class="'bi-' + store.sortIcon('catalogue') + ' ms-1'"></i></th>
                      <th style="cursor: pointer; text-align: center;" @click="store.sortBy('nb_articles')">Articles <i class="bi" :class="'bi-' + store.sortIcon('nb_articles') + ' ms-1'"></i></th>
                      <th style="cursor: pointer; text-align: right;" @click="store.sortBy('total')">Total <i class="bi" :class="'bi-' + store.sortIcon('total') + ' ms-1'"></i></th>
                      <th style="cursor: pointer;" @click="store.sortBy('expiration_date')">Expiration <i class="bi" :class="'bi-' + store.sortIcon('expiration_date') + ' ms-1'"></i></th>
                      <th>Statut</th>
                      <th style="width: 200px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in store.sortedPaniers" :key="p.id">
                      <td><span class="badge bg-light text-dark">#{{ p.id }}</span></td>
                      <td>
                        <strong>{{ p.catalogue_nom }}</strong>
                        <br v-if="p.catalog_description"><small v-if="p.catalog_description" class="text-muted">{{ p.catalog_description }}</small>
                        <br v-if="p.panier_note"><small v-if="p.panier_note" class="text-info"><i class="bi bi-sticky"></i> {{ p.panier_note }}</small>
                      </td>
                      <td class="text-center"><span class="badge bg-secondary">{{ p.nb_articles || 0 }}</span></td>
                      <td class="text-end"><strong>{{ formatPrice(p.total) }}</strong></td>
                      <td>
                        <div>{{ p.expiration_formatted }}</div>
                        <small class="text-muted"><i class="bi bi-truck"></i> {{ p.livraison_formatted }}</small>
                      </td>
                      <td>
                        <span class="badge" :class="badgeClass(p)">{{ badgeText(p) }}</span>
                      </td>
                      <td>
                        <div class="d-flex gap-1">
                          <a v-if="p.modifiable" :href="`/catalogues/${p.catalog_file_id}/vue`" class="btn btn-sm btn-primary" title="Éditer"><i class="bi bi-pencil"></i> Éditer</a>
                          <span v-else class="text-muted small">Catalogue expiré</span>
                          <button class="btn btn-sm btn-outline-danger ms-1" title="Supprimer" @click="confirmDelete(p.id)"><i class="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="text-muted small mt-2">
                {{ store.sortedPaniers.length }} panier(s)
                <span v-if="store.searchTerm && store.paniers.length !== store.sortedPaniers.length"> (filtré sur {{ store.paniers.length }} total)</span>
              </div>
            </div>
          </div>

          <!-- Mobile: cards -->
          <div class="d-md-none">
            <div v-for="p in store.sortedPaniers" :key="'m-' + p.id" class="card mb-2 shadow-sm">
              <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <h6 class="card-title mb-0 small">
                    <span class="badge bg-light text-dark me-1">#{{ p.id }}</span>
                    <strong>{{ p.catalogue_nom }}</strong>
                  </h6>
                  <span class="badge" :class="badgeClass(p)">{{ badgeText(p) }}</span>
                </div>
                <p v-if="p.catalog_description" class="text-muted mb-1" style="font-size: 0.75rem;">{{ p.catalog_description }}</p>
                <div v-if="p.panier_note" class="alert alert-info py-1 px-2 mb-1" style="font-size: 0.7rem;">
                  <i class="bi bi-sticky me-1"></i>{{ p.panier_note }}
                </div>
                <div class="row g-1 mb-2">
                  <div class="col-6">
                    <small class="text-muted d-block" style="font-size: 0.65rem;">Articles</small>
                    <span class="badge bg-secondary" style="font-size: 0.7rem;">{{ p.nb_articles || 0 }}</span>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block" style="font-size: 0.65rem;">Total</small>
                    <strong style="font-size: 0.85rem;">{{ formatPrice(p.total) }}</strong>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block" style="font-size: 0.65rem;">Expiration</small>
                    <div style="font-size: 0.75rem;">{{ p.expiration_formatted }}</div>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block" style="font-size: 0.65rem;">Livraison</small>
                    <div style="font-size: 0.75rem;"><i class="bi bi-truck"></i> {{ p.livraison_formatted }}</div>
                  </div>
                </div>
                <div class="d-grid gap-1">
                  <a v-if="p.modifiable" :href="`/catalogues/${p.catalog_file_id}/vue`" class="btn btn-sm btn-primary"><i class="bi bi-pencil me-1"></i>Éditer</a>
                  <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(p.id)"><i class="bi bi-trash me-1"></i>Supprimer</button>
                </div>
              </div>
            </div>
            <div class="text-muted small text-center mt-3">
              {{ store.sortedPaniers.length }} panier(s)
              <span v-if="store.searchTerm && store.paniers.length !== store.sortedPaniers.length"> (filtré sur {{ store.paniers.length }} total)</span>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { usePaniersStore } from '@/stores/paniers';
import { onMounted } from 'vue';

const store = usePaniersStore();

function formatPrice(price) {
  if (price == null) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}

function badgeClass(panier) {
  if (panier.isExpired) return 'bg-danger';
  if (panier.modifiable) return 'bg-success';
  return 'bg-secondary';
}

function badgeText(panier) {
  if (panier.isExpired) return 'Expiré';
  if (panier.modifiable) return 'Modifiable';
  return 'Non modifiable';
}

function confirmDelete(panierId) {
  if (!confirm('Confirmer la suppression de ce panier ?')) return;
  store.deletePanier(panierId, typeof window !== 'undefined' ? window.CSRF_TOKEN : '').catch((e) => {
    console.error('deletePanier:', e);
    if (typeof window !== 'undefined') alert('Erreur lors de la suppression du panier');
  });
}

onMounted(() => {
  store.loadAll();
});
</script>
