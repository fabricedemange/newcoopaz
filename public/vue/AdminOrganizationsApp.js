/**
 * AdminOrganizationsApp - Interface de gestion des organisations
 *
 * Features:
 * - Liste de toutes les organisations
 * - Création, édition, suppression
 * - Statistiques (utilisateurs, catalogues, commandes)
 * - Validation avant suppression
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      organizations: [],
      loading: true,
      error: null,
      editingOrg: null,
      isCreating: false,
      searchQuery: '',
      formData: {
        name: '',
        email: ''
      },
      formErrors: {},
      statsCache: {} // Cache des stats par org
    };
  },
  computed: {
    filteredOrganizations() {
      if (!this.searchQuery) return this.organizations;

      const query = this.searchQuery.toLowerCase();
      return this.organizations.filter(org =>
        (org.name && org.name.toLowerCase().includes(query)) ||
        (org.email && org.email.toLowerCase().includes(query))
      );
    },
    modalTitle() {
      return this.isCreating ? 'Nouvelle organisation' : 'Modifier l\'organisation';
    }
  },
  methods: {
    async loadOrganizations() {
      try {
        this.loading = true;
        const response = await fetch('/api/admin/organizations', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.organizations = data.organizations || [];
          // Charger les stats pour chaque org
          await this.loadAllStats();
        } else {
          this.error = data.error || 'Erreur lors du chargement des organisations';
        }
      } catch (err) {
        console.error('Error loading organizations:', err);
        this.error = 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    async loadAllStats() {
      // Charger les stats pour toutes les organisations en parallèle
      const promises = this.organizations.map(org => this.loadStats(org.id));
      await Promise.all(promises);
    },
    async loadStats(orgId) {
      try {
        const response = await fetch(`/api/admin/organizations/${orgId}/stats`, {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.statsCache[orgId] = data.stats;
        }
      } catch (err) {
        console.error(`Error loading stats for org ${orgId}:`, err);
        this.statsCache[orgId] = { users: 0, catalogues: 0, commandes: 0 };
      }
    },
    getStats(orgId) {
      return this.statsCache[orgId] || { users: 0, catalogues: 0, commandes: 0 };
    },
    openCreateModal() {
      this.isCreating = true;
      this.editingOrg = null;
      this.formData = {
        name: '',
        email: ''
      };
      this.formErrors = {};

      const modal = new bootstrap.Modal(document.getElementById('organizationModal'));
      modal.show();
    },
    openEditModal(org) {
      this.isCreating = false;
      this.editingOrg = org;
      this.formData = {
        name: org.name || '',
        email: org.email || ''
      };
      this.formErrors = {};

      const modal = new bootstrap.Modal(document.getElementById('organizationModal'));
      modal.show();
    },
    async saveOrganization() {
      this.formErrors = {};

      // Validation
      if (!this.formData.name || this.formData.name.trim().length < 2) {
        this.formErrors.name = 'Le nom doit contenir au moins 2 caractères';
        return;
      }

      try {
        const url = this.isCreating
          ? '/api/admin/organizations'
          : `/api/admin/organizations/${this.editingOrg.id}`;

        const method = this.isCreating ? 'POST' : 'PUT';

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': window.CSRF_TOKEN
          },
          body: JSON.stringify(this.formData)
        });

        const data = await response.json();

        if (data.success) {
          // Fermer modal
          const modalEl = document.getElementById('organizationModal');
          const modal = bootstrap.Modal.getInstance(modalEl);
          modal.hide();

          // Recharger la liste
          await this.loadOrganizations();

          // Message succès
          this.showToast(data.message || 'Organisation enregistrée avec succès', 'success');
        } else {
          this.formErrors.general = data.error || 'Erreur lors de l\'enregistrement';
        }
      } catch (err) {
        console.error('Error saving organization:', err);
        this.formErrors.general = 'Erreur de connexion au serveur';
      }
    },
    async deleteOrganization(org) {
      const stats = this.getStats(org.id);

      // Vérifier si l'org a des données
      if (stats.users > 0 || stats.catalogues > 0) {
        alert(`Impossible de supprimer : ${stats.users} utilisateur(s) et ${stats.catalogues} catalogue(s) associés`);
        return;
      }

      if (!confirm(`Supprimer définitivement l'organisation "${org.name}" ?`)) {
        return;
      }

      try {
        const response = await fetch(`/api/admin/organizations/${org.id}`, {
          method: 'DELETE',
          headers: {
            'CSRF-Token': window.CSRF_TOKEN
          }
        });

        const data = await response.json();

        if (data.success) {
          await this.loadOrganizations();
          this.showToast(data.message || 'Organisation supprimée avec succès', 'success');
        } else {
          this.showToast(data.error || 'Erreur lors de la suppression', 'danger');
        }
      } catch (err) {
        console.error('Error deleting organization:', err);
        this.showToast('Erreur de connexion au serveur', 'danger');
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
    canDelete(orgId) {
      const stats = this.getStats(orgId);
      return stats.users === 0 && stats.catalogues === 0;
    },
    showToast(message, type = 'success') {
      // Simple alert pour l'instant
      // TODO: Implémenter un vrai système de toasts
      if (type === 'success') {
        console.log('✓', message);
      } else {
        console.error('✗', message);
      }
    }
  },
  mounted() {
    this.loadOrganizations();
  },
  template: `
    <div class="container-fluid mt-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement des organisations...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-building me-2"></i>Organisations</h2>
          <div class="d-flex gap-2">
            <button @click="loadOrganizations" class="btn btn-outline-primary">
              <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
            </button>
            <button @click="openCreateModal" class="btn btn-primary">
              <i class="bi bi-plus-circle me-2"></i>Nouvelle organisation
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="mb-4">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Rechercher par nom ou email..."
          />
        </div>

        <!-- Organizations List -->
        <div v-if="filteredOrganizations.length === 0" class="alert alert-info">
          Aucune organisation trouvée
        </div>

        <div v-else class="card">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 5%;">ID</th>
                  <th style="width: 25%;">Nom</th>
                  <th style="width: 20%;">Email</th>
                  <th style="width: 10%;">Utilisateurs</th>
                  <th style="width: 10%;">Catalogues</th>
                  <th style="width: 10%;">Commandes</th>
                  <th style="width: 10%;">Créée le</th>
                  <th style="width: 10%;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="org in filteredOrganizations" :key="org.id">
                  <td>{{ org.id }}</td>
                  <td>
                    <strong>{{ org.name }}</strong>
                  </td>
                  <td>
                    <span v-if="org.email" class="text-muted">
                      <i class="bi bi-envelope me-1"></i>{{ org.email }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td>
                    <span class="badge bg-primary">
                      {{ getStats(org.id).users }}
                    </span>
                  </td>
                  <td>
                    <span class="badge bg-info">
                      {{ getStats(org.id).catalogues }}
                    </span>
                  </td>
                  <td>
                    <span class="badge bg-success">
                      {{ getStats(org.id).commandes }}
                    </span>
                  </td>
                  <td>{{ formatDate(org.created_at) }}</td>
                  <td>
                    <div class="d-flex gap-1">
                      <button
                        @click="openEditModal(org)"
                        class="btn btn-sm btn-outline-primary"
                        title="Modifier"
                      >
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        @click="deleteOrganization(org)"
                        class="btn btn-sm btn-outline-danger"
                        :disabled="!canDelete(org.id)"
                        :title="canDelete(org.id) ? 'Supprimer' : 'Impossible de supprimer (données associées)'"
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Summary -->
        <div class="mt-3 text-muted">
          <i class="bi bi-info-circle me-1"></i>
          {{ filteredOrganizations.length }} organisation(s) affichée(s)
        </div>
      </div>

      <!-- Modal Création/Édition -->
      <div class="modal fade" id="organizationModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ modalTitle }}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div v-if="formErrors.general" class="alert alert-danger">
                {{ formErrors.general }}
              </div>

              <div class="mb-3">
                <label class="form-label">Nom de l'organisation *</label>
                <input
                  v-model="formData.name"
                  type="text"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.name }"
                  placeholder="Nom de l'organisation..."
                  required
                />
                <div v-if="formErrors.name" class="invalid-feedback">
                  {{ formErrors.name }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Email de contact (optionnel)</label>
                <input
                  v-model="formData.email"
                  type="email"
                  class="form-control"
                  placeholder="contact@organization.com"
                />
                <small class="text-muted">
                  Email principal de l'organisation (optionnel)
                </small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                Annuler
              </button>
              <button type="button" @click="saveOrganization" class="btn btn-primary">
                <i class="bi bi-check-lg me-2"></i>Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}).mount('#admin-organizations-app');
