// Application Vue pour la page de détail de commande
(function() {
  console.log('🚀 Chargement de CommandeDetailApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive } = Vue;

  // Récupérer l'ID de la commande depuis l'URL
  const commandeId = window.location.pathname.split('/')[2];

  const app = createApp({
    setup() {
      const state = reactive({
        loading: false,
        error: null,
        commande: null,
        articles: [],
        editingNoteId: null
      });

      const loadCommandeDetail = async () => {
        state.loading = true;
        state.error = null;

        try {
          const response = await fetch(`/api/commandes/${commandeId}`, {
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
            state.commande = data.commande;
            state.articles = data.articles;
          } else {
            throw new Error(data.error || 'Erreur lors du chargement de la commande');
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur dans loadCommandeDetail:', error);
        } finally {
          state.loading = false;
        }
      };

      loadCommandeDetail();

      return {
        state
      };
    },

    methods: {
      formatPrice(price) {
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(price);
      },

      calculateTotal(prix, quantity) {
        return prix * quantity;
      },

      toggleEditNote(articleId) {
        if (this.state.editingNoteId === articleId) {
          this.state.editingNoteId = null;
        } else {
          this.state.editingNoteId = articleId;
        }
        this.updateDOM();
      },

      async saveNote(articleId, note) {
        try {
          const response = await fetch(`/commandes/${commandeId}/note`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': window.CSRF_TOKEN
            },
            credentials: 'include',
            body: JSON.stringify({
              note: note,
              source: '',
              catalog_product_id: articleId
            })
          });

          if (response.ok) {
            // Mettre à jour la note dans le state
            const article = this.state.articles.find(a => a.catalog_product_id === articleId);
            if (article) {
              article.note = note;
            }
            this.state.editingNoteId = null;
            this.updateDOM();
          } else {
            throw new Error('Erreur lors de la sauvegarde de la note');
          }
        } catch (error) {
          console.error('Erreur saveNote:', error);
          alert('Erreur lors de la sauvegarde de la note');
        }
      },

      async reopenCommande() {
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
            window.location.href = `/panier/${commandeId}/modifier/vue`;
          } else {
            throw new Error('Erreur lors de la réouverture');
          }
        } catch (error) {
          console.error('Erreur reopenCommande:', error);
          alert('Erreur lors de la réouverture de la commande');
        }
      },

      getArticlesByCategory() {
        const grouped = {};

        this.state.articles.forEach(article => {
          const category = article.categorie || 'Sans catégorie';
          if (!grouped[category]) {
            grouped[category] = {
              name: category,
              color: article.categorie_couleur || '#6c757d',
              ordre: article.categorie_ordre || 999,
              articles: []
            };
          }
          grouped[category].articles.push(article);
        });

        // Trier par ordre de catégorie
        return Object.values(grouped).sort((a, b) => a.ordre - b.ordre);
      },

      updateDOM() {
        console.log('📋 updateDOM appelé');
        const container = this.$refs.container;
        if (!container) {
          console.error('❌ Container non trouvé !');
          return;
        }
        console.log('✅ Container trouvé');

        const s = this.state;
        console.log('📊 State:', s);

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
            <p class="mt-3 text-muted">Chargement de la commande...</p>
          </div>`;
        } else if (s.commande) {
          // En-tête
          html += `<div class="d-flex justify-content-between align-items-center mb-4">
            <h2><i class="bi bi-receipt me-2"></i>Commande #${s.commande.id}</h2>
            <a href="/commandes/vue" class="btn btn-secondary">
              <i class="bi bi-arrow-left me-1"></i>Retour aux commandes
            </a>
          </div>`;

          // Informations de la commande
          html += `<div class="card mb-4">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations</h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Demandeur :</strong> <i class="bi bi-person-circle"></i> ${s.commande.username}</p>
                  <p><strong>Catalogue :</strong> ${s.commande.originalname}</p>
                  ${s.commande.catalog_description ? `<p><strong>Description :</strong> ${s.commande.catalog_description}</p>` : ''}
                  <p><strong>Date de commande :</strong> ${s.commande.created_formatted}</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Date d'expiration :</strong> ${s.commande.expiration_formatted}
                    ${s.commande.isExpired ? '<span class="badge bg-danger ms-2">Expiré</span>' : ''}
                  </p>
                  <p><strong>Date de livraison :</strong> ${s.commande.livraison_formatted}</p>
                  <p><strong>Statut :</strong>
                    ${s.commande.modifiable ? '<span class="badge bg-warning">Modifiable</span>' : '<span class="badge bg-secondary">Non modifiable</span>'}
                  </p>
                </div>
              </div>
              ${s.commande.note ? `<div class="alert alert-info mt-3"><strong>Note :</strong> ${s.commande.note}</div>` : ''}
            </div>
          </div>`;

          // Actions
          if (s.commande.modifiable) {
            html += `<div class="mb-4">
              <button class="btn btn-warning reopen-btn">
                <i class="bi bi-arrow-counterclockwise me-1"></i>Repasser en panier
              </button>
            </div>`;
          }

          // Articles par catégorie
          const categories = this.getArticlesByCategory();
          let totalCommande = 0;

          categories.forEach(category => {
            html += `<div class="card mb-4">
              <div class="card-header" style="background-color: ${category.color}20; border-left: 4px solid ${category.color};">
                <h5 class="mb-0">
                  <i class="bi bi-tag-fill me-2" style="color: ${category.color};"></i>${category.name}
                  <span class="badge bg-secondary ms-2">${category.articles.length} article${category.articles.length > 1 ? 's' : ''}</span>
                </h5>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead class="table-light">
                      <tr>
                        <th style="width: 40%;">Produit</th>
                        <th style="width: 10%;">Fournisseur</th>
                        <th style="width: 10%;" class="text-end">Prix unitaire</th>
                        <th style="width: 10%;" class="text-center">Quantité</th>
                        <th style="width: 10%;" class="text-end">Total</th>
                        <th style="width: 20%;">Note</th>
                      </tr>
                    </thead>
                    <tbody>`;

            category.articles.forEach(article => {
              const total = this.calculateTotal(article.prix, article.quantity);
              totalCommande += total;

              html += `<tr>
                <td>
                  <strong>${article.produit}</strong>
                  ${article.description ? `<br><small class="text-muted">${article.description}</small>` : ''}
                </td>
                <td>${article.fournisseur || '-'}</td>
                <td class="text-end">${this.formatPrice(article.prix)} / ${article.unite}</td>
                <td class="text-center">
                  <span class="badge bg-primary">${article.quantity}</span>
                </td>
                <td class="text-end">
                  <strong>${this.formatPrice(total)}</strong>
                </td>
                <td>`;

              if (this.state.editingNoteId === article.catalog_product_id) {
                html += `<div class="input-group input-group-sm">
                  <input type="text" class="form-control note-edit-input"
                         id="note_edit_${article.catalog_product_id}"
                         value="${article.note || ''}"
                         placeholder="Note optionnelle">
                  <button class="btn btn-success save-note-btn"
                          data-article-id="${article.catalog_product_id}">
                    <i class="bi bi-check"></i>
                  </button>
                  <button class="btn btn-secondary cancel-note-btn"
                          data-article-id="${article.catalog_product_id}">
                    <i class="bi bi-x"></i>
                  </button>
                </div>`;
              } else {
                html += `<div class="d-flex align-items-center gap-2">
                  <span class="flex-grow-1">${article.note || '-'}</span>
                  <button class="btn btn-sm btn-outline-primary edit-note-btn"
                          data-article-id="${article.catalog_product_id}">
                    <i class="bi bi-pencil"></i>
                  </button>
                </div>`;
              }

              html += `</td>
              </tr>`;
            });

            html += `</tbody>
                  </table>
                </div>
              </div>
            </div>`;
          });

          // Total
          html += `<div class="card bg-light">
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <h5>Total de la commande</h5>
                </div>
                <div class="col-md-6 text-end">
                  <h4 class="text-primary">${this.formatPrice(totalCommande)}</h4>
                </div>
              </div>
            </div>
          </div>`;
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Attacher les événements
        this.attachEventListeners();
      },

      attachEventListeners() {
        // Bouton réouverture
        const reopenBtn = document.querySelector('.reopen-btn');
        if (reopenBtn) {
          reopenBtn.addEventListener('click', () => this.reopenCommande());
        }

        // Boutons édition note
        document.querySelectorAll('.edit-note-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const articleId = parseInt(e.currentTarget.dataset.articleId);
            this.toggleEditNote(articleId);
          });
        });

        // Boutons sauvegarde note
        document.querySelectorAll('.save-note-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const articleId = parseInt(e.currentTarget.dataset.articleId);
            const input = document.getElementById(`note_edit_${articleId}`);
            if (input) {
              this.saveNote(articleId, input.value);
            }
          });
        });

        // Boutons annulation note
        document.querySelectorAll('.cancel-note-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const articleId = parseInt(e.currentTarget.dataset.articleId);
            this.toggleEditNote(articleId);
          });
        });
      }
    },

    mounted() {
      // Attendre le prochain tick pour s'assurer que le DOM est monté
      this.$nextTick(() => {
        this.updateDOM();
      });

      // Watcher pour les changements de state
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
    app.mount('#commande-detail-app');
    console.log('✅ Application Vue montée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du montage:', error);
  }
})();
