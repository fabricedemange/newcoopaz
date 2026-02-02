/**
 * AdminProduitsApp.js - Application Vue.js pour la gestion des produits
 * Version: 4 - Ajout changement fournisseur en masse
 */

(function() {
  console.log('🎨 AdminProduitsApp.js - Chargement...');

  const { createApp } = Vue;

  const app = createApp({
    data() {
      return {
        products: [],
        categories: [],
        suppliers: [],
        filters: {
          categoryId: '',
          supplierId: '',
          label: '',
          search: '',
          isActive: ''
        },
        loading: true,
        error: null,
        sortColumn: 'nom',
        sortDirection: 'asc',
        selectedProducts: [],
        showBulkActions: false,
        bulkCategoryId: '',
        bulkSupplierId: '',
        bulkUnite: '',
        bulkQuantiteMin: '',
        processingBulk: false
      };
    },

    computed: {
      filteredProducts() {
        let filtered = [...this.products];

        // Filtre par catégorie
        if (this.filters.categoryId) {
          filtered = filtered.filter(p =>
            p.category_id && p.category_id.toString() === this.filters.categoryId
          );
        }

        // Filtre par fournisseur
        if (this.filters.supplierId) {
          filtered = filtered.filter(p =>
            p.supplier_id && p.supplier_id.toString() === this.filters.supplierId
          );
        }

        // Filtre par label
        if (this.filters.label) {
          const labelLower = this.filters.label.toLowerCase();
          filtered = filtered.filter(p =>
            p.label && p.label.toLowerCase().includes(labelLower)
          );
        }

        // Filtre par recherche (nom ou description)
        if (this.filters.search) {
          const searchLower = this.filters.search.toLowerCase();
          filtered = filtered.filter(p =>
            (p.nom && p.nom.toLowerCase().includes(searchLower)) ||
            (p.description && p.description.toLowerCase().includes(searchLower))
          );
        }

        // Filtre par statut actif/inactif
        if (this.filters.isActive !== '') {
          const isActive = this.filters.isActive === '1';
          filtered = filtered.filter(p => p.is_active === (isActive ? 1 : 0));
        }

        // Tri
        filtered.sort((a, b) => {
          let aVal = a[this.sortColumn] || '';
          let bVal = b[this.sortColumn] || '';

          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();

          if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
          return 0;
        });

        return filtered;
      }
    },

    methods: {
      async loadData() {
        this.loading = true;
        this.error = null;

        try {
          const url = window.location.protocol + '//' + window.location.host + '/api/admin/products';
          const response = await fetch(url, {
            headers: {
              'CSRF-Token': window.CSRF_TOKEN
            }
          });

          if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
          }

          const data = await response.json();

          if (data.success) {
            this.products = data.products || [];
            this.categories = data.categories || [];
            this.suppliers = data.suppliers || [];
          } else {
            throw new Error(data.error || 'Erreur inconnue');
          }
        } catch (error) {
          console.error('❌ Erreur:', error);
          this.error = error.message;
        } finally {
          this.loading = false;
        }
      },

      truncateText(text, maxLength = 60) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      },

      resetFilters() {
        this.filters = {
          categoryId: '',
          supplierId: '',
          label: '',
          search: '',
          isActive: ''
        };
      },

      sortBy(column) {
        if (this.sortColumn === column) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = column;
          this.sortDirection = 'asc';
        }
      },

      getSortIcon(column) {
        if (this.sortColumn !== column) return 'bi-arrow-down-up';
        return this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
      },

      goToProduct(productId) {
        window.location.href = `/admin/products/${productId}`;
      },

      goToEditProduct(productId) {
        window.location.href = `/admin/products/${productId}/edit`;
      },

      goToNewProduct() {
        window.location.href = '/admin/products/new';
      },

      toggleProductSelection(productId) {
        const index = this.selectedProducts.indexOf(productId);
        if (index > -1) {
          this.selectedProducts.splice(index, 1);
        } else {
          this.selectedProducts.push(productId);
        }
      },

      toggleSelectAll() {
        if (this.selectedProducts.length === this.filteredProducts.length) {
          this.selectedProducts = [];
        } else {
          this.selectedProducts = this.filteredProducts.map(p => p.id);
        }
      },

      isSelected(productId) {
        return this.selectedProducts.indexOf(productId) > -1;
      },

      async bulkUpdate() {
        if (!this.bulkCategoryId && !this.bulkSupplierId && !this.bulkUnite && !this.bulkQuantiteMin) {
          alert('Veuillez sélectionner au moins un champ à modifier');
          return;
        }

        if (this.selectedProducts.length === 0) {
          alert('Veuillez sélectionner au moins un produit');
          return;
        }

        let confirmMsg = `Modifier ${this.selectedProducts.length} produit(s) ?\n`;
        if (this.bulkCategoryId) confirmMsg += '- Nouvelle catégorie\n';
        if (this.bulkSupplierId) confirmMsg += '- Nouveau fournisseur\n';
        if (this.bulkUnite) confirmMsg += `- Unité: ${this.bulkUnite}\n`;
        if (this.bulkQuantiteMin) confirmMsg += `- Quantité minimale: ${this.bulkQuantiteMin}\n`;

        if (!confirm(confirmMsg)) return;

        this.processingBulk = true;

        try {
          const response = await fetch('/api/admin/products/bulk-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': window.CSRF_TOKEN
            },
            body: JSON.stringify({
              productIds: this.selectedProducts,
              categoryId: this.bulkCategoryId || null,
              supplierId: this.bulkSupplierId || null,
              unite: this.bulkUnite || null,
              quantiteMin: this.bulkQuantiteMin || null
            })
          });

          const data = await response.json();

          if (data.success) {
            alert(`${data.updated} produit(s) mis à jour avec succès`);
            this.selectedProducts = [];
            this.bulkCategoryId = '';
            this.bulkSupplierId = '';
            this.bulkUnite = '';
            this.bulkQuantiteMin = '';
            this.showBulkActions = false;
            await this.loadData();
          } else {
            alert('Erreur: ' + (data.error || 'Erreur inconnue'));
          }
        } catch (error) {
          console.error('Erreur:', error);
          alert('Erreur lors de la mise à jour');
        } finally {
          this.processingBulk = false;
        }
      },

      cancelBulkActions() {
        this.selectedProducts = [];
        this.bulkCategoryId = '';
        this.bulkSupplierId = '';
        this.bulkUnite = '';
        this.bulkQuantiteMin = '';
        this.showBulkActions = false;
      },

      render() {
        // Sauvegarder l'élément actif et la position du curseur avant de régénérer le HTML
        const activeElement = document.activeElement;
        const activeId = activeElement?.id;
        const cursorPosition = activeElement?.selectionStart || 0;

        let html = '';

        if (this.loading) {
          html = `
            <div class="text-center py-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="mt-3 text-muted">Chargement des produits...</p>
            </div>
          `;
        } else if (this.error) {
          html = `
            <div class="alert alert-danger">
              <h4><i class="bi bi-exclamation-triangle me-2"></i>Erreur</h4>
              <p>${this.error}</p>
              <button class="btn btn-primary" onclick="location.reload()">
                <i class="bi bi-arrow-clockwise me-2"></i>Réessayer
              </button>
            </div>
          `;
        } else {
          html = `
            <div class="container-fluid px-3 mt-4">
              <!-- En-tête -->
              <div class="row">
                <div class="col-12">
                  <h2 class="mb-4">Gestion des produits</h2>
                  <p class="text-muted mb-4">Gérer la bibliothèque de produits réutilisables</p>
                </div>
              </div>

              <!-- Boutons actions -->
              <div class="row">
                <div class="col-12">
                  <div class="d-flex flex-column flex-sm-row gap-2 mb-3">
                    <button class="btn btn-success" onclick="app.goToNewProduct()">
                      <i class="bi bi-plus-circle me-2"></i>Ajouter un produit
                    </button>
                    <button class="btn btn-outline-primary" onclick="app.showBulkActions = !app.showBulkActions">
                      <i class="bi bi-list-check me-2"></i>Actions groupées
                      ${this.selectedProducts.length > 0 ? ` (${this.selectedProducts.length})` : ''}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Barre d'actions groupées -->
              ${this.showBulkActions ? `
                <div class="row mb-3">
                  <div class="col-12">
                    <div class="card border-primary">
                      <div class="card-body">
                        <div class="row align-items-end">
                          <div class="col-12 mb-3">
                            <h5 class="card-title mb-0">
                              <i class="bi bi-pencil-square me-2"></i>
                              Modifier ${this.selectedProducts.length} produit(s) sélectionné(s)
                            </h5>
                            <small class="text-muted">Modifiez une ou plusieurs propriétés en même temps</small>
                          </div>
                          <div class="col-md-3 mb-3 mb-md-0">
                            <label class="form-label">Nouvelle catégorie</label>
                            <select class="form-select" id="bulk-category-select" onchange="app.bulkCategoryId = this.value">
                              <option value="" ${this.bulkCategoryId === '' ? 'selected' : ''}>Ne pas modifier</option>
                              ${this.categories.map(cat => `
                                <option value="${cat.id}" ${this.bulkCategoryId === cat.id.toString() ? 'selected' : ''}>${cat.nom}</option>
                              `).join('')}
                            </select>
                          </div>
                          <div class="col-md-3 mb-3 mb-md-0">
                            <label class="form-label">Nouveau fournisseur</label>
                            <select class="form-select" id="bulk-supplier-select" onchange="app.bulkSupplierId = this.value">
                              <option value="" ${this.bulkSupplierId === '' ? 'selected' : ''}>Ne pas modifier</option>
                              ${this.suppliers.map(sup => `
                                <option value="${sup.id}" ${this.bulkSupplierId === sup.id.toString() ? 'selected' : ''}>${sup.nom}</option>
                              `).join('')}
                            </select>
                          </div>
                          <div class="col-md-2 mb-3 mb-md-0">
                            <label class="form-label">Unité</label>
                            <select class="form-select" id="bulk-unite-select" onchange="app.bulkUnite = this.value">
                              <option value="" ${this.bulkUnite === '' ? 'selected' : ''}>Ne pas modifier</option>
                              <option value="Pièce" ${this.bulkUnite === 'Pièce' ? 'selected' : ''}>Pièce</option>
                              <option value="Kilo" ${this.bulkUnite === 'Kilo' ? 'selected' : ''}>Kilo</option>
                              <option value="Litre" ${this.bulkUnite === 'Litre' ? 'selected' : ''}>Litre</option>
                              <option value="Unite" ${this.bulkUnite === 'Unite' ? 'selected' : ''}>Unité</option>
                            </select>
                          </div>
                          <div class="col-md-2 mb-3 mb-md-0">
                            <label class="form-label">Qté mini</label>
                            <input
                              type="number"
                              class="form-control"
                              id="bulk-quantite-min-input"
                              placeholder="Ex: 0.5"
                              step="0.001"
                              min="0"
                              value="${this.bulkQuantiteMin}"
                              oninput="app.bulkQuantiteMin = this.value">
                          </div>
                          <div class="col-md-2">
                            <div class="d-flex gap-2">
                              <button
                                class="btn btn-primary flex-fill"
                                onclick="app.bulkUpdate()"
                                ${this.processingBulk ? 'disabled' : ''}>
                                ${this.processingBulk ? '<span class="spinner-border spinner-border-sm me-2"></span>' : '<i class="bi bi-check-lg me-2"></i>'}
                                Appliquer
                              </button>
                              <button
                                class="btn btn-outline-secondary"
                                onclick="app.cancelBulkActions()"
                                ${this.processingBulk ? 'disabled' : ''}>
                                <i class="bi bi-x-lg"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Filtres -->
              <div class="row mb-3">
                <div class="col-12">
                  <div class="card">
                    <div class="card-header">
                      <h5 class="card-title mb-0">
                        <i class="bi bi-funnel me-2"></i>Filtres
                      </h5>
                    </div>
                    <div class="card-body">
                      <div class="row g-3">
                        <div class="col-md-3">
                          <label for="filter-search" class="form-label">Recherche</label>
                          <input
                            type="text"
                            class="form-control filter-search-input"
                            id="filter-search"
                            value="${this.filters.search}"
                            oninput="app.filters.search = this.value"
                            placeholder="Nom ou description...">
                        </div>

                        <div class="col-md-3">
                          <label for="filter-category" class="form-label">Catégorie</label>
                          <select
                            class="form-select"
                            id="filter-category"
                            onchange="app.filters.categoryId = this.value">
                            <option value="" ${this.filters.categoryId === '' ? 'selected' : ''}>Toutes les catégories</option>
                            ${this.categories.map(cat => `
                              <option value="${cat.id}" ${this.filters.categoryId === cat.id.toString() ? 'selected' : ''}>${cat.nom}</option>
                            `).join('')}
                          </select>
                        </div>

                        <div class="col-md-2">
                          <label for="filter-supplier" class="form-label">Fournisseur</label>
                          <select
                            class="form-select"
                            id="filter-supplier"
                            onchange="app.filters.supplierId = this.value">
                            <option value="" ${this.filters.supplierId === '' ? 'selected' : ''}>Tous les fournisseurs</option>
                            ${this.suppliers.map(sup => `
                              <option value="${sup.id}" ${this.filters.supplierId === sup.id.toString() ? 'selected' : ''}>${sup.nom}</option>
                            `).join('')}
                          </select>
                        </div>

                        <div class="col-md-2">
                          <label for="filter-label" class="form-label">Label</label>
                          <input
                            type="text"
                            class="form-control"
                            id="filter-label"
                            value="${this.filters.label}"
                            oninput="app.filters.label = this.value"
                            placeholder="Bio, AOP, IGP...">
                        </div>

                        <div class="col-md-2">
                          <label for="filter-status" class="form-label">Statut</label>
                          <select
                            class="form-select"
                            id="filter-status"
                            onchange="app.filters.isActive = this.value">
                            <option value="" ${this.filters.isActive === '' ? 'selected' : ''}>Tous</option>
                            <option value="1" ${this.filters.isActive === '1' ? 'selected' : ''}>Actifs uniquement</option>
                            <option value="0" ${this.filters.isActive === '0' ? 'selected' : ''}>Inactifs uniquement</option>
                          </select>
                        </div>

                        <div class="col-md-12">
                          <button
                            type="button"
                            class="btn btn-outline-secondary"
                            @click="resetFilters">
                            <i class="bi bi-x-lg me-2"></i>Réinitialiser
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Liste des produits -->
              <div class="row">
                <div class="col-12">
          `;

          if (this.filteredProducts.length === 0) {
            html += `
              <div class="alert alert-info text-center">
                <h4>Aucun produit trouvé</h4>
                <p>Commencez par créer votre premier produit ou modifiez les filtres.</p>
                <button class="btn btn-primary" onclick="app.goToNewProduct()">
                  Créer un produit
                </button>
              </div>
            `;
          } else {
            html += `
              <div class="card">
                <div class="card-header">
                  <h5 class="card-title mb-0">
                    <i class="bi bi-box-seam me-2"></i>
                    Liste des produits (${this.filteredProducts.length})
                  </h5>
                </div>
                <div class="card-body">
                  <!-- Version desktop -->
                  <div class="table-responsive d-none d-md-block">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th style="width: 40px;">
                            <input
                              type="checkbox"
                              class="form-check-input"
                              ${this.selectedProducts.length === this.filteredProducts.length && this.filteredProducts.length > 0 ? 'checked' : ''}
                              onclick="app.toggleSelectAll()"
                              title="Tout sélectionner">
                          </th>
                          <th>Image</th>
                          <th style="cursor: pointer" onclick="app.sortBy('nom')">
                            Produit <i class="${this.getSortIcon('nom')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('categorie')">
                            Catégorie <i class="${this.getSortIcon('categorie')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('fournisseur')">
                            Fournisseur <i class="${this.getSortIcon('fournisseur')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('prix')">
                            Prix <i class="${this.getSortIcon('prix')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('label')">
                            Label <i class="${this.getSortIcon('label')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('nb_catalogues')">
                            Catalogues <i class="${this.getSortIcon('nb_catalogues')}"></i>
                          </th>
                          <th style="cursor: pointer" onclick="app.sortBy('is_active')">
                            Statut <i class="${this.getSortIcon('is_active')}"></i>
                          </th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
            `;

            this.filteredProducts.forEach(product => {
              const isChecked = this.isSelected(product.id);
              html += `
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      class="form-check-input"
                      ${isChecked ? 'checked' : ''}
                      onclick="app.toggleProductSelection(${product.id})">
                  </td>
                  <td>
                    ${product.image_url ? `
                      <img src="${product.image_url}"
                           alt="${product.nom}"
                           style="width: 50px; height: 50px; object-fit: cover;"
                           class="rounded">
                    ` : `
                      <span class="text-muted">-</span>
                    `}
                  </td>
                  <td>
                    <strong>${product.nom}</strong>
                    ${product.description ? `<br><small class="text-muted">${this.truncateText(product.description, 60)}</small>` : ''}
                  </td>
                  <td>
                    ${product.categorie ? `
                      <span class="badge" style="background-color: ${product.categorie_couleur || '#6c757d'}">
                        ${product.categorie}
                      </span>
                    ` : '<span class="text-muted">-</span>'}
                  </td>
                  <td>${product.fournisseur || '-'}</td>
                  <td>
                    ${product.prix && product.prix > 0 ? `<strong>${parseFloat(product.prix).toFixed(2)} €</strong>` : '<span class="text-muted">-</span>'}
                  </td>
                  <td>
                    ${product.label ? `<small>${product.label}</small>` : '<span class="text-muted">-</span>'}
                  </td>
                  <td>
                    <span class="badge bg-info">${product.nb_catalogues || 0}</span>
                  </td>
                  <td>
                    ${product.is_active
                      ? '<span class="badge bg-success">Actif</span>'
                      : '<span class="badge bg-secondary">Inactif</span>'}
                  </td>
                  <td>
                    <div class="btn-group btn-group-sm">
                      <button
                        class="btn btn-outline-primary"
                        onclick="app.goToProduct(${product.id})"
                        title="Voir">
                        <i class="bi bi-eye"></i>
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        onclick="app.goToEditProduct(${product.id})"
                        title="Modifier">
                        <i class="bi bi-pencil"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            });

            html += `
                      </tbody>
                    </table>
                  </div>

                  <!-- Version mobile -->
                  <div class="d-md-none">
            `;

            this.filteredProducts.forEach(product => {
              html += `
                <div class="card mb-3 shadow-sm">
                  <div class="card-body">
                    ${product.image_url ? `
                      <img src="${product.image_url}"
                           alt="${product.nom}"
                           style="width: 100%; height: 150px; object-fit: cover; margin-bottom: 10px;"
                           class="rounded">
                    ` : ''}
                    <h5 class="card-title mb-2">${product.nom}</h5>
                    ${product.description ? `<p class="card-text text-muted small mb-3">${this.truncateText(product.description, 100)}</p>` : ''}

                    <div class="row g-2 mb-3">
                      <div class="col-6">
                        <small class="text-muted d-block">Catégorie</small>
                        ${product.categorie ? `
                          <span class="badge" style="background-color: ${product.categorie_couleur || '#6c757d'}">
                            ${product.categorie}
                          </span>
                        ` : '<span class="text-muted">-</span>'}
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Fournisseur</small>
                        <strong>${product.fournisseur || '-'}</strong>
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Prix</small>
                        <strong class="text-success">${product.prix && product.prix > 0 ? parseFloat(product.prix).toFixed(2) + ' €' : '-'}</strong>
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Label</small>
                        <strong>${product.label || '-'}</strong>
                      </div>
                      <div class="col-6">
                        <small class="text-muted d-block">Catalogues</small>
                        <span class="badge bg-info">${product.nb_catalogues || 0}</span>
                      </div>
                      <div class="col-12">
                        <small class="text-muted d-block">Statut</small>
                        ${product.is_active
                          ? '<span class="badge bg-success">Actif</span>'
                          : '<span class="badge bg-secondary">Inactif</span>'}
                      </div>
                    </div>

                    <div class="d-flex gap-2">
                      <button
                        class="btn btn-sm btn-outline-primary flex-fill"
                        onclick="app.goToProduct(${product.id})">
                        <i class="bi bi-eye me-1"></i>Voir
                      </button>
                      <button
                        class="btn btn-sm btn-outline-secondary flex-fill"
                        onclick="app.goToEditProduct(${product.id})">
                        <i class="bi bi-pencil me-1"></i>Modifier
                      </button>
                    </div>
                  </div>
                </div>
              `;
            });

            html += `
                  </div>
                </div>
              </div>
            `;
          }

          html += `
                </div>
              </div>
            </div>
          `;
        }

        // Mettre à jour le DOM
        const container = this.$refs.container;
        if (container) {
          container.innerHTML = html;

          // Restaurer le focus et la position du curseur
          if (activeId) {
            this.$nextTick(() => {
              const element = document.getElementById(activeId);
              if (element) {
                element.focus();
                if (element.type === 'text' || element.tagName === 'TEXTAREA') {
                  if (typeof element.setSelectionRange === 'function') {
                    element.setSelectionRange(cursorPosition, cursorPosition);
                  }
                }
              }
            });
          }
        }
      }
    },

    mounted() {
      console.log('✅ AdminProduitsApp monté');
      this.loadData();
      this.render();
    },

    watch: {
      filters: {
        handler() {
          this.render();
        },
        deep: true
      },
      products() {
        this.render();
      },
      selectedProducts() {
        this.render();
      },
      showBulkActions() {
        this.render();
      },
      sortColumn() {
        this.render();
      },
      sortDirection() {
        this.render();
      }
    }
  });

  // Montage de l'application
  window.app = app.mount('#admin-produits-app');
  console.log('✅ AdminProduitsApp initialisé');
})();
