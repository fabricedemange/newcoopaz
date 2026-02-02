/**
 * AdminRolesApp - Interface de gestion des rôles RBAC
 *
 * Features:
 * - Vue inline de tous les rôles avec permissions visibles
 * - Modification directe des permissions sans modal
 * - Permissions groupées par module avec accordéons
 * - Sauvegarde automatique des changements
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      roles: [],
      permissions: {},
      modules: [],
      loading: true,
      error: null,
      expandedRole: null, // Rôle actuellement déplié pour modification
      rolePermissions: {}, // Map: role.id -> [permission_ids]
      savingRoleId: null,
      savedRoleId: null,
      searchQuery: '',
      showCreateForm: false,
      newRole: {
        name: '',
        display_name: '',
        description: ''
      }
    };
  },
  computed: {
    systemRoles() {
      return this.roles.filter(r => r.is_system === 1);
    },
    customRoles() {
      return this.roles.filter(r => r.is_system === 0);
    },
    filteredRoles() {
      if (!this.searchQuery) return this.roles;
      const query = this.searchQuery.toLowerCase();
      return this.roles.filter(r =>
        r.display_name.toLowerCase().includes(query) ||
        r.name.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query))
      );
    }
  },
  methods: {
    async loadRoles() {
      try {
        const response = await fetch('/api/admin/roles', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const data = await response.json();

        if (data.success) {
          this.roles = data.roles;
          // Load permissions for each role
          for (const role of this.roles) {
            await this.loadRolePermissions(role.id);
          }
        } else {
          this.error = data.error || 'Erreur lors du chargement des rôles';
        }
      } catch (err) {
        console.error('Error loading roles:', err);
        this.error = 'Erreur de connexion au serveur';
      }
    },

    async loadRolePermissions(roleId) {
      try {
        const response = await fetch(`/api/admin/roles/${roleId}`, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const data = await response.json();

        if (data.success) {
          this.rolePermissions[roleId] = data.permission_ids || [];
        }
      } catch (err) {
        console.error('Error loading role permissions:', err);
      }
    },

    async loadPermissions() {
      try {
        const response = await fetch('/api/admin/permissions', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const data = await response.json();

        if (data.success) {
          this.permissions = data.permissions;
          this.modules = data.modules;
        } else {
          this.error = data.error || 'Erreur lors du chargement des permissions';
        }
      } catch (err) {
        console.error('Error loading permissions:', err);
        this.error = 'Erreur de connexion au serveur';
      }
    },

    toggleRole(roleId) {
      if (this.expandedRole === roleId) {
        this.expandedRole = null;
      } else {
        this.expandedRole = roleId;
      }
    },

    isRoleExpanded(roleId) {
      return this.expandedRole === roleId;
    },

    togglePermission(roleId, permissionId) {
      const perms = this.rolePermissions[roleId] || [];
      const index = perms.indexOf(permissionId);

      if (index > -1) {
        perms.splice(index, 1);
      } else {
        perms.push(permissionId);
      }

      this.rolePermissions[roleId] = [...perms];
    },

    hasPermission(roleId, permissionId) {
      const perms = this.rolePermissions[roleId] || [];
      return perms.includes(permissionId);
    },

    selectAllModulePermissions(roleId, module) {
      const modulePermissions = this.permissions[module] || [];
      const rolePerms = this.rolePermissions[roleId] || [];
      const allSelected = modulePermissions.every(p => rolePerms.includes(p.id));

      if (allSelected) {
        // Deselect all from this module
        const modulePermIds = modulePermissions.map(p => p.id);
        const filtered = rolePerms.filter(id => !modulePermIds.includes(id));
        this.rolePermissions[roleId] = filtered;
      } else {
        // Select all from this module
        const newPerms = [...new Set([...rolePerms, ...modulePermissions.map(p => p.id)])];
        this.rolePermissions[roleId] = newPerms;
      }
    },

    isModuleFullySelected(roleId, module) {
      const modulePermissions = this.permissions[module] || [];
      const rolePerms = this.rolePermissions[roleId] || [];
      return modulePermissions.length > 0 &&
             modulePermissions.every(p => rolePerms.includes(p.id));
    },

    async saveRolePermissions(role) {
      this.savingRoleId = role.id;

      try {
        const response = await fetch(`/api/admin/roles/${role.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify({
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            permission_ids: this.rolePermissions[role.id] || []
          })
        });

        const data = await response.json();

        if (data.success) {
          // Show success feedback
          this.savedRoleId = role.id;
          setTimeout(() => {
            this.savedRoleId = null;
          }, 2000);

          await this.loadRoles();
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error saving role:', err);
        alert('Erreur lors de la sauvegarde');
      } finally {
        this.savingRoleId = null;
      }
    },

    async createRole() {
      if (!this.newRole.name || !this.newRole.display_name) {
        alert('Le nom et le nom d\'affichage sont requis');
        return;
      }

      try {
        const response = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify({
            name: this.newRole.name,
            display_name: this.newRole.display_name,
            description: this.newRole.description,
            permission_ids: []
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showCreateForm = false;
          this.newRole = { name: '', display_name: '', description: '' };
          await this.loadRoles();
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error creating role:', err);
        alert('Erreur lors de la création');
      }
    },

    async deleteRole(role) {
      if (role.user_count > 0) {
        alert(`Impossible de supprimer ce rôle : ${role.user_count} utilisateur(s) l'utilisent encore`);
        return;
      }

      if (!confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.display_name}" ?`)) {
        return;
      }

      try {
        const response = await fetch(`/api/admin/roles/${role.id}`, {
          method: 'DELETE',
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          await this.loadRoles();
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error deleting role:', err);
        alert('Erreur lors de la suppression');
      }
    },

    cancelCreate() {
      this.showCreateForm = false;
      this.newRole = { name: '', display_name: '', description: '' };
    },

    isSystemRole(role) {
      return role.is_system === 1;
    },

    getRoleBadgeClass(role) {
      if (role.is_system === 1) return 'bg-primary';
      return 'bg-success';
    }
  },

  async mounted() {
    try {
      await Promise.all([this.loadRoles(), this.loadPermissions()]);
      this.loading = false;
    } catch (err) {
      console.error('Error during initialization:', err);
      this.error = 'Erreur d\'initialisation';
      this.loading = false;
    }
  },

  template: `
    <div class="container-fluid mt-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement des rôles...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-shield-lock me-2"></i>Gestion des Rôles</h2>
          <button @click="showCreateForm = !showCreateForm" class="btn btn-primary">
            <i class="bi bi-plus-lg me-2"></i>Nouveau rôle
          </button>
        </div>

        <!-- Create Form -->
        <div v-if="showCreateForm" class="card mb-4 border-primary">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Créer un nouveau rôle</h5>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-4">
                <div class="mb-3">
                  <label class="form-label">Nom technique *</label>
                  <input
                    v-model="newRole.name"
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
                    v-model="newRole.display_name"
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
                    v-model="newRole.description"
                    type="text"
                    class="form-control"
                    placeholder="Description du rôle"
                  />
                </div>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button @click="createRole" class="btn btn-primary">
                <i class="bi bi-check-lg me-2"></i>Créer
              </button>
              <button @click="cancelCreate" class="btn btn-secondary">
                <i class="bi bi-x-lg me-2"></i>Annuler
              </button>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="mb-4">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Rechercher un rôle..."
          />
        </div>

        <!-- System Roles -->
        <div class="card mb-4">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0"><i class="bi bi-shield-fill me-2"></i>Rôles Système</h5>
          </div>
          <div class="card-body p-0">
            <div v-for="role in systemRoles" :key="role.id" class="border-bottom">
              <!-- Role Header -->
              <div class="p-3 d-flex align-items-center" style="cursor: pointer;" @click="toggleRole(role.id)">
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
                  <i :class="'bi bi-chevron-' + (isRoleExpanded(role.id) ? 'up' : 'down')"></i>
                </div>
              </div>

              <!-- Permissions (Expanded) -->
              <div v-if="isRoleExpanded(role.id)" class="p-3 bg-light">
                <div class="row">
                  <div v-for="module in modules" :key="module.name" class="col-md-6 col-lg-4 mb-3">
                    <div class="card">
                      <div class="card-header d-flex justify-content-between align-items-center">
                        <strong>{{ module.display_name }}</strong>
                        <button
                          type="button"
                          class="btn btn-sm btn-link p-0"
                          @click="selectAllModulePermissions(role.id, module.name)"
                        >
                          {{ isModuleFullySelected(role.id, module.name) ? 'Tout décocher' : 'Tout cocher' }}
                        </button>
                      </div>
                      <div class="card-body" style="max-height: 300px; overflow-y: auto;">
                        <div v-for="perm in permissions[module.name]" :key="perm.id" class="form-check mb-2">
                          <input
                            :id="'perm-' + role.id + '-' + perm.id"
                            type="checkbox"
                            class="form-check-input"
                            :checked="hasPermission(role.id, perm.id)"
                            @change="togglePermission(role.id, perm.id)"
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
                    @click="saveRolePermissions(role)"
                    :class="'btn ' + (savedRoleId === role.id ? 'btn-success' : 'btn-primary')"
                    :disabled="savingRoleId === role.id"
                  >
                    <span v-if="savingRoleId === role.id">
                      <span class="spinner-border spinner-border-sm me-2"></span>
                      Sauvegarde...
                    </span>
                    <span v-else-if="savedRoleId === role.id">
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
          <div class="card-header bg-success text-white">
            <h5 class="mb-0"><i class="bi bi-gear-fill me-2"></i>Rôles Personnalisés</h5>
          </div>
          <div class="card-body p-0">
            <div v-if="customRoles.length === 0" class="text-center text-muted py-4">
              Aucun rôle personnalisé. Créez-en un pour commencer !
            </div>
            <div v-for="role in customRoles" :key="role.id" class="border-bottom">
              <!-- Role Header -->
              <div class="p-3 d-flex align-items-center" style="cursor: pointer;" @click="toggleRole(role.id)">
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
                    @click.stop="deleteRole(role)"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="role.user_count > 0"
                    title="Supprimer le rôle"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                  <i :class="'bi bi-chevron-' + (isRoleExpanded(role.id) ? 'up' : 'down')"></i>
                </div>
              </div>

              <!-- Permissions (Expanded) -->
              <div v-if="isRoleExpanded(role.id)" class="p-3 bg-light">
                <div class="row">
                  <div v-for="module in modules" :key="module.name" class="col-md-6 col-lg-4 mb-3">
                    <div class="card">
                      <div class="card-header d-flex justify-content-between align-items-center">
                        <strong>{{ module.display_name }}</strong>
                        <button
                          type="button"
                          class="btn btn-sm btn-link p-0"
                          @click="selectAllModulePermissions(role.id, module.name)"
                        >
                          {{ isModuleFullySelected(role.id, module.name) ? 'Tout décocher' : 'Tout cocher' }}
                        </button>
                      </div>
                      <div class="card-body" style="max-height: 300px; overflow-y: auto;">
                        <div v-for="perm in permissions[module.name]" :key="perm.id" class="form-check mb-2">
                          <input
                            :id="'perm-' + role.id + '-' + perm.id"
                            type="checkbox"
                            class="form-check-input"
                            :checked="hasPermission(role.id, perm.id)"
                            @change="togglePermission(role.id, perm.id)"
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
                    @click="saveRolePermissions(role)"
                    :class="'btn ' + (savedRoleId === role.id ? 'btn-success' : 'btn-primary')"
                    :disabled="savingRoleId === role.id"
                  >
                    <span v-if="savingRoleId === role.id">
                      <span class="spinner-border spinner-border-sm me-2"></span>
                      Sauvegarde...
                    </span>
                    <span v-else-if="savedRoleId === role.id">
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
  `
}).mount('#admin-roles-app');
