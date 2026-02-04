<template>
  <div class="container-fluid mt-4">
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-admin-site" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des rôles...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="alert alert-danger">
      {{ store.error }}
    </div>

    <!-- Main Content -->
    <div v-else>
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="text-admin-site mb-0"><i class="bi bi-shield-lock me-2"></i>Gestion des Rôles</h2>
        <div class="d-flex gap-2">
          <BackButton />
          <button type="button" class="btn btn-admin-site" @click="store.showCreateForm = !store.showCreateForm">
            <i class="bi bi-plus-lg me-2"></i>Nouveau rôle
          </button>
        </div>
      </div>

      <!-- Create Form -->
      <div v-if="store.showCreateForm" class="card mb-4">
        <div class="card-header card-header-admin-site">
          <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Créer un nouveau rôle</h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <div class="mb-3">
                <label class="form-label">Nom technique *</label>
                <input
                  v-model="store.newRole.name"
                  type="text"
                  class="form-control"
                  placeholder="ex: catalog_viewer"
                  pattern="[a-z_]+"
                />
                <small class="form-text text-muted">Minuscules et underscores uniquement</small>
              </div>
            </div>
            <div class="col-md-4">
              <div class="mb-3">
                <label class="form-label">Nom d'affichage *</label>
                <input
                  v-model="store.newRole.display_name"
                  type="text"
                  class="form-control"
                  placeholder="ex: Visualisateur de Catalogues"
                />
              </div>
            </div>
            <div class="col-md-4">
              <div class="mb-3">
                <label class="form-label">Description</label>
                <input
                  v-model="store.newRole.description"
                  type="text"
                  class="form-control"
                  placeholder="Description du rôle"
                />
              </div>
            </div>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-admin-site" @click="store.createRole()">
              <i class="bi bi-check-lg me-2"></i>Créer
            </button>
            <button type="button" class="btn btn-secondary" @click="store.cancelCreate()">
              <i class="bi bi-x-lg me-2"></i>Annuler
            </button>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-4">
        <input
          v-model="store.searchQuery"
          type="text"
          class="form-control"
          placeholder="Rechercher un rôle..."
        />
      </div>

      <!-- System Roles -->
      <div class="card mb-4">
        <div class="card-header card-header-admin-site">
          <h5 class="mb-0"><i class="bi bi-shield-fill me-2"></i>Rôles Système</h5>
        </div>
        <div class="card-body p-0">
          <div
            v-for="role in store.filteredSystemRoles"
            :key="role.id"
            class="border-bottom"
          >
            <!-- Role Header -->
            <div
              class="p-3 d-flex align-items-center"
              style="cursor: pointer"
              @click="store.toggleRole(role.id)"
            >
              <div class="flex-grow-1">
                <h6 class="mb-1">
                  <span class="badge bg-primary me-2">Système</span>
                  <strong>{{ role.display_name }}</strong>
                </h6>
                <p class="mb-0 text-muted small">{{ role.description }}</p>
              </div>
              <div class="d-flex align-items-center gap-3">
                <span class="badge bg-info">{{ role.permission_count }} permissions</span>
                <span class="badge bg-secondary">{{ role.user_count }} utilisateurs</span>
                <i :class="'bi bi-chevron-' + (store.isRoleExpanded(role.id) ? 'up' : 'down')"></i>
              </div>
            </div>

            <!-- Permissions (Expanded) -->
            <div v-if="store.isRoleExpanded(role.id)" class="p-3 bg-light">
              <div class="row">
                <div
                  v-for="module in store.modules"
                  :key="module.name"
                  class="col-md-6 col-lg-4 mb-3"
                >
                  <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                      <strong>{{ module.display_name }}</strong>
                      <button
                        type="button"
                        class="btn btn-sm btn-link p-0"
                        @click="store.selectAllModulePermissions(role.id, module.name)"
                      >
                        {{ store.isModuleFullySelected(role.id, module.name) ? 'Tout décocher' : 'Tout cocher' }}
                      </button>
                    </div>
                    <div class="card-body" style="max-height: 300px; overflow-y: auto">
                      <div
                        v-for="perm in (store.permissions[module.name] || [])"
                        :key="perm.id"
                        class="form-check mb-2"
                      >
                        <input
                          :id="'perm-' + role.id + '-' + perm.id"
                          type="checkbox"
                          class="form-check-input"
                          :checked="store.hasPermission(role.id, perm.id)"
                          @change="store.togglePermission(role.id, perm.id)"
                        />
                        <label :for="'perm-' + role.id + '-' + perm.id" class="form-check-label">
                          <strong>{{ perm.display_name }}</strong>
                          <br />
                          <small class="text-muted">{{ perm.description }}</small>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-3">
                <button
                  type="button"
                  :class="'btn ' + (store.savedRoleId === role.id ? 'btn-success' : 'btn-admin-site')"
                  :disabled="store.savingRoleId === role.id"
                  @click="store.saveRolePermissions(role)"
                >
                  <span v-if="store.savingRoleId === role.id">
                    <span class="spinner-border spinner-border-sm me-2"></span>
                    Sauvegarde...
                  </span>
                  <span v-else-if="store.savedRoleId === role.id">
                    <i class="bi bi-check-lg me-2"></i>Sauvegardé
                  </span>
                  <span v-else>
                    <i class="bi bi-save me-2"></i>Sauvegarder les permissions
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Roles -->
      <div class="card">
        <div class="card-header card-header-admin-site">
          <h5 class="mb-0"><i class="bi bi-gear-fill me-2"></i>Rôles Personnalisés</h5>
        </div>
        <div class="card-body p-0">
          <div v-if="store.filteredCustomRoles.length === 0" class="text-center text-muted py-4">
            Aucun rôle personnalisé. Créez-en un pour commencer !
          </div>
          <div
            v-for="role in store.filteredCustomRoles"
            :key="role.id"
            class="border-bottom"
          >
            <!-- Role Header -->
            <div
              class="p-3 d-flex align-items-center"
              style="cursor: pointer"
              @click="store.toggleRole(role.id)"
            >
              <div class="flex-grow-1">
                <h6 class="mb-1">
                  <span class="badge bg-success me-2">Custom</span>
                  <strong>{{ role.display_name }}</strong>
                </h6>
                <p class="mb-0 text-muted small">{{ role.description }}</p>
              </div>
              <div class="d-flex align-items-center gap-3">
                <span class="badge bg-info">{{ role.permission_count }} permissions</span>
                <span class="badge bg-secondary">{{ role.user_count }} utilisateurs</span>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="role.user_count > 0"
                  title="Supprimer le rôle"
                  @click.stop="store.deleteRole(role)"
                >
                  <i class="bi bi-trash"></i>
                </button>
                <i :class="'bi bi-chevron-' + (store.isRoleExpanded(role.id) ? 'up' : 'down')"></i>
              </div>
            </div>

            <!-- Permissions (Expanded) -->
            <div v-if="store.isRoleExpanded(role.id)" class="p-3 bg-light">
              <div class="row">
                <div
                  v-for="module in store.modules"
                  :key="module.name"
                  class="col-md-6 col-lg-4 mb-3"
                >
                  <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                      <strong>{{ module.display_name }}</strong>
                      <button
                        type="button"
                        class="btn btn-sm btn-link p-0"
                        @click="store.selectAllModulePermissions(role.id, module.name)"
                      >
                        {{ store.isModuleFullySelected(role.id, module.name) ? 'Tout décocher' : 'Tout cocher' }}
                      </button>
                    </div>
                    <div class="card-body" style="max-height: 300px; overflow-y: auto">
                      <div
                        v-for="perm in (store.permissions[module.name] || [])"
                        :key="perm.id"
                        class="form-check mb-2"
                      >
                        <input
                          :id="'perm-' + role.id + '-' + perm.id"
                          type="checkbox"
                          class="form-check-input"
                          :checked="store.hasPermission(role.id, perm.id)"
                          @change="store.togglePermission(role.id, perm.id)"
                        />
                        <label :for="'perm-' + role.id + '-' + perm.id" class="form-check-label">
                          <strong>{{ perm.display_name }}</strong>
                          <br />
                          <small class="text-muted">{{ perm.description }}</small>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-3">
                <button
                  type="button"
                  :class="'btn ' + (store.savedRoleId === role.id ? 'btn-success' : 'btn-admin-site')"
                  :disabled="store.savingRoleId === role.id"
                  @click="store.saveRolePermissions(role)"
                >
                  <span v-if="store.savingRoleId === role.id">
                    <span class="spinner-border spinner-border-sm me-2"></span>
                    Sauvegarde...
                  </span>
                  <span v-else-if="store.savedRoleId === role.id">
                    <i class="bi bi-check-lg me-2"></i>Sauvegardé
                  </span>
                  <span v-else>
                    <i class="bi bi-save me-2"></i>Sauvegarder les permissions
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { useAdminRolesStore } from '@/stores/adminRoles';

const store = useAdminRolesStore();

onMounted(() => {
  store.loadData();
});
</script>
