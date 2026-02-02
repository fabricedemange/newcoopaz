<template>
  <div class="container-fluid px-3 mt-4">
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des catégories...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="alert alert-danger">
      <h4 class="alert-heading"><i class="bi bi-exclamation-triangle me-2"></i>Erreur</h4>
      <p class="mb-0">{{ store.error }}</p>
      <button type="button" class="btn btn-primary mt-2" @click="store.loadData()">
        <i class="bi bi-arrow-clockwise me-2"></i>Réessayer
      </button>
    </div>

    <!-- Content -->
    <template v-else>
      <div class="row">
        <div class="col-12">
          <h2 class="mb-4">Gestion des catégories</h2>
          <p class="text-muted mb-4">Organiser les produits par catégories et sous-catégories</p>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="d-flex flex-column flex-sm-row gap-2 mb-3">
            <a href="/admin/categories/new" class="btn btn-success">
              <i class="bi bi-plus-circle me-2"></i>Ajouter une catégorie
            </a>
            <button type="button" class="btn btn-outline-warning" @click="store.openMergeModal()">
              <i class="bi bi-union me-2"></i>Fusionner des catégories
            </button>
          </div>
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-12 col-md-6">
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              v-model="store.searchTerm"
              type="text"
              class="form-control"
              placeholder="Rechercher une catégorie..."
            />
            <button
              v-if="store.searchTerm"
              type="button"
              class="btn btn-outline-secondary"
              @click="store.searchTerm = ''"
            >
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div v-if="store.sortedCategories.length === 0" class="alert alert-info text-center">
            <h4>Aucune catégorie trouvée</h4>
            <p>
              {{
                store.searchTerm
                  ? 'Modifiez votre recherche ou créez une nouvelle catégorie.'
                  : 'Commencez par créer votre première catégorie.'
              }}
            </p>
            <a href="/admin/categories/new" class="btn btn-primary">Créer une catégorie</a>
          </div>

          <div v-else>
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">
                  <i class="bi bi-tags me-2"></i>
                  Liste des catégories ({{ store.sortedCategories.length }})
                </h5>
              </div>
              <div class="card-body">
                <!-- Desktop table -->
                <div class="table-responsive d-none d-md-block">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th style="cursor: pointer" @click="store.sortBy('nom')">
                          Catégorie <i :class="'bi ms-1 ' + getSortIcon('nom')"></i>
                        </th>
                        <th>Icône</th>
                        <th style="cursor: pointer" @click="store.sortBy('parent_nom')">
                          Parent <i :class="'bi ms-1 ' + getSortIcon('parent_nom')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('ordre')">
                          Ordre <i :class="'bi ms-1 ' + getSortIcon('ordre')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('nb_products')">
                          Produits <i :class="'bi ms-1 ' + getSortIcon('nb_products')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('is_active')">
                          Statut <i :class="'bi ms-1 ' + getSortIcon('is_active')"></i>
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="cat in store.sortedCategories" :key="cat.id">
                        <td>
                          <span class="badge" :style="{ backgroundColor: cat.couleur || '#6c757d' }">
                            {{ cat.nom }}
                          </span>
                        </td>
                        <td>
                          <template v-if="cat.icon">
                            <i :class="cat.icon"></i>
                            <small class="text-muted">{{ cat.icon }}</small>
                          </template>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td>
                          <span v-if="cat.parent_nom" class="badge bg-secondary">{{ cat.parent_nom }}</span>
                          <span v-else class="badge bg-primary">Principale</span>
                        </td>
                        <td>{{ cat.ordre || 0 }}</td>
                        <td>
                          <span class="badge bg-info">{{ cat.nb_products || 0 }} produit(s)</span>
                        </td>
                        <td>
                          <span v-if="cat.is_active" class="badge bg-success">Active</span>
                          <span v-else class="badge bg-secondary">Inactive</span>
                        </td>
                        <td>
                          <a
                            :href="`/admin/categories/${cat.id}/edit`"
                            class="btn btn-outline-secondary btn-sm"
                            title="Modifier"
                          >
                            <i class="bi bi-pencil"></i>
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Mobile cards -->
                <div class="d-md-none">
                  <div
                    v-for="cat in store.sortedCategories"
                    :key="'m-' + cat.id"
                    class="card mb-3 shadow-sm"
                  >
                    <div class="card-body">
                      <h5 class="card-title mb-3">
                        <span class="badge" :style="{ backgroundColor: cat.couleur || '#6c757d' }">
                          {{ cat.nom }}
                        </span>
                      </h5>
                      <div class="row g-2 mb-3">
                        <div class="col-6">
                          <small class="text-muted d-block">Icône</small>
                          <template v-if="cat.icon"><i :class="cat.icon"></i> <small>{{ cat.icon }}</small></template>
                          <span v-else class="text-muted">-</span>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Parent</small>
                          <span v-if="cat.parent_nom" class="badge bg-secondary">{{ cat.parent_nom }}</span>
                          <span v-else class="badge bg-primary">Principale</span>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Ordre</small>
                          <strong>{{ cat.ordre || 0 }}</strong>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Produits</small>
                          <span class="badge bg-info">{{ cat.nb_products || 0 }}</span>
                        </div>
                        <div class="col-12">
                          <small class="text-muted d-block">Statut</small>
                          <span v-if="cat.is_active" class="badge bg-success">Active</span>
                          <span v-else class="badge bg-secondary">Inactive</span>
                        </div>
                      </div>
                      <a :href="`/admin/categories/${cat.id}/edit`" class="btn btn-sm btn-outline-secondary w-100">
                        <i class="bi bi-pencil me-1"></i>Modifier
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Fusion -->
    <div
      v-if="store.showMergeModal"
      class="modal show d-block"
      tabindex="-1"
      style="background-color: rgba(0,0,0,0.5)"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-union me-2"></i>Fusionner des catégories</h5>
            <button type="button" class="btn-close" @click="store.closeMergeModal()"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Attention :</strong> Cette action est irréversible. Tous les produits et sous-catégories de la
              catégorie source seront transférés vers la cible, puis la source sera supprimée.
            </div>
            <div class="mb-3">
              <label for="merge-source" class="form-label">Catégorie à fusionner (source) :</label>
              <select id="merge-source" class="form-select" v-model="store.mergeSourceId">
                <option value="">-- Sélectionner --</option>
                <option
                  v-for="c in store.categoriesAlpha"
                  :key="'s-' + c.id"
                  :value="c.id"
                >
                  {{ c.nom }} ({{ c.nb_products || 0 }} produits)
                </option>
              </select>
            </div>
            <div class="mb-3">
              <label for="merge-target" class="form-label">Catégorie de destination (cible) :</label>
              <select id="merge-target" class="form-select" v-model="store.mergeTargetId">
                <option value="">-- Sélectionner --</option>
                <option
                  v-for="c in store.categoriesAlpha"
                  :key="'t-' + c.id"
                  :value="c.id"
                >
                  {{ c.nom }} ({{ c.nb_products || 0 }} produits)
                </option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.closeMergeModal()">Annuler</button>
            <button
              type="button"
              class="btn btn-warning"
              :disabled="store.merging"
              @click="store.mergeCategories()"
            >
              <span v-if="store.merging" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-union me-2"></i>
              {{ store.merging ? 'Fusion en cours...' : 'Fusionner' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAdminCategoriesStore } from '@/stores/adminCategories';

const store = useAdminCategoriesStore();

function getSortIcon(column) {
  if (store.sortColumn !== column) return 'bi-arrow-down-up';
  return store.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
}

onMounted(() => {
  store.loadData();
});
</script>

<style scoped>
.modal.show.d-block {
  z-index: 9999;
}
</style>
