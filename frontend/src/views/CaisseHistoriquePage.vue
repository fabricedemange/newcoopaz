<template>
  <div class="container-fluid mt-4">
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2><i class="bi bi-clock-history me-2"></i>Historique des ventes</h2>
          <a href="/caisse" class="btn btn-outline-primary">
            <i class="bi bi-arrow-left me-2"></i>Retour à la caisse
          </a>
        </div>

        <div class="row g-3" v-if="store.stats">
          <div class="col-md-3">
            <div class="card bg-primary text-white">
              <div class="card-body">
                <h6 class="card-title">Nombre de ventes</h6>
                <h3 class="mb-0">{{ store.stats.nb_ventes }}</h3>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card bg-success text-white">
              <div class="card-body">
                <h6 class="card-title">CA Total</h6>
                <h3 class="mb-0">{{ store.stats.ca_total.toFixed(2) }} €</h3>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card bg-info text-white">
              <div class="card-body">
                <h6 class="card-title">Ticket moyen</h6>
                <h3 class="mb-0">{{ store.stats.ticket_moyen.toFixed(2) }} €</h3>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card bg-warning text-dark">
              <div class="card-body">
                <h6 class="card-title">Ticket max</h6>
                <h3 class="mb-0">{{ store.stats.ticket_max.toFixed(2) }} €</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header bg-light">
        <h5 class="mb-0"><i class="bi bi-funnel me-2"></i>Filtres de recherche</h5>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label">Date début</label>
            <input type="date" class="form-control" v-model="store.dateDebut" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Date fin</label>
            <input type="date" class="form-control" v-model="store.dateFin" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Numéro ticket</label>
            <input
              type="text"
              class="form-control"
              v-model="store.numeroTicket"
              placeholder="Ex: CAISSE-1738272840"
            />
          </div>
          <div class="col-md-2 d-flex align-items-end gap-2">
            <button class="btn btn-primary" @click="store.rechercher()">
              <i class="bi bi-search me-1"></i>Rechercher
            </button>
            <button class="btn btn-outline-secondary" @click="store.resetFiltres()">
              <i class="bi bi-x-circle me-1"></i>Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ store.error }}
      <button type="button" class="btn-close" @click="store.error = null"></button>
    </div>

    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary"></div>
    </div>

    <div v-else class="card">
      <div class="card-header">
        <h5 class="mb-0">
          Résultats ({{ store.total }} vente{{ store.total > 1 ? 's' : '' }})
        </h5>
      </div>
      <div class="card-body p-0">
        <div v-if="store.ventes.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-inbox" style="font-size: 3rem"></i>
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
              <tr v-for="vente in store.ventes" :key="vente.id">
                <td><code>{{ vente.numero_ticket }}</code></td>
                <td>{{ store.formatDate(vente.created_at) }}</td>
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
                  <button class="btn btn-sm btn-outline-primary" @click="store.ouvrirDetail(vente.id)">
                    <i class="bi bi-eye me-1"></i>Détails
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="store.nbPages > 1" class="card-footer">
        <nav>
          <ul class="pagination mb-0 justify-content-center">
            <li class="page-item" :class="{ disabled: store.currentPage === 1 }">
              <button class="page-link" @click="store.pagePrecedente()">Précédent</button>
            </li>
            <li
              v-for="page in store.nbPages"
              :key="page"
              class="page-item"
              :class="{ active: page === store.currentPage }"
            >
              <button class="page-link" @click="store.allerPage(page)">{{ page }}</button>
            </li>
            <li class="page-item" :class="{ disabled: store.currentPage === store.nbPages }">
              <button class="page-link" @click="store.pageSuivante()">Suivant</button>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- Modal détail vente -->
    <div
      v-if="store.showDetailModal && store.selectedVente"
      class="modal show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-receipt me-2"></i>
              Détail vente {{ store.selectedVente.vente.numero_ticket }}
            </h5>
            <button type="button" class="btn-close" @click="store.fermerDetail()"></button>
          </div>
          <div class="modal-body">
            <div class="row mb-4">
              <div class="col-md-6">
                <h6>Informations générales</h6>
                <dl class="row">
                  <dt class="col-sm-4">Date/Heure</dt>
                  <dd class="col-sm-8">{{ store.formatDate(store.selectedVente.vente.created_at) }}</dd>
                  <dt class="col-sm-4">Caissier</dt>
                  <dd class="col-sm-8">{{ store.selectedVente.vente.caissier_nom }}</dd>
                  <dt class="col-sm-4">Client</dt>
                  <dd class="col-sm-8">{{ store.selectedVente.vente.client_nom || store.selectedVente.vente.nom_client }}</dd>
                  <dt class="col-sm-4">Montant total</dt>
                  <dd class="col-sm-8">
                    <strong class="text-primary">{{ store.selectedVente.vente.montant_ttc.toFixed(2) }} €</strong>
                  </dd>
                </dl>
              </div>
              <div class="col-md-6" v-if="store.selectedVente.vente.panier_id">
                <h6>Informations panier</h6>
                <dl class="row">
                  <dt class="col-sm-4">Source</dt>
                  <dd class="col-sm-8">
                    <span
                      :class="[
                        'badge',
                        store.selectedVente.vente.panier_source === 'caisse' ? 'bg-info' : 'bg-secondary',
                      ]"
                    >
                      {{ store.selectedVente.vente.panier_source }}
                    </span>
                  </dd>
                  <dt class="col-sm-4">Sauvegardé le</dt>
                  <dd class="col-sm-8">{{ store.formatDate(store.selectedVente.vente.panier_saved_at) }}</dd>
                </dl>
              </div>
            </div>

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
                  <tr
                    v-for="ligne in store.selectedVente.lignes"
                    :key="ligne.id"
                    :class="{ 'table-warning': ligne.is_avoir }"
                  >
                    <td>
                      {{ ligne.nom_produit || ligne.product_nom_actuel }}
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
                      <strong class="text-primary">{{ store.selectedVente.vente.montant_ttc.toFixed(2) }} €</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <h6 v-if="store.selectedVente.paiements?.length > 0">Paiements</h6>
            <div v-if="store.selectedVente.paiements?.length > 0" class="table-responsive">
              <table class="table table-sm">
                <thead class="table-light">
                  <tr>
                    <th>Mode de paiement</th>
                    <th class="text-end">Montant</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="paiement in store.selectedVente.paiements" :key="paiement.id">
                    <td>{{ paiement.mode_paiement_nom }}</td>
                    <td class="text-end"><strong>{{ paiement.montant.toFixed(2) }} €</strong></td>
                    <td>{{ store.formatDate(paiement.date_paiement) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.fermerDetail()">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useCaisseHistoriqueStore } from '@/stores/caisseHistorique';

const store = useCaisseHistoriqueStore();

onMounted(async () => {
  const today = new Date().toISOString().split('T')[0];
  store.dateDebut = today;
  store.dateFin = today;
  await store.chargerVentes();
  await store.chargerStats();
});
</script>
