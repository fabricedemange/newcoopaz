<template>
  <div>
    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement des utilisateurs...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="alert alert-danger">
      {{ store.error }}
    </div>

    <!-- Main Content -->
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2>Gestion des Utilisateurs</h2>
        <button type="button" class="btn btn-success" @click="store.openCreateModal()">
          <i class="bi bi-person-plus-fill"></i>
          Ajouter un utilisateur
        </button>
      </div>

      <div class="row mb-4">
        <div class="col-md-8">
          <input
            v-model="store.searchQuery"
            type="text"
            class="form-control"
            placeholder="Rechercher un utilisateur..."
          />
        </div>
        <div class="col-md-4">
          <button
            type="button"
            class="btn btn-primary w-100"
            :disabled="store.selectedUsers.length === 0"
            @click="store.openBulkAssignModal()"
          >
            <i class="bi bi-people-fill"></i>
            Affectation en masse
          </button>
        </div>
      </div>

      <div
        v-if="store.selectedUsers.length > 0"
        class="alert alert-info d-flex justify-content-between align-items-center"
      >
        <span>{{ store.getSelectedUsersText() }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="store.selectedUsers = []">
          Désélectionner tout
        </button>
      </div>

      <!-- Desktop table -->
      <div class="d-none d-md-block">
        <div class="card">
          <div class="card-body">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th style="width: 40px">
                    <input
                      type="checkbox"
                      class="form-check-input"
                      :checked="store.allSelected"
                      :indeterminate="store.someSelected"
                      @change="store.toggleSelectAll()"
                    />
                  </th>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Organisation</th>
                  <th>Rôles</th>
                  <th style="width: 80px">Statut</th>
                  <th style="width: 100px">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in store.filteredUsers" :key="user.id">
                  <td>
                    <input
                      type="checkbox"
                      class="form-check-input"
                      :checked="store.isUserSelected(user.id)"
                      @change="store.toggleUserSelection(user.id)"
                    />
                  </td>
                  <td>
                    <strong>{{ user.username }}</strong>
                    <br />
                    <small class="text-muted">Legacy: {{ user.legacy_role }}</small>
                  </td>
                  <td>{{ user.email }}</td>
                  <td>{{ user.organization_name || 'N/A' }}</td>
                  <td>
                    <span :class="'badge ' + store.getRoleBadgeClass(user)">
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
                          <a class="dropdown-item" href="#" @click.prevent="store.editUser(user)">
                            <i class="bi bi-pencil"></i> Modifier
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item" href="#" @click.prevent="store.openRoleModal(user)">
                            <i class="bi bi-shield-check"></i> Gérer les rôles
                          </a>
                        </li>
                        <li>
                          <a class="dropdown-item" href="#" @click.prevent="store.toggleUserActive(user)">
                            <i :class="'bi bi-' + (user.is_active ? 'x-circle' : 'check-circle')"></i>
                            {{ user.is_active ? 'Désactiver' : 'Activer' }}
                          </a>
                        </li>
                        <li><hr class="dropdown-divider" /></li>
                        <li>
                          <a class="dropdown-item" href="#" @click.prevent="store.impersonateUser(user)">
                            <i class="bi bi-person-circle"></i> Impersonner
                          </a>
                        </li>
                        <li><hr class="dropdown-divider" /></li>
                        <li>
                          <a class="dropdown-item text-danger" href="#" @click.prevent="store.deleteUser(user)">
                            <i class="bi bi-trash"></i> Supprimer
                          </a>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="store.filteredUsers.length === 0" class="text-center text-muted py-4">
              Aucun utilisateur trouvé
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="d-md-none">
        <div v-for="user in store.filteredUsers" :key="user.id" class="card mb-3">
          <div class="card-body">
            <div class="form-check mb-3">
              <input
                type="checkbox"
                class="form-check-input"
                :id="'check-' + user.id"
                :checked="store.isUserSelected(user.id)"
                @change="store.toggleUserSelection(user.id)"
              />
              <label class="form-check-label" :for="'check-' + user.id">
                <strong>{{ user.username }}</strong>
              </label>
            </div>
            <p class="card-text mb-2">
              <small class="text-muted">{{ user.email }}</small>
            </p>
            <p class="card-text mb-2">
              <span :class="'badge ' + store.getRoleBadgeClass(user)">
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
                  <a class="dropdown-item" href="#" @click.prevent="store.editUser(user)">
                    <i class="bi bi-pencil"></i> Modifier
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="store.openRoleModal(user)">
                    <i class="bi bi-shield-check"></i> Gérer les rôles
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="store.toggleUserActive(user)">
                    <i :class="'bi bi-' + (user.is_active ? 'x-circle' : 'check-circle')"></i>
                    {{ user.is_active ? 'Désactiver' : 'Activer' }}
                  </a>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="store.impersonateUser(user)">
                    <i class="bi bi-person-circle"></i> Impersonner
                  </a>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item text-danger" href="#" @click.prevent="store.deleteUser(user)">
                    <i class="bi bi-trash"></i> Supprimer
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Role Assignment Modal -->
      <div
        v-if="store.showRoleModal"
        class="modal show d-block"
        tabindex="-1"
        style="background-color: rgba(0,0,0,0.5)"
      >
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Gérer les rôles - {{ store.editingUser?.username }}</h5>
              <button type="button" class="btn-close" @click="store.closeRoleModal()"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                Sélectionnez un ou plusieurs rôles pour cet utilisateur. Les permissions seront la
                combinaison de tous les rôles assignés.
              </div>
              <div v-for="role in store.roles" :key="role.id" class="form-check">
                <input
                  :id="'role-' + role.id"
                  type="checkbox"
                  class="form-check-input"
                  :value="role.id"
                  v-model="store.selectedUserRoles"
                />
                <label :for="'role-' + role.id" class="form-check-label">
                  <strong>{{ role.display_name }}</strong>
                  <span :class="'badge ms-2 ' + (role.is_system ? 'bg-primary' : 'bg-secondary')">
                    {{ role.is_system ? 'Système' : 'Custom' }}
                  </span>
                  <br />
                  <small class="text-muted">{{ role.description }}</small>
                  <br />
                  <small class="text-muted">{{ role.permission_count }} permissions</small>
                </label>
              </div>
              <div v-if="store.roles.length === 0" class="text-center text-muted py-4">
                Aucun rôle disponible
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="store.closeRoleModal()">
                Annuler
              </button>
              <button type="button" class="btn btn-primary" @click="store.saveUserRoles()">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Assignment Modal -->
      <div
        v-if="store.showBulkModal"
        class="modal show d-block"
        tabindex="-1"
        style="background-color: rgba(0,0,0,0.5)"
      >
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Affectation en masse - {{ store.getSelectedUsersText() }}</h5>
              <button type="button" class="btn-close" @click="store.closeBulkModal()"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i>
                Les rôles sélectionnés seront <strong>ajoutés</strong> aux utilisateurs sélectionnés (sans
                supprimer leurs rôles existants).
              </div>
              <div v-for="role in store.roles" :key="role.id" class="form-check">
                <input
                  :id="'bulk-role-' + role.id"
                  type="checkbox"
                  class="form-check-input"
                  :value="role.id"
                  v-model="store.bulkRoleIds"
                />
                <label :for="'bulk-role-' + role.id" class="form-check-label">
                  <strong>{{ role.display_name }}</strong>
                  <span :class="'badge ms-2 ' + (role.is_system ? 'bg-primary' : 'bg-secondary')">
                    {{ role.is_system ? 'Système' : 'Custom' }}
                  </span>
                  <br />
                  <small class="text-muted">{{ role.description }}</small>
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="store.closeBulkModal()">
                Annuler
              </button>
              <button type="button" class="btn btn-primary" @click="store.bulkAssignRoles()">
                Assigner aux {{ store.selectedUsers.length }} utilisateur(s)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create User Modal -->
      <div
        v-if="store.showCreateModal"
        class="modal show d-block"
        tabindex="-1"
        style="background-color: rgba(0,0,0,0.5)"
      >
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-person-plus-fill"></i>
                Créer un nouvel utilisateur
              </h5>
              <button type="button" class="btn-close" @click="store.closeCreateModal()"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                Créez un nouvel utilisateur et assignez-lui des rôles (optionnel)
              </div>
              <div class="mb-3">
                <label for="username" class="form-label">Nom d'utilisateur *</label>
                <input
                  id="username"
                  v-model="store.newUser.username"
                  type="text"
                  class="form-control"
                  placeholder="Ex: john.doe"
                  required
                />
              </div>
              <div class="mb-3">
                <label for="email" class="form-label">Email *</label>
                <input
                  id="email"
                  v-model="store.newUser.email"
                  type="email"
                  class="form-control"
                  placeholder="Ex: john.doe@example.com"
                  required
                />
              </div>
              <div class="mb-3">
                <label for="password" class="form-label">Mot de passe *</label>
                <input
                  id="password"
                  v-model="store.newUser.password"
                  type="password"
                  class="form-control"
                  placeholder="Minimum 8 caractères"
                  required
                />
                <small class="form-text text-muted">Le mot de passe sera hashé automatiquement</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Rôles (optionnel)</label>
                <div v-for="role in store.roles" :key="role.id" class="form-check">
                  <input
                    :id="'create-role-' + role.id"
                    type="checkbox"
                    class="form-check-input"
                    :value="role.id"
                    v-model="store.newUser.role_ids"
                  />
                  <label class="form-check-label" :for="'create-role-' + role.id">
                    <strong>{{ role.display_name }}</strong>
                    <small class="text-muted d-block">{{ role.description || 'Aucune description' }}</small>
                  </label>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="store.closeCreateModal()">
                Annuler
              </button>
              <button type="button" class="btn btn-success" @click="store.createUser()">
                <i class="bi bi-check-lg"></i>
                Créer l'utilisateur
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAdminUsersStore } from '@/stores/adminUsers';

const store = useAdminUsersStore();

onMounted(() => {
  store.loadData();
});
</script>

<style scoped>
.modal.show.d-block {
  z-index: 9999;
}
</style>
