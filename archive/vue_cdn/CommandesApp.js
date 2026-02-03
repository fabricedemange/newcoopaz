// Application Vue pour la page Commandes
(function() {
  console.log('🚀 Chargement de CommandesApp.js...');

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
        commandes: [],
        ventes: [], // Ventes de caisse
        activeTab: 'catalogues', // 'catalogues' ou 'caisse'
        searchTerm: '',
        sortColumn: 'created_at',
        sortDirection: 'desc',
        savingNotes: {}, // { commandeId: true/false }
        savedNotes: {}, // { commandeId: true/false }
        errorNotes: {}, // { commandeId: true/false }
        showDetailModal: false,
        selectedVente: null
      });

      const loadCommandes = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch('/api/commandes', {
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
            state.commandes = data.commandes;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des commandes');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadCommandes:', error);
        } finally {
          state.loading = false;
        }
      };

      const loadVentes = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch('/api/commandes/caisse', {
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
            state.ventes = data.ventes;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement des achats en caisse');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadVentes:', error);
        } finally {
          state.loading = false;
        }
      };

      loadCommandes();
      loadVentes();

      return {
        state
      };
    },

    methods: {
      getFilteredCommandes() {
        let filtered = [...this.state.commandes];

        // Filtrer par recherche
        if (this.state.searchTerm) {
          const term = this.state.searchTerm.toLowerCase();
          filtered = filtered.filter(c =>
            c.originalname.toLowerCase().includes(term) ||
            (c.catalog_description && c.catalog_description.toLowerCase().includes(term)) ||
            (c.note && c.note.toLowerCase().includes(term)) ||
            String(c.id).includes(term)
          );
        }

        return filtered;
      },

      getSortedCommandes() {
        const filtered = this.getFilteredCommandes();
        const column = this.state.sortColumn;
        const direction = this.state.sortDirection;

        return filtered.sort((a, b) => {
          let valA, valB;

          switch (column) {
            case 'id':
              valA = a.id;
              valB = b.id;
              break;
            case 'catalogue':
              valA = a.originalname || '';
              valB = b.originalname || '';
              break;
            case 'expiration_date':
              valA = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
              valB = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
              break;
            case 'date_livraison':
              valA = a.date_livraison ? new Date(a.date_livraison).getTime() : 0;
              valB = b.date_livraison ? new Date(b.date_livraison).getTime() : 0;
              break;
            case 'created_at':
              valA = a.created_at ? new Date(a.created_at).getTime() : 0;
              valB = b.created_at ? new Date(b.created_at).getTime() : 0;
              break;
            default:
              return 0;
          }

          if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
          }

          if (direction === 'asc') {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
          } else {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
          }
        });
      },

      sortBy(column) {
        if (this.state.sortColumn === column) {
          this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortColumn = column;
          this.state.sortDirection = 'asc';
        }
        this.updateDOM();
      },

      getSortIcon(column) {
        if (this.state.sortColumn !== column) {
          return '<i class="bi bi-arrow-down-up ms-1 text-muted"></i>';
        }
        return this.state.sortDirection === 'asc'
          ? '<i class="bi bi-arrow-up ms-1"></i>'
          : '<i class="bi bi-arrow-down ms-1"></i>';
      },


      updateNoteStatus(commandeId) {
        // Mettre à jour uniquement les indicateurs de statut sans rafraîchir tout le DOM
        const statusContainer = document.querySelector(`#note-status-${commandeId}`);
        if (!statusContainer) return;

        const s = this.state;
        let statusHtml = '';
        if (s.savingNotes[commandeId]) {
          statusHtml = '<span class="text-info"><i class="bi bi-arrow-repeat spin"></i> Sauvegarde...</span>';
        } else if (s.savedNotes[commandeId]) {
          statusHtml = '<span class="text-success"><i class="bi bi-check-circle"></i> Enregistré</span>';
        } else if (s.errorNotes[commandeId]) {
          statusHtml = '<span class="text-danger"><i class="bi bi-exclamation-circle"></i> Erreur</span>';
        }
        statusContainer.innerHTML = statusHtml;
      },

      async saveNote(commandeId, note) {
        try {
          this.state.savingNotes[commandeId] = true;
          delete this.state.savedNotes[commandeId];
          delete this.state.errorNotes[commandeId];
          this.updateNoteStatus(commandeId);

          const response = await fetch(`/api/commandes/${commandeId}/note`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              note: note
            })
          });

          if (response.ok) {
            // Mettre à jour l'état local
            const commande = this.state.commandes.find(c => c.id === commandeId);
            if (commande) {
              commande.note = note;
            }
            this.state.savedNotes[commandeId] = true;
            this.updateNoteStatus(commandeId);
            setTimeout(() => {
              delete this.state.savedNotes[commandeId];
              this.updateNoteStatus(commandeId);
            }, 2000);
          } else {
            throw new Error('Erreur lors de la sauvegarde de la note');
          }
        } catch (error) {
          console.error('Erreur saveNote:', error);
          this.state.errorNotes[commandeId] = true;
          this.updateNoteStatus(commandeId);
          setTimeout(() => {
            delete this.state.errorNotes[commandeId];
            this.updateNoteStatus(commandeId);
          }, 3000);
        } finally {
          delete this.state.savingNotes[commandeId];
          this.updateNoteStatus(commandeId);
        }
      },

      handleNoteInput(commandeId, event) {
        const note = event.target.value;

        // Initialiser l'objet de timers s'il n'existe pas
        if (!this._debouncedSaveNote) {
          this._debouncedSaveNote = {};
        }

        // Annuler le timeout précédent s'il existe
        if (this._debouncedSaveNote[commandeId]) {
          clearTimeout(this._debouncedSaveNote[commandeId]);
        }

        // Créer un nouveau timeout
        this._debouncedSaveNote[commandeId] = setTimeout(() => {
          this.saveNote(commandeId, note);
        }, 1000); // Sauvegarde après 1 seconde d'inactivité
      },

      async reopenCommande(commandeId) {
        if (!confirm('Confirmer la réouverture de cette commande en panier ?')) {
          return;
        }

        try {
          const response = await fetch(`/commandes/${commandeId}/edit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              source: ''
            })
          });

          if (response.ok) {
            // Recharger les commandes
            window.location.reload();
          } else {
            throw new Error('Erreur lors de la réouverture');
          }
        } catch (error) {
          console.error('Erreur reopenCommande:', error);
          alert('Erreur lors de la réouverture de la commande');
        }
      },

      updateDOM() {
        const container = this.$refs.container;
        if (!container) return;

        const s = this.state;

        // Sauvegarder les éléments actifs
        const activeElement = document.activeElement;
        const activeId = activeElement?.id;
        const cursorPosition = activeElement?.selectionStart || 0;

        let html = '<div class="admin-content-wrapper"><div class="container-fluid mt-4">';

        // Bouton retour mobile uniquement
        html += `
          <button class="btn btn-outline-secondary d-md-none mb-3" onclick="window.history.back()">
            <i class="bi bi-arrow-left me-2"></i>Retour
          </button>
        `;

        html += '<div class="row mb-4">';
        html += '<div class="col-12">';
        html += '<h2 class="mb-4"><i class="bi bi-list-check me-2"></i>Historique de mes achats</h2>';

        // Onglets
        html += `
          <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link ${s.activeTab === 'catalogues' ? 'active' : ''}"
                      data-tab="catalogues" type="button" role="tab">
                <i class="bi bi-book me-2"></i>Catalogues (${s.commandes.length})
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link ${s.activeTab === 'caisse' ? 'active' : ''}"
                      data-tab="caisse" type="button" role="tab">
                <i class="bi bi-cart me-2"></i>Caisse (${s.ventes.length})
              </button>
            </li>
          </ul>
        `;

        html += '</div>';
        html += '</div>';

        if (s.error) {
          html += `<div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Erreur :</strong> ${s.error}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>`;
        }

        // Contenu selon l'onglet actif
        if (s.activeTab === 'catalogues') {
          // TAB CATALOGUES
          if (s.loading) {
            html += `<div class="text-center py-5">
              <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="mt-3 text-muted">Chargement des commandes...</p>
            </div>`;
          } else if (s.commandes.length === 0) {
            html += `<div class="alert alert-info text-center">
              <h4>Aucune commande passée</h4>
              <p>Vous n'avez encore passé aucune commande.</p>
              <a href="/catalogues/vue" class="btn btn-primary">Consulter les catalogues</a>
            </div>`;
          } else {
          // Barre de recherche
          html += `<div class="row mb-3">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" id="searchInput"
                       placeholder="Rechercher une commande..."
                       value="${s.searchTerm}">
              </div>
            </div>
            <div class="col-md-6 text-end">
              <span class="text-muted">${s.commandes.length} commande${s.commandes.length > 1 ? 's' : ''} au total</span>
            </div>
          </div>`;

          const commandes = this.getSortedCommandes();

          if (commandes.length === 0) {
            html += `<div class="alert alert-warning text-center">
              <p>Aucune commande ne correspond à votre recherche</p>
            </div>`;
          } else {
            // Vue DESKTOP: Tableau (visible uniquement sur écrans ≥768px)
            html += `<div class="d-none d-md-block">
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead class="table-dark">
                    <tr>
                      <th class="sortable" data-column="id" style="cursor: pointer;">
                        ID ${this.getSortIcon('id')}
                      </th>
                      <th class="sortable" data-column="catalogue" style="cursor: pointer;">
                        Catalogue ${this.getSortIcon('catalogue')}
                      </th>
                      <th>Description + Note</th>
                      <th class="sortable" data-column="expiration_date" style="cursor: pointer;">
                        Expiration ${this.getSortIcon('expiration_date')}
                      </th>
                      <th class="sortable" data-column="date_livraison" style="cursor: pointer;">
                        Livraison ${this.getSortIcon('date_livraison')}
                      </th>
                      <th class="sortable" data-column="created_at" style="cursor: pointer;">
                        Date commande ${this.getSortIcon('created_at')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>`;

            commandes.forEach(c => {
              html += `<tr>
                <td><strong>#${c.id}</strong></td>
                <td>
                  <strong>${c.originalname}</strong>
                  <br><small class="text-muted">N°${c.catalog_filesID}</small>
                </td>
                <td>
                  <div>${c.catalog_description || ''}</div>
                  <div class="mt-2">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <small class="text-muted">Note personnelle (sauvegarde automatique)</small>
                      <small id="note-status-${c.id}">
                        ${s.savingNotes[c.id] ? '<span class="text-info"><i class="bi bi-arrow-repeat spin"></i> Sauvegarde...</span>' : ''}
                        ${s.savedNotes[c.id] ? '<span class="text-success"><i class="bi bi-check-circle"></i> Enregistré</span>' : ''}
                        ${s.errorNotes[c.id] ? '<span class="text-danger"><i class="bi bi-exclamation-circle"></i> Erreur</span>' : ''}
                      </small>
                    </div>
                    <textarea class="form-control form-control-sm note-textarea"
                              id="note_${c.id}"
                              data-commande-id="${c.id}"
                              rows="2"
                              placeholder="Ajoutez votre note personnelle...">${c.note || ''}</textarea>
                  </div>
                </td>
                <td>
                  ${c.expiration_formatted || ''}
                  ${c.isExpired ? '<br><span class="badge bg-danger">Expiré</span>' : ''}
                </td>
                <td>${c.livraison_formatted || ''}</td>
                <td>${c.created_formatted || ''}</td>
                <td>
                  <div class="d-flex flex-column gap-1">
                    <a href="/commandes/${c.id}/vue" class="btn btn-info btn-sm">
                      <i class="bi bi-eye"></i> Voir détails
                    </a>`;

              if (c.modifiable) {
                html += `<button class="btn btn-warning btn-sm reopen-btn"
                                data-commande-id="${c.id}">
                          <i class="bi bi-arrow-counterclockwise"></i> Repasser en panier
                        </button>`;
              } else {
                html += `<span class="badge bg-secondary">Non modifiable</span>`;
              }

              html += `</div>
                </td>
              </tr>`;
            });

            html += `</tbody>
                </table>
              </div>

              <div class="alert alert-secondary mt-3">
                <strong>Non modifiable</strong> - Un catalogue associé à une commande peut être expiré ou le référent a choisi de le rendre non modifiable.
              </div>
            </div>`;

            // Vue MOBILE: Cartes (visible uniquement sur écrans <768px)
            html += `<div class="d-md-none">`;

            commandes.forEach(c => {
              html += `<div class="card mb-2 shadow-sm">
                <div class="card-body p-2" style="font-size: 0.7rem;">
                  <div class="row g-1 mb-2">
                    <!-- Colonne gauche -->
                    <div class="col-6" style="text-align: left;">
                      <div class="mb-1">
                        <strong>Cde #${c.id}</strong> par ${c.username || 'Utilisateur'}
                        ${c.isExpired ? '<br><span class="badge bg-danger" style="font-size: 0.6rem;">Expiré</span>' : ''}
                      </div>
                      <div style="font-size: 0.65rem;" class="mb-1">
                        ${c.nb_produits || 0} produits • <strong>${(c.montant_total || 0).toFixed(2)} €</strong>
                      </div>
                      <div style="font-size: 0.65rem;" class="mb-1">
                        Faite le <strong>${c.created_formatted || '-'}</strong>
                      </div>
                    </div>

                    <!-- Colonne droite -->
                    <div class="col-6">
                      <div class="mb-1" style="text-align: right;">
                        <strong>Cat #${c.catalog_filesID}</strong>, ${c.originalname}
                      </div>
                      <div style="font-size: 0.65rem; text-align: right;" class="mb-1">
                        Expir le <strong>${c.expiration_formatted || '-'}</strong>, livrée le <strong>${c.livraison_formatted || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <!-- Note (pleine largeur) -->
                  ${c.note ? `<div style="font-size: 0.65rem;" class="mb-2">
                    <em>Note: ${c.note}</em>
                  </div>` : ''}

                  <!-- Description (pleine largeur) -->
                  ${c.catalog_description ? `<div class="text-muted mb-2" style="font-size: 0.65rem;">${c.catalog_description}</div>` : ''}

                  <!-- Boutons centrés -->
                  ${c.modifiable ? `
                    <div class="text-center">
                      <a href="/commandes/${c.id}/vue" class="btn btn-sm btn-info" style="min-width: 120px;">
                        <i class="bi bi-eye me-1"></i>Détails
                      </a>
                      <button class="btn btn-sm btn-warning ms-1 reopen-btn"
                              style="min-width: 120px;"
                              data-commande-id="${c.id}">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>Panier
                      </button>
                    </div>
                  ` : `
                    <div class="text-center">
                      <a href="/commandes/${c.id}/vue" class="btn btn-sm btn-info" style="min-width: 150px;">
                        <i class="bi bi-eye me-1"></i>Voir détails
                      </a>
                    </div>
                  `}
                </div>
              </div>`;
            });

            html += `<div class="alert alert-secondary">
              <strong>Non modifiable</strong> - Un catalogue associé à une commande peut être expiré ou le référent a choisi de le rendre non modifiable.
            </div>`;
            html += `</div>`;
          }  // Ferme le else de 389 (if commandes.length === 0)
          }  // Ferme le else de 367 (if s.loading)
        } else {  // Ferme le if de 352 (catalogues) et ouvre caisse
          // TAB CAISSE
          if (s.loading) {
            html += `<div class="text-center py-5">
              <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="mt-3 text-muted">Chargement des achats en caisse...</p>
            </div>`;
          } else if (s.ventes.length === 0) {
            html += `<div class="alert alert-info text-center">
              <h4>Aucun achat en caisse</h4>
              <p>Vous n'avez encore fait aucun achat en caisse.</p>
              <a href="/caisse" class="btn btn-primary">Aller à la caisse</a>
            </div>`;
          } else {
            // Liste des ventes de caisse
            html += `<div class="row mb-3">
              <div class="col-md-12 text-end">
                <span class="text-muted">${s.ventes.length} achat${s.ventes.length > 1 ? 's' : ''} en caisse</span>
              </div>
            </div>`;

            // Vue DESKTOP: Tableau
            html += `<div class="d-none d-md-block">
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead class="table-dark">
                    <tr>
                      <th>N° Ticket</th>
                      <th>Client</th>
                      <th>Produits</th>
                      <th>Montant</th>
                      <th>Mode paiement</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>`;

            s.ventes.forEach(v => {
              html += `<tr>
                <td><strong>${v.numero_ticket}</strong></td>
                <td>${v.nom_client || 'Anonyme'}</td>
                <td>
                  <span class="badge bg-secondary">${v.nb_produits} article${v.nb_produits > 1 ? 's' : ''}</span>
                  ${v.produits_preview ? `<br><small class="text-muted">${v.produits_preview.substring(0, 50)}${v.produits_preview.length > 50 ? '...' : ''}</small>` : ''}
                </td>
                <td><strong class="text-primary">${parseFloat(v.montant_ttc).toFixed(2)} €</strong></td>
                <td>${v.mode_paiement || 'N/A'}</td>
                <td>${v.created_formatted}</td>
                <td>
                  <button class="btn btn-sm btn-info voir-detail-btn" data-vente-id="${v.id}" title="Voir le détail">
                    <i class="bi bi-eye"></i> Détails
                  </button>
                </td>
              </tr>`;
            });

            html += `</tbody>
                </table>
              </div>
            </div>`;

            // Vue MOBILE: Cartes
            html += `<div class="d-md-none">`;

            s.ventes.forEach(v => {
              html += `
                <div class="card mb-3 shadow-sm">
                  <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <h6 class="card-title mb-0">
                        <i class="bi bi-receipt me-1"></i>${v.numero_ticket}
                      </h6>
                      <span class="badge bg-success">${parseFloat(v.montant_ttc).toFixed(2)} €</span>
                    </div>
                    <p class="card-text mb-1">
                      <strong>Client:</strong> ${v.nom_client || 'Anonyme'}<br>
                      <strong>Articles:</strong> ${v.nb_produits}<br>
                      ${v.produits_preview ? `<small class="text-muted">${v.produits_preview.substring(0, 60)}${v.produits_preview.length > 60 ? '...' : ''}</small><br>` : ''}
                      <strong>Paiement:</strong> ${v.mode_paiement || 'N/A'}<br>
                      <small class="text-muted">${v.created_formatted}</small>
                    </p>
                    <div class="text-center mt-2">
                      <button class="btn btn-sm btn-info voir-detail-btn" data-vente-id="${v.id}">
                        <i class="bi bi-eye me-1"></i>Voir détails
                      </button>
                    </div>
                  </div>
                </div>`;
            });

            html += `</div>`;
          }
        }

        // Modal détail vente
        if (s.showDetailModal && s.selectedVente) {
          html += `
            <div class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
              <div class="modal-dialog modal-xl">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">
                      <i class="bi bi-receipt me-2"></i>
                      Détail vente ${s.selectedVente.vente.numero_ticket}
                    </h5>
                    <button type="button" class="btn-close" id="close-modal-btn"></button>
                  </div>
                  <div class="modal-body">
                    <!-- Infos vente -->
                    <div class="row mb-4">
                      <div class="col-md-6">
                        <h6>Informations générales</h6>
                        <dl class="row">
                          <dt class="col-sm-4">Date/Heure</dt>
                          <dd class="col-sm-8">${this.formatDate(s.selectedVente.vente.created_at)}</dd>
                          <dt class="col-sm-4">Caissier</dt>
                          <dd class="col-sm-8">${s.selectedVente.vente.caissier_nom || 'N/A'}</dd>
                          <dt class="col-sm-4">Client</dt>
                          <dd class="col-sm-8">${s.selectedVente.vente.client_nom || s.selectedVente.vente.nom_client || 'Anonyme'}</dd>
                          <dt class="col-sm-4">Montant total</dt>
                          <dd class="col-sm-8"><strong class="text-primary">${parseFloat(s.selectedVente.vente.montant_ttc).toFixed(2)} €</strong></dd>
                        </dl>
                      </div>
                      ${s.selectedVente.vente.panier_id ? `
                        <div class="col-md-6">
                          <h6>Informations panier</h6>
                          <dl class="row">
                            <dt class="col-sm-4">Source</dt>
                            <dd class="col-sm-8">
                              <span class="badge ${s.selectedVente.vente.panier_source === 'caisse' ? 'bg-info' : 'bg-secondary'}">
                                ${s.selectedVente.vente.panier_source || 'N/A'}
                              </span>
                            </dd>
                            <dt class="col-sm-4">Sauvegardé le</dt>
                            <dd class="col-sm-8">${this.formatDate(s.selectedVente.vente.panier_saved_at)}</dd>
                          </dl>
                        </div>
                      ` : ''}
                    </div>

                    <!-- Lignes de vente -->
                    <h6>Produits vendus</h6>
                    <div class="table-responsive mb-4">
                      <table class="table table-sm table-bordered">
                        <thead class="table-light">
                          <tr>
                            <th>Produit</th>
                            <th class="text-end">Quantité</th>
                            <th class="text-end">Prix unitaire</th>
                            <th class="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>`;

          s.selectedVente.lignes.forEach(ligne => {
            html += `
              <tr class="${ligne.is_avoir ? 'table-warning' : ''}">
                <td>
                  ${ligne.nom_produit}
                  ${ligne.is_avoir ? '<span class="badge bg-warning text-dark ms-2">AVOIR</span>' : ''}
                </td>
                <td class="text-end">${parseFloat(ligne.quantite).toFixed(3)}</td>
                <td class="text-end">${parseFloat(ligne.prix_unitaire).toFixed(2)} €</td>
                <td class="text-end">
                  <strong class="${ligne.is_avoir ? 'text-warning' : 'text-primary'}">
                    ${parseFloat(ligne.montant_ttc).toFixed(2)} €
                  </strong>
                </td>
              </tr>`;
          });

          html += `
                        </tbody>
                        <tfoot class="table-light">
                          <tr>
                            <td colspan="3" class="text-end"><strong>Total</strong></td>
                            <td class="text-end">
                              <strong class="text-primary">${parseFloat(s.selectedVente.vente.montant_ttc).toFixed(2)} €</strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <!-- Paiements -->`;

          if (s.selectedVente.paiements && s.selectedVente.paiements.length > 0) {
            html += `
              <h6>Paiements</h6>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead class="table-light">
                    <tr>
                      <th>Mode de paiement</th>
                      <th class="text-end">Montant</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>`;

            s.selectedVente.paiements.forEach(paiement => {
              html += `
                <tr>
                  <td>${paiement.mode_paiement_nom}</td>
                  <td class="text-end"><strong>${parseFloat(paiement.montant).toFixed(2)} €</strong></td>
                  <td>${this.formatDate(paiement.date_paiement)}</td>
                </tr>`;
            });

            html += `
                  </tbody>
                </table>
              </div>`;
          }

          html += `
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="send-pdf-modal-btn" data-vente-id="${s.selectedVente.vente.id}">
                      <i class="bi bi-envelope-fill me-1"></i>Envoyer par email
                    </button>
                    <button type="button" class="btn btn-secondary" id="close-modal-footer-btn">Fermer</button>
                  </div>
                </div>
              </div>
            </div>`;
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Restaurer le focus si nécessaire
        if (activeId) {
          const element = document.getElementById(activeId);
          if (element) {
            element.focus();
            if (element.type === 'text' || element.tagName === 'TEXTAREA') {
              if (typeof element.setSelectionRange === 'function') {
                element.setSelectionRange(cursorPosition, cursorPosition);
              }
            }
          }
        }

        // Attacher les événements
        this.attachEventListeners();
      },

      attachEventListeners() {
        // Onglets
        const tabButtons = document.querySelectorAll('[data-tab]');
        tabButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            this.state.activeTab = tab;
            this.updateDOM();
          });
        });

        // Recherche
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.updateDOM();
          });
        }

        // Tri
        const sortHeaders = document.querySelectorAll('.sortable');
        sortHeaders.forEach(header => {
          header.addEventListener('click', (e) => {
            const column = e.currentTarget.dataset.column;
            this.sortBy(column);
          });
        });

        // Note textarea - sauvegarde automatique
        const noteTextareas = document.querySelectorAll('.note-textarea');
        noteTextareas.forEach(textarea => {
          textarea.addEventListener('input', (e) => {
            const commandeId = parseInt(e.currentTarget.dataset.commandeId);
            this.handleNoteInput(commandeId, e);
          });
        });

        // Reopen commande
        const reopenBtns = document.querySelectorAll('.reopen-btn');
        reopenBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const commandeId = parseInt(e.currentTarget.dataset.commandeId);
            this.reopenCommande(commandeId);
          });
        });

        // Voir détail vente
        const detailBtns = document.querySelectorAll('.voir-detail-btn');
        detailBtns.forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const venteId = parseInt(e.currentTarget.dataset.venteId);
            await this.voirDetail(venteId);
          });
        });

        // Fermer modale - bouton header
        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) {
          closeModalBtn.addEventListener('click', () => {
            this.fermerDetail();
          });
        }

        // Fermer modale - bouton footer
        const closeModalFooterBtn = document.getElementById('close-modal-footer-btn');
        if (closeModalFooterBtn) {
          closeModalFooterBtn.addEventListener('click', () => {
            this.fermerDetail();
          });
        }

        // Envoyer PDF depuis la modale
        const sendPdfModalBtn = document.getElementById('send-pdf-modal-btn');
        if (sendPdfModalBtn) {
          sendPdfModalBtn.addEventListener('click', async (e) => {
            const venteId = parseInt(e.currentTarget.dataset.venteId);
            await this.sendTicketPDF(venteId);
          });
        }
      },

      async voirDetail(venteId) {
        try {
          const response = await fetch(`/api/caisse/ventes-historique/${venteId}`, {
            method: 'GET',
            credentials: 'include'
          });

          const data = await response.json();

          if (data.success) {
            this.state.selectedVente = data;
            this.state.showDetailModal = true;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement du détail');
          }
        } catch (error) {
          console.error('Erreur voirDetail:', error);
          alert('Erreur : ' + error.message);
        }
      },

      fermerDetail() {
        this.state.showDetailModal = false;
      },

      formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      },

      async sendTicketPDF(venteId) {
        if (!confirm('Envoyer le ticket par email ?')) {
          return;
        }

        try {
          const response = await fetch(`/api/commandes/${venteId}/send-pdf`, {
            method: 'GET',
            credentials: 'include'
          });

          const data = await response.json();

          if (data.success) {
            alert('Email envoyé avec succès !');
          } else {
            throw new Error(data.error || 'Erreur lors de l\'envoi');
          }
        } catch (error) {
          console.error('Erreur sendTicketPDF:', error);
          alert('Erreur : ' + error.message);
        }
      }
    },

    mounted() {
      this.updateDOM();
      this.$watch(() => this.state.commandes, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.ventes, () => this.updateDOM(), { deep: true });
      this.$watch(() => this.state.activeTab, () => this.updateDOM());
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'commandes-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#commandes-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
