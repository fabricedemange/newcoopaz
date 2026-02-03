<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-3 text-muted">Chargement...</p>
      </div>
      <div v-else-if="store.error" class="alert alert-danger">{{ store.error }}</div>
      <div v-else>
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-person-badge me-2"></i>Rôles de l'utilisateur</h2>
          <button @click="store.openAddModal()" class="btn btn-primary">
            <i class="bi bi-plus-lg me-2"></i>Ajouter un rôle
          </button>
        </div>
        <div class="card mb-4">
          <div class="card-header">
            <h5 class="mb-0">Rôles Actuels ({{ store.userRoles.length }})</h5>
          </div>
          <div class="card-body">
            <div v-if="store.userRoles.length === 0" class="text-muted">Aucun rôle assigné</div>
            <div v-else class="table-responsive">
              <table class="table">
                <thead class="thead-admin-site">
                  <tr>
                    <th>Rôle</th>
                    <th>Type</th>
                    <th>Assigné le</th>
                    <th>Expire le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="role in store.userRoles" :key="role.id">
                    <td><strong>{{ role.display_name }}</strong></td>
                    <td>
                      <span :class="['badge', role.is_system ? 'bg-primary' : 'bg-success']">
                        {{ role.is_system ? 'Système' : 'Custom' }}
                      </span>
                    </td>
                    <td>{{ role.assigned_at ? new Date(role.assigned_at).toLocaleDateString() : '—' }}</td>
                    <td>{{ role.expires_at ? new Date(role.expires_at).toLocaleDateString() : 'Permanent' }}</td>
                    <td>
                      <button @click="store.removeRole(role.id)" class="btn btn-sm btn-outline-danger">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Permissions Effectives ({{ store.permissionCount }})</h5>
            <small class="text-muted">Cumul de toutes les permissions des rôles assignés</small>
          </div>
          <div class="card-body">
            <div v-if="store.permissionCount === 0" class="text-muted">Aucune permission</div>
            <div v-else>
              <div v-for="(perms, module) in store.effectivePermissions" :key="module" class="mb-3">
                <h6 class="text-uppercase">{{ module }} <span class="badge bg-secondary">{{ perms.length }}</span></h6>
                <div class="row">
                  <div v-for="perm in perms" :key="perm.id" class="col-md-6 mb-2">
                    <div class="small">
                      <i class="bi bi-check-circle text-success me-1"></i>
                      {{ perm.display_name }}
                      <span class="text-muted">({{ perm.from_roles }})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Ajouter rôle -->
      <div v-if="store.showAddModal" class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Ajouter un rôle</h5>
              <button type="button" class="btn-close" @click="store.closeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Rôle *</label>
                <select v-model="store.selectedRoleId" class="form-select" required>
                  <option :value="null">Sélectionner un rôle</option>
                  <option
                    v-for="role in store.availableRoles"
                    :key="role.id"
                    :value="role.id"
                    :disabled="store.hasRole(role.id)"
                  >
                    {{ role.display_name }} {{ store.hasRole(role.id) ? '(déjà assigné)' : '' }}
                  </option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Date d'expiration (optionnel)</label>
                <input v-model="store.expiresAt" type="datetime-local" class="form-control" />
                <small class="form-text text-muted">Laisser vide pour un rôle permanent</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Raison (optionnel)</label>
                <textarea v-model="store.reason" class="form-control" rows="2" placeholder="Ex: Remplacement temporaire pendant congés"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="store.closeModal()">Annuler</button>
              <button type="button" class="btn btn-primary" @click="store.assignRole()">Assigner</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAdminUserRolesStore } from '@/stores/adminUserRoles';

const store = useAdminUserRolesStore();

onMounted(() => {
  const userId = typeof window !== 'undefined' && window.USER_ID != null ? Number(window.USER_ID) : null;
  store.setUserId(userId);
  store.loadData();
});
</script>
