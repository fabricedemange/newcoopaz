/**
 * AdminBandeauxApp - Interface de gestion des bandeaux d'information
 *
 * Features:
 * - Liste de tous les bandeaux avec filtres
 * - Création, édition, suppression
 * - Gestion des organisations (SuperAdmin)
 * - Types: info, important
 * - Page cible et date d'expiration optionnelles
 */

const { createApp } = Vue;

createApp({
  data() {
    return {
      bandeaux: [],
      organizations: [],
      loading: true,
      error: null,
      userRole: '',
      organizationId: null,
      editingBandeau: null,
      isCreating: false,
      searchQuery: '',
      filterType: '',
      formData: {
        message: '',
        type: 'info',
        page_cible: '',
        expiration_date: '',
        organization_id: ''
      },
      formErrors: {}
    };
  },
  computed: {
    filteredBandeaux() {
      let result = [...this.bandeaux];

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(b =>
          (b.message && b.message.toLowerCase().includes(query)) ||
          (b.organization_name && b.organization_name.toLowerCase().includes(query))
        );
      }

      if (this.filterType) {
        result = result.filter(b => b.type === this.filterType);
      }

      return result;
    },
    isSuperAdmin() {
      return this.userRole === 'SuperAdmin';
    },
    modalTitle() {
      return this.isCreating ? 'Nouveau bandeau' : 'Modifier le bandeau';
    }
  },
  methods: {
    async loadBandeaux() {
      try {
        this.loading = true;
        const response = await fetch('/api/admin/bandeaux', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.bandeaux = data.bandeaux || [];
          this.userRole = data.userRole;
          this.organizationId = data.organizationId;
        } else {
          this.error = data.error || 'Erreur lors du chargement des bandeaux';
        }
      } catch (err) {
        console.error('Error loading bandeaux:', err);
        this.error = 'Erreur de connexion au serveur';
      } finally {
        this.loading = false;
      }
    },
    async loadOrganizations() {
      if (!this.isSuperAdmin) return;

      try {
        const response = await fetch('/api/admin/bandeaux/organizations', {
          headers: { 'CSRF-Token': window.CSRF_TOKEN }
        });

        const data = await response.json();

        if (data.success) {
          this.organizations = data.organizations || [];
        }
      } catch (err) {
        console.error('Error loading organizations:', err);
      }
    },
    openCreateModal() {
      this.isCreating = true;
      this.editingBandeau = null;
      this.formData = {
        message: '',
        type: 'info',
        page_cible: '',
        expiration_date: '',
        organization_id: this.isSuperAdmin ? '' : this.organizationId
      };
      this.formErrors = {};

      // Charger les organisations si SuperAdmin
      if (this.isSuperAdmin) {
        this.loadOrganizations();
      }

      const modal = new bootstrap.Modal(document.getElementById('bandeauModal'));
      modal.show();
    },
    async openEditModal(bandeau) {
      this.isCreating = false;
      this.editingBandeau = bandeau;

      // Formatter la date pour l'input type="datetime-local"
      let formattedDate = '';
      if (bandeau.expiration_date) {
        const date = new Date(bandeau.expiration_date);
        if (!isNaN(date.getTime())) {
          formattedDate = date.toISOString().slice(0, 16);
        }
      }

      this.formData = {
        message: bandeau.message || '',
        type: bandeau.type || 'info',
        page_cible: bandeau.page_cible || '',
        expiration_date: formattedDate,
        organization_id: bandeau.organization_id || ''
      };
      this.formErrors = {};

      // Charger les organisations si SuperAdmin
      if (this.isSuperAdmin) {
        await this.loadOrganizations();
      }

      const modal = new bootstrap.Modal(document.getElementById('bandeauModal'));
      modal.show();
    },
    async saveBandeau() {
      this.formErrors = {};

      // Validation
      if (!this.formData.message || !this.formData.message.trim()) {
        this.formErrors.message = 'Le message est obligatoire';
        return;
      }

      if (!this.formData.type) {
        this.formErrors.type = 'Le type est obligatoire';
        return;
      }

      try {
        const url = this.isCreating
          ? '/api/admin/bandeaux'
          : `/api/admin/bandeaux/${this.editingBandeau.id}`;

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
          const modalEl = document.getElementById('bandeauModal');
          const modal = bootstrap.Modal.getInstance(modalEl);
          modal.hide();

          // Recharger la liste
          await this.loadBandeaux();

          // Message succès
          this.showToast(data.message || 'Bandeau enregistré avec succès', 'success');
        } else {
          this.formErrors.general = data.error || 'Erreur lors de l\'enregistrement';
        }
      } catch (err) {
        console.error('Error saving bandeau:', err);
        this.formErrors.general = 'Erreur de connexion au serveur';
      }
    },
    async deleteBandeau(bandeau) {
      if (!confirm(`Supprimer le bandeau "${bandeau.message.substring(0, 50)}..." ?`)) {
        return;
      }

      try {
        const response = await fetch(`/api/admin/bandeaux/${bandeau.id}`, {
          method: 'DELETE',
          headers: {
            'CSRF-Token': window.CSRF_TOKEN
          }
        });

        const data = await response.json();

        if (data.success) {
          await this.loadBandeaux();
          this.showToast(data.message || 'Bandeau supprimé avec succès', 'success');
        } else {
          this.showToast(data.error || 'Erreur lors de la suppression', 'danger');
        }
      } catch (err) {
        console.error('Error deleting bandeau:', err);
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
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    },
    isExpired(dateStr) {
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date < new Date();
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
    this.loadBandeaux();
  },
  template: `
    <div class="container-fluid mt-4">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3 text-muted">Chargement des bandeaux...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-megaphone me-2"></i>Bandeaux d'information</h2>
          <div class="d-flex gap-2">
            <button @click="loadBandeaux" class="btn btn-outline-primary">
              <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
            </button>
            <button @click="openCreateModal" class="btn btn-primary">
              <i class="bi bi-plus-circle me-2"></i>Nouveau bandeau
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="row mb-4">
          <div class="col-md-8">
            <input
              v-model="searchQuery"
              type="text"
              class="form-control"
              placeholder="Rechercher par message ou organisation..."
            />
          </div>
          <div class="col-md-4">
            <select v-model="filterType" class="form-select">
              <option value="">Tous les types</option>
              <option value="info">Info</option>
              <option value="important">Important</option>
            </select>
          </div>
        </div>

        <!-- Bandeaux List -->
        <div v-if="filteredBandeaux.length === 0" class="alert alert-info">
          Aucun bandeau trouvé
        </div>

        <div v-else class="row">
          <div v-for="bandeau in filteredBandeaux" :key="bandeau.id" class="col-md-6 col-lg-4 mb-3">
            <div class="card h-100" :class="{ 'border-danger': isExpired(bandeau.expiration_date) }">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="badge" :class="getTypeBadgeClass(bandeau.type)">
                    {{ getTypeLabel(bandeau.type) }}
                  </span>
                  <span v-if="isExpired(bandeau.expiration_date)" class="badge bg-secondary">
                    Expiré
                  </span>
                </div>

                <p class="card-text">{{ truncate(bandeau.message, 150) }}</p>

                <div class="small text-muted mb-2">
                  <div v-if="bandeau.page_cible">
                    <i class="bi bi-link-45deg me-1"></i>
                    <strong>Page:</strong> {{ bandeau.page_cible }}
                  </div>
                  <div v-if="bandeau.expiration_date">
                    <i class="bi bi-calendar-x me-1"></i>
                    <strong>Expire:</strong> {{ formatDate(bandeau.expiration_date) }}
                  </div>
                  <div v-if="isSuperAdmin && bandeau.organization_name">
                    <i class="bi bi-building me-1"></i>
                    <strong>Organisation:</strong> {{ bandeau.organization_name || '(Toutes)' }}
                  </div>
                </div>
              </div>

              <div class="card-footer bg-transparent border-0">
                <div class="d-flex gap-2">
                  <button @click="openEditModal(bandeau)" class="btn btn-sm btn-outline-primary flex-fill">
                    <i class="bi bi-pencil"></i> Modifier
                  </button>
                  <button @click="deleteBandeau(bandeau)" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Création/Édition -->
      <div class="modal fade" id="bandeauModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
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
                <label class="form-label">Message *</label>
                <textarea
                  v-model="formData.message"
                  class="form-control"
                  :class="{ 'is-invalid': formErrors.message }"
                  rows="3"
                  placeholder="Message du bandeau..."
                ></textarea>
                <div v-if="formErrors.message" class="invalid-feedback">
                  {{ formErrors.message }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Type *</label>
                <select
                  v-model="formData.type"
                  class="form-select"
                  :class="{ 'is-invalid': formErrors.type }"
                >
                  <option value="info">Info (bleu)</option>
                  <option value="important">Important (rouge)</option>
                </select>
                <div v-if="formErrors.type" class="invalid-feedback">
                  {{ formErrors.type }}
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Page cible (optionnel)</label>
                <input
                  v-model="formData.page_cible"
                  type="text"
                  class="form-control"
                  placeholder="/chemin/vers/page (laissez vide pour toutes les pages)"
                />
                <small class="text-muted">
                  Si vide, le bandeau sera affiché sur toutes les pages
                </small>
              </div>

              <div class="mb-3">
                <label class="form-label">Date d'expiration (optionnel)</label>
                <input
                  v-model="formData.expiration_date"
                  type="datetime-local"
                  class="form-control"
                />
                <small class="text-muted">
                  Si vide, le bandeau n'expirera jamais
                </small>
              </div>

              <div v-if="isSuperAdmin" class="mb-3">
                <label class="form-label">Organisation</label>
                <select
                  v-model="formData.organization_id"
                  class="form-select"
                >
                  <option value="">Toutes les organisations</option>
                  <option v-for="org in organizations" :key="org.id" :value="org.id">
                    {{ org.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                Annuler
              </button>
              <button type="button" @click="saveBandeau" class="btn btn-primary">
                <i class="bi bi-check-lg me-2"></i>Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}).mount('#admin-bandeaux-app');
