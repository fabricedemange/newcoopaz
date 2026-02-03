// Application Vue pour le Dashboard Admin
(function() {
  console.log('🚀 Chargement de AdminDashboardApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive } = Vue;

  const app = createApp({
    setup() {
      const state = reactive({
        loading: false,
        error: null,
        catalogues: [],
        commandes: [],
        totalCommandes: 0,
        paniers: [],
        referentScopeActive: false,
        showAllScope: false,
        activeSection: 'catalogues'
      });

      const loadDashboard = async () => {
        state.loading = true;
        state.error = null;

        try {
          const urlParams = new URLSearchParams(window.location.search);
          const scope = urlParams.get('scope') || 'all';

          const response = await fetch(`/api/admin/dashboard?scope=${scope}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            state.catalogues = data.catalogues;
            state.commandes = data.commandes;
            state.totalCommandes = data.totalCommandes || 0;
            state.paniers = data.paniers;
            state.referentScopeActive = data.referentScopeActive;
            state.showAllScope = data.showAllScope;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement du dashboard');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadDashboard:', error);
        } finally {
          state.loading = false;
        }
      };

      loadDashboard();

      return {
        state
      };
    },

    methods: {
      toggleScope() {
        const newScope = this.state.showAllScope ? 'referent' : 'all';
        window.location.href = `?scope=${newScope}#catalogues`;
      },

      setActiveSection(section) {
        this.state.activeSection = section;
        this.updateDOM();
      },

      updateDOM() {
        const container = this.$refs.container;
        if (!container) return;

        const s = this.state;

        let html = '<div class="admin-content-wrapper"><div class="container-fluid px-3 mt-4">';

        // Bouton retour mobile uniquement
        html += `
          <button class="btn btn-outline-secondary d-md-none mb-3" onclick="window.history.back()">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </button>
        `;

        // Header avec titre et toggle desktop
        html += `
        <div class="row mb-4">
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2 class="mb-0"><i class="bi bi-speedometer2 me-2"></i>Dashboard Administrateur</h2>

              <!-- Toggle Desktop -->
              ${s.referentScopeActive ? `
                <div class="d-none d-md-block">
                  <div class="form-check form-switch mb-0">
                    <input class="form-check-input scope-toggle" type="checkbox" id="scopeToggle"
                           ${s.showAllScope ? 'checked' : ''}>
                    <label class="form-check-label" for="scopeToggle">
                      ${s.showAllScope ? 'Voir tous' : 'Mes éléments'}
                    </label>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>`;

        // Toggle Mobile
        if (s.referentScopeActive) {
          html += `
        <div class="row mb-3 d-md-none">
          <div class="col-12">
            <div class="dropdown">
              <button class="btn btn-primary dropdown-toggle w-100" type="button"
                      data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-filter me-2"></i>Vue
              </button>
              <ul class="dropdown-menu w-100">
                <li>
                  <a class="dropdown-item scope-toggle-mobile" href="#"
                     data-scope="${s.showAllScope ? 'mine' : 'all'}">
                    <i class="bi bi-${s.showAllScope ? 'person' : 'people'} me-2"></i>
                    ${s.showAllScope ? 'Mes éléments' : 'Voir tous'}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>`;
        }

        // Erreur
        if (s.error) {
          html += `<div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Erreur :</strong> ${s.error}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>`;
        }

        // Navigation
        html += `<div class="mb-4">
          <div class="d-flex flex-wrap gap-2 justify-content-center justify-md-start">
            <a href="#catalogues" class="badge ${s.activeSection === 'catalogues' ? 'bg-primary' : 'bg-secondary'} text-decoration-none fs-6 py-2 px-3 section-link" data-section="catalogues">
              <i class="bi bi-book-fill me-1"></i>Catalogues (${s.catalogues.length})
            </a>
            <a href="#commandes" class="badge ${s.activeSection === 'commandes' ? 'bg-success' : 'bg-secondary'} text-decoration-none fs-6 py-2 px-3 section-link" data-section="commandes">
              <i class="bi bi-bag-check-fill me-1"></i>Commandes (${s.totalCommandes})
            </a>
            <a href="#paniers" class="badge ${s.activeSection === 'paniers' ? 'bg-warning' : 'bg-secondary'} text-decoration-none fs-6 py-2 px-3 section-link" data-section="paniers">
              <i class="bi bi-cart-fill me-1"></i>Paniers (${s.paniers.length})
            </a>
          </div>
        </div>`;

        if (s.loading) {
          html += `<div class="text-center py-5">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3 text-muted">Chargement du dashboard...</p>
          </div>`;
        } else {
          // Section Catalogues
          if (s.activeSection === 'catalogues') {
            html += this.renderCatalogues(s.catalogues);
          }

          // Section Commandes
          if (s.activeSection === 'commandes') {
            html += this.renderCommandes(s.commandes);
          }

          // Section Paniers
          if (s.activeSection === 'paniers') {
            html += this.renderPaniers(s.paniers);
          }
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Attacher les événements
        this.attachEventListeners();
      },

      renderCatalogues(catalogues) {
        let html = `<div class="row mb-4">
          <div class="col-12">
            <h3 id="catalogues" class="fs-5">Catalogues concernés par les commandes</h3>`;

        if (catalogues.length === 0) {
          html += `<div class="alert alert-info text-center">
            <p>Aucun catalogue trouvé</p>
          </div>`;
        } else {
          // Vue DESKTOP
          html += `<div class="d-none d-md-block">
            <div class="table-responsive">
              <table class="table table-striped table-hover">
                <thead class="table-dark">
                  <tr>
                    <th>N°</th>
                    <th>Nom</th>
                    <th>Description</th>
                    <th>Expiration</th>
                    <th>Livraison</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>`;

          catalogues.forEach(c => {
            const desc = c.description || '';
            const truncatedDesc = desc.length > 100 ? desc.slice(0, 100) + '...' : desc;

            html += `<tr>
                <td><strong>${c.id}</strong></td>
                <td>
                  <a href="/admin/catalogues/${c.id}/edit" class="text-decoration-none">
                    ${c.originalname}
                  </a>
                </td>
                <td><small>${truncatedDesc}</small></td>
                <td>
                  ${c.expiration_formatted}
                  ${c.isExpired ? '<br><span class="badge bg-danger">Expiré</span>' : ''}
                </td>
                <td>${c.livraison_formatted}</td>
                <td>
                  <a href="/admin/catalogues/${c.id}/synthese/vue" class="btn btn-sm btn-primary me-1">
                    <i class="bi bi-file-earmark-spreadsheet"></i> Synthèse
                  </a>
                  <a href="/admin/catalogues/${c.id}/synthese-detaillee/vue" class="btn btn-sm btn-info">
                    <i class="bi bi-file-earmark-text"></i> Synthèse détaillée
                  </a>
                </td>
              </tr>`;
          });

          html += `</tbody>
              </table>
            </div>
          </div>`;

          // Vue MOBILE
          html += `<div class="d-md-none">`;
          catalogues.forEach(c => {
            const desc = c.description || '';
            const truncatedDesc = desc.length > 80 ? desc.slice(0, 80) + '...' : desc;

            html += `<div class="card mb-2 shadow-sm">
              <div class="card-body p-2" style="font-size: 0.7rem;">
                <div class="row g-1 mb-2">
                  <!-- Colonne gauche: Cat # + Nom -->
                  <div class="col-5">
                    <div class="mb-1">
                      <strong>Cat #${c.id}</strong>
                      ${c.isExpired ? '<br><span class="badge bg-danger" style="font-size: 0.6rem;">Expiré</span>' : ''}
                    </div>
                  </div>

                  <!-- Colonne droite: Dates -->
                  <div class="col-7" style="text-align: right;">
                    <div style="font-size: 0.65rem; text-align: right;" class="text-muted">
                      Expire le <strong>${c.expiration_formatted}</strong> • Livré le <strong>${c.livraison_formatted}</strong>
                    </div>
                  </div>
                </div>

                <!-- Nom (pleine largeur) -->
                <div class="mb-1"><strong>${c.originalname}</strong></div>

                <!-- Description (pleine largeur) -->
                ${desc ? `<div class="text-muted mb-2" style="font-size: 0.65rem;">${truncatedDesc}</div>` : ''}

                <!-- Menu Actions -->
                <div class="dropdown">
                  <button class="btn btn-sm btn-secondary dropdown-toggle w-100" type="button"
                          id="dropdownCat${c.id}" data-bs-toggle="dropdown"
                          aria-expanded="false" style="font-size: 0.7rem; padding: 0.25rem;">
                    <i class="bi bi-three-dots-vertical me-1"></i>Actions
                  </button>
                  <ul class="dropdown-menu" aria-labelledby="dropdownCat${c.id}" style="font-size: 0.75rem;">
                    <li><a class="dropdown-item" href="/admin/catalogues/${c.id}/synthese/vue">
                      <i class="bi bi-file-earmark-spreadsheet me-2"></i>Synthèse
                    </a></li>
                    <li><a class="dropdown-item" href="/admin/catalogues/${c.id}/synthese-detaillee/vue">
                      <i class="bi bi-file-earmark-text me-2"></i>Synthèse détaillée
                    </a></li>
                  </ul>
                </div>
              </div>
            </div>`;
          });
          html += `</div>`;
        }

        html += `</div></div>`;
        return html;
      },

      renderCommandes(commandes) {
        let html = `<div class="row mb-4">
          <div class="col-12">
            <h3 id="commandes" class="fs-5">Commandes validées</h3>`;

        if (commandes.length === 0) {
          html += `<div class="alert alert-info text-center">
            <p>Aucune commande trouvée</p>
          </div>`;
        } else {
          // Vue DESKTOP
          html += `<div class="d-none d-md-block">
            <div class="table-responsive">
              <table class="table table-striped table-hover">
                <thead class="table-dark">
                  <tr>
                    <th>N°</th>
                    <th>Utilisateur</th>
                    <th>Catalogue</th>
                    <th>Date commande</th>
                    <th>Livraison</th>
                    <th class="text-center">Nb produits</th>
                    <th class="text-end">Montant</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>`;

          commandes.forEach(cmd => {
            const nbProduits = cmd.nb_produits || 0;
            const montantTotal = cmd.montant_total || 0;

            html += `<tr>
                <td><strong>${cmd.id}</strong></td>
                <td>
                  <i class="bi bi-person-circle"></i> ${cmd.username}
                  ${cmd.note ? `<br><small class="badge bg-info">📝 ${cmd.note}</small>` : ''}
                </td>
                <td>
                  ${cmd.catalogue}
                  <br><small class="text-muted">N°${cmd.catalog_file_id}</small>
                </td>
                <td>${cmd.created_formatted}</td>
                <td>${cmd.livraison_formatted}</td>
                <td class="text-center">
                  <span class="badge bg-primary">${nbProduits}</span>
                </td>
                <td class="text-end">
                  <strong>${montantTotal.toFixed(2)} €</strong>
                </td>
                <td>
                  <a href="/commandes/${cmd.id}/vue" class="btn btn-sm btn-info">
                    <i class="bi bi-eye"></i> Voir
                  </a>
                </td>
              </tr>`;
          });

          html += `</tbody>
              </table>
            </div>
          </div>`;

          // Vue MOBILE
          html += `<div class="d-md-none">`;
          commandes.forEach(cmd => {
            const nbProduits = cmd.nb_produits || 0;
            const montantTotal = cmd.montant_total || 0;

            html += `<div class="card mb-2 shadow-sm">
              <div class="card-body p-2" style="font-size: 0.7rem;">
                <div class="row g-1 mb-2">
                  <!-- Colonne gauche: Cde + User + Produits/Montant -->
                  <div class="col-5">
                    <div class="mb-1">
                      <strong>Cde #${cmd.id}</strong> le <strong>${cmd.created_formatted}</strong>
                    </div>
                    <div style="font-size: 0.65rem;">
                      <i class="bi bi-person-circle"></i> ${cmd.username}
                    </div>
                    <div style="font-size: 0.65rem;" class="mt-1">
                      ${nbProduits} produits • <strong>${montantTotal.toFixed(2)} €</strong>
                    </div>
                    ${cmd.note ? `<div style="font-size: 0.65rem;" class="mt-1">
                      <em>${cmd.note}</em>
                    </div>` : ''}
                  </div>

                  <!-- Colonne droite: Cat + dates -->
                  <div class="col-7" style="text-align: right;">
                    <div style="text-align: right;">Cat #${cmd.catalog_file_id}, <strong>${cmd.catalogue}</strong></div>
                    <div style="font-size: 0.65rem; text-align: right;" class="text-muted">
                      Expir le <strong>${cmd.expiration_formatted}</strong> • Livré le <strong>${cmd.livraison_formatted}</strong>
                    </div>
                  </div>
                </div>

                <!-- Bouton -->
                <div class="text-center">
                  <a href="/commandes/${cmd.id}/vue" class="btn btn-sm btn-info" style="min-width: 150px; font-size: 0.7rem; padding: 0.25rem;">
                    <i class="bi bi-eye me-1"></i>Voir détails
                  </a>
                </div>
              </div>
            </div>`;
          });
          html += `</div>`;
        }

        html += `</div></div>`;
        return html;
      },

      renderPaniers(paniers) {
        let html = `<div class="row mb-4">
          <div class="col-12">
            <h3 id="paniers" class="fs-5">Paniers en cours</h3>`;

        if (paniers.length === 0) {
          html += `<div class="alert alert-info text-center">
            <p>Aucun panier trouvé</p>
          </div>`;
        } else {
          // Vue DESKTOP
          html += `<div class="d-none d-md-block">
            <div class="table-responsive">
              <table class="table table-striped table-hover">
                <thead class="table-dark">
                  <tr>
                    <th>N°</th>
                    <th>Utilisateur</th>
                    <th>Catalogue</th>
                    <th>Date création</th>
                    <th>Expiration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>`;

          paniers.forEach(p => {
            html += `<tr>
                <td><strong>${p.id}</strong></td>
                <td>
                  <i class="bi bi-person-circle"></i> ${p.username}
                  ${p.note ? `<br><small class="badge bg-info">📝 ${p.note}</small>` : ''}
                </td>
                <td>
                  ${p.catalogue}
                  <br><small class="text-muted">N°${p.catalog_file_id}</small>
                </td>
                <td>${p.created_formatted}</td>
                <td>
                  ${p.expiration_formatted}
                  ${p.isExpired ? '<br><span class="badge bg-danger">Expiré</span>' : ''}
                </td>
                <td>
                  <a href="/panier/${p.id}/modifier/vue" class="btn btn-sm btn-primary">
                    <i class="bi bi-pencil"></i> Modifier
                  </a>
                </td>
              </tr>`;
          });

          html += `</tbody>
              </table>
            </div>
          </div>`;

          // Vue MOBILE
          html += `<div class="d-md-none">`;
          paniers.forEach(p => {
            html += `<div class="card mb-2 shadow-sm">
              <div class="card-body p-2" style="font-size: 0.7rem;">
                <div class="row g-1 mb-2">
                  <!-- Colonne gauche: Panier + User -->
                  <div class="col-5">
                    <div class="mb-1">
                      <strong>Panier #${p.id}</strong> créé le <strong>${p.created_formatted}</strong>
                      ${p.isExpired ? '<br><span class="badge bg-danger" style="font-size: 0.6rem;">Expiré</span>' : ''}
                    </div>
                    <div style="font-size: 0.65rem;">
                      <i class="bi bi-person-circle"></i> ${p.username}
                    </div>
                    ${p.note ? `<div style="font-size: 0.65rem;" class="mt-1">
                      <em>${p.note}</em>
                    </div>` : ''}
                  </div>

                  <!-- Colonne droite: Cat + dates -->
                  <div class="col-7" style="text-align: right;">
                    <div style="text-align: right;">Cat #${p.catalog_file_id}, <strong>${p.catalogue}</strong></div>
                    <div style="font-size: 0.65rem; text-align: right;" class="text-muted">
                      Expire le <strong>${p.expiration_formatted}</strong>
                    </div>
                  </div>
                </div>

                <!-- Bouton -->
                <div class="text-center">
                  <a href="/panier/${p.id}/modifier/vue" class="btn btn-sm btn-primary" style="min-width: 150px; font-size: 0.7rem; padding: 0.25rem;">
                    <i class="bi bi-pencil me-1"></i>Modifier
                  </a>
                </div>
              </div>
            </div>`;
          });
          html += `</div>`;
        }

        html += `</div></div>`;
        return html;
      },

      attachEventListeners() {
        // Toggle scope desktop
        const scopeToggle = document.querySelector('.scope-toggle');
        if (scopeToggle) {
          scopeToggle.addEventListener('change', () => this.toggleScope());
        }

        // Toggle scope mobile
        const scopeToggleMobile = document.querySelector('.scope-toggle-mobile');
        if (scopeToggleMobile) {
          scopeToggleMobile.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleScope();
          });
        }

        // Section links
        const sectionLinks = document.querySelectorAll('.section-link');
        sectionLinks.forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.currentTarget.dataset.section;
            this.setActiveSection(section);
          });
        });
      }
    },

    mounted() {
      // Détecter la section active depuis le hash
      const hash = window.location.hash.substring(1);
      if (hash && ['catalogues', 'commandes', 'paniers'].includes(hash)) {
        this.state.activeSection = hash;
      }

      this.updateDOM();
      this.$watch(() => this.state.catalogues, () => this.updateDOM(), { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'admin-dashboard-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#admin-dashboard-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
