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
        <p class="mt-3 text-muted">Chargement du panier...</p>
      </div>

      <template v-else-if="store.panier">
        <!-- En-tête -->
        <div class="row mb-4">
          <div class="col">
            <h2><i class="bi bi-cart3 me-2"></i>{{ titrePanier }}</h2>
            <div class="card">
              <div class="card-body">
                <dl class="row mb-0">
                  <dt class="col-sm-3">Catalogue :</dt>
                  <dd class="col-sm-9">{{ store.panier.catalogue_nom }}</dd>
                  <dt class="col-sm-3">Expiration :</dt>
                  <dd class="col-sm-9">
                    {{ store.panier.expiration_formatted }}
                    <span v-if="store.panier.isExpired" class="badge bg-danger ms-2">Expiré</span>
                  </dd>
                  <dt class="col-sm-3">Livraison :</dt>
                  <dd class="col-sm-9">{{ store.panier.livraison_formatted }}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <!-- Changement de propriétaire (RBAC: paniers.change_owner / paniers.admin) -->
        <div v-if="store.panier.canChangeOwner && store.users.length > 0" class="row mb-3">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <h5 class="card-title mb-3">Changement de propriétaire</h5>
                <div class="d-flex flex-column flex-md-row gap-2 align-items-md-center">
                  <label class="form-label mb-0 text-nowrap">Propriétaire actuel : <strong>{{ store.panier.username }}</strong></label>
                  <select v-model="store.selectedUserId" class="form-select form-select-sm" style="width: auto; min-width: 200px;" :disabled="store.changingOwner">
                    <option :value="null">-- Sélectionner un utilisateur --</option>
                    <option v-for="u in store.users" :key="u.id" :value="u.id">{{ u.username }}</option>
                  </select>
                  <button type="button" class="btn btn-warning btn-sm" :disabled="store.changingOwner || !store.selectedUserId" @click="confirmChangeOwner">
                    <span v-if="store.changingOwner" class="spinner-border spinner-border-sm me-1"></span>
                    <i class="bi bi-person-fill-gear me-1"></i>Changer le propriétaire
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Note personnelle -->
        <div class="row mb-3">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h5 class="card-title mb-0">Note personnelle</h5>
                  <small class="text-muted">
                    <span v-if="store.savingPanierNote" class="text-info"><i class="bi bi-arrow-repeat spin"></i> Sauvegarde...</span>
                    <span v-else-if="store.panierNoteSaved" class="text-success"><i class="bi bi-check-circle"></i> Enregistré</span>
                    <span v-else-if="store.panierNoteError" class="text-danger"><i class="bi bi-exclamation-circle"></i> Erreur</span>
                  </small>
                </div>
                <textarea
                  :value="store.panier.note || ''"
                  class="form-control"
                  rows="2"
                  placeholder="Ajoutez une note personnelle pour ce panier..."
                  :disabled="!store.panier.modifiable"
                  @input="debouncedPanierNote($event.target.value)"
                />
                <small class="text-muted d-block mt-2">Cette note sera visible uniquement par vous et les administrateurs. Sauvegarde automatique.</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Recherche et filtre -->
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input v-model="store.searchTerm" type="text" class="form-control" placeholder="Rechercher un article..." />
            </div>
          </div>
          <div v-if="store.categories.length > 0" class="col-md-6">
            <select v-model="store.selectedCategory" class="form-select">
              <option value="all">Toutes les catégories</option>
              <option v-for="cat in store.categories" :key="cat.nom" :value="cat.nom">{{ cat.nom }}</option>
            </select>
          </div>
        </div>

        <!-- Résumé + Valider -->
        <template v-if="store.totalArticles > 0">
          <div class="alert alert-info d-flex justify-content-between align-items-center mb-3">
            <div>
              <i class="bi bi-cart-check me-2"></i>
              <strong>{{ store.totalArticles }}</strong> article{{ store.totalArticles > 1 ? 's' : '' }} dans votre panier
              <span class="ms-3"><strong>Total :</strong> {{ formatPrice(store.totalPrice) }}</span>
            </div>
            <button v-if="store.panier.modifiable" type="button" class="btn btn-success" @click="confirmValider">
              <i class="bi bi-check2-circle me-1"></i>Transformer en commande
            </button>
          </div>
        </template>

        <!-- Liste articles par catégorie -->
        <template v-if="store.articlesByCategory.length === 0">
          <div class="card mb-4">
            <div class="card-body text-center py-5">
              <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
              <p class="text-muted">Votre panier est vide</p>
              <a :href="`/catalogues/${store.panier.catalog_file_id}/vue`" class="btn btn-primary">
                <i class="bi bi-arrow-left me-1"></i>Retour au catalogue
              </a>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-for="cat in store.articlesByCategory" :key="cat.name" class="card mb-3 border-0 shadow-sm">
            <div class="card-header" :style="{ backgroundColor: cat.color, color: 'white' }">
              <h5 class="mb-0">{{ cat.name }}</h5>
            </div>
            <div class="card-body p-0">
              <!-- Desktop: tableau -->
              <div class="d-none d-lg-block">
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead class="thead-precommandes">
                      <tr>
                        <th style="width: 30%;">Produit</th>
                        <th class="text-center" style="width: 13%;">Prix</th>
                        <th class="text-center" style="width: 20%;">Quantité</th>
                        <th style="width: 27%;">Note</th>
                        <th class="text-center" style="width: 10%;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="article in cat.articles" :key="article.catalog_product_id" :class="{ 'table-success': (article.quantity || 0) > 0 }">
                        <td>
                          <div class="d-flex align-items-center">
                            <img v-if="article.image_filename" :src="`/images/products/${article.image_filename}`" :alt="article.produit" class="me-2" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" @error="($event.target).style.display = 'none'" />
                            <div>
                              <strong>{{ article.produit }}</strong>
                              <br v-if="article.description">
                              <small v-if="article.description" class="text-muted">{{ article.description }}</small>
                            </div>
                          </div>
                        </td>
                        <td class="text-center">
                          <strong>{{ formatPrice((article.prix || 0) * (article.unite || 1)) }}</strong>
                          <br v-if="article.unite > 1">
                          <small v-if="article.unite > 1" class="text-muted">par {{ article.unite }}</small>
                        </td>
                        <td class="text-center">
                          <div class="d-flex align-items-center justify-content-center gap-1">
                            <button type="button" class="btn btn-sm btn-outline-secondary" style="width: 32px; height: 32px; padding: 0;" :disabled="!store.panier.modifiable" @click="changeQty(article, -1)">
                              <i class="bi bi-dash"></i>
                            </button>
                            <input type="number" class="form-control form-control-sm text-center quantity-input" style="width: 60px;" :value="article.quantity || 0" min="0" step="1" :disabled="!store.panier.modifiable" @input="debouncedQty(article.catalog_product_id, $event.target.value)" />
                            <button type="button" class="btn btn-sm btn-outline-secondary" style="width: 32px; height: 32px; padding: 0;" :disabled="!store.panier.modifiable" @click="changeQty(article, 1)">
                              <i class="bi bi-plus"></i>
                            </button>
                          </div>
                          <small class="text-success d-block">Total: {{ formatPrice((article.quantity || 0) * (article.prix || 0) * (article.unite || 1)) }}</small>
                        </td>
                        <td>
                          <input v-if="(article.quantity || 0) > 0" type="text" class="form-control form-control-sm note-input" :value="article.note || ''" placeholder="Note optionnelle" :disabled="!store.panier.modifiable" @input="debouncedNote(article.catalog_product_id, $event.target.value)" />
                          <span v-else class="text-muted">-</span>
                        </td>
                        <td class="text-center">
                          <button v-if="(article.quantity || 0) > 0" type="button" class="btn btn-danger btn-sm" :disabled="!store.panier.modifiable" @click="setQtyZero(article)">
                            <i class="bi bi-trash"></i>
                          </button>
                          <span v-else class="text-muted">-</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Mobile: cartes -->
              <div class="d-lg-none">
                <div v-for="article in cat.articles" :key="'m-' + article.catalog_product_id" class="product-card-mobile p-3 border-bottom" :class="{ 'bg-success-subtle': (article.quantity || 0) > 0 }">
                  <div class="d-flex align-items-start mb-2">
                    <img v-if="article.image_filename" :src="`/images/products/${article.image_filename}`" :alt="article.produit" class="me-2" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" @error="($event.target).style.display = 'none'" />
                    <div class="flex-grow-1">
                      <strong class="d-block">{{ article.produit }}</strong>
                      <small v-if="article.description" class="text-muted d-block">{{ article.description }}</small>
                    </div>
                  </div>
                  <div class="mb-2">
                    <span class="text-muted">Prix : </span>
                    <strong class="fs-5">{{ formatPrice((article.prix || 0) * (article.unite || 1)) }}</strong>
                    <small v-if="article.unite > 1" class="text-muted"> par {{ article.unite }}</small>
                  </div>
                  <div class="mb-2">
                    <label class="form-label mb-1 text-muted">Quantité</label>
                    <div class="d-flex align-items-center gap-2">
                      <button type="button" class="btn btn-outline-secondary" style="width: 44px; height: 44px; padding: 0;" :disabled="!store.panier.modifiable" @click="changeQty(article, -1)">
                        <i class="bi bi-dash fs-5"></i>
                      </button>
                      <input type="number" class="form-control form-control-lg text-center quantity-input" style="width: 80px;" :value="article.quantity || 0" min="0" step="1" :disabled="!store.panier.modifiable" @input="debouncedQty(article.catalog_product_id, $event.target.value)" />
                      <button type="button" class="btn btn-outline-secondary" style="width: 44px; height: 44px; padding: 0;" :disabled="!store.panier.modifiable" @click="changeQty(article, 1)">
                        <i class="bi bi-plus fs-5"></i>
                      </button>
                    </div>
                    <small class="text-success d-block mt-1">Total: {{ formatPrice((article.quantity || 0) * (article.prix || 0) * (article.unite || 1)) }}</small>
                  </div>
                  <div v-if="(article.quantity || 0) > 0" class="mb-2">
                    <label class="form-label mb-1 text-muted">Note (optionnel)</label>
                    <input type="text" class="form-control note-input" :value="article.note || ''" placeholder="Ajoutez une note..." :disabled="!store.panier.modifiable" @input="debouncedNote(article.catalog_product_id, $event.target.value)" />
                  </div>
                  <div v-if="(article.quantity || 0) > 0" class="text-end">
                    <button type="button" class="btn btn-danger btn-sm" :disabled="!store.panier.modifiable" @click="setQtyZero(article)">
                      <i class="bi bi-trash me-1"></i> Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="!store.panier.modifiable" class="alert alert-warning">
          <i class="bi bi-lock me-2"></i>
          Ce catalogue est expiré. Vous ne pouvez plus modifier votre panier.
        </div>

        <!-- Navigation -->
        <div class="row mt-4">
          <div class="col-12">
            <div class="d-flex gap-2">
              <a :href="`/catalogues/${store.panier.catalog_file_id}/vue`" class="btn btn-secondary">
                <i class="bi bi-arrow-left me-1"></i>Retour au catalogue
              </a>
              <a href="/commandes/vue" class="btn btn-outline-secondary">
                <i class="bi bi-list-ul me-1"></i>Mes commandes
              </a>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { usePanierDetailStore } from '@/stores/panierDetail';
import { onMounted, ref, computed } from 'vue';

const store = usePanierDetailStore();
const panierIdRef = ref(null);

/** "Mon panier" si c'est le panier de l'utilisateur connecté, sinon "Panier de [propriétaire]" (mode référent). */
const titrePanier = computed(() => {
  if (!store.panier) return 'Mon panier';
  const currentId = typeof window !== 'undefined' && window.CURRENT_USER_ID != null ? Number(window.CURRENT_USER_ID) : null;
  if (currentId != null && store.panier.user_id !== currentId) {
    return 'Panier de ' + (store.panier.username || '');
  }
  return 'Mon panier';
});

let debounceQtyTimer = null;
let debounceNoteTimer = null;
let debouncePanierNoteTimer = null;

function getPanierIdFromPath() {
  if (typeof window === 'undefined') return null;
  const parts = window.location.pathname.split('/');
  return parts[2] || null;
}

function formatPrice(price) {
  if (price == null) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}

function changeQty(article, delta) {
  const current = article.quantity || 0;
  const newQty = Math.max(0, current + delta);
  applyQty(article.catalog_product_id, newQty);
}

function setQtyZero(article) {
  if (typeof window !== 'undefined' && !confirm(`Retirer "${article.produit}" du panier ?`)) return;
  applyQty(article.catalog_product_id, 0);
}

function applyQty(catalogProductId, quantity) {
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  store.updateQuantity(catalogProductId, quantity, csrf).catch(() => {
    if (typeof window !== 'undefined') alert('Erreur lors de la mise à jour de la quantité');
  });
}

function applyNote(catalogProductId, note) {
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  store.updateNote(catalogProductId, note, csrf).catch(() => {
    if (typeof window !== 'undefined') alert('Erreur lors de la mise à jour de la note');
  });
}

function applyPanierNote(note) {
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  store.updatePanierNote(note, csrf).catch(() => {});
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

function confirmValider() {
  if (typeof window !== 'undefined' && !confirm('Confirmer la validation de votre panier ?')) return;
  const csrf = typeof window !== 'undefined' ? window.CSRF_TOKEN : '';
  store.validerPanier(csrf).catch((e) => {
    if (typeof window !== 'undefined') alert(e.message || 'Erreur lors de la validation');
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

onMounted(() => {
  const id = getPanierIdFromPath();
  panierIdRef.value = id;
  if (id) store.loadDetail(id);
});
</script>
