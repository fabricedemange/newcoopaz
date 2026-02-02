import { defineStore } from 'pinia';
import {
  fetchAdminRoles,
  fetchAdminRolePermissions,
  fetchAdminPermissions,
  putAdminRole,
  postAdminRole,
  deleteAdminRole,
} from '@/api';

export const useAdminRolesStore = defineStore('adminRoles', {
  state: () => ({
    roles: [],
    permissions: {},
    modules: [],
    loading: true,
    error: null,
    expandedRole: null,
    rolePermissions: {},
    savingRoleId: null,
    savedRoleId: null,
    searchQuery: '',
    showCreateForm: false,
    newRole: {
      name: '',
      display_name: '',
      description: '',
    },
  }),

  getters: {
    systemRoles(state) {
      return state.roles.filter((r) => r.is_system === 1);
    },
    customRoles(state) {
      return state.roles.filter((r) => r.is_system === 0);
    },
    filteredRoles(state) {
      if (!state.searchQuery) return state.roles;
      const query = state.searchQuery.toLowerCase();
      return state.roles.filter(
        (r) =>
          (r.display_name && r.display_name.toLowerCase().includes(query)) ||
          (r.name && r.name.toLowerCase().includes(query)) ||
          (r.description && r.description.toLowerCase().includes(query))
      );
    },
    filteredSystemRoles(state) {
      const filtered = state.searchQuery
        ? state.roles.filter(
            (r) =>
              r.is_system === 1 &&
              ((r.display_name && r.display_name.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
                (r.name && r.name.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
                (r.description && r.description.toLowerCase().includes(state.searchQuery.toLowerCase())))
          )
        : state.roles.filter((r) => r.is_system === 1);
      return filtered;
    },
    filteredCustomRoles(state) {
      const filtered = state.searchQuery
        ? state.roles.filter(
            (r) =>
              r.is_system === 0 &&
              ((r.display_name && r.display_name.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
                (r.name && r.name.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
                (r.description && r.description.toLowerCase().includes(state.searchQuery.toLowerCase())))
          )
        : state.roles.filter((r) => r.is_system === 0);
      return filtered;
    },
  },

  actions: {
    async loadRoles() {
      try {
        const data = await fetchAdminRoles();
        if (data.success) {
          this.roles = data.roles || [];
          for (const role of this.roles) {
            await this.loadRolePermissions(role.id);
          }
        } else {
          this.error = data.error || 'Erreur lors du chargement des rôles';
        }
      } catch (err) {
        console.error('Error loading roles:', err);
        this.error = err.message || 'Erreur de connexion au serveur';
      }
    },

    async loadRolePermissions(roleId) {
      try {
        const data = await fetchAdminRolePermissions(roleId);
        if (data.success) {
          this.rolePermissions = { ...this.rolePermissions, [roleId]: data.permission_ids || [] };
        }
      } catch (err) {
        console.error('Error loading role permissions:', err);
      }
    },

    async loadPermissions() {
      try {
        const data = await fetchAdminPermissions();
        if (data.success) {
          this.permissions = data.permissions || {};
          this.modules = data.modules || [];
        } else {
          this.error = data.error || 'Erreur lors du chargement des permissions';
        }
      } catch (err) {
        console.error('Error loading permissions:', err);
        this.error = err.message || 'Erreur de connexion au serveur';
      }
    },

    toggleRole(roleId) {
      this.expandedRole = this.expandedRole === roleId ? null : roleId;
    },

    isRoleExpanded(roleId) {
      return this.expandedRole === roleId;
    },

    togglePermission(roleId, permissionId) {
      const perms = [...(this.rolePermissions[roleId] || [])];
      const index = perms.indexOf(permissionId);
      if (index > -1) {
        perms.splice(index, 1);
      } else {
        perms.push(permissionId);
      }
      this.rolePermissions = { ...this.rolePermissions, [roleId]: perms };
    },

    hasPermission(roleId, permissionId) {
      const perms = this.rolePermissions[roleId] || [];
      return perms.includes(permissionId);
    },

    selectAllModulePermissions(roleId, module) {
      const modulePermissions = this.permissions[module] || [];
      const rolePerms = [...(this.rolePermissions[roleId] || [])];
      const allSelected = modulePermissions.every((p) => rolePerms.includes(p.id));
      const modulePermIds = modulePermissions.map((p) => p.id);
      if (allSelected) {
        const filtered = rolePerms.filter((id) => !modulePermIds.includes(id));
        this.rolePermissions = { ...this.rolePermissions, [roleId]: filtered };
      } else {
        const newPerms = [...new Set([...rolePerms, ...modulePermIds])];
        this.rolePermissions = { ...this.rolePermissions, [roleId]: newPerms };
      }
    },

    isModuleFullySelected(roleId, module) {
      const modulePermissions = this.permissions[module] || [];
      const rolePerms = this.rolePermissions[roleId] || [];
      return (
        modulePermissions.length > 0 &&
        modulePermissions.every((p) => rolePerms.includes(p.id))
      );
    },

    async saveRolePermissions(role) {
      this.savingRoleId = role.id;
      try {
        await putAdminRole(role.id, {
          name: role.name,
          display_name: role.display_name,
          description: role.description,
          permission_ids: this.rolePermissions[role.id] || [],
        });
        this.savedRoleId = role.id;
        setTimeout(() => {
          this.savedRoleId = null;
        }, 2000);
        await this.loadRoles();
      } catch (err) {
        alert(err.message || 'Erreur lors de la sauvegarde');
      } finally {
        this.savingRoleId = null;
      }
    },

    async createRole() {
      if (!this.newRole.name || !this.newRole.display_name) {
        alert("Le nom et le nom d'affichage sont requis");
        return;
      }
      try {
        await postAdminRole({
          name: this.newRole.name,
          display_name: this.newRole.display_name,
          description: this.newRole.description,
          permission_ids: [],
        });
        this.showCreateForm = false;
        this.newRole = { name: '', display_name: '', description: '' };
        await this.loadRoles();
      } catch (err) {
        alert(err.message || "Erreur lors de la création");
      }
    },

    async deleteRole(role) {
      if (role.user_count > 0) {
        alert(
          `Impossible de supprimer ce rôle : ${role.user_count} utilisateur(s) l'utilisent encore`
        );
        return;
      }
      if (!confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.display_name}" ?`)) {
        return;
      }
      try {
        await deleteAdminRole(role.id);
        await this.loadRoles();
      } catch (err) {
        alert(err.message || 'Erreur lors de la suppression');
      }
    },

    cancelCreate() {
      this.showCreateForm = false;
      this.newRole = { name: '', display_name: '', description: '' };
    },

    async loadData() {
      this.loading = true;
      this.error = null;
      try {
        await Promise.all([this.loadRoles(), this.loadPermissions()]);
      } catch (err) {
        this.error = err.message || "Erreur d'initialisation";
      } finally {
        this.loading = false;
      }
    },
  },
});
