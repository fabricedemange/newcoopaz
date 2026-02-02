import { defineStore } from 'pinia';
import {
  fetchAdminUsers,
  fetchAdminRoles,
  fetchAdminUserDetail,
  postAdminUser,
  putAdminUserRoles,
  postAdminUsersBulkAssignRoles,
  putAdminUserToggleActive,
  deleteAdminUser,
} from '@/api';

export const useAdminUsersStore = defineStore('adminUsers', {
  state: () => ({
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
      role_ids: [],
    },
  }),

  getters: {
    filteredUsers(state) {
      if (!state.searchQuery) return state.users;
      const query = state.searchQuery.toLowerCase();
      return state.users.filter(
        (u) =>
          (u.username && u.username.toLowerCase().includes(query)) ||
          (u.email && u.email.toLowerCase().includes(query)) ||
          (u.role_names && u.role_names.toLowerCase().includes(query))
      );
    },
    allSelected(state) {
      const filtered = state.searchQuery
        ? state.users.filter(
            (u) =>
              (u.username && u.username.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (u.email && u.email.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (u.role_names && u.role_names.toLowerCase().includes(state.searchQuery.toLowerCase()))
          )
        : state.users;
      return filtered.length > 0 && state.selectedUsers.length === filtered.length;
    },
    someSelected(state) {
      const filtered = state.searchQuery
        ? state.users.filter(
            (u) =>
              (u.username && u.username.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (u.email && u.email.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
              (u.role_names && u.role_names.toLowerCase().includes(state.searchQuery.toLowerCase()))
          )
        : state.users;
      const allSel = filtered.length > 0 && state.selectedUsers.length === filtered.length;
      return state.selectedUsers.length > 0 && !allSel;
    },
  },

  actions: {
    async loadUsers() {
      try {
        const data = await fetchAdminUsers();
        if (data.success) this.users = data.users || [];
        else this.error = data.error || 'Erreur lors du chargement des utilisateurs';
      } catch (err) {
        console.error('Error loading users:', err);
        this.error = err.message || 'Erreur de connexion au serveur';
      }
    },

    async loadRoles() {
      try {
        const data = await fetchAdminRoles();
        if (data.success) this.roles = data.roles || [];
        else this.error = data.error || 'Erreur lors du chargement des rôles';
      } catch (err) {
        console.error('Error loading roles:', err);
        this.error = err.message || 'Erreur de connexion au serveur';
      }
    },

    openCreateModal() {
      this.newUser = { username: '', email: '', password: '', role_ids: [] };
      this.showCreateModal = true;
    },

    closeCreateModal() {
      this.showCreateModal = false;
      this.newUser = { username: '', email: '', password: '', role_ids: [] };
    },

    async createUser() {
      if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
      }
      try {
        await postAdminUser(this.newUser);
        alert('Utilisateur créé avec succès');
        this.closeCreateModal();
        await this.loadUsers();
      } catch (err) {
        alert(err.message || "Erreur lors de la création");
      }
    },

    async openRoleModal(user) {
      try {
        const data = await fetchAdminUserDetail(user.id);
        if (data.success) {
          this.editingUser = { ...data.user };
          this.selectedUserRoles = data.role_ids || [];
          this.showRoleModal = true;
        } else {
          alert('Erreur: ' + data.error);
        }
      } catch (err) {
        alert(err.message || 'Erreur de chargement');
      }
    },

    async saveUserRoles() {
      if (!this.editingUser) return;
      try {
        await putAdminUserRoles(this.editingUser.id, { role_ids: this.selectedUserRoles });
        this.showRoleModal = false;
        this.editingUser = null;
        this.selectedUserRoles = [];
        await this.loadUsers();
        alert('Rôles mis à jour avec succès');
      } catch (err) {
        alert(err.message || 'Erreur lors de la sauvegarde');
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
        this.selectedUsers = this.filteredUsers.map((u) => u.id);
      }
    },

    toggleUserSelection(userId) {
      const index = this.selectedUsers.indexOf(userId);
      if (index > -1) {
        this.selectedUsers = this.selectedUsers.filter((id) => id !== userId);
      } else {
        this.selectedUsers = [...this.selectedUsers, userId];
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
        const data = await postAdminUsersBulkAssignRoles({
          user_ids: this.selectedUsers,
          role_ids: this.bulkRoleIds,
        });
        this.showBulkModal = false;
        this.selectedUsers = [];
        this.bulkRoleIds = [];
        await this.loadUsers();
        alert(data.message || 'Rôles assignés avec succès');
      } catch (err) {
        alert(err.message || "Erreur lors de l'assignation");
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
        await putAdminUserToggleActive(user.id, { is_active: newStatus });
        await this.loadUsers();
        alert(`Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`);
      } catch (err) {
        alert(err.message || 'Erreur lors de la modification');
      }
    },

    impersonateUser(user) {
      if (!confirm(`Voulez-vous vous connecter en tant que "${user.username}" ?`)) return;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/admin/impersonate';
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = '_csrf';
      csrfInput.value = typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '';
      form.appendChild(csrfInput);
      const userIdInput = document.createElement('input');
      userIdInput.type = 'hidden';
      userIdInput.name = 'user_id';
      userIdInput.value = user.id;
      form.appendChild(userIdInput);
      document.body.appendChild(form);
      form.submit();
    },

    editUser(user) {
      window.location.href = `/admin/users/${user.id}/edit`;
    },

    async deleteUser(user) {
      if (
        !confirm(
          `⚠️ ATTENTION : Êtes-vous sûr de vouloir SUPPRIMER l'utilisateur "${user.username}" ?\n\nCette action est IRRÉVERSIBLE.`
        )
      ) {
        return;
      }
      try {
        await deleteAdminUser(user.id);
        await this.loadUsers();
        alert('Utilisateur supprimé avec succès');
      } catch (err) {
        alert(err.message || 'Erreur lors de la suppression');
      }
    },

    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        await Promise.all([this.loadUsers(), this.loadRoles()]);
      } catch (err) {
        this.error = err.message || "Erreur d'initialisation";
      } finally {
        this.loading = false;
      }
    },
  },
});
