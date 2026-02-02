(function() {
  console.log('🚀 Chargement de CaisseHistoriqueApp.js...');

  if (typeof Vue === 'undefined') {
    console.error('❌ Vue n\'est pas chargé !');
    return;
  }

  const { createApp, reactive, computed, onMounted } = Vue;

  const app = createApp({
    setup() {
      const state = reactive({
        ventes: [],
        stats: null,
        loading: false,
        selectedVente: null,
        showDetailModal: false,

        // Filtres
        dateDebut: '',
        dateFin: '',
        numeroTicket: '',
        caissier_id: null,

        // Pagination
        total: 0,
        limit: 50,
        offset: 0,

        error: null
      });

      // Computed
      const nbPages = computed(() => {
        return Math.ceil(state.total / state.limit);
      });

      const currentPage = computed(() => {
        return Math.floor(state.offset / state.limit) + 1;
      });

      // Méthodes
      const chargerVentes = async () => {
        state.loading = true;
        try {
          const params = new URLSearchParams({
            limit: state.limit,
            offset: state.offset
          });

          if (state.dateDebut) params.append('date_debut', state.dateDebut);
          if (state.dateFin) params.append('date_fin', state.dateFin);
          if (state.numeroTicket) params.append('numero_ticket', state.numeroTicket);
          if (state.caissier_id) params.append('caissier_id', state.caissier_id);

          const response = await fetch(`/api/caisse/ventes-historique?${params}`, {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.ventes = data.ventes;
            state.total = data.total;
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          state.error = error.message;
          console.error('Erreur chargement ventes:', error);
        } finally {
          state.loading = false;
        }
      };

      const chargerStats = async () => {
        try {
          const params = new URLSearchParams();
          if (state.dateDebut) params.append('date_debut', state.dateDebut);
          if (state.dateFin) params.append('date_fin', state.dateFin);

          const response = await fetch(`/api/caisse/ventes-historique/stats/resume?${params}`, {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.stats = data.stats;
          }
        } catch (error) {
          console.error('Erreur chargement stats:', error);
        }
      };

      const ouvrirDetail = async (venteId) => {
        try {
          const response = await fetch(`/api/caisse/ventes-historique/${venteId}`, {
            credentials: 'include'
          });
          const data = await response.json();

          if (data.success) {
            state.selectedVente = data;
            state.showDetailModal = true;
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          alert('Erreur : ' + error.message);
        }
      };

      const fermerDetail = () => {
        state.showDetailModal = false;
        state.selectedVente = null;
      };

      const rechercher = () => {
        state.offset = 0;
        chargerVentes();
        chargerStats();
      };

      const resetFiltres = () => {
        state.dateDebut = '';
        state.dateFin = '';
        state.numeroTicket = '';
        state.caissier_id = null;
        state.offset = 0;
        chargerVentes();
        chargerStats();
      };

      const pageSuivante = () => {
        if (state.offset + state.limit < state.total) {
          state.offset += state.limit;
          chargerVentes();
        }
      };

      const pagePrecedente = () => {
        if (state.offset > 0) {
          state.offset = Math.max(0, state.offset - state.limit);
          chargerVentes();
        }
      };

      const allerPage = (page) => {
        state.offset = (page - 1) * state.limit;
        chargerVentes();
      };

      const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      // Chargement initial
      onMounted(() => {
        // Date par défaut: aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        state.dateDebut = today;
        state.dateFin = today;

        chargerVentes();
        chargerStats();
      });

      return {
        state,
        nbPages,
        currentPage,
        chargerVentes,
        chargerStats,
        ouvrirDetail,
        fermerDetail,
        rechercher,
        resetFiltres,
        pageSuivante,
        pagePrecedente,
        allerPage,
        formatDate
      };
    },

    template: `
      <div class="container-fluid mt-4">
        <!-- Header avec stats -->
        <div class="row mb-4">
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h2><i class="bi bi-clock-history me-2"></i>Historique des ventes</h2>
              <a href="/caisse" class="btn btn-outline-primary">
                <i class="bi bi-arrow-left me-2"></i>Retour à la caisse
              </a>
            </div>

            <div class="row g-3" v-if="state.stats">
              <div class="col-md-3">
                <div class="card bg-primary text-white">
                  <div class="card-body">
                    <h6 class="card-title">Nombre de ventes</h6>
                    <h3 class="mb-0">{{ state.stats.nb_ventes }}</h3>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card bg-success text-white">
                  <div class="card-body">
                    <h6 class="card-title">CA Total</h6>
                    <h3 class="mb-0">{{ state.stats.ca_total.toFixed(2) }} €</h3>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card bg-info text-white">
                  <div class="card-body">
                    <h6 class="card-title">Ticket moyen</h6>
                    <h3 class="mb-0">{{ state.stats.ticket_moyen.toFixed(2) }} €</h3>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card bg-warning text-dark">
                  <div class="card-body">
                    <h6 class="card-title">Ticket max</h6>
                    <h3 class="mb-0">{{ state.stats.ticket_max.toFixed(2) }} €</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtres -->
        <div class="card mb-4">
          <div class="card-header bg-light">
            <h5 class="mb-0"><i class="bi bi-funnel me-2"></i>Filtres de recherche</h5>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label">Date début</label>
                <input type="date" class="form-control" v-model="state.dateDebut">
              </div>
              <div class="col-md-3">
                <label class="form-label">Date fin</label>
                <input type="date" class="form-control" v-model="state.dateFin">
              </div>
              <div class="col-md-4">
                <label class="form-label">Numéro ticket</label>
                <input type="text" class="form-control" v-model="state.numeroTicket"
                       placeholder="Ex: CAISSE-1738272840">
              </div>
              <div class="col-md-2 d-flex align-items-end gap-2">
                <button class="btn btn-primary" @click="rechercher">
                  <i class="bi bi-search me-1"></i>Rechercher
                </button>
                <button class="btn btn-outline-secondary" @click="resetFiltres">
                  <i class="bi bi-x-circle me-1"></i>Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="state.loading" class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>

        <!-- Liste des ventes -->
        <div v-else class="card">
          <div class="card-header">
            <h5 class="mb-0">
              Résultats ({{ state.total }} vente{{ state.total > 1 ? 's' : '' }})
            </h5>
          </div>
          <div class="card-body p-0">
            <div v-if="state.ventes.length === 0" class="text-center py-5 text-muted">
              <i class="bi bi-inbox" style="font-size: 3rem;"></i>
              <p class="mt-2">Aucune vente trouvée</p>
            </div>

            <div v-else class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Ticket</th>
                    <th>Date/Heure</th>
                    <th>Caissier</th>
                    <th>Client</th>
                    <th>Nb articles</th>
                    <th>Montant</th>
                    <th>Source</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="vente in state.ventes" :key="vente.id">
                    <td>
                      <code>{{ vente.numero_ticket }}</code>
                    </td>
                    <td>{{ formatDate(vente.created_at) }}</td>
                    <td>{{ vente.caissier_nom || '-' }}</td>
                    <td>{{ vente.client_nom || vente.nom_client || 'Anonyme' }}</td>
                    <td>{{ vente.nb_lignes }}</td>
                    <td><strong class="text-primary">{{ vente.montant_ttc.toFixed(2) }} €</strong></td>
                    <td>
                      <span v-if="vente.panier_source === 'caisse'" class="badge bg-info">
                        <i class="bi bi-cart me-1"></i>Panier caisse
                      </span>
                      <span v-else-if="vente.panier_source === 'catalogue'" class="badge bg-secondary">
                        <i class="bi bi-book me-1"></i>Catalogue
                      </span>
                      <span v-else class="badge bg-light text-dark">
                        <i class="bi bi-lightning me-1"></i>Direct
                      </span>
                    </td>
                    <td>
                      <span :class="['badge', vente.statut === 'complete' ? 'bg-success' : 'bg-warning']">
                        {{ vente.statut }}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline-primary" @click="ouvrirDetail(vente.id)">
                        <i class="bi bi-eye me-1"></i>Détails
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="nbPages > 1" class="card-footer">
            <nav>
              <ul class="pagination mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" @click="pagePrecedente">Précédent</button>
                </li>
                <li v-for="page in nbPages" :key="page" class="page-item" :class="{ active: page === currentPage }">
                  <button class="page-link" @click="allerPage(page)">{{ page }}</button>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === nbPages }">
                  <button class="page-link" @click="pageSuivante">Suivant</button>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <!-- Modal détail vente -->
        <div v-if="state.showDetailModal && state.selectedVente" class="modal show d-block"
             tabindex="-1" style="background: rgba(0,0,0,0.5);">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  <i class="bi bi-receipt me-2"></i>
                  Détail vente {{ state.selectedVente.vente.numero_ticket }}
                </h5>
                <button type="button" class="btn-close" @click="fermerDetail"></button>
              </div>
              <div class="modal-body">
                <!-- Infos vente -->
                <div class="row mb-4">
                  <div class="col-md-6">
                    <h6>Informations générales</h6>
                    <dl class="row">
                      <dt class="col-sm-4">Date/Heure</dt>
                      <dd class="col-sm-8">{{ formatDate(state.selectedVente.vente.created_at) }}</dd>
                      <dt class="col-sm-4">Caissier</dt>
                      <dd class="col-sm-8">{{ state.selectedVente.vente.caissier_nom }}</dd>
                      <dt class="col-sm-4">Client</dt>
                      <dd class="col-sm-8">{{ state.selectedVente.vente.client_nom || state.selectedVente.vente.nom_client }}</dd>
                      <dt class="col-sm-4">Montant total</dt>
                      <dd class="col-sm-8"><strong class="text-primary">{{ state.selectedVente.vente.montant_ttc.toFixed(2) }} €</strong></dd>
                    </dl>
                  </div>
                  <div class="col-md-6" v-if="state.selectedVente.vente.panier_id">
                    <h6>Informations panier</h6>
                    <dl class="row">
                      <dt class="col-sm-4">Source</dt>
                      <dd class="col-sm-8">
                        <span :class="['badge', state.selectedVente.vente.panier_source === 'caisse' ? 'bg-info' : 'bg-secondary']">
                          {{ state.selectedVente.vente.panier_source }}
                        </span>
                      </dd>
                      <dt class="col-sm-4">Sauvegardé le</dt>
                      <dd class="col-sm-8">{{ formatDate(state.selectedVente.vente.panier_saved_at) }}</dd>
                    </dl>
                  </div>
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
                    <tbody>
                      <tr v-for="ligne in state.selectedVente.lignes" :key="ligne.id"
                          :class="{ 'table-warning': ligne.is_avoir }">
                        <td>
                          {{ ligne.nom_produit }}
                          <span v-if="ligne.is_avoir" class="badge bg-warning text-dark ms-2">AVOIR</span>
                        </td>
                        <td class="text-end">{{ ligne.quantite.toFixed(3) }}</td>
                        <td class="text-end">{{ ligne.prix_unitaire.toFixed(2) }} €</td>
                        <td class="text-end">
                          <strong :class="ligne.is_avoir ? 'text-warning' : 'text-primary'">
                            {{ ligne.montant_ttc.toFixed(2) }} €
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot class="table-light">
                      <tr>
                        <td colspan="3" class="text-end"><strong>Total</strong></td>
                        <td class="text-end">
                          <strong class="text-primary">{{ state.selectedVente.vente.montant_ttc.toFixed(2) }} €</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <!-- Paiements -->
                <h6 v-if="state.selectedVente.paiements.length > 0">Paiements</h6>
                <div v-if="state.selectedVente.paiements.length > 0" class="table-responsive">
                  <table class="table table-sm">
                    <thead class="table-light">
                      <tr>
                        <th>Mode de paiement</th>
                        <th class="text-end">Montant</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="paiement in state.selectedVente.paiements" :key="paiement.id">
                        <td>{{ paiement.mode_paiement_nom }}</td>
                        <td class="text-end"><strong>{{ paiement.montant.toFixed(2) }} €</strong></td>
                        <td>{{ formatDate(paiement.date_paiement) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="fermerDetail">Fermer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  });

  app.mount('#historique-ventes-app');

  console.log('✅ CaisseHistoriqueApp monté');
})();
