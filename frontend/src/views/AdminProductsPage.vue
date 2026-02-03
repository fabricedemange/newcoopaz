<template>
  <div class="container-fluid px-3 mt-4">
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des produits...</p>
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
          <h2 class="mb-4">Gestion des produits</h2>
          <p class="text-muted mb-4">Gérer la bibliothèque de produits réutilisables</p>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="d-flex flex-column flex-sm-row gap-2 mb-3">
            <button type="button" class="btn btn-success" @click="openNewModal">
              <i class="bi bi-plus-circle me-2"></i>Ajouter un produit
            </button>
            <button
              type="button"
              class="btn btn-outline-primary"
              @click="store.showBulkActions = !store.showBulkActions"
            >
              <i class="bi bi-list-check me-2"></i>Actions groupées
              {{ store.selectedProducts.length > 0 ? ` (${store.selectedProducts.length})` : '' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk actions panel -->
      <div v-if="store.showBulkActions" class="row mb-3">
        <div class="col-12">
          <div class="card border-primary">
            <div class="card-body">
              <div class="row align-items-end">
                <div class="col-12 mb-3">
                  <h5 class="card-title mb-0">
                    <i class="bi bi-pencil-square me-2"></i>
                    Modifier {{ store.selectedProducts.length }} produit(s) sélectionné(s)
                  </h5>
                  <small class="text-muted">Modifiez une ou plusieurs propriétés en même temps</small>
                </div>
                <div class="col-md-3 mb-3 mb-md-0">
                  <label class="form-label">Nouvelle catégorie</label>
                  <select class="form-select" v-model="store.bulkCategoryId">
                    <option value="">Ne pas modifier</option>
                    <option v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.nom }}</option>
                  </select>
                </div>
                <div class="col-md-3 mb-3 mb-md-0">
                  <label class="form-label">Nouveau fournisseur</label>
                  <select class="form-select" v-model="store.bulkSupplierId">
                    <option value="">Ne pas modifier</option>
                    <option v-for="s in store.suppliers" :key="s.id" :value="s.id">{{ s.nom }}</option>
                  </select>
                </div>
                <div class="col-md-2 mb-3 mb-md-0">
                  <label class="form-label">Unité</label>
                  <select class="form-select" v-model="store.bulkUnite">
                    <option value="">Ne pas modifier</option>
                    <option value="Pièce">Pièce</option>
                    <option value="Kilo">Kilo</option>
                    <option value="Litre">Litre</option>
                    <option value="Unite">Unité</option>
                  </select>
                </div>
                <div class="col-md-2 mb-3 mb-md-0">
                  <label class="form-label">Qté mini</label>
                  <input
                    v-model="store.bulkQuantiteMin"
                    type="number"
                    class="form-control"
                    placeholder="Ex: 0.5"
                    step="0.001"
                    min="0"
                  />
                </div>
                <div class="col-md-2">
                  <div class="d-flex gap-2">
                    <button
                      type="button"
                      class="btn btn-primary flex-fill"
                      :disabled="store.processingBulk"
                      @click="store.bulkUpdate()"
                    >
                      <span v-if="store.processingBulk" class="spinner-border spinner-border-sm me-2"></span>
                      <i v-else class="bi bi-check-lg me-2"></i>
                      Appliquer
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary"
                      :disabled="store.processingBulk"
                      @click="store.cancelBulkActions()"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="row mb-3">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0"><i class="bi bi-funnel me-2"></i>Filtres</h5>
            </div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-3">
                  <label class="form-label">Recherche</label>
                  <input
                    v-model="store.filters.search"
                    type="text"
                    class="form-control"
                    placeholder="Nom ou description..."
                  />
                </div>
                <div class="col-md-3">
                  <label class="form-label">Catégorie</label>
                  <select
                    class="form-select"
                    v-model="store.filters.categoryId"
                    :key="'cat-' + (store.filters.supplierId || 'all')"
                  >
                    <option value="">Toutes les catégories</option>
                    <option v-for="c in store.filteredCategoriesForFilters" :key="c.id" :value="String(c.id)">{{ c.nom }}</option>
                  </select>
                </div>
                <div class="col-md-2">
                  <label class="form-label">Fournisseur</label>
                  <select
                    class="form-select"
                    v-model="store.filters.supplierId"
                    :key="'sup-' + (store.filters.categoryId || 'all')"
                  >
                    <option value="">Tous les fournisseurs</option>
                    <option v-for="s in store.filteredSuppliersForFilters" :key="s.id" :value="String(s.id)">{{ s.nom }}</option>
                  </select>
                </div>
                <div class="col-md-2">
                  <label class="form-label">Label</label>
                  <input
                    v-model="store.filters.label"
                    type="text"
                    class="form-control"
                    placeholder="Bio, AOP, IGP..."
                  />
                </div>
                <div class="col-md-2">
                  <label class="form-label">Statut</label>
                  <select class="form-select" v-model="store.filters.isActive">
                    <option value="">Tous</option>
                    <option value="1">Actifs uniquement</option>
                    <option value="0">Inactifs uniquement</option>
                  </select>
                </div>
                <div class="col-md-12">
                  <button type="button" class="btn btn-outline-secondary" @click="store.resetFilters()">
                    <i class="bi bi-x-lg me-2"></i>Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- List -->
      <div class="row">
        <div class="col-12">
          <div v-if="store.filteredProducts.length === 0" class="alert alert-info text-center">
            <h4>Aucun produit trouvé</h4>
            <p>Commencez par créer votre premier produit ou modifiez les filtres.</p>
            <button type="button" class="btn btn-primary" @click="openNewModal">Créer un produit</button>
          </div>

          <div v-else>
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">
                  <i class="bi bi-box-seam me-2"></i>
                  Liste des produits ({{ store.filteredProducts.length }})
                </h5>
              </div>
              <div class="card-body">
                <!-- Desktop table -->
                <div class="table-responsive d-none d-md-block">
                  <table class="table table-hover">
                    <thead class="thead-administration">
                      <tr>
                        <th style="width: 40px">
                          <input
                            type="checkbox"
                            class="form-check-input"
                            :checked="store.selectedProducts.length === store.filteredProducts.length && store.filteredProducts.length > 0"
                            @change="store.toggleSelectAll()"
                            title="Tout sélectionner"
                          />
                        </th>
                        <th>Image</th>
                        <th style="cursor: pointer" @click="store.sortBy('nom')">
                          Produit <i :class="'bi ms-1 ' + getSortIcon('nom')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('categorie')">
                          Catégorie <i :class="'bi ms-1 ' + getSortIcon('categorie')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('fournisseur')">
                          Fournisseur <i :class="'bi ms-1 ' + getSortIcon('fournisseur')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('prix')">
                          Prix <i :class="'bi ms-1 ' + getSortIcon('prix')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('label')">
                          Label <i :class="'bi ms-1 ' + getSortIcon('label')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('nb_catalogues')">
                          Catalogues <i :class="'bi ms-1 ' + getSortIcon('nb_catalogues')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('is_active')">
                          Statut <i :class="'bi ms-1 ' + getSortIcon('is_active')"></i>
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="p in store.filteredProducts" :key="p.id">
                        <td>
                          <input
                            type="checkbox"
                            class="form-check-input"
                            :checked="store.isSelected(p.id)"
                            @change="store.toggleProductSelection(p.id)"
                          />
                        </td>
                        <td>
                          <img
                            v-if="p.image_url"
                            :src="p.image_url"
                            :alt="p.nom"
                            style="width: 50px; height: 50px; object-fit: cover"
                            class="rounded"
                          />
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td>
                          <strong>{{ p.nom }}</strong>
                          <br v-if="p.description" />
                          <small v-if="p.description" class="text-muted">{{ truncate(p.description, 60) }}</small>
                        </td>
                        <td>
                          <span
                            v-if="p.categorie"
                            class="badge"
                            :style="{ backgroundColor: p.categorie_couleur || '#6c757d' }"
                          >
                            {{ p.categorie }}
                          </span>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td>{{ p.fournisseur || '-' }}</td>
                        <td>
                          <strong v-if="p.prix && p.prix > 0">{{ parseFloat(p.prix).toFixed(2) }} €</strong>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td>
                          <small v-if="p.label">{{ p.label }}</small>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td><span class="badge bg-info">{{ p.nb_catalogues || 0 }}</span></td>
                        <td>
                          <span v-if="p.is_active" class="badge bg-success">Actif</span>
                          <span v-else class="badge bg-secondary">Inactif</span>
                        </td>
                        <td>
                          <a :href="`/admin/products/${p.id}`" class="btn btn-outline-primary btn-sm" title="Voir">
                            <i class="bi bi-eye"></i>
                          </a>
                          <a
                            :href="`/admin/products/${p.id}/edit`"
                            class="btn btn-outline-secondary btn-sm ms-1"
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
                  <div v-for="p in store.filteredProducts" :key="'m-' + p.id" class="card mb-3 shadow-sm">
                    <div class="card-body">
                      <img
                        v-if="p.image_url"
                        :src="p.image_url"
                        :alt="p.nom"
                        style="width: 100%; height: 150px; object-fit: cover; margin-bottom: 10px"
                        class="rounded"
                      />
                      <h5 class="card-title mb-2">{{ p.nom }}</h5>
                      <p v-if="p.description" class="card-text text-muted small mb-3">
                        {{ truncate(p.description, 100) }}
                      </p>
                      <div class="row g-2 mb-3">
                        <div class="col-6">
                          <small class="text-muted d-block">Catégorie</small>
                          <span
                            v-if="p.categorie"
                            class="badge"
                            :style="{ backgroundColor: p.categorie_couleur || '#6c757d' }"
                          >
                            {{ p.categorie }}
                          </span>
                          <span v-else class="text-muted">-</span>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Fournisseur</small>
                          <strong>{{ p.fournisseur || '-' }}</strong>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Prix</small>
                          <strong class="text-success">
                            {{ p.prix && p.prix > 0 ? parseFloat(p.prix).toFixed(2) + ' €' : '-' }}
                          </strong>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Label</small>
                          <strong>{{ p.label || '-' }}</strong>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Catalogues</small>
                          <span class="badge bg-info">{{ p.nb_catalogues || 0 }}</span>
                        </div>
                        <div class="col-12">
                          <small class="text-muted d-block">Statut</small>
                          <span v-if="p.is_active" class="badge bg-success">Actif</span>
                          <span v-else class="badge bg-secondary">Inactif</span>
                        </div>
                      </div>
                      <div class="d-flex gap-2">
                        <a :href="`/admin/products/${p.id}`" class="btn btn-sm btn-outline-primary flex-fill">
                          <i class="bi bi-eye me-1"></i>Voir
                        </a>
                        <a :href="`/admin/products/${p.id}/edit`" class="btn btn-sm btn-outline-secondary flex-fill">
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
      </div>
    </template>

    <!-- Modal nouveau produit : hors du v-else pour être toujours monté -->
    <Teleport to="body">
      <div
        v-show="showNewModal"
        class="modal fade"
        :class="{ show: showNewModal }"
        :aria-hidden="!showNewModal"
        tabindex="-1"
        :style="showNewModal ? { display: 'flex', visibility: 'visible' } : { display: 'none', visibility: 'hidden' }"
        @click.self="closeNewModal"
      >
        <div class="modal-backdrop fade" :class="{ show: showNewModal }" @click="closeNewModal"></div>
        <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document" @click.stop>
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Créer un nouveau produit</h5>
              <button type="button" class="btn-close" aria-label="Fermer" @click="closeNewModal"></button>
            </div>
            <div class="modal-body">
              <AdminProductFormContent
                v-if="showNewModal"
                :categories="store.categories"
                :suppliers="store.suppliers"
                :product="null"
                :product-id="null"
                :modal="true"
                :csrf-token="csrfToken"
                @success="onNewProductSuccess"
                @cancel="closeNewModal"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminProductsStore } from '@/stores/adminProducts';
import AdminProductFormContent from '@/components/AdminProductFormContent.vue';

const store = useAdminProductsStore();

// Réinitialiser le filtre fournisseur si le fournisseur sélectionné n'a pas de produit dans la catégorie choisie (et inversement)
watch(
  () => store.filters.categoryId,
  () => {
    if (
      store.filters.supplierId &&
      !store.filteredSuppliersForFilters.some((s) => String(s.id) === store.filters.supplierId)
    ) {
      store.filters.supplierId = '';
    }
  }
);
watch(
  () => store.filters.supplierId,
  () => {
    if (
      store.filters.categoryId &&
      !store.filteredCategoriesForFilters.some((c) => String(c.id) === store.filters.categoryId)
    ) {
      store.filters.categoryId = '';
    }
  }
);
const showNewModal = ref(false);

const csrfToken = computed(() => typeof window !== 'undefined' ? (window.CSRF_TOKEN || '') : '');

function openNewModal() {
  showNewModal.value = true;
}

function closeNewModal() {
  showNewModal.value = false;
}

function onNewProductSuccess() {
  closeNewModal();
  store.loadData();
}

function getSortIcon(column) {
  if (store.sortColumn !== column) return 'bi-arrow-down-up';
  return store.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
}

function truncate(text, maxLength = 60) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

onMounted(() => {
  store.loadData();
  const params = new URLSearchParams(window.location.search);
  if (params.get('modal') === 'new') {
    showNewModal.value = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('modal');
    window.history.replaceState({}, '', url.toString());
  }
});
</script>
