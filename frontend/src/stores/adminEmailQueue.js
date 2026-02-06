import { defineStore } from 'pinia';
import { fetchAdminEmailQueue, fetchEmailQueueSettings, updateEmailQueueSettings } from '@/api';

export const useAdminEmailQueueStore = defineStore('adminEmailQueue', {
  state: () => ({
    entries: [],
    subjectSummary: [],
    loading: true,
    error: null,
    searchQuery: '',
    currentTab: 'notifications',
    limit: 500,
    statusFilter: 'all',
    settings: {
      mailQueueSendEnabled: false,
      catalogueOrderReminderEnabled: false,
    },
    settingsLoading: false,
    settingsError: null,
  }),

  getters: {
    filteredSummary(state) {
      if (!state.searchQuery) return state.subjectSummary;
      const q = state.searchQuery.toLowerCase();
      return state.subjectSummary.filter(
        (item) =>
          (item.subject && item.subject.toLowerCase().includes(q)) ||
          (item.initiated_by_display && item.initiated_by_display.toLowerCase().includes(q))
      );
    },
    filteredEntries(state) {
      let filtered = [...state.entries];
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            (e.subject && e.subject.toLowerCase().includes(q)) ||
            (e.to_display && e.to_display.toLowerCase().includes(q)) ||
            (e.initiated_by_display && e.initiated_by_display.toLowerCase().includes(q))
        );
      }
      if (state.statusFilter !== 'all') {
        if (state.statusFilter === 'pending') filtered = filtered.filter((e) => e.status === 'pending' || e.status === 'sending');
        else if (state.statusFilter === 'failed') filtered = filtered.filter((e) => e.status === 'failed');
        else filtered = filtered.filter((e) => e.status === state.statusFilter);
      }
      return filtered;
    },
    stats(state) {
      const totalNotifications = state.subjectSummary.reduce((sum, item) => sum + (item.total_count || 0), 0);
      const sentNotifications = state.subjectSummary.reduce((sum, item) => sum + (item.sent_count || 0), 0);
      const pendingNotifications = state.subjectSummary.reduce((sum, item) => sum + (item.pending_count || 0), 0);
      const totalIndividual = state.entries.length;
      const sentIndividual = state.entries.filter((e) => e.status === 'sent').length;
      const pendingIndividual = state.entries.filter((e) => e.status === 'pending' || e.status === 'sending').length;
      const failedIndividual = state.entries.filter((e) => e.status === 'failed').length;
      return {
        notifications: { total: totalNotifications, sent: sentNotifications, pending: pendingNotifications },
        individual: { total: totalIndividual, sent: sentIndividual, pending: pendingIndividual, failed: failedIndividual },
      };
    },
  },

  actions: {
    async loadEmailQueue() {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminEmailQueue(this.limit);
        if (data.success) {
          this.entries = data.entries || [];
          this.subjectSummary = data.subjectSummary || [];
        } else throw new Error(data.error);
      } catch (e) {
        this.error = e.message || 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    async loadSettings() {
      this.settingsLoading = true;
      this.settingsError = null;
      try {
        const data = await fetchEmailQueueSettings();
        if (data.success) {
          this.settings.mailQueueSendEnabled = !!data.mailQueueSendEnabled;
          this.settings.catalogueOrderReminderEnabled = !!data.catalogueOrderReminderEnabled;
        } else throw new Error(data.error);
      } catch (e) {
        this.settingsError = e.message || 'Erreur chargement réglages';
      } finally {
        this.settingsLoading = false;
      }
    },
    async updateSetting(key, value) {
      const payload = key === 'mailQueueSendEnabled'
        ? { mailQueueSendEnabled: value }
        : { catalogueOrderReminderEnabled: value };
      try {
        const data = await updateEmailQueueSettings(payload);
        if (data.success) {
          this.settings.mailQueueSendEnabled = !!data.mailQueueSendEnabled;
          this.settings.catalogueOrderReminderEnabled = !!data.catalogueOrderReminderEnabled;
        } else throw new Error(data.error);
      } catch (e) {
        this.settingsError = e.message || 'Erreur mise à jour';
        throw e;
      }
    },
    formatDate(dateStr) {
      if (!dateStr || dateStr === '—') return '—';
      return dateStr;
    },
    getStatusBadgeClass(status) {
      const classes = { sent: 'bg-success', pending: 'bg-warning text-dark', sending: 'bg-info text-dark', failed: 'bg-danger' };
      return classes[status] || 'bg-secondary';
    },
    getStatusLabel(status) {
      const labels = { sent: 'Envoyé', pending: 'En attente', sending: 'Envoi en cours', failed: 'Échec' };
      return labels[status] || status;
    },
    truncate(str, maxLength = 60) {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    },
  },
});
