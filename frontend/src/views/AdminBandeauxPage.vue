<template>
  <div class="container-fluid mt-4">
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3 text-muted">Chargement des bandeaux...</p>
    </div>
    <div v-else-if="store.error" class="alert alert-danger">{{ store.error }}</div>
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0"><i class="bi bi-megaphone me-2"></i>Bandeaux d'information</h2>
        <div class="d-flex gap-2">
          <BackButton />
          <button @click="store.loadBandeaux()" class="btn btn-outline-primary">
            <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
          </button>
          <button @click="store.openCreateModal()" class="btn btn-primary">
            <i class="bi bi-plus-circle me-2"></i>Nouveau bandeau
          </button>
        </div>
      </div>
      <div class="row mb-4">
        <div class="col-md-8">
          <input
            v-model="store.searchQuery"
            type="text"
            class="form-control"
            placeholder="Rechercher par message ou organisation..."
          />
        </div>
        <div class="col-md-4">
          <select v-model="store.filterType" class="form-select">
            <option value="">Tous les types</option>
            <option value="info">Info</option>
            <option value="important">Important</option>
          </select>
        </div>
      </div>
      <div v-if="store.filteredBandeaux.length === 0" class="alert alert-info">Aucun bandeau trouvé</div>
      <div v-else class="row">
        <div v-for="bandeau in store.filteredBandeaux" :key="bandeau.id" class="col-md-6 col-lg-4 mb-3">
          <div class="card h-100" :class="{ 'border-danger': store.isExpired(bandeau.expiration_date) }">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span :class="['badge', store.getTypeBadgeClass(bandeau.type)]">
                  {{ store.getTypeLabel(bandeau.type) }}
                </span>
                <span v-if="store.isExpired(bandeau.expiration_date)" class="badge bg-secondary">Expiré</span>
              </div>
              <p class="card-text">{{ store.truncate(bandeau.message, 150) }}</p>
              <div class="small text-muted mb-2">
                <div v-if="bandeau.page_cible">
                  <i class="bi bi-link-45deg me-1"></i><strong>Page:</strong> {{ bandeau.page_cible }}
                </div>
                <div v-if="bandeau.expiration_date">
                  <i class="bi bi-calendar-x me-1"></i><strong>Expire:</strong> {{ store.formatDate(bandeau.expiration_date) }}
                </div>
                <div v-if="store.isSuperAdmin && bandeau.organization_name">
                  <i class="bi bi-building me-1"></i><strong>Organisation:</strong> {{ bandeau.organization_name || '(Toutes)' }}
                </div>
              </div>
            </div>
            <div class="card-footer bg-transparent border-0">
              <div class="d-flex gap-2">
                <button @click="store.openEditModal(bandeau)" class="btn btn-sm btn-outline-primary flex-fill">
                  <i class="bi bi-pencil"></i> Modifier
                </button>
                <button @click="store.deleteBandeau(bandeau)" class="btn btn-sm btn-outline-danger">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Création/Édition -->
    <div v-if="store.showBandeauModal" class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ store.modalTitle }}</h5>
            <button type="button" class="btn-close" @click="store.closeModal()"></button>
          </div>
          <div class="modal-body">
            <div v-if="store.formErrors.general" class="alert alert-danger">{{ store.formErrors.general }}</div>
            <div class="mb-3">
              <label class="form-label">Message *</label>
              <textarea
                v-model="store.formData.message"
                class="form-control"
                :class="{ 'is-invalid': store.formErrors.message }"
                rows="3"
                placeholder="Message du bandeau..."
              ></textarea>
              <div v-if="store.formErrors.message" class="invalid-feedback">{{ store.formErrors.message }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Type *</label>
              <select v-model="store.formData.type" class="form-select" :class="{ 'is-invalid': store.formErrors.type }">
                <option value="info">Info (bleu)</option>
                <option value="important">Important (rouge)</option>
              </select>
              <div v-if="store.formErrors.type" class="invalid-feedback">{{ store.formErrors.type }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Page cible (optionnel)</label>
              <input
                v-model="store.formData.page_cible"
                type="text"
                class="form-control"
                placeholder="/chemin/vers/page (laissez vide pour toutes les pages)"
              />
              <small class="text-muted">Si vide, le bandeau sera affiché sur toutes les pages</small>
            </div>
            <div class="mb-3">
              <label class="form-label">Date d'expiration (optionnel)</label>
              <input v-model="store.formData.expiration_date" type="datetime-local" class="form-control" />
              <small class="text-muted">Si vide, le bandeau n'expirera jamais</small>
            </div>
            <div v-if="store.isSuperAdmin" class="mb-3">
              <label class="form-label">Organisation</label>
              <select v-model="store.formData.organization_id" class="form-select">
                <option value="">Toutes les organisations</option>
                <option v-for="org in store.organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.closeModal()">Annuler</button>
            <button type="button" @click="store.saveBandeau()" class="btn btn-primary">
              <i class="bi bi-check-lg me-2"></i>Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { useAdminBandeauxStore } from '@/stores/adminBandeaux';

const store = useAdminBandeauxStore();

onMounted(() => {
  store.loadBandeaux();
});
</script>
