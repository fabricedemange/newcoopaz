import { defineStore } from 'pinia';
import {
  fetchAdminOrganizations,
  fetchAdminOrganizationStats,
  postAdminOrganization,
  putAdminOrganization,
  deleteAdminOrganization,
} from '@/api';

export const useAdminOrganizationsStore = defineStore('adminOrganizations', {
  state: () => ({
    organizations: [],
    loading: true,
    error: null,
    editingOrg: null,
    isCreating: false,
    searchQuery: '',
    formData: { name: '', email: '' },
    formErrors: {},
    statsCache: {},
    showOrgModal: false,
  }),

  getters: {
    filteredOrganizations(state) {
      if (!state.searchQuery) return state.organizations;
      const q = state.searchQuery.toLowerCase();
      return state.organizations.filter(
        (org) =>
          (org.name && org.name.toLowerCase().includes(q)) ||
          (org.email && org.email.toLowerCase().includes(q))
      );
    },
    modalTitle(state) {
      return state.isCreating ? 'Nouvelle organisation' : "Modifier l'organisation";
    },
  },

  actions: {
    getStats(orgId) {
      return this.statsCache[orgId] || { users: 0, catalogues: 0, commandes: 0 };
    },
    canDelete(orgId) {
      const stats = this.getStats(orgId);
      return stats.users === 0 && stats.catalogues === 0;
    },
    async loadOrganizations() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminOrganizations();
        if (data.success) {
          this.organizations = data.organizations || [];
          await this.loadAllStats();
        } else throw new Error(data.error);
      } catch (e) {
        this.error = e.message || 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    async loadAllStats() {
      const promises = this.organizations.map((org) => this.loadStats(org.id));
      await Promise.all(promises);
    },
    async loadStats(orgId) {
      try {
        const data = await fetchAdminOrganizationStats(orgId);
        if (data.success) this.statsCache[orgId] = data.stats;
      } catch (e) {
        this.statsCache[orgId] = { users: 0, catalogues: 0, commandes: 0 };
      }
    },
    openCreateModal() {
      this.showOrgModal = true;
      this.isCreating = true;
      this.editingOrg = null;
      this.formData = { name: '', email: '' };
      this.formErrors = {};
    },
    openEditModal(org) {
      this.showOrgModal = true;
      this.isCreating = false;
      this.editingOrg = org;
      this.formData = { name: org.name || '', email: org.email || '' };
      this.formErrors = {};
    },
    closeModal() {
      this.showOrgModal = false;
      this.editingOrg = null;
      this.formErrors = {};
    },
    async saveOrganization() {
      this.formErrors = {};
      if (!this.formData.name || this.formData.name.trim().length < 2) {
        this.formErrors.name = 'Le nom doit contenir au moins 2 caractères';
        return;
      }
      try {
        const body = { name: this.formData.name.trim(), email: this.formData.email?.trim() || null };
        if (this.isCreating) {
          const data = await postAdminOrganization(body);
          if (data.success) {
            this.closeModal();
            await this.loadOrganizations();
            alert(data.message || 'Organisation enregistrée avec succès');
          } else this.formErrors.general = data.error;
        } else {
          const data = await putAdminOrganization(this.editingOrg.id, body);
          if (data.success) {
            this.closeModal();
            await this.loadOrganizations();
            alert(data.message || 'Organisation modifiée avec succès');
          } else this.formErrors.general = data.error;
        }
      } catch (e) {
        this.formErrors.general = e.message || 'Erreur de connexion au serveur';
      }
    },
    async deleteOrganization(org) {
      const stats = this.getStats(org.id);
      if (stats.users > 0 || stats.catalogues > 0) {
        alert(`Impossible de supprimer : ${stats.users} utilisateur(s) et ${stats.catalogues} catalogue(s) associés`);
        return;
      }
      if (!confirm(`Supprimer définitivement l'organisation "${org.name}" ?`)) return;
      try {
        const data = await deleteAdminOrganization(org.id);
        if (data.success) {
          await this.loadOrganizations();
          alert(data.message || 'Organisation supprimée avec succès');
        } else alert(data.error || 'Erreur lors de la suppression');
      } catch (e) {
        alert(e.message || 'Erreur de connexion au serveur');
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    },
  },
});
