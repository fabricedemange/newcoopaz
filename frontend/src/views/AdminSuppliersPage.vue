<template>
  <div class="container-fluid px-3 mt-4">
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des fournisseurs...</p>
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
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h2 class="mb-0">Gestion des fournisseurs</h2>
            <BackButton />
          </div>
          <p class="text-muted mb-4">Gérer les fournisseurs de produits</p>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="d-flex flex-column flex-sm-row gap-2 mb-3">
            <button type="button" class="btn btn-success" @click="openNewModal">
              <i class="bi bi-plus-circle me-2"></i>Ajouter un fournisseur
            </button>
            <button type="button" class="btn btn-outline-warning" @click="store.openMergeModal()">
              <i class="bi bi-union me-2"></i>Fusionner des fournisseurs
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
              placeholder="Rechercher par nom, email ou ville..."
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
          <div v-if="store.sortedSuppliers.length === 0" class="alert alert-info text-center">
            <h4>Aucun fournisseur trouvé</h4>
            <p>
              {{
                store.searchTerm
                  ? 'Modifiez votre recherche ou créez un nouveau fournisseur.'
                  : 'Commencez par créer votre premier fournisseur.'
              }}
            </p>
            <button type="button" class="btn btn-primary" @click="openNewModal">Créer un fournisseur</button>
          </div>

          <div v-else>
            <div class="card">
              <div class="card-header">
                <h5 class="card-title mb-0">
                  <i class="bi bi-truck me-2"></i>
                  Liste des fournisseurs ({{ store.sortedSuppliers.length }})
                </h5>
              </div>
              <div class="card-body">
                <!-- Desktop table -->
                <div class="table-responsive d-none d-md-block">
                  <table class="table table-hover">
                    <thead class="thead-administration">
                      <tr>
                        <th style="cursor: pointer" @click="store.sortBy('nom')">
                          Nom <i :class="'bi ms-1 ' + getSortIcon('nom')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('email')">
                          Email <i :class="'bi ms-1 ' + getSortIcon('email')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('telephone')">
                          Téléphone <i :class="'bi ms-1 ' + getSortIcon('telephone')"></i>
                        </th>
                        <th style="cursor: pointer" @click="store.sortBy('ville')">
                          Ville <i :class="'bi ms-1 ' + getSortIcon('ville')"></i>
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
                      <tr v-for="s in store.sortedSuppliers" :key="s.id">
                        <td><strong>{{ s.nom }}</strong></td>
                        <td>
                          <a v-if="s.email" :href="'mailto:' + s.email">{{ s.email }}</a>
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td>{{ s.telephone || '-' }}</td>
                        <td>{{ s.ville || '-' }}</td>
                        <td>
                          <span class="badge bg-info">{{ s.nb_products || 0 }} produit(s)</span>
                        </td>
                        <td>
                          <span v-if="s.is_active" class="badge bg-success">Actif</span>
                          <span v-else class="badge bg-secondary">Inactif</span>
                        </td>
                        <td>
                          <a
                            :href="`/admin/suppliers/${s.id}`"
                            class="btn btn-outline-primary btn-sm"
                            title="Voir les détails"
                          >
                            <i class="bi bi-eye"></i>
                          </a>
                          <a
                            :href="`/admin/suppliers/${s.id}/edit`"
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
                  <div
                    v-for="s in store.sortedSuppliers"
                    :key="'m-' + s.id"
                    class="card mb-3 shadow-sm"
                  >
                    <div class="card-body">
                      <h5 class="card-title mb-3">{{ s.nom }}</h5>
                      <div class="row g-2 mb-3">
                        <div class="col-12">
                          <small class="text-muted d-block">Email</small>
                          <a v-if="s.email" :href="'mailto:' + s.email">{{ s.email }}</a>
                          <span v-else class="text-muted">-</span>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Téléphone</small>
                          <strong>{{ s.telephone || '-' }}</strong>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Ville</small>
                          <strong>{{ s.ville || '-' }}</strong>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Produits</small>
                          <span class="badge bg-info">{{ s.nb_products || 0 }}</span>
                        </div>
                        <div class="col-6">
                          <small class="text-muted d-block">Statut</small>
                          <span v-if="s.is_active" class="badge bg-success">Actif</span>
                          <span v-else class="badge bg-secondary">Inactif</span>
                        </div>
                      </div>
                      <div class="d-flex gap-2">
                        <a :href="`/admin/suppliers/${s.id}`" class="btn btn-sm btn-outline-primary flex-fill">
                          <i class="bi bi-eye me-1"></i>Voir
                        </a>
                        <a :href="`/admin/suppliers/${s.id}/edit`" class="btn btn-sm btn-outline-secondary flex-fill">
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

    <!-- Modal nouveau fournisseur : hors du v-else pour être toujours monté -->
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
              <h5 class="modal-title">Créer un nouveau fournisseur</h5>
              <button type="button" class="btn-close" aria-label="Fermer" @click="closeNewModal"></button>
            </div>
            <div class="modal-body">
              <AdminSupplierFormContent
                v-if="showNewModal"
                :supplier="null"
                :supplier-id="null"
                :modal="true"
                :csrf-token="csrfToken"
                @success="onNewSupplierSuccess"
                @cancel="closeNewModal"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>

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
            <h5 class="modal-title"><i class="bi bi-union me-2"></i>Fusionner des fournisseurs</h5>
            <button type="button" class="btn-close" @click="store.closeMergeModal()"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Attention :</strong> Cette action est irréversible. Tous les produits du fournisseur source
              seront transférés vers la cible, puis la source sera supprimée.
            </div>
            <div class="mb-3">
              <label for="merge-source" class="form-label">Fournisseur à fusionner (source) :</label>
              <select id="merge-source" class="form-select" v-model="store.mergeSourceId">
                <option value="">-- Sélectionner --</option>
                <option
                  v-for="s in store.suppliersAlpha"
                  :key="'s-' + s.id"
                  :value="s.id"
                >
                  {{ s.nom }} ({{ s.nb_products || 0 }} produits)
                </option>
              </select>
            </div>
            <div class="mb-3">
              <label for="merge-target" class="form-label">Fournisseur de destination (cible) :</label>
              <select id="merge-target" class="form-select" v-model="store.mergeTargetId">
                <option value="">-- Sélectionner --</option>
                <option
                  v-for="s in store.suppliersAlpha"
                  :key="'t-' + s.id"
                  :value="s.id"
                >
                  {{ s.nom }} ({{ s.nb_products || 0 }} produits)
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
              @click="store.mergeSuppliers()"
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
import { ref, computed, onMounted } from 'vue';
import { useAdminSuppliersStore } from '@/stores/adminSuppliers';
import BackButton from '@/components/BackButton.vue';
import AdminSupplierFormContent from '@/components/AdminSupplierFormContent.vue';

const store = useAdminSuppliersStore();
const showNewModal = ref(false);

const csrfToken = computed(() => (typeof window !== 'undefined' ? window.CSRF_TOKEN || '' : ''));

function openNewModal() {
  showNewModal.value = true;
}

function closeNewModal() {
  showNewModal.value = false;
}

function onNewSupplierSuccess() {
  closeNewModal();
  store.loadData();
}

function getSortIcon(column) {
  if (store.sortColumn !== column) return 'bi-arrow-down-up';
  return store.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
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

<style scoped>
.modal.show.d-block {
  z-index: 9999;
}
</style>
