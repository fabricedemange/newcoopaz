<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <div class="row mb-4">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
            <h2 class="mb-0"><i class="bi bi-list-check me-2"></i>Historique de mes achats</h2>
            <BackButton />
          </div>

          <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item" role="presentation">
              <button
                class="nav-link"
                :class="{ active: store.activeTab === 'catalogues' }"
                type="button"
                @click="store.setActiveTab('catalogues')"
              >
                <i class="bi bi-book me-2"></i>Précommandes ({{ store.commandes.length }})
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button
                class="nav-link"
                :class="{ active: store.activeTab === 'caisse' }"
                type="button"
                @click="store.setActiveTab('caisse')"
              >
                <i class="bi bi-cart me-2"></i>Caisse ({{ store.ventes.length }})
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i><strong>Erreur :</strong> {{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <!-- Tab Précommandes -->
      <template v-if="store.activeTab === 'catalogues'">
        <div v-if="store.loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
          <p class="mt-3 text-muted">Chargement des commandes...</p>
        </div>
        <div v-else-if="store.commandes.length === 0" class="alert alert-info text-center">
          <h4>Aucune commande passée</h4>
          <p>Vous n'avez encore passé aucune commande.</p>
          <a href="/catalogues/vue" class="btn btn-primary">Consulter les catalogues</a>
        </div>
        <template v-else>
          <div class="row mb-3">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input
                  v-model="store.searchTerm"
                  type="text"
                  class="form-control"
                  placeholder="Rechercher une commande..."
                />
              </div>
            </div>
            <div class="col-md-6 text-end">
              <span class="text-muted">{{ store.commandes.length }} commande(s) au total</span>
            </div>
          </div>

          <div v-if="store.sortedCommandes.length === 0" class="alert alert-warning text-center">
            <p>Aucune commande ne correspond à votre recherche</p>
          </div>

          <template v-else>
          <!-- Desktop: table -->
          <div class="d-none d-md-block">
            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="thead-precommandes">
                  <tr>
                    <th v-for="col in sortColumns" :key="col.key" class="sortable" style="cursor: pointer;" @click="store.sortBy(col.key)">
                      {{ col.label }} <i class="bi" :class="'bi-' + store.sortIcon(col.key) + ' ms-1'"></i>
                    </th>
                    <th>Description + Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in store.sortedCommandes" :key="c.id">
                    <td><strong>#{{ c.id }}</strong></td>
                    <td><strong>{{ c.originalname }}</strong><br><small class="text-muted">N°{{ c.catalog_filesID }}</small></td>
                    <td>{{ c.expiration_formatted || '' }}<br><span v-if="c.isExpired" class="badge bg-danger">Expiré</span></td>
                    <td>{{ c.livraison_formatted || '' }}</td>
                    <td>{{ c.created_formatted || '' }}</td>
                    <td>
                      <div>{{ c.catalog_description || '' }}</div>
                      <div class="mt-2">
                        <small class="text-muted">Note (sauvegarde auto)</small>
                        <span class="ms-2">
                          <span v-if="store.savingNotes[c.id]" class="text-info"><i class="bi bi-arrow-repeat spin"></i> Sauvegarde...</span>
                          <span v-else-if="store.savedNotes[c.id]" class="text-success"><i class="bi bi-check-circle"></i> Enregistré</span>
                          <span v-else-if="store.errorNotes[c.id]" class="text-danger"><i class="bi bi-exclamation-circle"></i> Erreur</span>
                        </span>
                        <textarea
                          :value="c.note"
                          class="form-control form-control-sm mt-1"
                          rows="2"
                          placeholder="Note personnelle..."
                          @input="debouncedSaveNote(c.id, $event.target.value)"
                        ></textarea>
                      </div>
                    </td>
                    <td>
                      <div class="d-flex flex-column gap-1">
                        <a :href="`/commandes/${c.id}/vue`" class="btn btn-info btn-sm"><i class="bi bi-eye"></i> Voir détails</a>
                        <button v-if="c.modifiable" class="btn btn-warning btn-sm" @click="confirmReopen(c.id)">
                          <i class="bi bi-arrow-counterclockwise"></i> Repasser en panier
                        </button>
                        <span v-else class="badge bg-secondary">Non modifiable</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="alert alert-secondary mt-3">
              <strong>Non modifiable</strong> – Un catalogue associé à une commande peut être expiré ou le référent a choisi de le rendre non modifiable.
            </div>
          </div>

          <!-- Mobile: cards -->
          <div class="d-md-none">
            <div v-for="c in store.sortedCommandes" :key="'m-' + c.id" class="card mb-2 shadow-sm">
              <div class="card-body p-2" style="font-size: 0.7rem;">
                <div class="row g-1 mb-2">
                  <div class="col-6 text-start">
                    <div class="mb-1"><strong>Cde #{{ c.id }}</strong> par {{ c.username || 'Utilisateur' }}</div>
                    <span v-if="c.isExpired" class="badge bg-danger" style="font-size: 0.6rem;">Expiré</span>
                    <div class="mb-1" style="font-size: 0.65rem;">{{ c.nb_produits || 0 }} produits • <strong>{{ (c.montant_total || 0).toFixed(2) }} €</strong></div>
                    <div style="font-size: 0.65rem;">Faite le <strong>{{ c.created_formatted || '-' }}</strong></div>
                  </div>
                  <div class="col-6 text-end">
                    <div class="mb-1"><strong>Cat #{{ c.catalog_filesID }}</strong>, {{ c.originalname }}</div>
                    <div style="font-size: 0.65rem;">Expir le <strong>{{ c.expiration_formatted || '-' }}</strong>, livrée le <strong>{{ c.livraison_formatted || '-' }}</strong></div>
                  </div>
                </div>
                <div v-if="c.note" class="mb-2" style="font-size: 0.65rem;"><em>Note: {{ c.note }}</em></div>
                <div v-if="c.catalog_description" class="text-muted mb-2" style="font-size: 0.65rem;">{{ c.catalog_description }}</div>
                <div class="text-center">
                  <a :href="`/commandes/${c.id}/vue`" class="btn btn-sm btn-info me-1">Détails</a>
                  <button v-if="c.modifiable" class="btn btn-sm btn-warning" @click="confirmReopen(c.id)">Panier</button>
                </div>
              </div>
            </div>
            <div class="alert alert-secondary"><strong>Non modifiable</strong> – Catalogue expiré ou verrouillé par le référent.</div>
          </div>
          </template>
        </template>
      </template>

      <!-- Tab Caisse -->
      <template v-if="store.activeTab === 'caisse'">
        <div v-if="store.loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
          <p class="mt-3 text-muted">Chargement des achats en caisse...</p>
        </div>
        <div v-else-if="store.ventes.length === 0" class="alert alert-info text-center">
          <h4>Aucun achat en caisse</h4>
          <p>Vous n'avez encore fait aucun achat en caisse.</p>
          <a href="/caisse" class="btn btn-primary">Aller à la caisse</a>
        </div>
        <template v-else>
          <div class="row mb-3">
            <div class="col-12 text-end">
              <span class="text-muted">{{ store.ventes.length }} achat(s) en caisse</span>
            </div>
          </div>
          <div class="d-none d-md-block">
            <div class="table-responsive">
              <table class="table table-hover table-commandes-caisse">
                <thead class="thead-precommandes">
                  <tr>
                    <th class="col-ticket">N° Ticket</th>
                    <th>Client</th>
                    <th>Produits</th>
                    <th>Montant</th>
                    <th>Mode paiement</th>
                    <th>Date</th>
                    <th>PréCde</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="v in store.ventes" :key="v.id">
                    <td class="col-ticket"><strong>{{ v.numero_ticket }}</strong></td>
                    <td>{{ v.nom_client || 'Anonyme' }}</td>
                    <td>
                      <span class="badge bg-secondary">{{ v.nb_produits }} article(s)</span>
                      <br v-if="v.produits_preview"><small v-if="v.produits_preview" class="text-muted">{{ (v.produits_preview || '').slice(0, 50) }}{{ (v.produits_preview || '').length > 50 ? '...' : '' }}</small>
                    </td>
                    <td><strong class="text-primary">{{ parseFloat(v.montant_ttc).toFixed(2) }} €</strong></td>
                    <td>{{ v.mode_paiement || 'N/A' }}</td>
                    <td>{{ v.created_formatted }}</td>
                    <td>
                      <span v-if="v.avec_precommandes" class="badge bg-secondary">Oui</span>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-info" @click="store.loadVenteDetail(v.id)"><i class="bi bi-eye"></i> Détails</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="d-md-none">
            <div v-for="v in store.ventes" :key="'vm-' + v.id" class="card mb-3 shadow-sm">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <h6 class="card-title mb-0"><i class="bi bi-receipt me-1"></i>{{ v.numero_ticket }}</h6>
                  <span class="badge bg-success">{{ parseFloat(v.montant_ttc).toFixed(2) }} €</span>
                </div>
                <p class="card-text mb-1">
                  <strong>Client:</strong> {{ v.nom_client || 'Anonyme' }}<br>
                  <strong>Articles:</strong> {{ v.nb_produits }}<br>
                  <small v-if="v.produits_preview" class="text-muted">{{ (v.produits_preview || '').slice(0, 60) }}{{ (v.produits_preview || '').length > 60 ? '...' : '' }}</small><br v-if="v.produits_preview">
                  <strong>Paiement:</strong> {{ v.mode_paiement || 'N/A' }}<br>
                  <small class="text-muted">{{ v.created_formatted }}</small>
                </p>
                <div class="text-center mt-2">
                  <button class="btn btn-sm btn-info" @click="store.loadVenteDetail(v.id)"><i class="bi bi-eye me-1"></i>Voir détails</button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
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
        <div class="modal-header card-header-caisse">
          <h5 class="modal-title">
            <i class="bi bi-receipt me-2"></i>
            Détail vente {{ store.selectedVente.vente?.numero_ticket }}
          </h5>
          <button type="button" class="btn-close" @click="store.closeDetailModal()"></button>
        </div>
        <div class="modal-body">
          <div class="row mb-4">
            <div class="col-md-6">
              <h6>Informations générales</h6>
              <dl class="row">
                <dt class="col-sm-4">Date/Heure</dt>
                <dd class="col-sm-8">{{ formatDate(store.selectedVente.vente?.created_at) }}</dd>
                <dt class="col-sm-4">Caissier</dt>
                <dd class="col-sm-8">{{ store.selectedVente.vente?.caissier_nom || 'N/A' }}</dd>
                <dt class="col-sm-4">Client</dt>
                <dd class="col-sm-8">{{ store.selectedVente.vente?.client_nom || store.selectedVente.vente?.nom_client || 'Anonyme' }}</dd>
                <dt class="col-sm-4">Montant total</dt>
                <dd class="col-sm-8">
                  <strong class="text-primary">{{ parseFloat(store.selectedVente.vente?.montant_ttc || 0).toFixed(2) }} €</strong>
                </dd>
              </dl>
            </div>
          </div>

          <h6>Produits vendus</h6>
          <div class="table-responsive mb-4">
            <table class="table table-sm table-bordered">
              <thead class="thead-caisse">
                <tr>
                  <th>Produit</th>
                  <th class="text-end">Quantité</th>
                  <th class="text-end">Prix unitaire</th>
                  <th class="text-end">Remise</th>
                  <th class="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(ligne, idx) in (store.selectedVente.lignes || [])"
                  :key="idx"
                  :class="{ 'table-warning': ligne.is_avoir, 'table-info': ligne.is_cotisation }"
                >
                  <td>
                    {{ ligne.nom_produit || ligne.product_nom_actuel }}
                    <span v-if="ligne.is_cotisation" class="badge bg-info ms-2">Cotisation</span>
                    <span v-if="ligne.is_avoir" class="badge bg-warning text-dark ms-2">AVOIR</span>
                  </td>
                  <td class="text-end">{{ parseFloat(ligne.quantite || 0).toFixed(3) }}</td>
                  <td class="text-end">{{ parseFloat(ligne.prix_unitaire || 0).toFixed(2) }} €</td>
                  <td class="text-end">
                    <span v-if="(ligne.remise_pourcent || 0) > 0" class="text-danger">
                      -{{ ligne.remise_pourcent }}%
                    </span>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td class="text-end">
                    <strong :class="ligne.is_cotisation ? 'text-info' : ligne.is_avoir ? 'text-warning' : 'text-primary'">
                      {{ parseFloat(ligne.montant_ttc || 0).toFixed(2) }} €
                    </strong>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-light">
                <tr>
                  <td colspan="4" class="text-end"><strong>Total</strong></td>
                  <td class="text-end">
                    <strong class="text-primary">{{ parseFloat(store.selectedVente.vente?.montant_ttc || 0).toFixed(2) }} €</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <h6 v-if="store.selectedVente.paiements?.length > 0">Paiements</h6>
          <div v-if="store.selectedVente.paiements?.length > 0" class="table-responsive">
            <table class="table table-sm">
              <thead class="thead-caisse">
                <tr>
                  <th>Mode de paiement</th>
                  <th class="text-end">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, idx) in store.selectedVente.paiements" :key="idx">
                  <td>{{ p.mode_paiement_nom }}</td>
                  <td class="text-end"><strong>{{ parseFloat(p.montant || 0).toFixed(2) }} €</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <a
            :href="`/api/commandes/${store.selectedVente?.vente?.id}/pdf`"
            class="btn btn-outline-caisse"
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="bi bi-file-earmark-pdf me-1"></i>Télécharger PDF
          </a>
          <button type="button" class="btn btn-primary" @click="confirmSendPdf(store.selectedVente.vente?.id)">
            <i class="bi bi-envelope-fill me-1"></i>Envoyer par email
          </button>
          <button type="button" class="btn btn-secondary" @click="store.closeDetailModal()">Fermer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useCommandesStore } from '@/stores/commandes';
import { onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';

const store = useCommandesStore();

const sortColumns = [
  { key: 'id', label: 'ID' },
  { key: 'catalogue', label: 'Catalogue' },
  { key: 'expiration_date', label: 'Expiration' },
  { key: 'date_livraison', label: 'Livraison' },
  { key: 'created_at', label: 'Date commande' },
];

let noteDebounce = {};
function debouncedSaveNote(commandeId, note) {
  if (noteDebounce[commandeId]) clearTimeout(noteDebounce[commandeId]);
  noteDebounce[commandeId] = setTimeout(() => {
    store.saveNote(commandeId, note, typeof window !== 'undefined' ? window.CSRF_TOKEN : '');
    delete noteDebounce[commandeId];
  }, 1000);
}

function confirmReopen(commandeId) {
  if (!confirm('Confirmer la réouverture de cette commande en panier ?')) return;
  store.reopenCommande(commandeId, typeof window !== 'undefined' ? window.CSRF_TOKEN : '');
}

function confirmSendPdf(venteId) {
  if (!venteId) return;
  if (!confirm('Envoyer le ticket par email ?')) return;
  store.sendTicketPDF(venteId);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

onMounted(() => {
  store.loadAll();
});
</script>

<style scoped>
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.table-commandes-caisse .col-ticket {
  width: 1%;
  max-width: 4em;
  white-space: nowrap;
}
</style>
