// Application Vue pour la gestion des catalogues admin
(function() {
  console.log('🚀 Chargement de AdminCataloguesApp.js...');

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
        archivedCatalogues: [],
        role: null,
        referentScopeActive: false,
        showAllScope: true,
        searchActive: '',
        searchArchived: '',
        organization_id: null,
        sortColumnActive: 'id',
        sortDirectionActive: 'desc',
        sortColumnArchived: 'id',
        sortDirectionArchived: 'desc'
      });

      const loadCatalogues = async (scope) => {
        state.loading = true;
        state.error = null;

        try {
          const scopeParam = scope ? `?scope=${scope}` : '';
          const url = window.location.protocol + '//' + window.location.host + `/api/admin/catalogues${scopeParam}`;
          const response = await fetch(url, {
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
            state.catalogues = data.catalogues || [];
            state.archivedCatalogues = data.archivedCatalogues || [];
            state.role = data.role;
            state.referentScopeActive = data.referentScopeActive;
            state.showAllScope = data.showAllScope;
            state.organization_id = data.organization_id;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des catalogues');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadCatalogues:', error);
        } finally {
          state.loading = false;
        }
      };

      // Charger initialement avec le scope approprié
      const urlParams = new URLSearchParams(window.location.search);
      const initialScope = urlParams.get('scope') || (state.referentScopeActive ? 'all' : null);
      loadCatalogues(initialScope);

      return {
        state,
        loadCatalogues
      };
    },

    computed: {
      activeCatalogues() {
        // L'API retourne déjà les catalogues actifs dans state.catalogues
        const filtered = this.filterCatalogues(this.state.catalogues, this.state.searchActive);
        return this.sortCatalogues(filtered, this.state.sortColumnActive, this.state.sortDirectionActive);
      },
      archivedCatalogues() {
        // L'API retourne déjà les catalogues archivés dans state.archivedCatalogues
        const filtered = this.filterCatalogues(this.state.archivedCatalogues, this.state.searchArchived);
        return this.sortCatalogues(filtered, this.state.sortColumnArchived, this.state.sortDirectionArchived);
      },
      isSuperAdmin() {
        return this.state.role === 'SuperAdmin';
      }
    },

    methods: {
      filterCatalogues(catalogues, searchTerm) {
        if (!searchTerm) return catalogues;
        const term = searchTerm.toLowerCase();
        return catalogues.filter(c =>
          c.originalname?.toLowerCase().includes(term) ||
          c.username?.toLowerCase().includes(term) ||
          c.organization_name?.toLowerCase().includes(term) ||
          c.description?.toLowerCase().includes(term)
        );
      },

      sortCatalogues(catalogues, column, direction) {
        if (!catalogues || catalogues.length === 0) return catalogues;

        const sorted = [...catalogues].sort((a, b) => {
          let aVal = a[column];
          let bVal = b[column];

          // Gestion spéciale pour les dates
          if (column === 'expiration_date' || column === 'livraison_date') {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
          }
          // Gestion des nombres
          else if (column === 'id' || column === 'nb_paniers' || column === 'is_archived') {
            aVal = Number(aVal) || 0;
            bVal = Number(bVal) || 0;
          }
          // Gestion des chaînes
          else {
            aVal = (aVal || '').toString().toLowerCase();
            bVal = (bVal || '').toString().toLowerCase();
          }

          if (aVal < bVal) return direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return direction === 'asc' ? 1 : -1;
          return 0;
        });

        return sorted;
      },

      handleSort(column, isArchived) {
        if (isArchived) {
          if (this.state.sortColumnArchived === column) {
            this.state.sortDirectionArchived = this.state.sortDirectionArchived === 'asc' ? 'desc' : 'asc';
          } else {
            this.state.sortColumnArchived = column;
            this.state.sortDirectionArchived = 'asc';
          }
        } else {
          if (this.state.sortColumnActive === column) {
            this.state.sortDirectionActive = this.state.sortDirectionActive === 'asc' ? 'desc' : 'asc';
          } else {
            this.state.sortColumnActive = column;
            this.state.sortDirectionActive = 'asc';
          }
        }
        this.updateDOM();
      },

      toggleScope() {
        const newScope = this.state.showAllScope ? 'referent' : 'all';
        window.location.href = `/admin/catalogues/vue?scope=${newScope}`;
      },

      formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR');
      },

      truncateText(text, maxLength = 200) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      },

      getVisibilityBadge(isArchived) {
        const badges = {
          0: { label: 'Visible', class: 'bg-success' },
          2: { label: 'Référents seulement', class: 'bg-warning' },
          3: { label: 'Masqué', class: 'bg-secondary' }
        };
        return badges[isArchived] || badges[0];
      },

      async changeVisibility(catalogueId, newVisibilite) {
        try {
          // Construire l'URL complète avec le protocole actuel
          const url = window.location.protocol + '//' + window.location.host + `/admin/catalogues/${catalogueId}/visibility`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({ is_archived: newVisibilite })
          });

          if (response.ok) {
            // Recharger les catalogues
            const urlParams = new URLSearchParams(window.location.search);
            const currentScope = urlParams.get('scope');
            await this.loadCatalogues(currentScope);
          } else {
            throw new Error('Erreur lors du changement de visibilité');
          }
        } catch (error) {
          console.error('Erreur changeVisibility:', error);
          alert('Erreur lors du changement de visibilité');
        }
      },

      async archiveCatalogue(catalogueId) {
        if (!confirm('Confirmer l\'archivage de ce catalogue ?')) {
          return;
        }
        await this.changeVisibility(catalogueId, 3);
      },

      async unarchiveCatalogue(catalogueId) {
        if (!confirm('Confirmer la désarchivage de ce catalogue ?')) {
          return;
        }
        await this.changeVisibility(catalogueId, 0);
      },

      async deleteCatalogue(catalogueId) {
        if (!confirm('Masquer complètement ce catalogue ? Il restera accessible dans l\'historique des commandes mais ne sera plus visible dans les listes.')) {
          return;
        }
        // Masquer complètement (is_archived = 3) au lieu de supprimer pour conserver l'historique
        await this.changeVisibility(catalogueId, 3);
      },

      goToEdit(catalogueId) {
        window.location.href = `/admin/catalogues/${catalogueId}/edit`;
      },

      goToSynthese(catalogueId) {
        window.location.href = `/admin/catalogues/${catalogueId}/synthese/vue`;
      },

      goToSyntheseDetaillee(catalogueId) {
        window.location.href = `/admin/catalogues/${catalogueId}/synthese-detaillee/vue`;
      },

      async sendAlerteMail(catalogueId) {
        if (!confirm('Envoyer une alerte par mail à tous les utilisateurs ?')) {
          return;
        }
        try {
          const url = window.location.protocol + '//' + window.location.host + `/admin/catalogues/${catalogueId}/alerte`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include'
          });

          if (response.ok) {
            alert('Mail d\'alerte envoyé avec succès !');
          } else {
            throw new Error('Erreur lors de l\'envoi du mail');
          }
        } catch (error) {
          console.error('Erreur sendAlerteMail:', error);
          alert('Erreur lors de l\'envoi du mail d\'alerte');
        }
      },

      async sendRappelMail(catalogueId) {
        if (!confirm('Envoyer un rappel par mail à tous les utilisateurs ?')) {
          return;
        }
        try {
          const url = window.location.protocol + '//' + window.location.host + `/admin/catalogues/${catalogueId}/rappel`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include'
          });

          if (response.ok) {
            alert('Mail de rappel envoyé avec succès !');
          } else {
            throw new Error('Erreur lors de l\'envoi du mail');
          }
        } catch (error) {
          console.error('Erreur sendRappelMail:', error);
          alert('Erreur lors de l\'envoi du mail de rappel');
        }
      },

      renderCataloguesTable(catalogues, isArchived = false) {
        if (catalogues.length === 0) {
          return `
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Aucun catalogue ${isArchived ? 'archivé' : 'actif'}
            </div>
          `;
        }

        // Vue DESKTOP: Tableau
        const sortCol = isArchived ? this.state.sortColumnArchived : this.state.sortColumnActive;
        const sortDir = isArchived ? this.state.sortDirectionArchived : this.state.sortDirectionActive;

        let html = `
          <div class="d-none d-lg-block">
            <div class="table-responsive">
              <table class="table table-hover table-striped">
                <thead class="table-dark">
                  <tr>
                    <th class="sortable" data-column="id" data-archived="${isArchived}">
                      ID ${sortCol === 'id' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    ${this.isSuperAdmin ? '<th>Org</th>' : ''}
                    <th class="sortable" data-column="originalname" data-archived="${isArchived}">
                      Catalogue ${sortCol === 'originalname' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" data-column="username" data-archived="${isArchived}">
                      Référent ${sortCol === 'username' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" data-column="expiration_date" data-archived="${isArchived}">
                      Expiration ${sortCol === 'expiration_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" data-column="livraison_date" data-archived="${isArchived}">
                      Livraison ${sortCol === 'livraison_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" data-column="is_archived" data-archived="${isArchived}">
                      Visibilité ${sortCol === 'is_archived' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" data-column="nb_paniers" data-archived="${isArchived}">
                      Nb Commandes ${sortCol === 'nb_paniers' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
        `;

        catalogues.forEach(catalogue => {
          const visibility = this.getVisibilityBadge(catalogue.is_archived);
          const expirationClass = catalogue.isExpired ? 'text-danger fw-bold' : '';

          html += `
            <tr>
              <td><strong>${catalogue.id}</strong></td>
              ${this.isSuperAdmin ? `<td><small class="text-muted">${catalogue.organization_name || '-'}</small></td>` : ''}
              <td>
                <div class="d-flex align-items-center">
                  ${catalogue.image_filename ? `
                    <span class="catalogue-thumbnail me-2">
                      <img src="/uploads/catalogue-images/${catalogue.image_filename}" alt="Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                    </span>
                  ` : ''}
                  <div>
                    <div class="fw-bold">${catalogue.originalname}</div>
                    ${catalogue.description ? `<small class="text-muted">${this.truncateText(catalogue.description, 200)}</small>` : ''}
                  </div>
                </div>
              </td>
              <td>${catalogue.username}</td>
              <td class="${expirationClass}">
                ${catalogue.expiration_formatted || '-'}
                ${catalogue.expiration_day ? `<br><small>${catalogue.expiration_day}</small>` : ''}
              </td>
              <td>
                ${catalogue.livraison_formatted || '-'}
                ${catalogue.livraison_day ? `<br><small>${catalogue.livraison_day}</small>` : ''}
              </td>
              <td>
                <span class="badge ${visibility.class}">${visibility.label}</span>
              </td>
              <td class="text-center">
                <span class="badge bg-primary">${catalogue.nb_paniers || 0}</span>
              </td>
              <td class="text-end">
                <div class="btn-group btn-group-sm" role="group">
                  ${!isArchived ? `
                    <button class="btn btn-outline-primary" onclick="adminCataloguesApp.goToEdit(${catalogue.id})" title="Modifier">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <div class="btn-group btn-group-sm" role="group">
                      <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="Actions">
                        <i class="bi bi-three-dots-vertical"></i> Actions
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.goToSynthese(${catalogue.id})"><i class="bi bi-file-earmark-text me-2"></i>Synthèse</a></li>
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.goToSyntheseDetaillee(${catalogue.id})"><i class="bi bi-file-earmark-spreadsheet me-2"></i>Synthèse détaillée</a></li>
                        <li><hr class="dropdown-divider"></li>
                        ${catalogue.is_archived !== 0 ? `<li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.changeVisibility(${catalogue.id}, 0)"><i class="bi bi-eye me-2"></i>Visible de tous</a></li>` : ''}
                        ${catalogue.is_archived !== 2 ? `<li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.changeVisibility(${catalogue.id}, 2)"><i class="bi bi-eye-slash me-2"></i>Invisible des utilisateurs</a></li>` : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.sendAlerteMail(${catalogue.id})"><i class="bi bi-envelope-exclamation me-2"></i>Notifier de la dispo des produits</a></li>
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.sendRappelMail(${catalogue.id})"><i class="bi bi-bell me-2"></i>Rappel au référent pour commande</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-warning" href="#" onclick="event.preventDefault(); adminCataloguesApp.archiveCatalogue(${catalogue.id})"><i class="bi bi-archive me-2"></i>Archiver</a></li>
                      </ul>
                    </div>
                  ` : `
                    <div class="btn-group btn-group-sm" role="group">
                      <button type="button" class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="Actions">
                        <i class="bi bi-three-dots-vertical"></i> Actions
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.goToSynthese(${catalogue.id})"><i class="bi bi-file-earmark-text me-2"></i>Synthèse</a></li>
                        <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); adminCataloguesApp.goToSyntheseDetaillee(${catalogue.id})"><i class="bi bi-file-earmark-spreadsheet me-2"></i>Synthèse détaillée</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-warning" href="#" onclick="event.preventDefault(); adminCataloguesApp.unarchiveCatalogue(${catalogue.id})"><i class="bi bi-arrow-counterclockwise me-2"></i>Désarchiver</a></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="event.preventDefault(); adminCataloguesApp.deleteCatalogue(${catalogue.id})"><i class="bi bi-eye-slash me-2"></i>Masquer complètement</a></li>
                      </ul>
                    </div>
                  `}
                </div>
              </td>
            </tr>
          `;
        });

        html += `
              </tbody>
            </table>
          </div>
        </div>`;

        // Vue MOBILE: Cartes
        html += `<div class="d-lg-none">`;

        catalogues.forEach(catalogue => {
          const visibility = this.getVisibilityBadge(catalogue.is_archived);
          const expirationClass = catalogue.isExpired ? 'text-danger' : '';

          html += `<div class="card mb-3 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="card-title mb-0 flex-grow-1">
                  #${catalogue.id} - ${catalogue.originalname}
                </h6>
                <span class="badge ${visibility.class} ms-2">${visibility.label}</span>
              </div>

              ${this.isSuperAdmin ? `<p class="text-muted small mb-2"><i class="bi bi-building"></i> ${catalogue.organization_name || '-'}</p>` : ''}
              ${catalogue.description ? `
                <div class="d-flex align-items-start mb-2">
                  ${catalogue.image_filename ? `
                    <span class="catalogue-thumbnail me-2">
                      <img src="/uploads/catalogue-images/${catalogue.image_filename}" alt="Photo" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                    </span>
                  ` : ''}
                  <p class="text-muted small mb-0">${this.truncateText(catalogue.description, 200)}</p>
                </div>
              ` : ''}

              <div class="row g-2 mb-3">
                <div class="col-6">
                  <small class="text-muted d-block">Référent</small>
                  <div>${catalogue.username}</div>
                </div>
                <div class="col-6">
                  <small class="text-muted d-block">Commandes</small>
                  <span class="badge bg-primary">${catalogue.nb_paniers || 0}</span>
                </div>
                <div class="col-6">
                  <small class="text-muted d-block">Expiration</small>
                  <div class="${expirationClass}">${catalogue.expiration_formatted || '-'}</div>
                  ${catalogue.expiration_day ? `<small class="text-muted">${catalogue.expiration_day}</small>` : ''}
                </div>
                <div class="col-6">
                  <small class="text-muted d-block">Livraison</small>
                  <div>${catalogue.livraison_formatted || '-'}</div>
                  ${catalogue.livraison_day ? `<small class="text-muted">${catalogue.livraison_day}</small>` : ''}
                </div>
              </div>

              <div class="d-grid gap-2">`;

          if (!isArchived) {
            html += `
                <button class="btn btn-primary" onclick="adminCataloguesApp.goToEdit(${catalogue.id})">
                  <i class="bi bi-pencil me-2"></i>Modifier
                </button>
                <div class="row g-2">
                  <div class="col-6">
                    <button class="btn btn-info w-100" onclick="adminCataloguesApp.goToSynthese(${catalogue.id})">
                      <i class="bi bi-file-earmark-text me-1"></i>Synthèse
                    </button>
                  </div>
                  <div class="col-6">
                    <button class="btn btn-success w-100" onclick="adminCataloguesApp.goToSyntheseDetaillee(${catalogue.id})">
                      <i class="bi bi-file-earmark-spreadsheet me-1"></i>Détaillée
                    </button>
                  </div>
                </div>

                <div class="accordion" id="actions-${catalogue.id}">
                  <div class="accordion-item">
                    <h2 class="accordion-header">
                      <button class="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${catalogue.id}">
                        <i class="bi bi-three-dots me-2"></i>Plus d'actions
                      </button>
                    </h2>
                    <div id="collapse-${catalogue.id}" class="accordion-collapse collapse" data-bs-parent="#actions-${catalogue.id}">
                      <div class="accordion-body p-2">
                        <div class="d-grid gap-2">
                          ${catalogue.is_archived !== 0 ? `
                            <button class="btn btn-sm btn-outline-secondary" onclick="adminCataloguesApp.changeVisibility(${catalogue.id}, 0)">
                              <i class="bi bi-eye me-2"></i>Visible de tous
                            </button>` : ''}
                          ${catalogue.is_archived !== 2 ? `
                            <button class="btn btn-sm btn-outline-warning" onclick="adminCataloguesApp.changeVisibility(${catalogue.id}, 2)">
                              <i class="bi bi-eye-slash me-2"></i>Référents seulement
                            </button>` : ''}
                          <hr class="my-1">
                          <button class="btn btn-sm btn-outline-info" onclick="adminCataloguesApp.sendAlerteMail(${catalogue.id})">
                            <i class="bi bi-envelope-exclamation me-2"></i>Notifier de la dispo des produits
                          </button>
                          <button class="btn btn-sm btn-outline-info" onclick="adminCataloguesApp.sendRappelMail(${catalogue.id})">
                            <i class="bi bi-bell me-2"></i>Rappel au référent pour commande
                          </button>
                          <hr class="my-1">
                          <button class="btn btn-sm btn-warning" onclick="adminCataloguesApp.archiveCatalogue(${catalogue.id})">
                            <i class="bi bi-archive me-2"></i>Archiver
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>`;
          } else {
            html += `
                <div class="row g-2">
                  <div class="col-6">
                    <button class="btn btn-info w-100" onclick="adminCataloguesApp.goToSynthese(${catalogue.id})">
                      <i class="bi bi-file-earmark-text me-1"></i>Synthèse
                    </button>
                  </div>
                  <div class="col-6">
                    <button class="btn btn-success w-100" onclick="adminCataloguesApp.goToSyntheseDetaillee(${catalogue.id})">
                      <i class="bi bi-file-earmark-spreadsheet me-1"></i>Détaillée
                    </button>
                  </div>
                </div>
                <button class="btn btn-warning" onclick="adminCataloguesApp.unarchiveCatalogue(${catalogue.id})">
                  <i class="bi bi-arrow-counterclockwise me-2"></i>Désarchiver
                </button>
                <button class="btn btn-danger" onclick="adminCataloguesApp.deleteCatalogue(${catalogue.id})">
                  <i class="bi bi-trash me-2"></i>Supprimer définitivement
                </button>`;
          }

          html += `
              </div>
            </div>
          </div>`;
        });

        html += `</div>`;

        return html;
      },

      updateDOM() {
        const container = this.$refs.container;
        if (!container) {
          console.error('❌ Container non trouvé !');
          return;
        }

        // Sauvegarder l'élément actif et sa position de curseur
        const activeElement = document.activeElement;
        const isSearchActive = activeElement?.classList.contains('search-active');
        const isSearchArchived = activeElement?.classList.contains('search-archived');
        const cursorPosition = (isSearchActive || isSearchArchived) ? activeElement.selectionStart : 0;

        const s = this.state;

        let html = '<div class="admin-content-wrapper"><div class="container-fluid mt-4">';

        // Bouton retour mobile uniquement
        html += `
          <button class="btn btn-outline-secondary d-md-none mb-3" onclick="window.history.back()">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </button>
        `;

        // En-tête avec boutons
        html += `
          <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-4">
            <h2 class="mb-0"><i class="bi bi-folder-fill me-2"></i>Gestion des catalogues</h2>

            <!-- Desktop: boutons séparés -->
            <div class="d-none d-md-flex gap-2 align-items-center">`;

        // Toggle scope si applicable (desktop)
        if (s.referentScopeActive) {
          html += `
              <div class="form-check form-switch mb-0">
                <input class="form-check-input scope-toggle" type="checkbox" id="scopeToggle"
                       ${s.showAllScope ? 'checked' : ''}>
                <label class="form-check-label" for="scopeToggle">
                  ${s.showAllScope ? 'Voir tous' : 'Mes catalogues'}
                </label>
              </div>`;
        }

        html += `
              <a href="/admin/catalogues/new" class="btn btn-success">
                <i class="bi bi-plus-circle me-1"></i>Nouveau catalogue
              </a>
            </div>

            <!-- Mobile: menu déroulant -->
            <div class="d-md-none">
              <div class="dropdown">
                <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                  Actions
                </button>
                <ul class="dropdown-menu dropdown-menu-end">`;

        if (s.referentScopeActive) {
          html += `
                  <li>
                    <a class="dropdown-item scope-toggle-mobile" href="#" data-scope="${s.showAllScope ? 'mine' : 'all'}">
                      <i class="bi bi-${s.showAllScope ? 'person' : 'people'} me-2"></i>
                      ${s.showAllScope ? 'Mes catalogues' : 'Voir tous'}
                    </a>
                  </li>
                  <li><hr class="dropdown-divider"></li>`;
        }

        html += `
                  <li>
                    <a class="dropdown-item" href="/admin/catalogues/new">
                      <i class="bi bi-plus-circle me-2"></i>Nouveau catalogue
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        `;

        // Erreur
        if (s.error) {
          html += `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Erreur :</strong> ${s.error}
              <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
          `;
        }

        // Loading
        if (s.loading) {
          html += `
            <div class="text-center py-5">
              <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="mt-3 text-muted">Chargement des catalogues...</p>
            </div>
          `;
        } else {
          // Catalogues actifs
          html += `
            <div class="card mb-4">
              <div class="card-header bg-primary text-white">
                <div class="d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">
                    <i class="bi bi-folder2-open me-2"></i>Catalogues actifs
                    <span class="badge bg-light text-dark ms-2">${this.activeCatalogues.length}</span>
                  </h5>
                  <div class="input-group" style="max-width: 300px;">
                    <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control search-active" placeholder="Rechercher..."
                           value="${s.searchActive}">
                  </div>
                </div>
              </div>
              <div class="card-body p-0">
                ${this.renderCataloguesTable(this.activeCatalogues, false)}
              </div>
            </div>
          `;

          // Catalogues archivés
          html += `
            <div class="card">
              <div class="card-header bg-secondary text-white">
                <div class="d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">
                    <i class="bi bi-archive me-2"></i>Catalogues archivés
                    <span class="badge bg-light text-dark ms-2">${this.archivedCatalogues.length}</span>
                  </h5>
                  <div class="input-group" style="max-width: 300px;">
                    <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control search-archived" placeholder="Rechercher..."
                           value="${s.searchArchived}">
                  </div>
                </div>
              </div>
              <div class="card-body p-0">
                ${this.renderCataloguesTable(this.archivedCatalogues, true)}
              </div>
            </div>
          `;
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Restaurer le focus si nécessaire
        if (isSearchActive) {
          const searchInput = document.querySelector('.search-active');
          if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        } else if (isSearchArchived) {
          const searchInput = document.querySelector('.search-archived');
          if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        }

        // Attacher les événements
        this.attachEventListeners();
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

        // Recherche actifs
        const searchActive = document.querySelector('.search-active');
        if (searchActive) {
          searchActive.addEventListener('input', (e) => {
            this.state.searchActive = e.target.value;
            this.updateDOM();
          });
        }

        // Recherche archivés
        const searchArchived = document.querySelector('.search-archived');
        if (searchArchived) {
          searchArchived.addEventListener('input', (e) => {
            this.state.searchArchived = e.target.value;
            this.updateDOM();
          });
        }

        // Tri des colonnes
        document.querySelectorAll('.sortable').forEach(th => {
          th.addEventListener('click', () => {
            const column = th.dataset.column;
            const isArchived = th.dataset.archived === 'true';
            this.handleSort(column, isArchived);
          });
        });
      }
    },

    mounted() {
      this.$nextTick(() => {
        this.updateDOM();
      });

      this.$watch(() => this.state, () => {
        this.$nextTick(() => {
          this.updateDOM();
        });
      }, { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'vue-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    const instance = app.mount('#admin-catalogues-app');
    // Exposer globalement pour les onclick
    window.adminCataloguesApp = instance;
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
