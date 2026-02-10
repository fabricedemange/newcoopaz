<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid px-3 mt-4">
      <div class="row mb-4">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center">
            <h2 class="mb-0"><i class="bi bi-cart-fill me-2"></i>Caisse</h2>
            <div class="d-flex gap-2">
              <BackButton />
              <a href="/caisse/historique" class="btn btn-outline-primary">
              <i class="bi bi-clock-history me-2"></i>Historique des ventes
            </a>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
        {{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <!-- Retour scan lecteur (toast léger, auto-masqué) -->
      <Transition name="scan-toast">
        <div
          v-if="scanToastMessage"
          :class="['alert mb-2 py-2', scanToastType === 'success' ? 'alert-success' : 'alert-warning']"
          role="status"
        >
          <i :class="scanToastType === 'success' ? 'bi bi-check-circle me-2' : 'bi bi-upc-scan me-2'"></i>
          {{ scanToastMessage }}
        </div>
      </Transition>

      <div class="row">
        <!-- Colonne Produits -->
        <div class="col-lg-7 col-md-7 mb-4">
          <div class="mb-3">
            <input
              v-model="store.searchQuery"
              type="text"
              class="form-control"
              placeholder="Rechercher un produit..."
              style="max-width: 500px"
            />
          </div>
          <div class="mb-3">
            <span class="badge bg-secondary fs-6 py-2 px-3">
              <i class="bi bi-box-seam me-1"></i>{{ store.produitsFiltrés.length }} produits disponibles
            </span>
          </div>
          <div v-if="store.searchQuery && store.categoriesFiltrées.length > 0" class="mb-3">
            <div class="d-flex flex-wrap gap-2">
              <button
                v-for="cat in store.categoriesFiltrées"
                :key="cat.id"
                :class="['btn btn-sm', store.selectedCategorie === cat.id ? 'btn-primary' : 'btn-outline-primary']"
                @click="store.selectedCategorie = store.selectedCategorie === cat.id ? null : cat.id"
              >
                {{ cat.nom }}
                <span :class="['badge ms-2', store.selectedCategorie === cat.id ? 'bg-light text-primary' : 'bg-primary']">
                  {{ store.produitsFiltresParRecherche.filter((p) => p.category_id === cat.id).length }}
                </span>
              </button>
            </div>
          </div>
          <div v-if="store.produitsLoading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
          <div v-else-if="store.produitsFiltrés.length === 0" class="alert alert-info text-center">
            Aucun produit disponible
          </div>
          <div v-else class="row g-3">
            <div
              v-for="produit in store.produitsFiltrés"
              :key="produit.id"
              class="col-lg-4 col-md-6 col-sm-4 col-6"
            >
              <div class="card h-100 produit-card" @click="onSelectProduit(produit)">
                <img
                  v-if="produit.image_url"
                  :src="produit.image_url"
                  class="card-img-top"
                  :alt="produit.nom"
                  style="height: 120px; object-fit: cover"
                />
                <div class="card-body p-2 d-flex flex-column">
                  <h6 class="card-title mb-1" style="font-size: 0.9rem">{{ produit.nom }}</h6>
                  <div class="mt-auto pt-1 d-flex justify-content-between align-items-center">
                    <span class="text-primary fw-bold">{{ (parseFloat(produit.prix) || 0).toFixed(2) }} €</span>
                    <span
                      class="small"
                      :class="(Number(produit.stock) ?? 0) < 0 ? 'fw-bold text-danger' : 'text-muted'"
                    >
                      Stock : {{ produit.stock ?? 0 }} {{ produit.unite || 'pièce' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Colonne Panier -->
        <div class="col-lg-5 col-md-5">
          <div class="card" style="min-height: calc(100vh - 120px); display: flex; flex-direction: column">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0"><i class="bi bi-cart3 me-2"></i>Panier</h5>
              <div class="d-flex gap-2 flex-wrap mt-2">
                <button class="btn btn-sm btn-outline-light" @click="store.nouveauPanier()">
                  <i class="bi bi-file-earmark-plus me-1"></i>Nouveau
                </button>
                <button
                  class="btn btn-sm btn-light"
                  :disabled="store.lignes.length === 0"
                  @click="store.sauvegarderPanier()"
                >
                  <i class="bi bi-save me-1"></i>Sauvegarder
                </button>
                <button class="btn btn-sm btn-info" @click="store.showPaniersModal = true">
                  <i class="bi bi-folder2-open me-1"></i>Charger
                  <span class="badge bg-white text-info ms-1">{{ store.savedPaniers.length }}</span>
                </button>
              </div>
              <div class="mt-3">
                <label class="form-label mb-1 small"><i class="bi bi-person me-1"></i>Utilisateur</label>
                <select v-model="store.selectedUtilisateur" class="form-select form-select-sm">
                  <option v-for="u in store.utilisateurs" :key="u.id" :value="u.id">{{ u.username }}</option>
                </select>
              </div>
            </div>
            <div class="card-body" style="flex: 1">
              <!-- Charger une commande catalogue -->
              <div v-if="store.selectedUtilisateur" class="mb-3 border-bottom pb-3">
                <label class="form-label fw-bold small mb-2 d-flex align-items-center gap-1">
                  <i class="bi bi-basket me-1"></i>Charger une commande catalogue
                  <span
                    ref="infobulleCommandesRef"
                    class="d-inline-flex align-items-center text-muted ms-1"
                    style="cursor: help"
                    :title="infobulleReglesCommandesCatalogue"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    data-bs-trigger="hover focus"
                    :data-bs-title="infobulleReglesCommandesCatalogue"
                  >
                    <i class="bi bi-info-circle" style="font-size: 1rem"></i>
                  </span>
                </label>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary w-100 mb-2"
                  :disabled="store.loadingCommandes"
                  @click="store.chargerCommandesUtilisateur()"
                >
                  <i class="bi bi-arrow-clockwise me-1"></i>
                  {{ store.loadingCommandes ? 'Chargement...' : 'Actualiser commandes' }}
                </button>
                <select
                  v-model="store.selectedCommandeId"
                  class="form-select form-select-sm"
                  :disabled="!store.commandesUtilisateur.length"
                >
                  <option :value="null">-- Sélectionner une commande --</option>
                  <option
                    v-for="cmd in store.commandesUtilisateur"
                    :key="cmd.id"
                    :value="cmd.id"
                  >
                    Cde #{{ cmd.id }} - {{ cmd.catalogue_nom || 'Catalogue' }} (Cat #{{ cmd.catalog_id }}) | {{ cmd.nb_articles }} articles | {{ (parseFloat(cmd.total) || 0).toFixed(2) }} €
                  </option>
                </select>
                <small v-if="store.commandesUtilisateur.length === 0 && !store.loadingCommandes" class="text-muted d-block mt-1">
                  Aucune commande en attente pour cet utilisateur
                </small>
                <button
                  v-if="store.selectedCommandeId"
                  type="button"
                  class="btn btn-sm btn-primary w-100 mt-2"
                  @click="onChargerCommandeCatalogue"
                >
                  <i class="bi bi-box-arrow-in-down me-1"></i>Charger cette commande
                </button>
              </div>
              <div v-if="store.commandeSelectionnee" class="alert alert-info py-2 px-3 mb-3" style="font-size: 0.85rem">
                <i class="bi bi-info-circle me-1"></i>
                Ce panier provient de la commande catalogue #{{ store.commandeSelectionnee }}
              </div>
              <button
                v-if="store.lignes.length > 0"
                class="btn btn-sm btn-warning w-100 mb-2"
                @click="store.showAvoirModal = true"
              >
                <i class="bi bi-receipt me-1"></i>Ajouter un avoir
              </button>
              <div v-if="store.lignes.length === 0" class="text-center py-4 text-muted">
                <i class="bi bi-cart-x" style="font-size: 3rem"></i>
                <p class="mt-2 mb-0">Panier vide</p>
              </div>
              <template v-else>
                <div class="mb-3">
                  <div
                    v-for="(ligne, index) in store.lignes"
                    :key="index"
                    :class="['border-bottom pb-2 mb-2', ligne.is_cotisation ? 'bg-info bg-opacity-10' : (ligne.is_avoir || !ligne.produit_id) ? 'bg-warning bg-opacity-10' : '']"
                  >
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <strong :class="[ligne.is_cotisation ? 'text-info' : (ligne.is_avoir || !ligne.produit_id) ? 'text-warning' : '']" style="font-size: 0.9rem">
                        <i v-if="ligne.is_cotisation" class="bi bi-coin me-1"></i>
                        <i v-else-if="ligne.is_avoir || !ligne.produit_id" class="bi bi-receipt me-1"></i>
                        {{ ligne.nom_produit }}
                      </strong>
                      <button class="btn btn-sm btn-outline-danger" @click="store.supprimerLigne(index)">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                    <div v-if="ligne.is_cotisation || ligne.is_avoir || !ligne.produit_id" class="d-flex justify-content-end">
                      <strong :class="ligne.is_cotisation ? 'text-info' : 'text-warning'">{{ ligne.prix_unitaire.toFixed(2) }} €</strong>
                    </div>
                    <div v-else class="d-flex justify-content-between align-items-center">
                      <div class="d-flex align-items-center gap-1">
                        <button
                          class="btn btn-outline-secondary btn-sm"
                          type="button"
                          @click="store.modifierQuantite(index, Math.max(0.001, ligne.quantite - (ligne.quantite_min || 0.001)))"
                        >
                          <i class="bi bi-dash"></i>
                        </button>
                        <input
                          :ref="(el) => setQuantiteInputRef(el, index)"
                          type="number"
                          class="form-control form-control-sm text-center quantite-input"
                          :value="ligne.quantite"
                          min="0.001"
                          step="0.001"
                          style="width: 60px"
                          @change="store.modifierQuantite(index, parseFloat($event.target.value) || 0.001)"
                        />
                        <button
                          class="btn btn-outline-secondary btn-sm"
                          type="button"
                          @click="store.modifierQuantite(index, ligne.quantite + (ligne.quantite_min || 0.001))"
                        >
                          <i class="bi bi-plus"></i>
                        </button>
                        <span class="text-muted small">{{ ligne.unite || 'Pièce' }}</span>
                      </div>
                      <span class="text-muted">
                        {{ ligne.quantite.toFixed(3) }} × {{ ligne.prix_unitaire.toFixed(2) }}€ =
                        <strong class="text-primary">{{ (ligne.quantite * ligne.prix_unitaire).toFixed(2) }} €</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <div class="border-top pt-3 mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted">Articles:</span>
                    <span>{{ store.nombreArticles }}</span>
                  </div>
                  <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Total:</h5>
                    <h5 class="mb-0 text-primary">{{ store.total.toFixed(2) }} €</h5>
                  </div>
                </div>
                <div class="d-grid gap-2">
                  <button
                    class="btn btn-success btn-lg"
                    :disabled="store.lignes.length === 0"
                    @click="store.ouvrirPaiement()"
                  >
                    <i class="bi bi-check-circle me-2"></i>Valider la vente
                  </button>
                  <button class="btn btn-outline-danger" @click="store.viderPanier()">
                    <i class="bi bi-trash me-2"></i>Vider le panier
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Paniers sauvegardés -->
    <div
      v-if="store.showPaniersModal"
      class="modal show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-folder2-open me-2"></i>Paniers sauvegardés</h5>
            <button type="button" class="btn-close" @click="store.showPaniersModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="store.savedPaniers.length === 0" class="alert alert-info">Aucun panier sauvegardé</div>
            <div v-else>
              <div v-for="panier in store.savedPaniers" :key="panier.id" class="card mb-2">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col-md-6">
                      <strong>{{ (panier.lignes || []).length }} article(s)</strong>
                      <span class="text-muted ms-2">—</span>
                      <span class="text-primary">
                        <i class="bi bi-person me-1"></i>{{ store.utilisateurs.find(u => u.id === panier.selectedUtilisateur)?.username || 'Non assigné' }}
                      </span>
                      <br />
                      <small class="text-muted">
                        <i class="bi bi-clock me-1"></i>{{ new Date(panier.saved_at).toLocaleString('fr-FR') }}
                      </small>
                    </div>
                    <div class="col-md-3 text-end">
                      <h5 class="mb-0 text-primary">{{ (panier.total || 0).toFixed(2) }} €</h5>
                    </div>
                    <div class="col-md-3 text-end">
                      <button class="btn btn-sm btn-primary me-2" @click="store.chargerPanier(panier.id)">
                        <i class="bi bi-box-arrow-in-down me-1"></i>Charger
                      </button>
                      <button class="btn btn-sm btn-outline-danger" @click="confirmSupprimerPanier(panier.id)">
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.showPaniersModal = false">Fermer</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Paiement -->
    <div
      v-if="store.showPaiementModal"
      class="modal show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-credit-card me-2"></i>Valider la vente</h5>
            <button type="button" class="btn-close" @click="store.fermerPaiement()"></button>
          </div>
          <div class="modal-body">
            <!-- Cotisation : jamais pour client Anonyme -->
            <div
              v-if="!estAnonyme && store.cotisationCheck?.doit_cotiser && !store.aPanierCotisation"
              class="alert alert-warning mb-3"
            >
              <strong><i class="bi bi-info-circle me-1"></i>Cotisation mensuelle</strong>
              <p class="mb-2 small">Pour ce mois ({{ store.cotisationCheck.mois_courant }}), une cotisation entre 5 et 15 € est requise. Choisissez le montant :</p>
              <div class="d-flex gap-2 flex-wrap">
                <button type="button" class="btn btn-outline-primary" @click="store.ajouterCotisation(5)">5 €</button>
                <button type="button" class="btn btn-outline-primary" @click="store.ajouterCotisation(10)">10 €</button>
                <button type="button" class="btn btn-outline-primary" @click="store.ajouterCotisation(15)">15 €</button>
              </div>
            </div>
            <!-- Email optionnel pour envoyer la facture PDF (client anonyme uniquement) -->
            <div v-if="estAnonyme" class="alert alert-info mb-3">
              <label class="form-label small mb-1">
                <i class="bi bi-envelope me-1"></i>Email pour recevoir la facture en PDF (optionnel)
              </label>
              <input
                v-model="store.emailFactureAnonyme"
                type="email"
                class="form-control form-control-sm"
                placeholder="exemple@email.com"
              />
            </div>
            <div class="alert alert-success mb-3">
              Total à payer: <strong>{{ store.total.toFixed(2) }} €</strong>
            </div>
            <div class="mb-2">
              <label class="form-label">Paiements</label>
              <div
                v-for="(ligne, index) in store.lignesPaiement"
                :key="index"
                class="d-flex gap-2 align-items-start mb-2"
              >
                <select
                  v-model="ligne.mode_paiement_id"
                  class="form-select flex-grow-1"
                  style="min-width: 140px"
                >
                  <option :value="null">-- Mode --</option>
                  <option v-for="m in store.modesPaiement" :key="m.id" :value="m.id">{{ m.nom }}</option>
                </select>
                <div class="input-group" style="max-width: 120px">
                  <input
                    v-model.number="ligne.montant"
                    type="number"
                    class="form-control"
                    step="0.01"
                    min="0"
                    placeholder="Montant"
                  />
                  <span class="input-group-text">€</span>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  :disabled="store.lignesPaiement.length <= 1"
                  :title="store.lignesPaiement.length <= 1 ? 'Garder au moins une ligne' : 'Supprimer'"
                  @click="store.supprimerLignePaiement(index)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <button type="button" class="btn btn-outline-secondary btn-sm mt-1" @click="store.ajouterLignePaiement()">
                <i class="bi bi-plus me-1"></i>Ajouter un paiement
              </button>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span>Total payé:</span>
              <strong>{{ store.totalPaye.toFixed(2) }} €</strong>
            </div>
            <div v-if="store.resteAPayer > 0" class="alert alert-warning mb-2 py-2">
              <i class="bi bi-exclamation-triangle me-1"></i>Reste à payer: <strong>{{ store.resteAPayer.toFixed(2) }} €</strong>. La vente ne peut pas être validée tant que le montant n'est pas entièrement couvert.
            </div>
            <div v-else-if="store.resteAPayer < 0" class="alert alert-info mb-2 py-2">
              Rendu monnaie: <strong>{{ (-store.resteAPayer).toFixed(2) }} €</strong>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.fermerPaiement()">Annuler</button>
            <button
              type="button"
              class="btn btn-success"
              :disabled="!store.peutValiderPaiement"
              @click="store.validerVente()"
            >
              <i class="bi bi-check-circle me-1"></i>Valider la vente
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal confirmation charger commande catalogue -->
    <div v-if="store.showModalChargerCommande" class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-cart-plus me-2"></i>Ajouter la commande au panier</h5>
            <button type="button" class="btn-close" @click="store.annulerChargerCommande()"></button>
          </div>
          <div class="modal-body">
            <p>Le panier actuel contient déjà des articles.</p>
            <p><strong>Les articles de la commande catalogue seront ajoutés au panier (les quantités des mêmes produits seront fusionnées).</strong></p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.annulerChargerCommande()">Annuler</button>
            <button type="button" class="btn btn-primary" @click="store.chargerCommandeDansPanier(store.commandeACharger?.id)">
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Avoir -->
    <div v-if="store.showAvoirModal" class="modal show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.5)">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>Ajouter un avoir</h5>
            <button type="button" class="btn-close" @click="store.showAvoirModal = false"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              Total panier: <strong>{{ totalProduitsPanier.toFixed(2) }} €</strong>
            </div>
            <div class="mb-3">
              <label class="form-label">Montant de l'avoir *</label>
              <input v-model.number="store.avoirMontant" type="number" class="form-control" step="0.01" min="0.01" />
            </div>
            <div class="mb-3">
              <label class="form-label">Commentaire</label>
              <input v-model="store.avoirCommentaire" type="text" class="form-control" placeholder="Ex: Remboursement" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="store.showAvoirModal = false">Annuler</button>
            <button type="button" class="btn btn-warning" @click="store.ajouterAvoir()">
              <i class="bi bi-check me-1"></i>Ajouter l'avoir
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { useCaisseStore } from '@/stores/caisse';

const store = useCaisseStore();
const infobulleCommandesRef = ref(null);
const quantityInputRefs = ref({});

function setQuantiteInputRef(el, index) {
  if (el) quantityInputRefs.value[index] = el;
}

function onSelectProduit(produit) {
  const lineIndex = store.ajouterProduit(produit);
  nextTick(() => {
    const input = quantityInputRefs.value[lineIndex];
    if (input && typeof input.focus === 'function') input.focus();
  });
}

// Toast scan lecteur (léger, dynamique)
const scanToastMessage = ref('');
const scanToastType = ref('success');
let scanToastTimer = null;

function showScanToast(message, type = 'success') {
  scanToastMessage.value = message;
  scanToastType.value = type;
  clearTimeout(scanToastTimer);
  scanToastTimer = setTimeout(() => {
    scanToastMessage.value = '';
  }, 2500);
}

// Lecteur code-barres : buffer global + Enter
const BARCODE_MIN_LENGTH = 4;
const BARCODE_IDLE_MS = 200;
let scanBuffer = '';
let scanBufferTimer = null;

function focusQuantiteInput(lineIndex) {
  const doFocus = () => {
    const input = quantityInputRefs.value[lineIndex];
    if (input && typeof input.focus === 'function') {
      input.focus();
      input.select?.();
    }
  };
  nextTick(() => {
    doFocus();
    setTimeout(doFocus, 50);
  });
}

function clearScanBuffer() {
  scanBuffer = '';
}

function flushScanBuffer() {
  const code = scanBuffer.trim().replace(/\s/g, '');
  clearScanBuffer();
  if (code.length >= BARCODE_MIN_LENGTH && /^\d+$/.test(code)) {
    const result = store.ajouterProduitParEan(code);
    if (result.found) {
      showScanToast(`Ajouté : ${result.produit.nom}`, 'success');
      if (result.lineIndex != null) focusQuantiteInput(result.lineIndex);
    } else {
      showScanToast('Code non reconnu', 'warning');
    }
  }
}

function onKeydownScan(e) {
  const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
  if (e.key === 'Enter') {
    if (inInput) {
      const val = (e.target.value || '').trim().replace(/\s/g, '');
      if (val.length >= BARCODE_MIN_LENGTH && /^\d+$/.test(val)) {
        e.preventDefault();
        const result = store.ajouterProduitParEan(val);
        if (result.found) {
          showScanToast(`Ajouté : ${result.produit.nom}`, 'success');
          if (result.lineIndex != null) focusQuantiteInput(result.lineIndex);
          if (store.searchQuery === val) store.searchQuery = '';
          e.target.value = '';
        } else {
          showScanToast('Code non reconnu', 'warning');
        }
      }
    } else {
      if (scanBuffer.length >= BARCODE_MIN_LENGTH && /^\d+$/.test(scanBuffer)) {
        e.preventDefault();
        flushScanBuffer();
      } else {
        clearScanBuffer();
      }
    }
    return;
  }
  if (!inInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    scanBuffer += e.key;
    clearTimeout(scanBufferTimer);
    scanBufferTimer = setTimeout(clearScanBuffer, BARCODE_IDLE_MS);
  }
}

/** Infobulle : règles d'affichage des commandes catalogue dans la caisse */
const infobulleReglesCommandesCatalogue =
  "Règles d'affichage : sont listées uniquement les commandes dont le catalogue a une date d'expiration dépassée et dont le catalogue est masqué (invisible) pour l'utilisateur. Les commandes déjà transformées en vente caisse n'apparaissent pas.";

const totalProduitsPanier = computed(() => {
  return store.lignes
    .filter((l) => !l.is_avoir)
    .reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0);
});

/** True si l'utilisateur sélectionné est "Anonyme" (pas de cotisation, proposition email facture) */
const estAnonyme = computed(() => {
  const u = store.utilisateurs.find((x) => x.id === store.selectedUtilisateur);
  return u && (u.username || '').toLowerCase() === 'anonyme';
});

function confirmSupprimerPanier(panierId) {
  if (confirm('Supprimer ce panier sauvegardé ?')) store.supprimerPanier(panierId);
}

function onChargerCommandeCatalogue() {
  const cmd = store.commandesUtilisateur.find((c) => c.id === store.selectedCommandeId);
  if (cmd) store.confirmerChargerCommande(cmd);
}

function onBeforeUnload(e) {
  if (store.lignes.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(() => {
  store.chargerProduits();
  store.chargerUtilisateurs();
  store.chargerModesPaiement();
  nextTick(() => initTooltipCommandes());
  document.addEventListener('keydown', onKeydownScan);
  window.addEventListener('beforeunload', onBeforeUnload);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydownScan);
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (scanBufferTimer) clearTimeout(scanBufferTimer);
  if (scanToastTimer) clearTimeout(scanToastTimer);
});

watch(() => store.searchQuery, () => {
  store.selectedCategorie = null;
});

watch(() => store.selectedUtilisateur, (userId) => {
  if (userId) {
    store.chargerCommandesUtilisateur();
    nextTick(() => initTooltipCommandes());
  } else {
    store.commandesUtilisateur = [];
    store.commandeSelectionnee = null;
    store.selectedCommandeId = null;
  }
});

function initTooltipCommandes() {
  setTimeout(() => {
    const el = infobulleCommandesRef.value;
    if (!el || typeof window === 'undefined') return;
    if (window.bootstrap?.Tooltip) {
      try {
        const existing = window.bootstrap.Tooltip.getInstance(el);
        if (existing) existing.dispose();
        new window.bootstrap.Tooltip(el, { trigger: 'hover focus', placement: 'top' });
      } catch (_) {
        // Fallback: native title is already sur l'élément
      }
    }
  }, 150);
}
</script>

<style scoped>
.scan-toast-enter-active,
.scan-toast-leave-active {
  transition: opacity 0.25s ease;
}
.scan-toast-enter-from,
.scan-toast-leave-to {
  opacity: 0;
}
.produit-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  border: 1px solid #dee2e6;
  cursor: pointer;
}
.produit-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #0d6efd;
}
.quantite-input::-webkit-outer-spin-button,
.quantite-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.quantite-input {
  -moz-appearance: textfield;
}
</style>
