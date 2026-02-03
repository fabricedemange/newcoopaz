<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <button class="btn btn-outline-secondary d-md-none mb-3" @click="history.back()">
        <i class="bi bi-arrow-left me-2"></i>Retour
      </button>

      <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i><strong>Erreur :</strong> {{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement du catalogue...</p>
      </div>

      <template v-else-if="store.catalogue">
        <!-- En-tête du catalogue : une colonne, titre + libellé puis ID, référent et dates avec icônes -->
        <div class="mb-4">
          <h2 class="mb-1"><i class="bi bi-book me-2"></i>{{ store.catalogue.originalname }}</h2>
          <p v-if="store.catalogue.description" class="text-muted mb-2">{{ store.catalogue.description }}</p>
          <div class="d-flex flex-wrap gap-3 align-items-center small text-muted">
            <span><i class="bi bi-hash me-1" title="ID catalogue"></i>ID catalogue : <strong>{{ store.catalogue.id }}</strong></span>
            <span v-if="store.catalogue.referent_username"><i class="bi bi-person-badge me-1" title="Référent"></i>Référent : <strong>{{ store.catalogue.referent_username }}</strong></span>
            <span><i class="bi bi-calendar-x me-1" title="Expiration"></i>Expiration : <strong>{{ store.catalogue.expiration_formatted }}</strong><span v-if="store.catalogue.isExpired" class="badge bg-danger ms-1">Expiré</span></span>
            <span><i class="bi bi-truck me-1" title="Livraison"></i>Livraison : <strong>{{ store.catalogue.livraison_formatted }}</strong></span>
          </div>
        </div>

        <!-- Gauche : préremplissage + résumé | Droite : note + bouton -->
        <div class="row mb-3 catalogue-detail-row-equal">
          <div class="col-12 col-md-4 mb-3 mb-md-0 d-flex">
            <div class="catalogue-detail-side catalogue-detail-side-left w-100 h-100">
              <div v-if="store.catalogue.modifiable" class="card mb-2">
                <div class="card-body py-2">
                  <h6 class="card-title mb-2"><i class="bi bi-arrow-repeat me-2"></i>Préremplir le panier</h6>
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm w-100"
                    :disabled="prefillLoading"
                    @click="prefillFromRecent"
                  >
                    <span v-if="prefillLoading" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="bi bi-arrow-repeat me-1"></i>Mes dernières commandes (60 jours)
                  </button>
                  <p v-if="prefillMessage" class="small mb-0 mt-2" :class="prefillMessageType === 'success' ? 'text-success' : prefillMessageType === 'error' ? 'text-danger' : 'text-muted'">
                    {{ prefillMessage }}
                  </p>
                </div>
              </div>
              <div class="alert alert-info py-2 mb-2">
                <i class="bi bi-cart3 me-2"></i>
                <strong>{{ store.totalArticles }}</strong> article{{ store.totalArticles > 1 ? 's' : '' }}
                <span class="d-block mt-1"><strong>Total :</strong> {{ formatPrice(store.totalPrice) }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-8 d-flex">
            <div class="catalogue-detail-side catalogue-detail-side-right w-100 h-100">
              <div class="catalogue-detail-note-wrapper">
                <h6 class="mb-2">
                  <i class="bi bi-sticky me-2"></i>Note pour ce panier
                  <small class="text-muted ms-2">(optionnel)</small>
                </h6>
                <textarea
                  :value="store.panier?.note || ''"
                  class="form-control mb-2"
                  rows="2"
                  placeholder="Ajoutez une note pour ce panier..."
                  :disabled="!store.catalogue.modifiable || store.totalArticles === 0"
                  @input="debouncedPanierNote($event.target.value)"
                />
                <small class="text-muted d-block mb-2">Cette note sera editable sur la commande après validation</small>
                <div class="d-grid">
                  <button
                    v-if="store.catalogue.modifiable"
                    type="button"
                    class="btn btn-success btn-lg"
                    :disabled="store.totalArticles === 0"
                    @click="confirmValiderPanier"
                  >
                    <i class="bi bi-check-circle me-2"></i>Transformer en commande
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recherche + Changement de propriétaire : alignés sur une même ligne -->
        <div class="row mb-3">
          <div class="col-12 col-md-4 mb-3 mb-md-0">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title mb-2"><i class="bi bi-search me-2"></i>Recherche</h5>
                <div class="input-group mb-2">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input
                    v-model="store.searchTerm"
                    type="text"
                    class="form-control"
                    placeholder="Rechercher un produit..."
                  />
                </div>
                <select
                  v-if="store.categories.length > 0"
                  v-model="store.selectedCategory"
                  class="form-select"
                >
                  <option value="all">Toutes les catégories</option>
                  <option v-for="cat in store.categories" :key="cat.nom" :value="cat.nom">{{ cat.nom }}</option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="store.canChangeOwner && store.users.length > 0" class="col-12 col-md-8">
            <div class="card h-100">
              <div class="card-body">
                <h5 class="card-title mb-3">
                  Changement de propriétaire
                  <span v-if="store.totalArticles === 0" class="text-muted fw-normal">(Ajoutez au moins un article pour activer.)</span>
                </h5>
                <div class="d-flex flex-column flex-md-row gap-2 align-items-md-center flex-wrap">
                  <label class="form-label mb-0 text-nowrap">Propriétaire actuel : <strong>{{ store.panier?.username || '—' }}</strong></label>
                  <select v-model="store.selectedUserId" class="form-select form-select-sm" style="width: auto; min-width: 200px;" :disabled="store.changingOwner || store.totalArticles === 0">
                    <option :value="null">-- Sélectionner un utilisateur --</option>
                    <option v-for="u in store.users" :key="u.id" :value="u.id">{{ u.username }}</option>
                  </select>
                  <button type="button" class="btn btn-warning btn-sm" :disabled="store.changingOwner || !store.selectedUserId || store.totalArticles === 0" @click="confirmChangeOwner">
                    <span v-if="store.changingOwner" class="spinner-border spinner-border-sm me-1"></span>
                    <i class="bi bi-person-fill-gear me-1"></i>Changer le propriétaire
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Liste des produits par catégorie -->
        <template v-if="store.productsByCategory.length === 0">
          <div class="text-center py-5">
            <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
            <p class="text-muted">Aucun produit trouvé</p>
          </div>
        </template>

        <template v-else>
          <div v-for="cat in store.sortedProductsByCategory" :key="cat.name" class="card mb-3 border-0 shadow-sm">
            <div class="card-header" :style="{ backgroundColor: cat.color, color: 'white' }">
              <h5 class="mb-0">{{ cat.name }}</h5>
            </div>
            <div class="card-body p-0">
              <!-- Desktop: tableau -->
              <div class="d-none d-md-block">
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead class="thead-precommandes">
                      <tr>
                        <th style="width: 35%;" class="sortable" @click="store.setSort('produit')">
                          Produit
                          <i v-if="store.sortColumn === 'produit'" :class="store.sortDirection === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down'" class="ms-1"></i>
                        </th>
                        <th class="text-center sortable" style="width: 15%;" @click="store.setSort('prix')">
                          Prix
                          <i v-if="store.sortColumn === 'prix'" :class="store.sortDirection === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down'" class="ms-1"></i>
                        </th>
                        <th class="text-center sortable" style="width: 20%;" @click="store.setSort('quantite')">
                          Quantité
                          <i v-if="store.sortColumn === 'quantite'" :class="store.sortDirection === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down'" class="ms-1"></i>
                        </th>
                        <th style="width: 30%;" class="sortable" @click="store.setSort('note')">
                          Note
                          <i v-if="store.sortColumn === 'note'" :class="store.sortDirection === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down'" class="ms-1"></i>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="product in cat.products"
                        :key="product.id"
                        :class="{ 'table-success': store.getProductQuantity(product.id) > 0 }"
                      >
                        <td>
                          <div class="d-flex align-items-center">
                            <img
                              v-if="product.image_filename"
                              :src="`/images/products/${product.image_filename}`"
                              :alt="product.produit"
                              class="me-2"
                              style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"
                              @error="($event.target).style.display = 'none'"
                            />
                            <div>
                              <strong>{{ product.produit }}</strong>
                              <br v-if="product.description">
                              <small v-if="product.description" class="text-muted">{{ product.description }}</small>
                            </div>
                          </div>
                        </td>
                        <td class="text-center">
                          <strong>{{ formatPrice((product.prix || 0) * (product.unite || 1)) }}</strong>
                          <br v-if="product.unite > 1">
                          <small v-if="product.unite > 1" class="text-muted">par {{ product.unite }}</small>
                        </td>
                        <td class="text-center">
                          <div class="d-flex align-items-center justify-content-center gap-1">
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary"
                              style="width: 32px; height: 32px; padding: 0;"
                              :disabled="!store.catalogue.modifiable"
                              @click="changeQty(product, -1)"
                            >
                              <i class="bi bi-dash"></i>
                            </button>
                            <input
                              type="number"
                              class="form-control form-control-sm text-center quantity-input"
                              style="width: 60px;"
                              :value="store.getProductQuantity(product.id)"
                              min="0"
                              step="1"
                              :disabled="!store.catalogue.modifiable"
                              @input="debouncedQty(product.id, $event.target.value)"
                            />
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-secondary"
                              style="width: 32px; height: 32px; padding: 0;"
                              :disabled="!store.catalogue.modifiable"
                              @click="changeQty(product, 1)"
                            >
                              <i class="bi bi-plus"></i>
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            v-if="store.getProductQuantity(product.id) > 0"
                            type="text"
                            class="form-control form-control-sm note-input"
                            :value="store.getProductNote(product.id)"
                            placeholder="Note optionnelle"
                            :disabled="!store.catalogue.modifiable"
                            @input="debouncedNote(product.id, $event.target.value)"
                          />
                          <span v-else class="text-muted">-</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Mobile: cartes -->
              <div class="d-md-none">
                <div
                  v-for="product in cat.products"
                  :key="'m-' + product.id"
                  class="product-card-mobile p-3 border-bottom"
                  :class="{ 'bg-success-subtle': store.getProductQuantity(product.id) > 0 }"
                >
                  <div class="d-flex align-items-start mb-2">
                    <img
                      v-if="product.image_filename"
                      :src="`/images/products/${product.image_filename}`"
                      :alt="product.produit"
                      class="me-2"
                      style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"
                      @error="($event.target).style.display = 'none'"
                    />
                    <div class="flex-grow-1">
                      <strong class="d-block">{{ product.produit }}</strong>
                      <small v-if="product.description" class="text-muted d-block">{{ product.description }}</small>
                    </div>
                  </div>
                  <div class="mb-2">
                    <span class="text-muted">Prix : </span>
                    <strong class="fs-5">{{ formatPrice((product.prix || 0) * (product.unite || 1)) }}</strong>
                    <small v-if="product.unite > 1" class="text-muted"> par {{ product.unite }}</small>
                  </div>
                  <div class="mb-2">
                    <label class="form-label mb-1 text-muted">Quantité</label>
                    <div class="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        class="btn btn-outline-secondary"
                        style="width: 44px; height: 44px; padding: 0;"
                        :disabled="!store.catalogue.modifiable"
                        @click="changeQty(product, -1)"
                      >
                        <i class="bi bi-dash fs-5"></i>
                      </button>
                      <input
                        type="number"
                        class="form-control form-control-lg text-center quantity-input"
                        style="width: 80px;"
                        :value="store.getProductQuantity(product.id)"
                        min="0"
                        step="1"
                        :disabled="!store.catalogue.modifiable"
                        @input="debouncedQty(product.id, $event.target.value)"
                      />
                      <button
                        type="button"
                        class="btn btn-outline-secondary"
                        style="width: 44px; height: 44px; padding: 0;"
                        :disabled="!store.catalogue.modifiable"
                        @click="changeQty(product, 1)"
                      >
                        <i class="bi bi-plus fs-5"></i>
                      </button>
                    </div>
                  </div>
                  <div v-if="store.getProductQuantity(product.id) > 0" class="mb-2">
                    <label class="form-label mb-1 text-muted">Note (optionnel)</label>
                    <input
                      type="text"
                      class="form-control note-input"
                      :value="store.getProductNote(product.id)"
                      placeholder="Ajoutez une note..."
                      :disabled="!store.catalogue.modifiable"
                      @input="debouncedNote(product.id, $event.target.value)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="store.catalogue && !store.catalogue.modifiable" class="alert alert-warning">
          <i class="bi bi-lock me-2"></i>
          Ce catalogue est expiré. Vous ne pouvez plus modifier votre panier.
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useCatalogueDetailStore } from '@/stores/catalogueDetail';
import { onMounted, ref } from 'vue';

const store = useCatalogueDetailStore();
const catalogueIdRef = ref(null);
const nouveauPanierRef = ref(false);
const prefillLoading = ref(false);
const prefillMessage = ref('');
const prefillMessageType = ref('success');

let debounceQtyTimer = null;
let debounceNoteTimer = null;
let debouncePanierNoteTimer = null;

function getCatalogueIdFromPath() {
  if (typeof window === 'undefined') return null;
  const parts = window.location.pathname.split('/');
  return parts[2] || null;
}

function getNouveauFromSearch() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('nouveau') === '1';
}

function formatPrice(price) {
  if (price == null) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}

function changeQty(product, delta) {
  const current = store.getProductQuantity(product.id);
  const newQty = Math.max(0, current + delta);
  applyQty(product.id, newQty);
}

function applyQty(catalogProductId, quantity) {
  const cid = catalogueIdRef.value;
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  if (!cid) return;
  store.updateQuantity(catalogProductId, quantity, cid, nouveauPanierRef.value, csrf).catch((e) => {
    if (typeof window !== 'undefined') alert('Erreur lors de la mise à jour de la quantité');
  });
}

function applyNote(catalogProductId, note) {
  const cid = catalogueIdRef.value;
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  if (!cid) return;
  store.updateNote(catalogProductId, note, cid, csrf).catch((e) => {
    if (typeof window !== 'undefined') alert('Erreur lors de la mise à jour de la note');
  });
}

function applyPanierNote(note) {
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  store.updatePanierNote(note, csrf).catch((e) => {
    if (typeof window !== 'undefined') alert('Erreur lors de la mise à jour de la note du panier');
  });
}

function debouncedQty(catalogProductId, value) {
  clearTimeout(debounceQtyTimer);
  debounceQtyTimer = setTimeout(() => {
    applyQty(catalogProductId, parseInt(value) || 0);
  }, 500);
}

function debouncedNote(catalogProductId, value) {
  clearTimeout(debounceNoteTimer);
  debounceNoteTimer = setTimeout(() => {
    applyNote(catalogProductId, value);
  }, 1000);
}

function debouncedPanierNote(value) {
  clearTimeout(debouncePanierNoteTimer);
  debouncePanierNoteTimer = setTimeout(() => {
    applyPanierNote(value);
  }, 1000);
}

function confirmValiderPanier() {
  const total = store.totalArticles;
  const totalPrice = store.totalPrice;
  if (
    typeof window !== 'undefined' &&
    !confirm(
      `Confirmer la transformation du panier en commande ?\n\n${total} article${total > 1 ? 's' : ''} - Total : ${formatPrice(totalPrice)}`
    )
  ) {
    return;
  }
  const cid = catalogueIdRef.value;
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  if (!cid) return;
  store.validerPanier(csrf).catch((e) => {
    if (typeof window !== 'undefined') alert(e.message || 'Erreur lors de la validation du panier');
  });
}

function confirmChangeOwner() {
  if (!store.selectedUserId) return;
  if (typeof window !== 'undefined' && !confirm('Merci de confirmer le changement de propriétaire de ce panier !')) return;
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  store.changeOwner(store.selectedUserId, csrf).catch((e) => {
    if (typeof window !== 'undefined') alert(e.message || 'Erreur lors du changement');
  });
}

async function prefillFromRecent() {
  const cid = catalogueIdRef.value;
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  if (!cid) return;
  prefillMessage.value = '';
  prefillLoading.value = true;
  try {
    const count = await store.prefillFromRecentOrders(cid, nouveauPanierRef.value, csrf);
    prefillMessageType.value = 'success';
    if (count > 0) {
      prefillMessage.value = `${count} article${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} avec une quantité de 1.`;
    } else {
      prefillMessage.value = 'Aucun produit commandé dans les 60 derniers jours pour ce catalogue.';
    }
  } catch (e) {
    prefillMessageType.value = 'error';
    prefillMessage.value = e.message || 'Erreur lors du préremplissage.';
  } finally {
    prefillLoading.value = false;
  }
}

onMounted(() => {
  const id = getCatalogueIdFromPath();
  catalogueIdRef.value = id;
  nouveauPanierRef.value = getNouveauFromSearch();
  if (id) {
    store.loadDetail(id, nouveauPanierRef.value);
  }
});
</script>

<style scoped>
.catalogue-detail-row-equal {
  align-items: stretch;
}
.catalogue-detail-row-equal > [class*="col-"] {
  display: flex;
}
.catalogue-detail-side {
  min-height: 180px;
}
.catalogue-detail-side-left,
.catalogue-detail-side-right {
  overflow-y: auto;
}
@media (min-width: 768px) {
  .catalogue-detail-row-equal {
    height: 320px;
    min-height: 320px;
  }
  .catalogue-detail-side {
    height: 100%;
    min-height: 0;
  }
}
.catalogue-detail-note-wrapper {
  width: 100%;
  max-width: 100%;
}
th.sortable {
  cursor: pointer;
  user-select: none;
}
th.sortable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
