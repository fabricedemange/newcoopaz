/**
 * AdminUserRolesApp - Interface d'assignation de rôles à un utilisateur
 *
 * Features:
 * - Liste des rôles disponibles (système + org custom)
 * - Assignation/retrait de rôles (multi-sélection)
 * - Affichage permissions effectives (cumul de tous les rôles)
 * - Support expiration temporaire et raison
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      userId: window.USER_ID,
      user: null,
      availableRoles: [],
      userRoles: [],
      effectivePermissions: {},
      loading: true,
      error: null,
      showAddModal: false,
      selectedRoleId: null,
      expiresAt: null,
      reason: ''
    };
  },
  computed:{
    permissionCount() {
      return Object.values(this.effectivePermissions).reduce((sum, perms) => sum + perms.length, 0);
    },
    userRoleIds() {
      return this.userRoles.map(ur => ur.id);
    }
  },
  methods: {
    async loadData() {
      try {
        // Load available roles
        const rolesResponse = await fetch('/api/admin/roles', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const rolesData = await rolesResponse.json();

        if (rolesData.success) {
          this.availableRoles = rolesData.roles;
        }

        // Load user's current roles
        const userRolesResponse = await fetch(`/api/admin/users/${this.userId}/roles`, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const userRolesData = await userRolesResponse.json();

        if (userRolesData.success) {
          this.userRoles = userRolesData.roles;
        }

        // Load effective permissions
        const permsResponse = await fetch(`/api/admin/users/${this.userId}/effective-permissions`, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const permsData = await permsResponse.json();

        if (permsData.success) {
          this.effectivePermissions = permsData.permissions || {};
        }

        this.loading = false;
      } catch (err) {
        console.error('Error loading data:', err);
        this.error = 'Erreur de chargement des données';
        this.loading = false;
      }
    },

    hasRole(roleId) {
      return this.userRoles.some(ur => ur.id === roleId);
    },

    openAddModal() {
      this.selectedRoleId = null;
      this.expiresAt = null;
      this.reason = '';
      this.showAddModal = true;
    },

    async assignRole() {
      if (!this.selectedRoleId) {
        alert('Veuillez sélectionner un rôle');
        return;
      }

      try {
        const response = await fetch(`/api/admin/users/${this.userId}/roles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify({
            role_id: this.selectedRoleId,
            expires_at: this.expiresAt || null,
            reason: this.reason || null
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showAddModal = false;
          await this.loadData();
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error assigning role:', err);
        alert('Erreur lors de l\'assignation');
      }
    },

    async removeRole(roleId) {
      if (!confirm('Êtes-vous sûr de vouloir retirer ce rôle ?')) {
        return;
      }

      try {
        const response = await fetch(`/api/admin/users/${this.userId}/roles/${roleId}`, {
          method: 'DELETE',
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          await this.loadData();
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error removing role:', err);
        alert('Erreur lors du retrait');
      }
    },

    closeModal() {
      this.showAddModal = false;
    }
  },

  async mounted() {
    await this.loadData();
  },

  template: `
    <div class="admin-content-wrapper">
      <div class="container-fluid mt-4">
        <!-- Loading -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-3 text-muted">Chargement...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

        <!-- Main Content -->
        <div v-else>
          <div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-person-badge me-2"></i>Rôles de l'utilisateur</h2>
            <button @click="openAddModal" class="btn btn-primary">
              <i class="bi bi-plus-lg me-2"></i>Ajouter un rôle
            </button>
          </div>

          <!-- Current Roles -->
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">Rôles Actuels ({{ userRoles.length }})</h5>
            </div>
            <div class="card-body">
              <div v-if="userRoles.length === 0" class="text-muted">Aucun rôle assigné</div>
              <div v-else class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Rôle</th>
                      <th>Type</th>
                      <th>Assigné le</th>
                      <th>Expire le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="role in userRoles" :key="role.id">
                      <td><strong>{{ role.display_name }}</strong></td>
                      <td>
                        <span :class="'badge ' + (role.is_system ? 'bg-primary' : 'bg-success')">
                          {{ role.is_system ? 'Système' : 'Custom' }}
                        </span>
                      </td>
                      <td>{{ new Date(role.assigned_at).toLocaleDateString() }}</td>
                      <td>{{ role.expires_at ? new Date(role.expires_at).toLocaleDateString() : 'Permanent' }}</td>
                      <td>
                        <button @click="removeRole(role.id)" class="btn btn-sm btn-outline-danger">
                          <i class="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Effective Permissions -->
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Permissions Effectives ({{ permissionCount }})</h5>
              <small class="text-muted">Cumul de toutes les permissions des rôles assignés</small>
            </div>
            <div class="card-body">
              <div v-if="permissionCount === 0" class="text-muted">Aucune permission</div>
              <div v-else>
                <div v-for="(perms, module) in effectivePermissions" :key="module" class="mb-3">
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

        <!-- Add Role Modal -->
        <div v-if="showAddModal" class="modal show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Ajouter un rôle</h5>
                <button type="button" class="btn-close" @click="closeModal"></button>
              </div>
              <div class="modal-body">
                <form @submit.prevent="assignRole">
                  <div class="mb-3">
                    <label class="form-label">Rôle *</label>
                    <select v-model="selectedRoleId" class="form-select" required>
                      <option :value="null">Sélectionner un rôle</option>
                      <option
                        v-for="role in availableRoles"
                        :key="role.id"
                        :value="role.id"
                        :disabled="hasRole(role.id)"
                      >
                        {{ role.display_name }} {{ hasRole(role.id) ? '(déjà assigné)' : '' }}
                      </option>
                    </select>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Date d'expiration (optionnel)</label>
                    <input v-model="expiresAt" type="datetime-local" class="form-control" />
                    <small class="form-text text-muted">Laisser vide pour un rôle permanent</small>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Raison (optionnel)</label>
                    <textarea v-model="reason" class="form-control" rows="2" placeholder="Ex: Remplacement temporaire pendant congés"></textarea>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="closeModal">Annuler</button>
                <button type="button" class="btn btn-primary" @click="assignRole">Assigner</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}).mount('#admin-user-roles-app');
