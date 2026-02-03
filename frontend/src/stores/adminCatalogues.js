import { defineStore } from 'pinia';
import { fetchAdminCatalogues, fetchAdminCataloguesAlerteRecipientsCount } from '@/api';

function filterCatalogues(catalogues, searchTerm) {
  if (!searchTerm) return catalogues;
  const term = searchTerm.toLowerCase();
  return catalogues.filter(
    (c) =>
      (c.originalname && c.originalname.toLowerCase().includes(term)) ||
      (c.username && c.username.toLowerCase().includes(term)) ||
      (c.organization_name && c.organization_name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
  );
}

function sortCatalogues(catalogues, column, direction) {
  if (!catalogues || catalogues.length === 0) return catalogues;
  const sorted = [...catalogues].sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];
    if (column === 'expiration_date' || column === 'livraison_date') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (column === 'id' || column === 'nb_paniers' || column === 'is_archived') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else {
      aVal = (aVal || '').toString().toLowerCase();
      bVal = (bVal || '').toString().toLowerCase();
    }
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

export const useAdminCataloguesStore = defineStore('adminCatalogues', {
  state: () => ({
    catalogues: [],
    archivedCatalogues: [],
    loading: true,
    error: null,
    role: null,
    referentScopeActive: false,
    showAllScope: true,
    searchActive: '',
    searchArchived: '',
    sortColumnActive: 'id',
    sortDirectionActive: 'desc',
    sortColumnArchived: 'id',
    sortDirectionArchived: 'desc',
  }),

  getters: {
    activeCataloguesSorted(state) {
      const filtered = filterCatalogues(state.catalogues, state.searchActive);
      return sortCatalogues(filtered, state.sortColumnActive, state.sortDirectionActive);
    },
    archivedCataloguesSorted(state) {
      const filtered = filterCatalogues(state.archivedCatalogues, state.searchArchived);
      return sortCatalogues(filtered, state.sortColumnArchived, state.sortDirectionArchived);
    },
    isSuperAdmin(state) {
      return state.role === 'SuperAdmin';
    },
  },

  actions: {
    async loadCatalogues(scope) {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAdminCatalogues(scope);
        if (data.success) {
          this.catalogues = data.catalogues || [];
          this.archivedCatalogues = data.archivedCatalogues || [];
          this.role = data.role;
          this.referentScopeActive = data.referentScopeActive;
          this.showAllScope = data.showAllScope;
        } else {
          throw new Error(data.error || 'Erreur lors du chargement des catalogues');
        }
      } catch (e) {
        this.error = e.message || 'Erreur lors du chargement';
      } finally {
        this.loading = false;
      }
    },

    handleSort(column, isArchived) {
      if (isArchived) {
        if (this.sortColumnArchived === column) {
          this.sortDirectionArchived = this.sortDirectionArchived === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumnArchived = column;
          this.sortDirectionArchived = 'asc';
        }
      } else {
        if (this.sortColumnActive === column) {
          this.sortDirectionActive = this.sortDirectionActive === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumnActive = column;
          this.sortDirectionActive = 'asc';
        }
      }
    },

    getVisibilityBadge(isArchived) {
      const badges = {
        0: { label: 'Visible', class: 'bg-success' },
        2: { label: 'Référents seulement', class: 'bg-warning' },
        3: { label: 'Masqué', class: 'bg-secondary' },
      };
      return badges[isArchived] ?? badges[0];
    },

    async changeVisibility(catalogueId, newVisibilite) {
      const csrf = typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '';
      const response = await fetch(`/admin/catalogues/${catalogueId}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'csrf-token': csrf },
        credentials: 'include',
        body: JSON.stringify({ is_archived: newVisibilite }),
      });
      if (!response.ok) throw new Error('Erreur lors du changement de visibilité');
      const urlParams = new URLSearchParams(window.location.search);
      await this.loadCatalogues(urlParams.get('scope'));
    },

    async archiveCatalogue(catalogueId) {
      if (!confirm("Confirmer l'archivage de ce catalogue ?")) return;
      await this.changeVisibility(catalogueId, 3);
    },

    async unarchiveCatalogue(catalogueId) {
      if (!confirm("Confirmer la désarchivage de ce catalogue ?")) return;
      await this.changeVisibility(catalogueId, 0);
    },

    async deleteCatalogue(catalogueId) {
      if (
        !confirm(
          "Masquer complètement ce catalogue ? Il restera accessible dans l'historique des commandes mais ne sera plus visible dans les listes."
        )
      ) {
        return;
      }
      await this.changeVisibility(catalogueId, 3);
    },

    async sendAlerteMail(catalogueId) {
      let count = null; // null = erreur ou non récupéré, 0 = zéro destinataire
      try {
        const data = await fetchAdminCataloguesAlerteRecipientsCount(catalogueId);
        if (data.success && data.count != null) count = Number(data.count);
      } catch (_) {
        count = null;
      }
      if (count === 0) {
        alert("Aucun destinataire : aucune personne n'a commandé ce catalogue (avec compte validé et email). L'envoi d'alerte n'est pas possible.");
        return;
      }
      if (count === null) {
        if (!confirm("Impossible de récupérer le nombre de destinataires. Envoyer l'alerte quand même ?")) return;
      } else {
        if (!confirm(`Envoyer une alerte par mail à ${count} personne(s) ayant commandé ce catalogue ?`)) return;
      }
      const csrf = typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '';
      const response = await fetch(`/admin/catalogues/${catalogueId}/alerte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'csrf-token': csrf },
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Erreur lors de l'envoi du mail");
      alert("Mail d'alerte envoyé avec succès !");
    },

    async sendRappelMail(catalogueId) {
      if (!confirm('Envoyer un rappel par mail à tous les utilisateurs ?')) return;
      const csrf = typeof window !== 'undefined' && window.CSRF_TOKEN ? window.CSRF_TOKEN : '';
      const response = await fetch(`/admin/catalogues/${catalogueId}/rappel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'csrf-token': csrf },
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Erreur lors de l'envoi du mail");
      alert('Mail de rappel envoyé avec succès !');
    },

    async loadData() {
      const urlParams = new URLSearchParams(window.location.search);
      const scope = urlParams.get('scope') || (this.referentScopeActive ? 'all' : null);
      await this.loadCatalogues(scope);
    },
  },
});
