/**
 * AdminUsersApp - Interface de gestion des utilisateurs avec RBAC
 *
 * Features:
 * - Liste des utilisateurs avec leurs rôles
 * - Affectation individuelle de rôles
 * - Affectation en masse de rôles
 * - Activation/désactivation RBAC
 * - Responsive (tableau desktop, cartes mobile)
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      users: [],
      roles: [],
      loading: true,
      error: null,
      editingUser: null,
      selectedUserRoles: [],
      showRoleModal: false,
      showBulkModal: false,
      showCreateModal: false,
      selectedUsers: [],
      bulkRoleIds: [],
      searchQuery: '',
      newUser: {
        username: '',
        email: '',
        password: '',
        role_ids: []
      }
    };
  },
  computed: {
    filteredUsers() {
      let filtered = this.users;

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(u =>
          u.username.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          (u.role_names && u.role_names.toLowerCase().includes(query))
        );
      }

      return filtered;
    },
    allSelected() {
      return this.filteredUsers.length > 0 &&
        this.selectedUsers.length === this.filteredUsers.length;
    },
    someSelected() {
      return this.selectedUsers.length > 0 && !this.allSelected;
    }
  },
  async mounted() {
    await Promise.all([
      this.loadUsers(),
      this.loadRoles()
    ]);
    this.loading = false;
  },
  methods: {
    async loadUsers() {
      try {
        const response = await fetch('/api/admin/users', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const data = await response.json();

        if (data.success) {
          this.users = data.users;
        } else {
          this.error = data.error || 'Erreur lors du chargement des utilisateurs';
        }
      } catch (err) {
        console.error('Error loading users:', err);
        this.error = 'Erreur de connexion au serveur';
      }
    },

    async loadRoles() {
      try {
        const response = await fetch('/api/admin/roles', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const data = await response.json();

        if (data.success) {
          this.roles = data.roles;
        } else {
          this.error = data.error || 'Erreur lors du chargement des rôles';
        }
      } catch (err) {
        console.error('Error loading roles:', err);
        this.error = 'Erreur de connexion au serveur';
      }
    },

    openCreateModal() {
      this.newUser = {
        username: '',
        email: '',
        password: '',
        role_ids: []
      };
      this.showCreateModal = true;
    },

    closeCreateModal() {
      this.showCreateModal = false;
      this.newUser = {
        username: '',
        email: '',
        password: '',
        role_ids: []
      };
    },

    async createUser() {
      if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
      }

      try {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify(this.newUser)
        });

        const data = await response.json();

        if (data.success) {
          alert('Utilisateur créé avec succès');
          this.closeCreateModal();
          await this.loadUsers();
        } else {
          alert('Erreur: ' + (data.error || 'Erreur lors de la création'));
        }
      } catch (err) {
        console.error('Error creating user:', err);
        alert('Erreur de connexion au serveur');
      }
    },

    async openRoleModal(user) {
      try {
        const response = await fetch(`/api/admin/users/${user.id}`, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });
        const data = await response.json();

        if (data.success) {
          this.editingUser = { ...data.user };
          this.selectedUserRoles = data.role_ids || [];
          this.showRoleModal = true;
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error loading user details:', err);
        alert('Erreur de chargement');
      }
    },

    async saveUserRoles() {
      if (!this.editingUser) return;

      try {
        const response = await fetch(`/api/admin/users/${this.editingUser.id}/roles`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify({
            role_ids: this.selectedUserRoles
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showRoleModal = false;
          this.editingUser = null;
          this.selectedUserRoles = [];
          await this.loadUsers();
          alert('Rôles mis à jour avec succès');
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error saving user roles:', err);
        alert('Erreur lors de la sauvegarde');
      }
    },

    closeRoleModal() {
      this.showRoleModal = false;
      this.editingUser = null;
      this.selectedUserRoles = [];
    },

    toggleSelectAll() {
      if (this.allSelected) {
        this.selectedUsers = [];
      } else {
        this.selectedUsers = this.filteredUsers.map(u => u.id);
      }
    },

    toggleUserSelection(userId) {
      const index = this.selectedUsers.indexOf(userId);
      if (index > -1) {
        this.selectedUsers.splice(index, 1);
      } else {
        this.selectedUsers.push(userId);
      }
    },

    isUserSelected(userId) {
      return this.selectedUsers.includes(userId);
    },

    openBulkAssignModal() {
      if (this.selectedUsers.length === 0) {
        alert('Veuillez sélectionner au moins un utilisateur');
        return;
      }
      this.bulkRoleIds = [];
      this.showBulkModal = true;
    },

    closeBulkModal() {
      this.showBulkModal = false;
      this.bulkRoleIds = [];
    },

    async bulkAssignRoles() {
      if (this.bulkRoleIds.length === 0) {
        alert('Veuillez sélectionner au moins un rôle');
        return;
      }

      try {
        const response = await fetch('/api/admin/users/bulk-assign-roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify({
            user_ids: this.selectedUsers,
            role_ids: this.bulkRoleIds
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showBulkModal = false;
          this.selectedUsers = [];
          this.bulkRoleIds = [];
          await this.loadUsers();
          alert(data.message || 'Rôles assignés avec succès');
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error bulk assigning roles:', err);
        alert('Erreur lors de l\'assignation');
      }
    },

    getRoleBadgeClass(user) {
      if (user.role_count === 0) return 'bg-warning';
      return 'bg-success';
    },

    getSelectedUsersText() {
      return `${this.selectedUsers.length} utilisateur(s) sélectionné(s)`;
    },

    async toggleUserActive(user) {
      const newStatus = !user.is_active;
      const message = newStatus
        ? `Activer l'utilisateur "${user.username}" ?\n\nIl pourra se connecter à nouveau.`
        : `Désactiver l'utilisateur "${user.username}" ?\n\nIl ne pourra plus se connecter.`;

      if (!confirm(message)) return;

      try {
        const response = await fetch(`/api/admin/users/${user.id}/toggle-active`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify({
            is_active: newStatus
          })
        });

        const data = await response.json();

        if (data.success) {
          await this.loadUsers();
          alert(`Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`);
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error toggling user active status:', err);
        alert('Erreur lors de la modification');
      }
    },

    async impersonateUser(user) {
      if (!confirm(`Voulez-vous vous connecter en tant que "${user.username}" ?`)) {
        return;
      }

      try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/admin/impersonate';

        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_csrf';
        csrfInput.value = window.CSRF_TOKEN;
        form.appendChild(csrfInput);

        const userIdInput = document.createElement('input');
        userIdInput.type = 'hidden';
        userIdInput.name = 'user_id';
        userIdInput.value = user.id;
        form.appendChild(userIdInput);

        document.body.appendChild(form);
        form.submit();
      } catch (err) {
        console.error('Error impersonating user:', err);
        alert('Erreur lors de l\'impersonnation');
      }
    },

    editUser(user) {
      window.location.href = `/admin/users/${user.id}/edit`;
    },

    async deleteUser(user) {
      if (!confirm(`⚠️ ATTENTION : Êtes-vous sûr de vouloir SUPPRIMER l'utilisateur "${user.username}" ?\n\nCette action est IRRÉVERSIBLE.`)) {
        return;
      }

      try {
        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          }
        });

        const data = await response.json();

        if (data.success) {
          await this.loadUsers();
          alert('Utilisateur supprimé avec succès');
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        alert('Erreur lors de la suppression');
      }
    }
  },
  template: `
    <div>
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement des utilisateurs...</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-if="!loading && !error">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>Gestion des Utilisateurs</h2>
          <button @click="openCreateModal" class="btn btn-success">
            <i class="bi bi-person-plus-fill"></i>
            Ajouter un utilisateur
          </button>
        </div>

        <!-- Filters and Actions -->
        <div class="row mb-4">
          <div class="col-md-8">
            <input
              v-model="searchQuery"
              type="text"
              class="form-control"
              placeholder="Rechercher un utilisateur..."
            />
          </div>
          <div class="col-md-4">
            <button
              @click="openBulkAssignModal"
              class="btn btn-primary w-100"
              :disabled="selectedUsers.length === 0"
            >
              <i class="bi bi-people-fill"></i>
              Affectation en masse
            </button>
          </div>
        </div>

        <!-- Selection info -->
        <div v-if="selectedUsers.length > 0" class="alert alert-info d-flex justify-content-between align-items-center">
          <span>{{ getSelectedUsersText() }}</span>
          <button @click="selectedUsers = []" class="btn btn-sm btn-outline-secondary">
            Désélectionner tout
          </button>
        </div>

        <!-- Users Table (Desktop) -->
        <div class="d-none d-md-block">
          <div class="card">
            <div class="card-body">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th style="width: 40px;">
                      <input
                        type="checkbox"
                        :checked="allSelected"
                        :indeterminate.prop="someSelected"
                        @change="toggleSelectAll"
                        class="form-check-input"
                      />
                    </th>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Organisation</th>
                    <th>Rôles</th>
                    <th style="width: 80px;">Statut</th>
                    <th style="width: 100px;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in filteredUsers" :key="user.id">
                    <td>
                      <input
                        type="checkbox"
                        :checked="isUserSelected(user.id)"
                        @change="toggleUserSelection(user.id)"
                        class="form-check-input"
                      />
                    </td>
                    <td>
                      <strong>{{ user.username }}</strong>
                      <br>
                      <small class="text-muted">Legacy: {{ user.legacy_role }}</small>
                    </td>
                    <td>{{ user.email }}</td>
                    <td>{{ user.organization_name || 'N/A' }}</td>
                    <td>
                      <span :class="'badge ' + getRoleBadgeClass(user)">
                        {{ user.role_names }}
                      </span>
                    </td>
                    <td>
                      <span :class="'badge ' + (user.is_active ? 'bg-success' : 'bg-secondary')">
                        {{ user.is_active ? 'Actif' : 'Inactif' }}
                      </span>
                    </td>
                    <td>
                      <div class="dropdown">
                        <button
                          class="btn btn-sm btn-outline-secondary dropdown-toggle"
                          type="button"
                          :id="'dropdown-' + user.id"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu" :aria-labelledby="'dropdown-' + user.id">
                          <li>
                            <a class="dropdown-item" href="#" @click.prevent="editUser(user)">
                              <i class="bi bi-pencil"></i> Modifier
                            </a>
                          </li>
                          <li>
                            <a class="dropdown-item" href="#" @click.prevent="openRoleModal(user)">
                              <i class="bi bi-shield-check"></i> Gérer les rôles
                            </a>
                          </li>
                          <li>
                            <a class="dropdown-item" href="#" @click.prevent="toggleUserActive(user)">
                              <i :class="'bi bi-' + (user.is_active ? 'x-circle' : 'check-circle')"></i>
                              {{ user.is_active ? 'Désactiver' : 'Activer' }}
                            </a>
                          </li>
                          <li><hr class="dropdown-divider"></li>
                          <li>
                            <a class="dropdown-item" href="#" @click.prevent="impersonateUser(user)">
                              <i class="bi bi-person-circle"></i> Impersonner
                            </a>
                          </li>
                          <li><hr class="dropdown-divider"></li>
                          <li>
                            <a class="dropdown-item text-danger" href="#" @click.prevent="deleteUser(user)">
                              <i class="bi bi-trash"></i> Supprimer
                            </a>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="filteredUsers.length === 0" class="text-center text-muted py-4">
                Aucun utilisateur trouvé
              </div>
            </div>
          </div>
        </div>

        <!-- Users Cards (Mobile) -->
        <div class="d-md-none">
          <div class="card mb-3" v-for="user in filteredUsers" :key="user.id">
            <div class="card-body">
              <div class="form-check mb-3">
                <input
                  type="checkbox"
                  :checked="isUserSelected(user.id)"
                  @change="toggleUserSelection(user.id)"
                  class="form-check-input"
                  :id="'check-' + user.id"
                />
                <label class="form-check-label" :for="'check-' + user.id">
                  <strong>{{ user.username }}</strong>
                </label>
              </div>
              <p class="card-text mb-2">
                <small class="text-muted">{{ user.email }}</small>
              </p>
              <p class="card-text mb-2">
                <span :class="'badge ' + getRoleBadgeClass(user)">
                  {{ user.role_names }}
                </span>
              </p>
              <p class="card-text mb-3">
                <span :class="'badge ' + (user.is_active ? 'bg-success' : 'bg-secondary')">
                  {{ user.is_active ? 'Actif' : 'Inactif' }}
                </span>
              </p>
              <div class="dropdown w-100">
                <button
                  class="btn btn-sm btn-outline-secondary dropdown-toggle w-100"
                  type="button"
                  :id="'dropdown-mobile-' + user.id"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i class="bi bi-three-dots"></i> Actions
                </button>
                <ul class="dropdown-menu w-100" :aria-labelledby="'dropdown-mobile-' + user.id">
                  <li>
                    <a class="dropdown-item" href="#" @click.prevent="editUser(user)">
                      <i class="bi bi-pencil"></i> Modifier
                    </a>
                  </li>
                  <li>
                    <a class="dropdown-item" href="#" @click.prevent="openRoleModal(user)">
                      <i class="bi bi-shield-check"></i> Gérer les rôles
                    </a>
                  </li>
                  <li>
                    <a class="dropdown-item" href="#" @click.prevent="toggleUserActive(user)">
                      <i :class="'bi bi-' + (user.is_active ? 'x-circle' : 'check-circle')"></i>
                      {{ user.is_active ? 'Désactiver' : 'Activer' }}
                    </a>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <a class="dropdown-item" href="#" @click.prevent="impersonateUser(user)">
                      <i class="bi bi-person-circle"></i> Impersonner
                    </a>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <a class="dropdown-item text-danger" href="#" @click.prevent="deleteUser(user)">
                      <i class="bi bi-trash"></i> Supprimer
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Role Assignment Modal -->
        <div v-if="showRoleModal" class="modal show d-block" tabindex="-1" style="">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  Gérer les rôles - {{ editingUser?.username }}
                </h5>
                <button type="button" class="btn-close" @click="closeRoleModal"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-info">
                  <i class="bi bi-info-circle"></i>
                  Sélectionnez un ou plusieurs rôles pour cet utilisateur.
                  Les permissions seront la combinaison de tous les rôles assignés.
                </div>

                <div class="form-check" v-for="role in roles" :key="role.id">
                  <input
                    type="checkbox"
                    :id="'role-' + role.id"
                    :value="role.id"
                    v-model="selectedUserRoles"
                    class="form-check-input"
                  />
                  <label :for="'role-' + role.id" class="form-check-label">
                    <strong>{{ role.display_name }}</strong>
                    <span :class="'badge ms-2 ' + (role.is_system ? 'bg-primary' : 'bg-secondary')">
                      {{ role.is_system ? 'Système' : 'Custom' }}
                    </span>
                    <br>
                    <small class="text-muted">{{ role.description }}</small>
                    <br>
                    <small class="text-muted">{{ role.permission_count }} permissions</small>
                  </label>
                </div>

                <div v-if="roles.length === 0" class="text-center text-muted py-4">
                  Aucun rôle disponible
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="closeRoleModal">
                  Annuler
                </button>
                <button type="button" class="btn btn-primary" @click="saveUserRoles">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bulk Assignment Modal -->
        <div v-if="showBulkModal" class="modal show d-block" tabindex="-1" style="">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  Affectation en masse - {{ getSelectedUsersText() }}
                </h5>
                <button type="button" class="btn-close" @click="closeBulkModal"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle"></i>
                  Les rôles sélectionnés seront <strong>ajoutés</strong> aux utilisateurs sélectionnés
                  (sans supprimer leurs rôles existants).
                </div>

                <div class="form-check" v-for="role in roles" :key="role.id">
                  <input
                    type="checkbox"
                    :id="'bulk-role-' + role.id"
                    :value="role.id"
                    v-model="bulkRoleIds"
                    class="form-check-input"
                  />
                  <label :for="'bulk-role-' + role.id" class="form-check-label">
                    <strong>{{ role.display_name }}</strong>
                    <span :class="'badge ms-2 ' + (role.is_system ? 'bg-primary' : 'bg-secondary')">
                      {{ role.is_system ? 'Système' : 'Custom' }}
                    </span>
                    <br>
                    <small class="text-muted">{{ role.description }}</small>
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="closeBulkModal">
                  Annuler
                </button>
                <button type="button" class="btn btn-primary" @click="bulkAssignRoles">
                  Assigner aux {{ selectedUsers.length }} utilisateur(s)
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Create User Modal -->
        <div v-if="showCreateModal" class="modal show d-block" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  <i class="bi bi-person-plus-fill"></i>
                  Créer un nouvel utilisateur
                </h5>
                <button type="button" class="btn-close" @click="closeCreateModal"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-info">
                  <i class="bi bi-info-circle"></i>
                  Créez un nouvel utilisateur et assignez-lui des rôles (optionnel)
                </div>

                <div class="mb-3">
                  <label for="username" class="form-label">Nom d'utilisateur *</label>
                  <input
                    type="text"
                    class="form-control"
                    id="username"
                    v-model="newUser.username"
                    placeholder="Ex: john.doe"
                    required
                  />
                </div>

                <div class="mb-3">
                  <label for="email" class="form-label">Email *</label>
                  <input
                    type="email"
                    class="form-control"
                    id="email"
                    v-model="newUser.email"
                    placeholder="Ex: john.doe@example.com"
                    required
                  />
                </div>

                <div class="mb-3">
                  <label for="password" class="form-label">Mot de passe *</label>
                  <input
                    type="password"
                    class="form-control"
                    id="password"
                    v-model="newUser.password"
                    placeholder="Minimum 8 caractères"
                    required
                  />
                  <small class="form-text text-muted">
                    Le mot de passe sera hashé automatiquement
                  </small>
                </div>

                <div class="mb-3">
                  <label class="form-label">Rôles (optionnel)</label>
                  <div class="form-check" v-for="role in roles" :key="role.id">
                    <input
                      type="checkbox"
                      class="form-check-input"
                      :id="'create-role-' + role.id"
                      :value="role.id"
                      v-model="newUser.role_ids"
                    />
                    <label class="form-check-label" :for="'create-role-' + role.id">
                      <strong>{{ role.display_name }}</strong>
                      <small class="text-muted d-block">{{ role.description || 'Aucune description' }}</small>
                    </label>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="closeCreateModal">
                  Annuler
                </button>
                <button type="button" class="btn btn-success" @click="createUser">
                  <i class="bi bi-check-lg"></i>
                  Créer l'utilisateur
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}).mount('#admin-users-app');
