<template>
  <div class="container-fluid mt-4">
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3 text-muted">Chargement des organisations...</p>
    </div>
    <div v-else-if="store.error" class="alert alert-danger">{{ store.error }}</div>
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0"><i class="bi bi-building me-2"></i>Organisations</h2>
        <div class="d-flex gap-2">
          <BackButton />
          <button @click="store.loadOrganizations()" class="btn btn-outline-primary">
            <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
          </button>
          <button @click="store.openCreateModal()" class="btn btn-primary">
            <i class="bi bi-plus-circle me-2"></i>Nouvelle organisation
          </button>
        </div>
      </div>
      <div class="mb-4">
        <input
          v-model="store.searchQuery"
          type="text"
          class="form-control"
          placeholder="Rechercher par nom ou email..."
        />
      </div>
      <div v-if="store.filteredOrganizations.length === 0" class="alert alert-info">Aucune organisation trouvée</div>
      <div v-else class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="thead-admin-site">
              <tr>
                <th style="width: 5%">ID</th>
                <th style="width: 25%">Nom</th>
                <th style="width: 20%">Email</th>
                <th style="width: 10%">Utilisateurs</th>
                <th style="width: 10%">Catalogues</th>
                <th style="width: 10%">Commandes</th>
                <th style="width: 10%">Créée le</th>
                <th style="width: 10%">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="org in store.filteredOrganizations" :key="org.id">
                <td>{{ org.id }}</td>
                <td><strong>{{ org.name }}</strong></td>
                <td>
                  <span v-if="org.email" class="text-muted"><i class="bi bi-envelope me-1"></i>{{ org.email }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td><span class="badge bg-primary">{{ store.getStats(org.id).users }}</span></td>
                <td><span class="badge bg-info">{{ store.getStats(org.id).catalogues }}</span></td>
                <td><span class="badge bg-success">{{ store.getStats(org.id).commandes }}</span></td>
                <td>{{ store.formatDate(org.created_at) }}</td>
                <td>
                  <div class="d-flex gap-1">
                    <button @click="store.openEditModal(org)" class="btn btn-sm btn-outline-primary" title="Modifier">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      @click="store.deleteOrganization(org)"
                      class="btn btn-sm btn-outline-danger"
                      :disabled="!store.canDelete(org.id)"
                      :title="store.canDelete(org.id) ? 'Supprimer' : 'Impossible de supprimer (données associées)'"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-3 text-muted">
        <i class="bi bi-info-circle me-1"></i>{{ store.filteredOrganizations.length }} organisation(s) affichée(s)
      </div>
    </div>

    <!-- Modal Création/Édition -->
    <div v-if="store.showOrgModal" class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ store.modalTitle }}</h5>
            <button type="button" class="btn-close" @click="store.closeModal()"></button>
          </div>
          <div class="modal-body">
            <div v-if="store.formErrors.general" class="alert alert-danger">{{ store.formErrors.general }}</div>
            <div class="mb-3">
              <label class="form-label">Nom de l'organisation *</label>
              <input
                v-model="store.formData.name"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': store.formErrors.name }"
                placeholder="Nom de l'organisation..."
              />
              <div v-if="store.formErrors.name" class="invalid-feedback">{{ store.formErrors.name }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Email de contact (optionnel)</label>
              <input
                v-model="store.formData.email"
                type="email"
                class="form-control"
                placeholder="contact@organization.com"
              />
              <small class="text-muted">Email principal de l'organisation (optionnel)</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.closeModal()">Annuler</button>
            <button type="button" @click="store.saveOrganization()" class="btn btn-primary">
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
import { useAdminOrganizationsStore } from '@/stores/adminOrganizations';

const store = useAdminOrganizationsStore();

onMounted(() => {
  store.loadOrganizations();
});
</script>
