// Application Vue pour la page Détail d'un catalogue
(function() {
  console.log('🚀 Chargement de CatalogueDetailApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive } = Vue;

  // Récupérer l'ID du catalogue depuis l'URL
  const catalogueId = window.location.pathname.split('/')[2];

  // Récupérer le paramètre 'nouveau' de l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const nouveauPanier = urlParams.get('nouveau');

  const app = createApp({
    setup() {
      const state = reactive({
        loading: false,
        error: null,
        catalogue: null,
        products: [],
        panier: null,
        panierArticles: {},
        searchTerm: '',
        selectedCategory: 'all'
      });

      const loadCatalogueDetail = async () => {
        state.loading = true;
        state.error = null;

        try {
          // Construire l'URL avec le paramètre 'nouveau' si présent
          let url = `/api/catalogues/${catalogueId}`;
          if (nouveauPanier === '1') {
            url += '?nouveau=1';
          }

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
            state.catalogue = data.catalogue;
            state.products = data.products;
            state.panier = data.panier;
            state.panierArticles = data.panierArticles;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement du catalogue');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadCatalogueDetail:', error);
        } finally {
          state.loading = false;
        }
      };

      loadCatalogueDetail();

      return {
        state
      };
    },

    methods: {
      getCategories() {
        const categories = new Map();
        this.state.products.forEach(product => {
          if (product.categorie) {
            categories.set(product.categorie, {
              nom: product.categorie,
              couleur: product.categorie_couleur,
              ordre: product.categorie_ordre
            });
          }
        });
        return Array.from(categories.values()).sort((a, b) => a.ordre - b.ordre);
      },

      getFilteredProducts() {
        let filtered = [...this.state.products];

        // Filtrer par catégorie
        if (this.state.selectedCategory !== 'all') {
          filtered = filtered.filter(p => p.categorie === this.state.selectedCategory);
        }

        // Filtrer par recherche
        if (this.state.searchTerm) {
          const term = this.state.searchTerm.toLowerCase();
          filtered = filtered.filter(p =>
            p.produit.toLowerCase().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
          );
        }

        return filtered;
      },

      getProductQuantity(catalogProductId) {
        return this.state.panierArticles[catalogProductId]?.quantity || 0;
      },

      getProductNote(catalogProductId) {
        return this.state.panierArticles[catalogProductId]?.note || '';
      },

      async updateQuantity(catalogProductId, newQuantity, productName) {
        const quantity = parseInt(newQuantity) || 0;

        try {
          // Si on n'a pas encore de panier et que nouveau=1, forcer la création d'un nouveau
          const forceNewPanier = !this.state.panier && nouveauPanier === '1';

          const response = await fetch(`${''}/panier/update-quantity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              catalog_file_id: catalogueId,
              catalog_product_id: catalogProductId,
              quantity: quantity,
              nouveau_panier: forceNewPanier
            })
          });

          const data = await response.json();

          if (data.success) {
            // Mettre à jour l'état local
            if (quantity === 0) {
              delete this.state.panierArticles[catalogProductId];
            } else {
              if (!this.state.panierArticles[catalogProductId]) {
                this.state.panierArticles[catalogProductId] = {};
              }
              this.state.panierArticles[catalogProductId].quantity = quantity;
            }

            // Mettre à jour l'ID du panier si nouveau
            if (data.panier_id && !this.state.panier) {
              this.state.panier = { id: data.panier_id };
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
              catalog_file_id: catalogueId,
              catalog_product_id: catalogProductId,
              note: newNote
            })
          });

          const data = await response.json();

          if (data.success) {
            // Mettre à jour l'état local
            if (!this.state.panierArticles[catalogProductId]) {
              this.state.panierArticles[catalogProductId] = {};
            }
            this.state.panierArticles[catalogProductId].note = newNote;
          } else {
            throw new Error(data.error || 'Erreur lors de la mise à jour');
          }
        } catch (error) {
          console.error('Erreur updateNote:', error);
          alert('Erreur lors de la mise à jour de la note');
        }
      },

      async updatePanierNote(newNote) {
        if (!this.state.panier || !this.state.panier.id) {
          console.log('Pas de panier à mettre à jour');
          return;
        }

        try {
          const response = await fetch(`/api/panier/${this.state.panier.id}/note`, {
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
            console.log('Note du panier mise à jour avec succès');
          } else {
            throw new Error(data.error || 'Erreur lors de la mise à jour de la note du panier');
          }
        } catch (error) {
          console.error('Erreur updatePanierNote:', error);
          alert('Erreur lors de la mise à jour de la note du panier');
        }
      },

      async validerPanier() {
        if (!this.state.panier || !this.state.panier.id) {
          alert('Aucun panier à valider');
          return;
        }

        const totalArticles = this.getTotalArticles();
        if (totalArticles === 0) {
          alert('Votre panier est vide');
          return;
        }

        if (!confirm(`Confirmer la transformation du panier en commande ?\n\n${totalArticles} article${totalArticles > 1 ? 's' : ''} - Total : ${this.formatPrice(this.getTotalPrice())}`)) {
          return;
        }

        try {
          const response = await fetch(`/panier/${this.state.panier.id}/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include'
          });

          const data = await response.json();

          if (data.success) {
            alert('Panier transformé en commande avec succès !');
            window.location.href = '/commandes/vue';
          } else {
            throw new Error(data.error || 'Erreur lors de la validation');
          }
        } catch (error) {
          console.error('Erreur validation panier:', error);
          alert('Erreur lors de la validation du panier');
        }
      },

      getTotalArticles() {
        return Object.values(this.state.panierArticles).reduce((sum, article) => {
          return sum + (article.quantity || 0);
        }, 0);
      },

      getTotalPrice() {
        let total = 0;
        this.state.products.forEach(product => {
          const quantity = this.getProductQuantity(product.id);
          if (quantity > 0) {
            total += quantity * (product.prix || 0) * (product.unite || 1);
          }
        });
        return total;
      },

      formatPrice(price) {
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(price);
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
            <p class="mt-3 text-muted">Chargement du catalogue...</p>
          </div>`;
        } else if (s.catalogue) {
          // En-tête du catalogue
          html += `<div class="row mb-4">
            <div class="col">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h2><i class="bi bi-book me-2"></i>${s.catalogue.originalname}</h2>
                  ${s.catalogue.description ? `<p class="text-muted">${s.catalogue.description}</p>` : ''}
                </div>
                <div class="text-end">
                  <div class="mb-2">
                    <strong>Expiration :</strong> ${s.catalogue.expiration_formatted}
                    ${s.catalogue.isExpired ? '<span class="badge bg-danger ms-2">Expiré</span>' : ''}
                  </div>
                  <div>
                    <strong>Livraison :</strong> ${s.catalogue.livraison_formatted}
                  </div>
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
                       placeholder="Rechercher un produit..."
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
            html += `<div class="alert alert-info">
              <i class="bi bi-cart3 me-2"></i>
              <strong>${totalArticles}</strong> article${totalArticles > 1 ? 's' : ''} dans votre panier
              <span class="ms-3"><strong>Total :</strong> ${this.formatPrice(totalPrice)}</span>
            </div>`;

            // Champ de note pour le panier
            const panierNote = s.panier?.note || '';
            html += `<div class="card mb-3">
              <div class="card-body">
                <h6 class="card-title mb-2">
                  <i class="bi bi-sticky me-2"></i>Note pour ce panier
                  <small class="text-muted ms-2">(optionnel)</small>
                </h6>
                <textarea id="panierNoteInput"
                          class="form-control"
                          rows="2"
                          placeholder="Ajoutez une note pour ce panier...">${panierNote}</textarea>
                <small class="text-muted d-block mt-2">Cette note sera visible sur la commande après validation</small>
                <div class="d-grid gap-2 mt-3">
                  <button class="btn btn-success btn-lg" id="btnValiderPanier">
                    <i class="bi bi-check-circle me-2"></i>Transformer en commande
                  </button>
                </div>
              </div>
            </div>`;
          }

          // Liste des produits
          const products = this.getFilteredProducts();

          if (products.length === 0) {
            html += `<div class="text-center py-5">
              <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
              <p class="text-muted">Aucun produit trouvé</p>
            </div>`;
          } else {
            // Grouper par catégorie
            const productsByCategory = new Map();
            products.forEach(product => {
              const cat = product.categorie || 'Sans catégorie';
              if (!productsByCategory.has(cat)) {
                productsByCategory.set(cat, []);
              }
              productsByCategory.get(cat).push(product);
            });

            // Afficher chaque catégorie
            productsByCategory.forEach((prods, categoryName) => {
              const category = categories.find(c => c.nom === categoryName);
              const bgColor = category?.couleur || '#6c757d';

              html += `<div class="card mb-3 border-0 shadow-sm">
                <div class="card-header" style="background-color: ${bgColor}; color: white;">
                  <h5 class="mb-0">${categoryName}</h5>
                </div>
                <div class="card-body p-0">
                  <!-- Vue Desktop: Tableau -->
                  <div class="d-none d-md-block">
                    <div class="table-responsive">
                      <table class="table table-hover mb-0">
                        <thead class="table-light">
                          <tr>
                            <th style="width: 35%;">Produit</th>
                            <th class="text-center" style="width: 15%;">Prix</th>
                            <th class="text-center" style="width: 20%;">Quantité</th>
                            <th style="width: 30%;">Note</th>
                          </tr>
                        </thead>
                        <tbody>`;

              prods.forEach(product => {
                const quantity = this.getProductQuantity(product.id);
                const note = this.getProductNote(product.id);
                const disabled = !s.catalogue.modifiable ? 'disabled' : '';
                const rowClass = quantity > 0 ? 'table-success' : '';

                html += `<tr class="${rowClass}">
                  <td>
                    <div class="d-flex align-items-center">`;

                if (product.image_filename) {
                  html += `<img src="/images/products/${product.image_filename}"
                               alt="${product.produit}"
                               class="me-2"
                               style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"
                               onerror="this.style.display='none'">`;
                }

                html += `<div>
                        <strong>${product.produit}</strong>
                        ${product.description ? `<br><small class="text-muted">${product.description}</small>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="text-center">
                    <strong>${this.formatPrice(product.prix * product.unite)}</strong>
                    ${product.unite > 1 ? `<br><small class="text-muted">par ${product.unite}</small>` : ''}
                  </td>
                  <td class="text-center">
                    <div class="d-flex align-items-center justify-content-center gap-1">
                      <button class="btn btn-sm btn-outline-secondary qty-btn-minus"
                              data-product-id="${product.id}"
                              data-product-name="${product.produit}"
                              ${disabled}
                              style="width: 32px; height: 32px; padding: 0;">
                        <i class="bi bi-dash"></i>
                      </button>
                      <input type="number"
                             class="form-control form-control-sm text-center quantity-input"
                             id="qty_${product.id}"
                             data-product-id="${product.id}"
                             data-product-name="${product.produit}"
                             value="${quantity}"
                             min="0"
                             step="1"
                             style="width: 60px;"
                             ${disabled}>
                      <button class="btn btn-sm btn-outline-secondary qty-btn-plus"
                              data-product-id="${product.id}"
                              data-product-name="${product.produit}"
                              ${disabled}
                              style="width: 32px; height: 32px; padding: 0;">
                        <i class="bi bi-plus"></i>
                      </button>
                    </div>
                  </td>
                  <td>`;

                if (quantity > 0) {
                  html += `<input type="text"
                           class="form-control form-control-sm note-input"
                           id="note_${product.id}"
                           data-product-id="${product.id}"
                           value="${note}"
                           placeholder="Note optionnelle"
                           ${disabled}>`;
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
                  <div class="d-md-none">`;

              prods.forEach(product => {
                const quantity = this.getProductQuantity(product.id);
                const note = this.getProductNote(product.id);
                const disabled = !s.catalogue.modifiable ? 'disabled' : '';
                const cardBg = quantity > 0 ? 'bg-success-subtle' : '';

                html += `<div class="product-card-mobile p-3 border-bottom ${cardBg}">
                  <!-- En-tête produit -->
                  <div class="d-flex align-items-start mb-2">`;

                if (product.image_filename) {
                  html += `<img src="/images/products/${product.image_filename}"
                               alt="${product.produit}"
                               class="me-2"
                               style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"
                               onerror="this.style.display='none'">`;
                }

                html += `<div class="flex-grow-1">
                      <strong class="d-block">${product.produit}</strong>
                      ${product.description ? `<small class="text-muted d-block">${product.description}</small>` : ''}
                    </div>
                  </div>

                  <!-- Prix -->
                  <div class="mb-2">
                    <span class="text-muted">Prix : </span>
                    <strong class="fs-5">${this.formatPrice(product.prix * product.unite)}</strong>
                    ${product.unite > 1 ? `<small class="text-muted"> par ${product.unite}</small>` : ''}
                  </div>

                  <!-- Quantité -->
                  <div class="mb-2">
                    <label class="form-label mb-1 text-muted">Quantité</label>
                    <div class="d-flex align-items-center gap-2">
                      <button class="btn btn-outline-secondary qty-btn-minus"
                              data-product-id="${product.id}"
                              data-product-name="${product.produit}"
                              ${disabled}
                              style="width: 44px; height: 44px; padding: 0;">
                        <i class="bi bi-dash fs-5"></i>
                      </button>
                      <input type="number"
                             class="form-control form-control-lg text-center quantity-input"
                             id="qty_mobile_${product.id}"
                             data-product-id="${product.id}"
                             data-product-name="${product.produit}"
                             value="${quantity}"
                             min="0"
                             step="1"
                             style="width: 80px;"
                             ${disabled}>
                      <button class="btn btn-outline-secondary qty-btn-plus"
                              data-product-id="${product.id}"
                              data-product-name="${product.produit}"
                              ${disabled}
                              style="width: 44px; height: 44px; padding: 0;">
                        <i class="bi bi-plus fs-5"></i>
                      </button>
                    </div>
                  </div>`;

                // Note (seulement si quantité > 0)
                if (quantity > 0) {
                  html += `<div>
                    <label class="form-label mb-1 text-muted">Note (optionnel)</label>
                    <input type="text"
                           class="form-control note-input"
                           id="note_mobile_${product.id}"
                           data-product-id="${product.id}"
                           value="${note}"
                           placeholder="Ajoutez une note..."
                           ${disabled}>
                  </div>`;
                }

                html += `</div>`;
              });

              html += `</div>
                </div>
              </div>`;
            });
          }

          // Message si catalogue non modifiable
          if (!s.catalogue.modifiable) {
            html += `<div class="alert alert-warning">
              <i class="bi bi-lock me-2"></i>
              Ce catalogue est expiré. Vous ne pouvez plus modifier votre panier.
            </div>`;
          }
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Restaurer le focus si nécessaire
        if (activeId) {
          const element = document.getElementById(activeId);
          if (element) {
            element.focus();
            // setSelectionRange ne fonctionne que sur les inputs textuels, pas sur type="number"
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
            const productName = e.currentTarget.dataset.productName;
            const input = document.getElementById(`qty_${productId}`);
            const currentQty = parseInt(input.value) || 0;
            const newQty = Math.max(0, currentQty - 1);
            input.value = newQty;
            this.updateQuantity(productId, newQty, productName);
          });
        });

        // Boutons plus (+)
        const plusButtons = document.querySelectorAll('.qty-btn-plus');
        plusButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const productId = parseInt(e.currentTarget.dataset.productId);
            const productName = e.currentTarget.dataset.productName;
            const input = document.getElementById(`qty_${productId}`);
            const currentQty = parseInt(input.value) || 0;
            const newQty = currentQty + 1;
            input.value = newQty;
            this.updateQuantity(productId, newQty, productName);
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
              const productName = e.target.dataset.productName;
              const quantity = e.target.value;
              this.updateQuantity(productId, quantity, productName);
            }, 500);
          });
        });

        // Notes produits (avec debounce)
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

        // Note du panier (avec debounce)
        const panierNoteInput = document.getElementById('panierNoteInput');
        if (panierNoteInput) {
          let timeout;
          panierNoteInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              const note = e.target.value;
              this.updatePanierNote(note);
            }, 1000);
          });
        }

        // Bouton valider panier
        const btnValiderPanier = document.getElementById('btnValiderPanier');
        if (btnValiderPanier) {
          btnValiderPanier.addEventListener('click', () => {
            this.validerPanier();
          });
        }
      }
    },

    mounted() {
      this.updateDOM();
      this.$watch(() => this.state.products, () => this.updateDOM(), { deep: true });
    },

    render() {
      return Vue.h('div', {
        ref: 'container',
        id: 'catalogue-detail-container'
      });
    }
  });

  console.log('🎯 Montage de l\'application Vue...');
  try {
    app.mount('#catalogue-detail-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
