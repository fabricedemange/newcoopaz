// Application Vue pour la page Panier (modifier)
(function() {
  console.log('🚀 Chargement de PanierApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive } = Vue;

  // Récupérer l'ID du panier depuis l'URL
  const panierId = window.location.pathname.split('/')[2];

  const app = createApp({
    setup() {
      const state = reactive({
        loading: false,
        error: null,
        panier: null,
        articles: [],
        allProducts: [],
        panierArticlesMap: {},
        searchTerm: '',
        selectedCategory: 'all',
        users: [],
        userRole: window.userRole || null,
        selectedUserId: null,
        changingOwner: false,
        savingPanierNote: false,
        panierNoteSaved: false,
        panierNoteError: false
      });

      const loadPanierDetail = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch(`${''}/api/panier/${panierId}`, {
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
            state.panier = data.panier;
            state.articles = data.articles;
            state.allProducts = data.allProducts;
            state.panierArticlesMap = data.panierArticlesMap;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement du panier');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadPanierDetail:', error);
        } finally {
          state.loading = false;
        }
      };

      const loadUsers = async () => {
        // Charger les utilisateurs seulement si l'utilisateur est admin/epicier/referent
        if (!['admin', 'epicier', 'referent', 'SuperAdmin'].includes(state.userRole)) {
          return;
        }

        try {
          const response = await fetch('/api/users', {
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
            state.users = data.users;
          }
        } catch (error) {
          console.error('Erreur dans loadUsers:', error);
        }
      };

      loadPanierDetail();
      loadUsers();

      return {
        state
      };
    },

    methods: {
      getCategories() {
        const categories = new Map();
        this.state.articles.forEach(article => {
          if (article.categorie) {
            categories.set(article.categorie, {
              nom: article.categorie,
              couleur: article.categorie_couleur,
              ordre: article.categorie_ordre
            });
          }
        });
        return Array.from(categories.values()).sort((a, b) => a.ordre - b.ordre);
      },

      getFilteredArticles() {
        let filtered = [...this.state.articles];

        // Filtrer par catégorie
        if (this.state.selectedCategory !== 'all') {
          filtered = filtered.filter(a => a.categorie === this.state.selectedCategory);
        }

        // Filtrer par recherche
        if (this.state.searchTerm) {
          const term = this.state.searchTerm.toLowerCase();
          filtered = filtered.filter(a =>
            a.produit.toLowerCase().includes(term) ||
            (a.description && a.description.toLowerCase().includes(term))
          );
        }

        return filtered;
      },

      async updateQuantity(catalogProductId, newQuantity) {
        const quantity = parseInt(newQuantity) || 0;

        try {
          const response = await fetch(`${''}/panier/update-quantity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              catalog_file_id: this.state.panier.catalog_file_id,
              catalog_product_id: catalogProductId,
              quantity: quantity
            })
          });

          const data = await response.json();

          if (data.success) {
            // Mettre à jour l'état local : vider la quantité mais garder la ligne (ne pas supprimer)
            if (!this.state.panierArticlesMap[catalogProductId]) {
              this.state.panierArticlesMap[catalogProductId] = {};
            }
            this.state.panierArticlesMap[catalogProductId].quantity = quantity;

            const article = this.state.articles.find(a => a.catalog_product_id === catalogProductId);
            if (article) {
              article.quantity = quantity;
            }

            this.updateDOM();
          } else {
            throw new Error(data.error || 'Erreur lors de la mise à jour');
          }
        } catch (error) {
          console.error('Erreur updateQuantity:', error);
          alert('Erreur lors de la mise à jour de la quantité');
        }
      },

      async updateNote(catalogProductId, newNote) {
        try {
          const response = await fetch(`${''}/panier/update-note`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              catalog_file_id: this.state.panier.catalog_file_id,
              catalog_product_id: catalogProductId,
              note: newNote
            })
          });

          const data = await response.json();

          if (data.success) {
            // Mettre à jour l'état local
            if (!this.state.panierArticlesMap[catalogProductId]) {
              this.state.panierArticlesMap[catalogProductId] = {};
            }
            this.state.panierArticlesMap[catalogProductId].note = newNote;

            // Mettre à jour la note dans la liste des articles
            const article = this.state.articles.find(a => a.catalog_product_id === catalogProductId);
            if (article) {
              article.note = newNote;
            }
          } else {
            throw new Error(data.error || 'Erreur lors de la mise à jour');
          }
        } catch (error) {
          console.error('Erreur updateNote:', error);
          alert('Erreur lors de la mise à jour de la note');
        }
      },

      async removeArticle(catalogProductId, produitNom) {
        if (!confirm(`Retirer "${produitNom}" du panier ?`)) {
          return;
        }

        await this.updateQuantity(catalogProductId, 0);
      },

      async deletePanier() {
        try {
          const response = await fetch(`/api/panier/${this.state.panier.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include'
          });

          const data = await response.json();

          if (data.success) {
            alert('Le panier est vide et a été supprimé.');
            // Rediriger vers la liste des catalogues
            window.location.href = '/catalogues/vue';
          } else {
            throw new Error(data.error || 'Erreur lors de la suppression');
          }
        } catch (error) {
          console.error('Erreur suppression panier:', error);
          alert('Erreur lors de la suppression du panier');
        }
      },

      getTotalArticles() {
        return this.state.articles.reduce((sum, article) => {
          return sum + (article.quantity || 0);
        }, 0);
      },

      getTotalPrice() {
        return this.state.articles.reduce((sum, article) => {
          return sum + ((article.quantity || 0) * (article.prix || 0) * (article.unite || 1));
        }, 0);
      },

      formatPrice(price) {
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(price);
      },

      async validerPanier() {
        if (!confirm('Confirmer la validation de votre panier ?')) {
          return;
        }

        try {
          const response = await fetch(`${''}/panier/${panierId}/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include'
          });

          const data = await response.json();

          if (data.success) {
            alert('Panier validé avec succès !');
            window.location.href = '/commandes/vue';
          } else {
            throw new Error(data.error || 'Erreur lors de la validation');
          }
        } catch (error) {
          console.error('Erreur validation panier:', error);
          alert('Erreur lors de la validation du panier');
        }
      },

      async updatePanierNote(newNote) {
        try {
          this.state.savingPanierNote = true;
          const response = await fetch(`/api/panier/${panierId}/note`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              note: newNote
            })
          });

          const data = await response.json();

          if (data.success) {
            // Mettre à jour l'état local
            this.state.panier.note = newNote;
            this.state.panierNoteSaved = true;
            setTimeout(() => {
              this.state.panierNoteSaved = false;
            }, 2000);
          } else {
            throw new Error(data.error || 'Erreur lors de la mise à jour');
          }
        } catch (error) {
          console.error('Erreur updatePanierNote:', error);
          this.state.panierNoteError = true;
          setTimeout(() => {
            this.state.panierNoteError = false;
          }, 3000);
        } finally {
          this.state.savingPanierNote = false;
        }
      },

      debouncedUpdatePanierNote: null,

      handlePanierNoteInput(event) {
        const newNote = event.target.value;

        // Annuler le timeout précédent s'il existe
        if (this.debouncedUpdatePanierNote) {
          clearTimeout(this.debouncedUpdatePanierNote);
        }

        // Créer un nouveau timeout
        this.debouncedUpdatePanierNote = setTimeout(() => {
          this.updatePanierNote(newNote);
        }, 1000); // Sauvegarde après 1 seconde d'inactivité
      },

      async changeOwner() {
        if (!this.state.selectedUserId) {
          alert('Veuillez sélectionner un utilisateur');
          return;
        }

        if (!confirm('Merci de confirmer le changement de propriétaire de ce panier !')) {
          return;
        }

        this.state.changingOwner = true;

        try {
          const response = await fetch(`/api/panier/${panierId}/change-owner`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              user_id: this.state.selectedUserId
            })
          });

          const data = await response.json();

          if (data.success) {
            alert('Propriétaire changé avec succès');
            // Recharger les données du panier
            const panierResponse = await fetch(`/api/panier/${panierId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });

            const panierData = await panierResponse.json();
            if (panierData.success) {
              this.state.panier = panierData.panier;
              this.updateDOM();
            }
          } else {
            throw new Error(data.error || 'Erreur lors du changement');
          }
        } catch (error) {
          console.error('Erreur changeOwner:', error);
          alert('Erreur lors du changement de propriétaire');
        } finally {
          this.state.changingOwner = false;
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

        if (s.error) {
          html += `<div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Erreur :</strong> ${s.error}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>`;
        }

        if (s.loading) {
          html += `<div class="text-center py-5">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3 text-muted">Chargement du panier...</p>
          </div>`;
        } else if (s.panier) {
          // En-tête du panier
          html += `<div class="row mb-4">
            <div class="col">
              <h2><i class="bi bi-cart3 me-2"></i>Mon panier</h2>
              <div class="card">
                <div class="card-body">
                  <dl class="row mb-0">
                    <dt class="col-sm-3">Catalogue :</dt>
                    <dd class="col-sm-9">${s.panier.catalogue_nom}</dd>
                    <dt class="col-sm-3">Expiration :</dt>
                    <dd class="col-sm-9">
                      ${s.panier.expiration_formatted}
                      ${s.panier.isExpired ? '<span class="badge bg-danger ms-2">Expiré</span>' : ''}
                    </dd>
                    <dt class="col-sm-3">Livraison :</dt>
                    <dd class="col-sm-9">${s.panier.livraison_formatted}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>`;

          // Changement de propriétaire (seulement pour admins/epiciers/referents)
          if (['admin', 'epicier', 'referent', 'SuperAdmin'].includes(s.userRole) && s.users.length > 0) {
            html += `<div class="row mb-3">
              <div class="col-12">
                <div class="card">
                  <div class="card-body">
                    <h5 class="card-title mb-3">Changement de propriétaire</h5>
                    <div class="d-flex flex-column flex-md-row gap-2 align-items-md-center">
                      <label class="form-label mb-0 text-nowrap">Propriétaire actuel : <strong>${s.panier.username}</strong></label>
                      <select class="form-select form-select-sm" id="userSelect" style="width: auto; min-width: 200px;" ${s.changingOwner ? 'disabled' : ''}>
                        <option value="">-- Sélectionner un utilisateur --</option>`;

            s.users.forEach(user => {
              const selected = user.id === s.panier.user_id ? 'selected' : '';
              html += `<option value="${user.id}" ${selected}>${user.username}</option>`;
            });

            html += `</select>
                      <button type="button" class="btn btn-warning btn-sm" id="changeOwnerBtn" ${s.changingOwner ? 'disabled' : ''}>
                        ${s.changingOwner ? '<span class="spinner-border spinner-border-sm me-1"></span>' : ''}<i class="bi bi-person-fill-gear me-1"></i>Changer le propriétaire
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>`;
          }

          // Note personnelle du panier
          html += `<div class="row mb-3">
            <div class="col-12">
              <div class="card">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="card-title mb-0">Note personnelle</h5>
                    <small class="text-muted">
                      ${s.savingPanierNote ? '<span class="text-info"><i class="bi bi-arrow-repeat spin"></i> Sauvegarde...</span>' : ''}
                      ${s.panierNoteSaved ? '<span class="text-success"><i class="bi bi-check-circle"></i> Enregistré</span>' : ''}
                      ${s.panierNoteError ? '<span class="text-danger"><i class="bi bi-exclamation-circle"></i> Erreur</span>' : ''}
                    </small>
                  </div>
                  <textarea id="panierNoteInput"
                            class="form-control"
                            rows="2"
                            placeholder="Ajoutez une note personnelle pour ce panier...">${s.panier.note || ''}</textarea>
                  <small class="text-muted d-block mt-2">Cette note sera visible uniquement par vous et les administrateurs. Sauvegarde automatique.</small>
                </div>
              </div>
            </div>
          </div>`;

          // Barre de recherche et filtres
          const categories = this.getCategories();
          html += `<div class="row mb-3">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" id="searchInput"
                       placeholder="Rechercher un article..."
                       value="${s.searchTerm}">
              </div>
            </div>`;

          if (categories.length > 0) {
            html += `<div class="col-md-6">
              <select class="form-select" id="categoryFilter">
                <option value="all">Toutes les catégories</option>`;
            categories.forEach(cat => {
              const selected = s.selectedCategory === cat.nom ? 'selected' : '';
              html += `<option value="${cat.nom}" ${selected}>${cat.nom}</option>`;
            });
            html += `</select>
            </div>`;
          }

          html += `</div>`;

          // Résumé du panier
          const totalArticles = this.getTotalArticles();
          const totalPrice = this.getTotalPrice();

          if (totalArticles > 0) {
            html += `<div class="alert alert-info d-flex justify-content-between align-items-center mb-3">
              <div>
                <i class="bi bi-cart-check me-2"></i>
                <strong>${totalArticles}</strong> article${totalArticles > 1 ? 's' : ''} dans votre panier
                <span class="ms-3"><strong>Total :</strong> ${this.formatPrice(totalPrice)}</span>
              </div>
              ${s.panier.modifiable ? `<button class="btn btn-success" id="btnValider">
                <i class="bi bi-check2-circle me-1"></i>Transformer en commande
              </button>` : ''}
            </div>`;
          }

          // Liste des articles du panier
          const articles = this.getFilteredArticles();

          if (articles.length === 0) {
            html += `<div class="card mb-4">
              <div class="card-body text-center py-5">
                <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
                <p class="text-muted">Votre panier est vide</p>
                <a href="/catalogues/${s.panier.catalog_file_id}/vue" class="btn btn-primary">
                  <i class="bi bi-arrow-left me-1"></i>Retour au catalogue
                </a>
              </div>
            </div>`;
          } else {
            // Grouper par catégorie
            const articlesByCategory = new Map();
            articles.forEach(article => {
              const cat = article.categorie || 'Sans catégorie';
              if (!articlesByCategory.has(cat)) {
                articlesByCategory.set(cat, []);
              }
              articlesByCategory.get(cat).push(article);
            });

            // Afficher chaque catégorie
            articlesByCategory.forEach((arts, categoryName) => {
              const category = categories.find(c => c.nom === categoryName);
              const bgColor = category?.couleur || '#6c757d';

              html += `<div class="card mb-3 border-0 shadow-sm">
                <div class="card-header" style="background-color: ${bgColor}; color: white;">
                  <h5 class="mb-0">${categoryName}</h5>
                </div>
                <div class="card-body p-0">
                  <!-- Vue Desktop: Tableau -->
                  <div class="d-none d-lg-block">
                    <div class="table-responsive">
                      <table class="table table-hover mb-0" style="table-layout: fixed; width: 100%;">
                        <thead class="table-light">
                          <tr>
                            <th style="width: 30%;">Produit</th>
                            <th class="text-center" style="width: 13%;">Prix</th>
                            <th class="text-center" style="width: 20%;">Quantité</th>
                            <th style="width: 27%;">Note</th>
                            <th class="text-center" style="width: 10%;">Actions</th>
                          </tr>
                        </thead>
                        <tbody>`;

              arts.forEach(article => {
                const disabled = !s.panier.modifiable ? 'disabled' : '';
                const total = (article.quantity || 0) * (article.prix || 0) * (article.unite || 1);

                html += `<tr>
                  <td>
                    <div class="d-flex align-items-center">`;

                if (article.image_filename) {
                  html += `<img src="/images/products/${article.image_filename}"
                               alt="${article.produit}"
                               class="me-2"
                               style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"
                               onerror="this.style.display='none'">`;
                }

                html += `<div style="min-width: 0; flex: 1;">
                        <strong>${article.produit}</strong>
                        ${article.description ? `<br><small class="text-muted product-description">${article.description}</small>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="text-center">
                    <strong>${this.formatPrice(article.prix * article.unite)}</strong>
                    ${article.unite > 1 ? `<br><small class="text-muted">par ${article.unite}</small>` : ''}
                  </td>
                  <td class="text-center">
                    <div class="d-flex align-items-center justify-content-center gap-1 mb-1">
                      <button class="btn btn-sm btn-outline-secondary qty-btn-minus"
                              data-product-id="${article.catalog_product_id}"
                              ${disabled}
                              style="width: 32px; height: 32px; padding: 0;">
                        <i class="bi bi-dash"></i>
                      </button>
                      <input type="number"
                             class="form-control form-control-sm text-center quantity-input"
                             id="qty_${article.catalog_product_id}"
                             data-product-id="${article.catalog_product_id}"
                             value="${article.quantity || 0}"
                             min="0"
                             step="1"
                             style="width: 60px;"
                             ${disabled}>
                      <button class="btn btn-sm btn-outline-secondary qty-btn-plus"
                              data-product-id="${article.catalog_product_id}"
                              ${disabled}
                              style="width: 32px; height: 32px; padding: 0;">
                        <i class="bi bi-plus"></i>
                      </button>
                    </div>
                    <small class="text-success d-block">Total: ${this.formatPrice(total)}</small>
                  </td>
                  <td>`;

                if (article.quantity > 0) {
                  html += `<input type="text"
                           class="form-control form-control-sm note-input"
                           id="note_${article.catalog_product_id}"
                           data-product-id="${article.catalog_product_id}"
                           value="${article.note || ''}"
                           placeholder="Note optionnelle"
                           ${disabled}>`;
                } else {
                  html += `<span class="text-muted">-</span>`;
                }

                html += `</td>
                  <td class="text-center">`;

                if (article.quantity > 0) {
                  html += `<button class="btn btn-danger btn-sm remove-btn"
                            data-product-id="${article.catalog_product_id}"
                            data-product-name="${article.produit}"
                            ${disabled}>
                      <i class="bi bi-trash"></i>
                    </button>`;
                } else {
                  html += `<span class="text-muted">-</span>`;
                }

                html += `</td>
                </tr>`;
              });

              html += `</tbody>
                      </table>
                    </div>
                  </div>

                  <!-- Vue Mobile: Cartes -->
                  <div class="d-lg-none">`;

              arts.forEach(article => {
                const disabled = !s.panier.modifiable ? 'disabled' : '';
                const total = (article.quantity || 0) * (article.prix || 0) * (article.unite || 1);
                const cardBg = (article.quantity > 0) ? 'bg-success-subtle' : '';

                html += `<div class="product-card-mobile p-3 border-bottom ${cardBg}">
                  <!-- En-tête produit -->
                  <div class="d-flex align-items-start mb-2">`;

                if (article.image_filename) {
                  html += `<img src="/images/products/${article.image_filename}"
                               alt="${article.produit}"
                               class="me-2"
                               style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"
                               onerror="this.style.display='none'">`;
                }

                html += `<div class="flex-grow-1">
                      <strong class="d-block">${article.produit}</strong>
                      ${article.description ? `<small class="text-muted d-block">${article.description}</small>` : ''}
                    </div>
                  </div>

                  <!-- Prix -->
                  <div class="mb-2">
                    <span class="text-muted">Prix : </span>
                    <strong class="fs-5">${this.formatPrice(article.prix * article.unite)}</strong>
                    ${article.unite > 1 ? `<small class="text-muted"> par ${article.unite}</small>` : ''}
                  </div>

                  <!-- Quantité -->
                  <div class="mb-2">
                    <label class="form-label mb-1 text-muted">Quantité</label>
                    <div class="d-flex align-items-center gap-2">
                      <button class="btn btn-outline-secondary qty-btn-minus"
                              data-product-id="${article.catalog_product_id}"
                              ${disabled}
                              style="width: 44px; height: 44px; padding: 0;">
                        <i class="bi bi-dash fs-5"></i>
                      </button>
                      <input type="number"
                             class="form-control form-control-lg text-center quantity-input"
                             id="qty_mobile_${article.catalog_product_id}"
                             data-product-id="${article.catalog_product_id}"
                             value="${article.quantity || 0}"
                             min="0"
                             step="1"
                             style="width: 80px;"
                             ${disabled}>
                      <button class="btn btn-outline-secondary qty-btn-plus"
                              data-product-id="${article.catalog_product_id}"
                              ${disabled}
                              style="width: 44px; height: 44px; padding: 0;">
                        <i class="bi bi-plus fs-5"></i>
                      </button>
                    </div>
                    <small class="text-success d-block mt-1">Total: ${this.formatPrice(total)}</small>
                  </div>`;

                // Note (seulement si quantité > 0)
                if (article.quantity > 0) {
                  html += `<div class="mb-2">
                    <label class="form-label mb-1 text-muted">Note (optionnel)</label>
                    <input type="text"
                           class="form-control note-input"
                           id="note_mobile_${article.catalog_product_id}"
                           data-product-id="${article.catalog_product_id}"
                           value="${article.note || ''}"
                           placeholder="Ajoutez une note..."
                           ${disabled}>
                  </div>`;
                }

                // Bouton supprimer (seulement si quantité > 0)
                if (article.quantity > 0) {
                  html += `<div class="text-end">
                    <button class="btn btn-danger btn-sm remove-btn"
                            data-product-id="${article.catalog_product_id}"
                            data-product-name="${article.produit}"
                            ${disabled}>
                      <i class="bi bi-trash me-1"></i> Supprimer
                    </button>
                  </div>`;
                }

                html += `</div>`;
              });

              html += `</div>
                </div>
              </div>`;
            });
          }

          // Message si panier non modifiable
          if (!s.panier.modifiable) {
            html += `<div class="alert alert-warning">
              <i class="bi bi-lock me-2"></i>
              Ce catalogue est expiré. Vous ne pouvez plus modifier votre panier.
            </div>`;
          }

          // Boutons de navigation
          html += `<div class="row mt-4">
            <div class="col-12">
              <div class="d-flex gap-2">
                <a href="/catalogues/${s.panier.catalog_file_id}/vue" class="btn btn-secondary">
                  <i class="bi bi-arrow-left me-1"></i>Retour au catalogue
                </a>
                <a href="/commandes/vue" class="btn btn-outline-secondary">
                  <i class="bi bi-list-ul me-1"></i>Mes commandes
                </a>
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
            if (element.type === 'text' && typeof element.setSelectionRange === 'function') {
              element.setSelectionRange(cursorPosition, cursorPosition);
            }
          }
        }

        // Attacher les événements
        this.attachEventListeners();
      },

      attachEventListeners() {
        // Recherche
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.updateDOM();
          });
        }

        // Filtre catégorie
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
          categoryFilter.addEventListener('change', (e) => {
            this.state.selectedCategory = e.target.value;
            this.updateDOM();
          });
        }

        // Boutons moins (-)
        const minusButtons = document.querySelectorAll('.qty-btn-minus');
        minusButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.dataset.productId);
            const input = document.getElementById(`qty_${productId}`) || document.getElementById(`qty_mobile_${productId}`);
            if (input) {
              const currentQty = parseInt(input.value) || 0;
              const newQty = Math.max(0, currentQty - 1);
              input.value = newQty;
              this.updateQuantity(productId, newQty);
            }
          });
        });

        // Boutons plus (+)
        const plusButtons = document.querySelectorAll('.qty-btn-plus');
        plusButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.dataset.productId);
            const input = document.getElementById(`qty_${productId}`) || document.getElementById(`qty_mobile_${productId}`);
            if (input) {
              const currentQty = parseInt(input.value) || 0;
              const newQty = currentQty + 1;
              input.value = newQty;
              this.updateQuantity(productId, newQty);
            }
          });
        });

        // Quantités (avec debounce)
        const quantityInputs = document.querySelectorAll('.quantity-input');
        quantityInputs.forEach(input => {
          let timeout;
          input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              const productId = parseInt(e.target.dataset.productId);
              const quantity = e.target.value;
              this.updateQuantity(productId, quantity);
            }, 500);
          });
        });

        // Notes (avec debounce)
        const noteInputs = document.querySelectorAll('.note-input');
        noteInputs.forEach(input => {
          let timeout;
          input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              const productId = parseInt(e.target.dataset.productId);
              const note = e.target.value;
              this.updateNote(productId, note);
            }, 1000);
          });
        });

        // Boutons de suppression (met la quantité à 0)
        const removeBtns = document.querySelectorAll('.remove-btn');
        removeBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.dataset.productId);
            // Mettre la quantité à 0 au lieu de supprimer l'article
            const input = document.getElementById(`qty_${productId}`) ||
                          document.getElementById(`qty_mobile_${productId}`);
            if (input) {
              input.value = 0;
              this.updateQuantity(productId, 0);
            }
          });
        });

        // Bouton de validation
        const btnValider = document.getElementById('btnValider');
        if (btnValider) {
          btnValider.addEventListener('click', () => {
            this.validerPanier();
          });
        }

        // Changement de propriétaire
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
          userSelect.addEventListener('change', (e) => {
            this.state.selectedUserId = parseInt(e.target.value) || null;
          });
        }

        const changeOwnerBtn = document.getElementById('changeOwnerBtn');
        if (changeOwnerBtn) {
          changeOwnerBtn.addEventListener('click', () => {
            this.changeOwner();
          });
        }

        // Input de la note du panier (sauvegarde automatique)
        const panierNoteInput = document.getElementById('panierNoteInput');
        if (panierNoteInput) {
          panierNoteInput.addEventListener('input', (e) => {
            this.handlePanierNoteInput(e);
          });
        }
      }
    },

    mounted() {
      this.updateDOM();
      this.$watch(() => this.state.articles, () => this.updateDOM(), { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'panier-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#panier-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
