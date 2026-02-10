<template>
  <div class="container-fluid px-3 mt-4">
      <div class="row mb-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2 class="mb-0"><i class="bi bi-upc-scan me-2"></i>Inventaire</h2>
            <div class="d-flex gap-2">
              <BackButton />
              <a href="/caisse/inventaires-historique" class="btn btn-outline-secondary">Historique inventaires</a>
              <a href="/caisse" class="btn btn-outline-primary">
                <i class="bi bi-arrow-left me-2"></i>Retour caisse
              </a>
            </div>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Scan caméra ou recherche produit (sans code-barres). Démarrer une session, ajouter des lignes, puis appliquer l'inventaire.
          </p>
        </div>
      </div>

      <div v-if="syncing" class="alert alert-info mb-2">
        <i class="bi bi-cloud-arrow-up me-2"></i>
        <strong>Synchronisation en cours…</strong>
      </div>
      <div v-else-if="isOffline" class="alert alert-warning mb-2">
        <i class="bi bi-wifi-off me-2"></i>
        <strong>Mode hors ligne</strong>
        <span v-if="loadedFromCache"> — Données chargées depuis le cache.</span>
        <span v-else> — Connectez-vous une première fois pour activer le mode hors ligne.</span>
      </div>

      <div v-if="error" class="alert alert-danger alert-dismissible show">
        {{ error }}
        <button type="button" class="btn-close" @click="error = null" aria-label="Fermer"></button>
      </div>

      <div v-if="!scanSupported" class="alert alert-info">
        <i class="bi bi-info-circle me-2"></i>
        Scan caméra n’est pas disponible. Utilisez la <strong>recherche produit</strong> ci-dessous (nom ou catégorie) pour ajouter des lignes à l’inventaire.
      </div>

      <!-- Brouillons en attente (reprenables) -->
      <div v-if="!inventaireId && brouillons.length > 0 && !loading" class="mb-3">
        <div class="card border-warning">
          <div class="card-header bg-warning bg-opacity-25">
            <h6 class="mb-0"><i class="bi bi-file-earmark-text me-2"></i>Brouillons en attente</h6>
          </div>
          <div class="card-body py-2">
            <div class="d-flex flex-wrap gap-2">
              <button
                v-for="b in brouillons"
                :key="b.id"
                type="button"
                class="btn btn-outline-warning btn-sm"
                @click="reprendreBrouillon(b.id)"
              >
                <i class="bi bi-arrow-repeat me-1"></i>Reprendre #{{ b.id }}
                <span class="badge bg-warning text-dark ms-1">{{ b.nb_lignes ?? 0 }} lignes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Session : démarrer ou en cours -->
      <div class="mb-3">
        <button
          v-if="!inventaireId"
          type="button"
          class="btn btn-primary"
          :disabled="loading"
          @click="demarrerSession"
        >
          <i class="bi bi-play-fill me-1"></i>Démarrer une session d'inventaire
        </button>
        <div v-else class="d-flex align-items-center gap-2">
          <span class="badge bg-success">Session {{ isLocalInventaireId(inventaireId) ? '(hors ligne)' : '#' + inventaireId }}</span>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click="reinitSession">
            Nouvelle session
          </button>
        </div>
      </div>

      <div class="row">
        <!-- Colonne gauche : Scan + Recherche produit -->
        <div class="col-lg-5 mb-4">
          <div class="card mb-3">
            <div class="card-header bg-success text-white">
              <h5 class="mb-0"><i class="bi bi-camera-video me-2"></i>Scan code-barres</h5>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <video
                  ref="videoEl"
                  class="rounded border w-100"
                  style="max-width: 100%; background: #000; aspect-ratio: 4/3"
                  playsinline
                  muted
                ></video>
                <div v-if="cameraError" class="alert alert-warning mt-2 mb-0">{{ cameraError }}</div>
              </div>
              <div class="d-flex gap-2">
                <button
                  v-if="!stream && !zxingControls"
                  type="button"
                  class="btn btn-success"
                  :disabled="!scanSupported || loading"
                  @click="startCamera"
                >
                  <i class="bi bi-camera-video me-1"></i>Démarrer la caméra
                </button>
                <button v-else type="button" class="btn btn-secondary" @click="stopCamera">
                  <i class="bi bi-stop-circle me-1"></i>Arrêter
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h5 class="mb-0"><i class="bi bi-search me-2"></i>Recherche produit (sans code-barres)</h5>
            </div>
            <div class="card-body">
              <div class="mb-2">
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Rechercher par nom..."
                />
              </div>
              <div class="mb-2">
                <select v-model="selectedCategorieId" class="form-select">
                  <option :value="null">Toutes les catégories</option>
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.nom }}</option>
                </select>
              </div>
              <div class="list-group" style="max-height: 280px; overflow-y: auto;">
                <button
                  v-for="p in produitsFiltres"
                  :key="p.id"
                  type="button"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  :disabled="!inventaireId"
                  @click="ouvrirQuantiteProduit(p)"
                >
                  <span>{{ p.nom }}</span>
                  <span class="badge bg-secondary">Stock: {{ p.stock ?? 0 }}</span>
                </button>
                <div v-if="produitsFiltres.length === 0" class="list-group-item text-muted text-center">
                  Aucun produit
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Colonne droite : Lignes inventaire -->
        <div class="col-lg-7 mb-4">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>Lignes d'inventaire</h5>
              <span class="badge bg-primary">{{ lignes.length }}</span>
            </div>
            <div class="card-body p-0">
              <div v-if="lignes.length === 0" class="p-4 text-center text-muted">
                Scannez des codes-barres ou ajoutez des produits par recherche pour constituer les lignes.
              </div>
              <div v-else class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th class="text-end">Qté comptée</th>
                      <th class="text-end">Stock théorique</th>
                      <th class="text-end">Écart</th>
                      <th>Commentaire (écart)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="l in lignes" :key="l.product_id">
                      <td>{{ l.product_nom }}</td>
                      <td class="text-end">{{ l.quantite_comptee }}</td>
                      <td class="text-end">{{ l.stock_theorique }}</td>
                      <td class="text-end" :class="l.ecart > 0 ? 'text-success' : l.ecart < 0 ? 'text-danger' : ''">
                        {{ l.ecart > 0 ? '+' : '' }}{{ l.ecart }}
                      </td>
                      <td>
                        <input
                          v-if="l.ecart !== 0 && inventaireId"
                          v-model="l.comment"
                          type="text"
                          class="form-control form-control-sm"
                          placeholder="Explication de l'écart..."
                          @blur="sauverCommentaire(l)"
                        />
                        <span v-else-if="l.ecart !== 0 && l.comment" class="small text-muted">{{ l.comment }}</span>
                        <span v-else class="text-muted">—</span>
                      </td>
                      <td>
                        <button
                          v-if="inventaireId"
                          type="button"
                          class="btn btn-outline-danger btn-sm"
                          aria-label="Retirer"
                          @click="retirerLigne(l.product_id)"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="lignes.length > 0 && inventaireId" class="p-3 border-top">
                <button
                  type="button"
                  :class="['btn', (applying || isOffline) ? 'btn-secondary' : 'btn-success']"
                  :disabled="applying || isOffline"
                  @click="appliquer"
                >
                  <i class="bi bi-check-lg me-1"></i>Appliquer l'inventaire (mettre à jour les stocks)
                </button>
                <p v-if="isOffline && lignes.length > 0" class="text-warning small mt-2 mb-0">
                  <i class="bi bi-wifi-off me-1"></i>Reconnexion requise pour appliquer l'inventaire.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modale : saisie quantité (recherche produit) -->
      <div v-if="showQuantiteModal" class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Quantité comptée — {{ produitPourQuantite?.nom }}</h5>
              <button type="button" class="btn-close" @click="showQuantiteModal = false" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <p class="small text-muted mb-2">
                Unité : <strong>{{ produitPourQuantite?.unite || 'pièce' }}</strong>
              </p>
              <label class="form-label">Quantité comptée</label>
              <input
                v-model.number="quantiteSaisie"
                type="number"
                min="0"
                step="0.001"
                class="form-control"
              />
              <p class="small text-muted mt-2 mb-0">Stock théorique actuel : {{ produitPourQuantite?.stock ?? 0 }} {{ produitPourQuantite?.unite || 'pièce' }}</p>

              <hr class="my-3" />
              <label class="form-label small text-muted">Corriger le code-barres</label>
              <div class="input-group">
                <input
                  v-model="codeEanQuantiteModal"
                  type="text"
                  class="form-control"
                  placeholder="Code EAN / code-barres"
                  @keydown.enter.prevent="mettreAJourCodeEanQuantite"
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  title="Mettre à jour le code-barres du produit"
                  @click="mettreAJourCodeEanQuantite"
                >
                  Mettre à jour
                </button>
              </div>
              <p v-if="codeEanQuantiteError" class="text-danger small mt-1 mb-0">{{ codeEanQuantiteError }}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showQuantiteModal = false">Annuler</button>
              <button type="button" class="btn btn-primary" @click="validerQuantiteProduit">Ajouter</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modale : code-barres non trouvé → recherche produit et mise à jour du code -->
      <div v-if="showCodeNotFoundModal" class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Code non trouvé : {{ scannedCodeNotFound }}</h5>
              <button type="button" class="btn-close" @click="fermerCodeNotFoundModal" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted mb-3">
                Recherchez le produit correspondant et associez ce code-barres pour les prochains scans.
              </p>
              <div class="mb-2">
                <input
                  v-model="searchQueryCodeNotFound"
                  type="text"
                  class="form-control"
                  placeholder="Rechercher par nom..."
                />
              </div>
              <div class="list-group" style="max-height: 280px; overflow-y: auto;">
                <button
                  v-for="p in produitsFiltresCodeNotFound"
                  :key="p.id"
                  type="button"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  @click="associerCodeAuProduit(p)"
                >
                  <span>{{ p.nom }}</span>
                  <span class="badge bg-secondary">EAN : {{ p.code_ean || '—' }}</span>
                </button>
                <div v-if="produitsFiltresCodeNotFound.length === 0" class="list-group-item text-muted text-center">
                  Aucun produit
                </div>
              </div>
              <p v-if="codeNotFoundError" class="text-danger small mt-2 mb-0">{{ codeNotFoundError }}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="fermerCodeNotFoundModal">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import {
  fetchCaisseProduits,
  createInventaire,
  addInventaireLigne,
  appliquerInventaire,
  fetchInventaires,
  fetchInventaireDetail,
  deleteInventaireLigne,
  deleteInventaire,
  updateProductCodeEan,
} from '@/api';
import {
  saveProduitsCache,
  getProduitsCache,
  createLocalDraft,
  getInventaireDraft,
  saveInventaireDraftLignes,
  clearInventaireDraft,
  isLocalInventaireId,
  queueCodeEanUpdate,
  updateProductCodeEanInCache,
  getSyncQueueCodeEan,
  clearSyncQueueCodeEan,
} from '@/lib/offline-inventaire';

const videoEl = ref(null);
const stream = ref(null);
const barcodeDetector = ref(null);
const scanIntervalId = ref(null);
const cameraDetecting = ref(false);
const lastScanTime = ref(0);
const cameraError = ref('');
const error = ref('');
const loading = ref(false);
const applying = ref(false);
const products = ref([]);
const categories = ref([]);
const searchQuery = ref('');
const selectedCategorieId = ref(null);
const inventaireId = ref(null);
const lignes = ref([]);
const scanned = ref([]);
const showQuantiteModal = ref(false);
const produitPourQuantite = ref(null);
const quantiteSaisie = ref(0);
const zxingControls = ref(null);
const showCodeNotFoundModal = ref(false);
const scannedCodeNotFound = ref('');
const searchQueryCodeNotFound = ref('');
const codeNotFoundError = ref('');
const codeEanQuantiteModal = ref('');
const codeEanQuantiteError = ref('');
const isOffline = ref(false);
const loadedFromCache = ref(false);
const syncing = ref(false);
const brouillons = ref([]);

const SCAN_COOLDOWN_MS = 1500;

// Scan supporté : BarcodeDetector (Chrome/Edge Mac) OU getUserMedia (Safari/iPhone → ZXing)
const scanSupported = computed(() => {
  if (typeof window === 'undefined') return false;
  if (typeof window.BarcodeDetector === 'function') return true;
  return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
});

const barcodeDetectorSupported = computed(
  () => typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'
);

const produitsFiltres = computed(() => {
  let list = [...products.value];
  const q = (searchQuery.value || '').toLowerCase();
  if (q) list = list.filter((p) => (p.nom || '').toLowerCase().includes(q));
  if (selectedCategorieId.value != null)
    list = list.filter((p) => p.category_id === selectedCategorieId.value);
  return list.slice(0, 50);
});

const produitsFiltresCodeNotFound = computed(() => {
  let list = [...products.value];
  const q = (searchQueryCodeNotFound.value || '').toLowerCase();
  if (q) list = list.filter((p) => (p.nom || '').toLowerCase().includes(q));
  return list.slice(0, 80);
});

function normalizeEan(str) {
  return String(str || '').trim().replace(/\s/g, '');
}

function findProductByEan(ean) {
  const code = normalizeEan(ean);
  return products.value.find((p) => p.code_ean && normalizeEan(p.code_ean) === code);
}

function addScanned(code) {
  const product = findProductByEan(code);
  if (!product) {
    scanned.value.unshift({
      code,
      productName: null,
      product_id: null,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    });
    scannedCodeNotFound.value = code;
    searchQueryCodeNotFound.value = '';
    codeNotFoundError.value = '';
    showCodeNotFoundModal.value = true;
    return;
  }
  scanned.value.unshift({
    code,
    productName: product.nom,
    product_id: product.id,
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  });
  if (inventaireId.value) {
    ouvrirQuantiteProduit(product);
  }
}

function fermerCodeNotFoundModal() {
  showCodeNotFoundModal.value = false;
  scannedCodeNotFound.value = '';
  searchQueryCodeNotFound.value = '';
  codeNotFoundError.value = '';
}

function isNetworkError(e) {
  const msg = (e && e.message) || '';
  return msg.includes('fetch') || msg.includes('network') || e instanceof TypeError;
}

async function associerCodeAuProduit(p) {
  codeNotFoundError.value = '';
  const newCode = scannedCodeNotFound.value;
  const doOffline = isOffline.value || !navigator.onLine;
  try {
    if (doOffline) {
      await queueCodeEanUpdate(p.id, newCode);
      await updateProductCodeEanInCache(p.id, newCode);
      const idx = products.value.findIndex((x) => x.id === p.id);
      if (idx >= 0) products.value[idx] = { ...p, code_ean: newCode };
      fermerCodeNotFoundModal();
      if (inventaireId.value) {
        ouvrirQuantiteProduit({ ...p, code_ean: newCode });
      } else if (typeof window !== 'undefined') {
        window.alert('Code-barres associé (sera synchronisé à la reconnexion).');
      }
    } else {
      try {
        await updateProductCodeEan(p.id, newCode);
        const idx = products.value.findIndex((x) => x.id === p.id);
        if (idx >= 0) products.value[idx] = { ...p, code_ean: newCode };
        fermerCodeNotFoundModal();
        if (inventaireId.value) {
          ouvrirQuantiteProduit({ ...p, code_ean: newCode });
        } else if (typeof window !== 'undefined') {
          window.alert('Code-barres associé au produit « ' + p.nom + ' ». Vous pouvez rescanner pour l\'ajouter à l\'inventaire.');
        }
      } catch (err) {
        if (isNetworkError(err)) {
          await queueCodeEanUpdate(p.id, newCode);
          await updateProductCodeEanInCache(p.id, newCode);
          const idx = products.value.findIndex((x) => x.id === p.id);
          if (idx >= 0) products.value[idx] = { ...p, code_ean: newCode };
          fermerCodeNotFoundModal();
          if (inventaireId.value) {
            ouvrirQuantiteProduit({ ...p, code_ean: newCode });
          } else if (typeof window !== 'undefined') {
            window.alert('Code-barres associé (sera synchronisé à la reconnexion).');
          }
        } else {
          throw err;
        }
      }
    }
  } catch (e) {
    codeNotFoundError.value = e.message || 'Erreur lors de la mise à jour';
  }
}

function ajouterOuIncrementerLigne(productId, productNom, stockTheorique, delta) {
  const existing = lignes.value.find((l) => l.product_id === productId);
  const newQty = existing ? existing.quantite_comptee + delta : delta;
  const ecart = newQty - (existing ? existing.stock_theorique : stockTheorique);
  if (existing) {
    existing.quantite_comptee = newQty;
    existing.ecart = ecart;
  } else {
    lignes.value.push({
      product_id: productId,
      product_nom: productNom,
      quantite_comptee: newQty,
      stock_theorique: stockTheorique,
      ecart,
      comment: '',
    });
  }
  if (inventaireId.value) {
    if (isLocalInventaireId(inventaireId.value)) {
      saveInventaireDraftLignes(lignes.value).catch(() => {});
    } else {
      addInventaireLigne(inventaireId.value, productId, newQty).catch((e) => {
        error.value = e.message || 'Erreur ajout ligne';
      });
    }
  }
}

async function demarrerSession() {
  error.value = '';
  loading.value = true;
  try {
    if (!navigator.onLine) {
      const id = await createLocalDraft();
      inventaireId.value = id;
      lignes.value = [];
      scanned.value = [];
    } else {
      const data = await createInventaire();
      if (data.success && data.inventaire) {
        inventaireId.value = data.inventaire.id;
        lignes.value = [];
        scanned.value = [];
      }
    }
  } catch (e) {
    error.value = e.message || 'Erreur création session';
  } finally {
    loading.value = false;
  }
}

async function reinitSession() {
  const wasServerId = inventaireId.value && !isLocalInventaireId(inventaireId.value);
  if (isLocalInventaireId(inventaireId.value)) {
    await clearInventaireDraft();
  }
  inventaireId.value = null;
  lignes.value = [];
  scanned.value = [];
  if (wasServerId && navigator.onLine) {
    try {
      const listData = await fetchInventaires({ limit: 50, offset: 0 });
      brouillons.value = (listData.inventaires || []).filter((i) => i.statut === 'draft');
    } catch (e) {
      brouillons.value = [];
    }
  }
}

function ouvrirQuantiteProduit(p) {
  produitPourQuantite.value = p;
  quantiteSaisie.value = Number(p.stock) ?? 0;
  codeEanQuantiteModal.value = p.code_ean != null ? String(p.code_ean).trim() : '';
  codeEanQuantiteError.value = '';
  showQuantiteModal.value = true;
}

async function mettreAJourCodeEanQuantite() {
  if (!produitPourQuantite.value) return;
  codeEanQuantiteError.value = '';
  const newCode = (codeEanQuantiteModal.value || '').trim() || null;
  const productId = produitPourQuantite.value.id;
  const doOffline = isOffline.value || !navigator.onLine;
  try {
    if (doOffline) {
      await queueCodeEanUpdate(productId, newCode);
      await updateProductCodeEanInCache(productId, newCode);
      const idx = products.value.findIndex((x) => x.id === productId);
      if (idx >= 0) products.value[idx] = { ...products.value[idx], code_ean: newCode };
      produitPourQuantite.value = { ...produitPourQuantite.value, code_ean: newCode };
    } else {
      try {
        await updateProductCodeEan(productId, newCode);
        const idx = products.value.findIndex((x) => x.id === productId);
        if (idx >= 0) products.value[idx] = { ...products.value[idx], code_ean: newCode };
        produitPourQuantite.value = { ...produitPourQuantite.value, code_ean: newCode };
      } catch (err) {
        if (isNetworkError(err)) {
          await queueCodeEanUpdate(productId, newCode);
          await updateProductCodeEanInCache(productId, newCode);
          const idx = products.value.findIndex((x) => x.id === productId);
          if (idx >= 0) products.value[idx] = { ...products.value[idx], code_ean: newCode };
          produitPourQuantite.value = { ...produitPourQuantite.value, code_ean: newCode };
        } else {
          throw err;
        }
      }
    }
  } catch (e) {
    codeEanQuantiteError.value = e.message || 'Erreur lors de la mise à jour';
  }
}

async function validerQuantiteProduit() {
  if (!produitPourQuantite.value || !inventaireId.value) return;
  const qte = Number(quantiteSaisie.value);
  if (qte < 0) return;
  error.value = '';
  const stockTheorique = Number(produitPourQuantite.value.stock) || 0;
  const ecart = qte - stockTheorique;
  const existing = lignes.value.find((l) => l.product_id === produitPourQuantite.value.id);
  if (existing) {
    existing.quantite_comptee = qte;
    existing.stock_theorique = stockTheorique;
    existing.ecart = ecart;
  } else {
    lignes.value.push({
      product_id: produitPourQuantite.value.id,
      product_nom: produitPourQuantite.value.nom,
      quantite_comptee: qte,
      stock_theorique: stockTheorique,
      ecart,
      comment: '',
    });
  }
  showQuantiteModal.value = false;
  if (isLocalInventaireId(inventaireId.value)) {
    await saveInventaireDraftLignes(lignes.value).catch(() => {});
  } else {
    try {
      await addInventaireLigne(inventaireId.value, produitPourQuantite.value.id, qte);
    } catch (e) {
      error.value = e.message || 'Erreur ajout ligne';
    }
  }
}

async function retirerLigne(productId) {
  lignes.value = lignes.value.filter((l) => l.product_id !== productId);
  if (inventaireId.value) {
    if (isLocalInventaireId(inventaireId.value)) {
      await saveInventaireDraftLignes(lignes.value).catch(() => {});
      if (lignes.value.length === 0) {
        await clearInventaireDraft();
        inventaireId.value = null;
        scanned.value = [];
      }
    } else {
      try {
        await deleteInventaireLigne(inventaireId.value, productId);
        if (lignes.value.length === 0) {
          await deleteInventaire(inventaireId.value);
          inventaireId.value = null;
          scanned.value = [];
          const listData = await fetchInventaires({ limit: 50, offset: 0 });
          brouillons.value = (listData.inventaires || []).filter((i) => i.statut === 'draft');
        }
      } catch (e) {
        error.value = e.message || 'Erreur suppression ligne';
      }
    }
  }
}

async function sauverCommentaire(ligne) {
  if (!inventaireId.value || ligne.ecart === 0) return;
  error.value = '';
  if (isLocalInventaireId(inventaireId.value)) {
    await saveInventaireDraftLignes(lignes.value).catch(() => {});
  } else {
    try {
      await addInventaireLigne(
        inventaireId.value,
        ligne.product_id,
        ligne.quantite_comptee,
        ligne.comment || null
      );
    } catch (e) {
      error.value = e.message || 'Erreur sauvegarde commentaire';
    }
  }
}

async function appliquer() {
  if (!inventaireId.value || lignes.value.length === 0) return;
  if (isLocalInventaireId(inventaireId.value)) return; // Hors ligne : appliquer désactivé
  error.value = '';
  applying.value = true;
  try {
    await appliquerInventaire(inventaireId.value);
    reinitSession();
    error.value = null;
    if (typeof window !== 'undefined') window.alert('Inventaire appliqué. Les stocks ont été mis à jour.');
  } catch (e) {
    error.value = e.message || 'Erreur lors de l\'application';
  } finally {
    applying.value = false;
  }
}

function startScanLoop() {
  if (!barcodeDetector.value || !videoEl.value?.srcObject || videoEl.value.readyState < 2) return;
  if (videoEl.value.videoWidth === 0 || videoEl.value.videoHeight === 0) {
    setTimeout(startScanLoop, 100);
    return;
  }
  scanIntervalId.value = setInterval(detectFromVideo, 350);
}

function detectFromVideo() {
  if (!barcodeDetector.value || !videoEl.value?.srcObject || videoEl.value.readyState < 2) return;
  if (videoEl.value.videoWidth === 0 || videoEl.value.videoHeight === 0) return;
  if (Date.now() - lastScanTime.value < SCAN_COOLDOWN_MS) return;
  if (cameraDetecting.value) return;
  cameraDetecting.value = true;
  barcodeDetector.value
    .detect(videoEl.value)
    .then((res) => {
      if (res?.length > 0 && res[0].rawValue) {
        lastScanTime.value = Date.now();
        addScanned(res[0].rawValue);
      }
    })
    .catch(() => {})
    .finally(() => {
      cameraDetecting.value = false;
    });
}

async function startCamera() {
  cameraError.value = '';
  if (!scanSupported.value) return;
  const hasNative = barcodeDetectorSupported.value;
  try {
    if (hasNative) {
      barcodeDetector.value = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'codabar'] });
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      stream.value = mediaStream;
      if (videoEl.value) {
        videoEl.value.srcObject = mediaStream;
        await videoEl.value.play();
        startScanLoop();
      }
    } else {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();
      const videoElem = videoEl.value;
      if (!videoElem) throw new Error('Élément vidéo non trouvé');
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      };
      const controls = await codeReader.decodeFromConstraints(
        constraints,
        videoElem,
        (result, err) => {
          if (err || !result) return;
          if (Date.now() - lastScanTime.value < SCAN_COOLDOWN_MS) return;
          lastScanTime.value = Date.now();
          addScanned(result.getText());
        }
      );
      zxingControls.value = controls;
    }
  } catch (err) {
    cameraError.value = err.message || 'Impossible d\'accéder à la caméra';
  }
}

function stopCamera() {
  if (zxingControls.value) {
    try {
      zxingControls.value.stop();
    } catch (_) {}
    zxingControls.value = null;
  }
  if (scanIntervalId.value) {
    clearInterval(scanIntervalId.value);
    scanIntervalId.value = null;
  }
  if (stream.value) {
    stream.value.getTracks().forEach((t) => t.stop());
    stream.value = null;
  }
  if (videoEl.value) videoEl.value.srcObject = null;
  cameraError.value = '';
}

async function loadProduitsEtCategories() {
  loading.value = true;
  error.value = '';
  isOffline.value = !navigator.onLine;
  loadedFromCache.value = false;

  try {
    if (navigator.onLine) {
      const data = await fetchCaisseProduits();
      if (data.success && data.produits) products.value = data.produits;
      if (data.success && data.categories) categories.value = data.categories || [];
      await saveProduitsCache(products.value, categories.value);
    } else {
      const cached = await getProduitsCache();
      if (cached) {
        products.value = cached.produits || [];
        categories.value = cached.categories || [];
        loadedFromCache.value = true;
      } else {
        error.value = 'Connectez-vous une première fois pour activer le mode hors ligne.';
      }
    }
  } catch (e) {
    if (!navigator.onLine) {
      const cached = await getProduitsCache();
      if (cached) {
        products.value = cached.produits || [];
        categories.value = cached.categories || [];
        loadedFromCache.value = true;
        error.value = '';
      } else {
        error.value = 'Connectez-vous une première fois pour activer le mode hors ligne.';
      }
    } else {
      error.value = e.message || 'Erreur chargement produits';
    }
  } finally {
    loading.value = false;
  }
  // Restaurer le brouillon : local si hors ligne, serveur si en ligne
  if (!navigator.onLine) {
    const draft = await getInventaireDraft();
    if (draft) {
      inventaireId.value = draft.id;
      lignes.value = draft.lignes || [];
    }
  } else {
    // Charger la liste des brouillons serveur (reprenables)
    try {
      const listData = await fetchInventaires({ limit: 50, offset: 0 });
      brouillons.value = (listData.inventaires || []).filter((i) => i.statut === 'draft');
    } catch (e) {
      brouillons.value = [];
    }
  }
}

async function reprendreBrouillon(id) {
  if (!navigator.onLine) return;
  loading.value = true;
  error.value = '';
  try {
    const detail = await fetchInventaireDetail(id);
    if (detail.success && detail.inventaire && detail.lignes) {
      inventaireId.value = detail.inventaire.id;
      lignes.value = detail.lignes.map((l) => ({
        product_id: l.product_id,
        product_nom: l.product_nom,
        quantite_comptee: l.quantite_comptee,
        stock_theorique: l.stock_theorique,
        ecart: l.ecart,
        comment: l.comment || '',
      }));
      scanned.value = [];
      brouillons.value = brouillons.value.filter((b) => b.id !== id);
    }
  } catch (e) {
    error.value = e.message || 'Erreur reprise brouillon';
  } finally {
    loading.value = false;
  }
}

/** Phase 4 + 5 : sync à la reconnexion (code EAN + inventaire draft) */
async function processSyncOnReconnect() {
  if (!navigator.onLine) return;
  syncing.value = true;
  try {
    // Phase 5 : mises à jour code EAN
    const codeEanQueue = await getSyncQueueCodeEan();
    for (const entry of codeEanQueue) {
      try {
        await updateProductCodeEan(entry.productId, entry.codeEan);
      } catch (e) {
        console.warn('Sync code EAN échoué:', e);
      }
    }
    if (codeEanQueue.length > 0) await clearSyncQueueCodeEan();

    // Phase 4 : inventaire draft
    const draft = await getInventaireDraft();
    if (draft && draft.lignes && draft.lignes.length > 0) {
      const data = await createInventaire();
      if (data.success && data.inventaire) {
        const serverId = data.inventaire.id;
        for (const l of draft.lignes) {
          await addInventaireLigne(serverId, l.product_id, l.quantite_comptee, l.comment || null);
        }
        await appliquerInventaire(serverId);
        await clearInventaireDraft();
        inventaireId.value = null;
        lignes.value = [];
        scanned.value = [];
        if (typeof window !== 'undefined') {
          window.alert('Inventaire synchronisé et appliqué. Les stocks ont été mis à jour.');
        }
      }
    } else if (draft) {
      await clearInventaireDraft();
      inventaireId.value = null;
      lignes.value = [];
    }
  } catch (e) {
    console.warn('Sync échoué:', e);
  } finally {
    syncing.value = false;
  }
}

async function handleOnline() {
  isOffline.value = false;
  await loadProduitsEtCategories();
  await processSyncOnReconnect();
}

function handleOffline() {
  isOffline.value = true;
}

onMounted(async () => {
  await loadProduitsEtCategories();
  if (navigator.onLine) await processSyncOnReconnect();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  stopCamera();
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});
</script>

<style scoped>
video {
  max-height: 50vh;
}
</style>
