import { defineStore } from 'pinia';
import {
  fetchAdminBandeaux,
  fetchAdminBandeauxOrganizations,
  postAdminBandeau,
  putAdminBandeau,
  deleteAdminBandeau,
} from '@/api';

export const useAdminBandeauxStore = defineStore('adminBandeaux', {
  state: () => ({
    bandeaux: [],
    organizations: [],
    loading: true,
    error: null,
    userRole: '',
    organizationId: null,
    editingBandeau: null,
    isCreating: false,
    showBandeauModal: false,
    searchQuery: '',
    filterType: '',
    formData: {
      message: '',
      type: 'info',
      page_cible: '',
      expiration_date: '',
      organization_id: '',
    },
    formErrors: {},
  }),

  getters: {
    filteredBandeaux(state) {
      let result = [...state.bandeaux];
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        result = result.filter(
          (b) =>
            (b.message && b.message.toLowerCase().includes(q)) ||
            (b.organization_name && b.organization_name.toLowerCase().includes(q))
        );
      }
      if (state.filterType) result = result.filter((b) => b.type === state.filterType);
      return result;
    },
    isSuperAdmin(state) {
      return state.userRole === 'SuperAdmin';
    },
    modalTitle(state) {
      return state.isCreating ? 'Nouveau bandeau' : 'Modifier le bandeau';
    },
  },

  actions: {
    async loadBandeaux() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminBandeaux();
        if (data.success) {
          this.bandeaux = data.bandeaux || [];
          this.userRole = data.userRole || '';
          this.organizationId = data.organizationId ?? null;
        } else throw new Error(data.error);
      } catch (e) {
        this.error = e.message || 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    async loadOrganizations() {
      if (this.userRole !== 'SuperAdmin') return;
      try {
        const data = await fetchAdminBandeauxOrganizations();
        if (data.success) this.organizations = data.organizations || [];
      } catch (e) {
        console.error('Error loading organizations:', e);
      }
    },
    openCreateModal() {
      this.showBandeauModal = true;
      this.isCreating = true;
      this.editingBandeau = null;
      this.formData = {
        message: '',
        type: 'info',
        page_cible: '',
        expiration_date: '',
        organization_id: this.userRole === 'SuperAdmin' ? '' : String(this.organizationId || ''),
      };
      this.formErrors = {};
      if (this.userRole === 'SuperAdmin') this.loadOrganizations();
    },
    openEditModal(bandeau) {
      this.showBandeauModal = true;
      this.isCreating = false;
      this.editingBandeau = bandeau;
      let formattedDate = '';
      if (bandeau.expiration_date) {
        const date = new Date(bandeau.expiration_date);
        if (!isNaN(date.getTime())) formattedDate = date.toISOString().slice(0, 16);
      }
      this.formData = {
        message: bandeau.message || '',
        type: bandeau.type || 'info',
        page_cible: bandeau.page_cible || '',
        expiration_date: formattedDate,
        organization_id: bandeau.organization_id ? String(bandeau.organization_id) : '',
      };
      this.formErrors = {};
      if (this.userRole === 'SuperAdmin') this.loadOrganizations();
    },
    closeModal() {
      this.showBandeauModal = false;
      this.editingBandeau = null;
      this.isCreating = false;
      this.formErrors = {};
    },
    async saveBandeau() {
      this.formErrors = {};
      if (!this.formData.message || !this.formData.message.trim()) {
        this.formErrors.message = 'Le message est obligatoire';
        return;
      }
      if (!this.formData.type) {
        this.formErrors.type = 'Le type est obligatoire';
        return;
      }
      try {
        const body = {
          message: this.formData.message.trim(),
          type: this.formData.type,
          page_cible: this.formData.page_cible?.trim() || null,
          expiration_date: this.formData.expiration_date || null,
          organization_id: this.formData.organization_id || null,
        };
        if (this.isCreating) {
          const data = await postAdminBandeau(body);
          if (data.success) {
            this.closeModal();
            await this.loadBandeaux();
            alert(data.message || 'Bandeau enregistré avec succès');
          } else this.formErrors.general = data.error;
        } else {
          const data = await putAdminBandeau(this.editingBandeau.id, body);
          if (data.success) {
            this.closeModal();
            await this.loadBandeaux();
            alert(data.message || 'Bandeau enregistré avec succès');
          } else this.formErrors.general = data.error;
        }
      } catch (e) {
        this.formErrors.general = e.message || 'Erreur de connexion au serveur';
      }
    },
    async deleteBandeau(bandeau) {
      if (!confirm(`Supprimer le bandeau "${(bandeau.message || '').substring(0, 50)}..." ?`)) return;
      try {
        const data = await deleteAdminBandeau(bandeau.id);
        if (data.success) {
          await this.loadBandeaux();
          alert(data.message || 'Bandeau supprimé avec succès');
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
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    },
    isExpired(dateStr) {
      if (!dateStr) return false;
      return new Date(dateStr) < new Date();
    },
    truncate(str, maxLength = 100) {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    },
    getTypeBadgeClass(type) {
      return type === 'important' ? 'bg-danger' : 'bg-info';
    },
    getTypeLabel(type) {
      return type === 'important' ? 'Important' : 'Info';
    },
  },
});
