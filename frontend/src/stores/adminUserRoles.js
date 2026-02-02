import { defineStore } from 'pinia';
import {
  fetchAdminRoles,
  fetchAdminUserRoles,
  fetchAdminUserEffectivePermissions,
  postAdminUserRole,
  deleteAdminUserRole,
} from '@/api';

export const useAdminUserRolesStore = defineStore('adminUserRoles', {
  state: () => ({
    userId: null,
    user: null,
    availableRoles: [],
    userRoles: [],
    effectivePermissions: {},
    loading: true,
    error: null,
    showAddModal: false,
    selectedRoleId: null,
    expiresAt: null,
    reason: '',
  }),

  getters: {
    permissionCount(state) {
      return Object.values(state.effectivePermissions).reduce((sum, perms) => sum + perms.length, 0);
    },
    userRoleIds(state) {
      return state.userRoles.map((ur) => ur.id);
    },
  },

  actions: {
    setUserId(id) {
      this.userId = id;
    },
    hasRole(roleId) {
      return this.userRoles.some((ur) => ur.id === roleId);
    },
    async loadData() {
      if (!this.userId) {
        this.loading = false;
        this.error = 'ID utilisateur manquant';
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const [rolesData, userRolesData, permsData] = await Promise.all([
          fetchAdminRoles(),
          fetchAdminUserRoles(this.userId),
          fetchAdminUserEffectivePermissions(this.userId),
        ]);
        if (rolesData.success) this.availableRoles = rolesData.roles || [];
        if (userRolesData.success) this.userRoles = userRolesData.roles || [];
        if (permsData.success) this.effectivePermissions = permsData.permissions || {};
      } catch (e) {
        this.error = e.message || 'Erreur de chargement des données';
      } finally {
        this.loading = false;
      }
    },
    openAddModal() {
      this.selectedRoleId = null;
      this.expiresAt = null;
      this.reason = '';
      this.showAddModal = true;
    },
    closeModal() {
      this.showAddModal = false;
    },
    async assignRole() {
      if (!this.selectedRoleId) {
        alert('Veuillez sélectionner un rôle');
        return;
      }
      try {
        const data = await postAdminUserRole(this.userId, {
          role_id: this.selectedRoleId,
          expires_at: this.expiresAt || null,
          reason: this.reason || null,
        });
        if (data.success) {
          this.closeModal();
          await this.loadData();
        } else alert('Erreur: ' + data.error);
      } catch (e) {
        alert(e.message || "Erreur lors de l'assignation");
      }
    },
    async removeRole(roleId) {
      if (!confirm('Êtes-vous sûr de vouloir retirer ce rôle ?')) return;
      try {
        const data = await deleteAdminUserRole(this.userId, roleId);
        if (data.success) await this.loadData();
        else alert('Erreur: ' + data.error);
      } catch (e) {
        alert(e.message || 'Erreur lors du retrait');
      }
    },
  },
});
