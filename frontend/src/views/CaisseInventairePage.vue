<template>
  <div class="container-fluid px-3 mt-4">
      <div class="row mb-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2 class="mb-0"><i class="bi bi-upc-scan me-2"></i>Inventaire</h2>
            <div class="d-flex gap-2">
              <a href="/caisse/inventaires-historique" class="btn btn-outline-secondary">Historique inventaires</a>
              <a href="/caisse/stock-mouvements" class="btn btn-outline-secondary">Mouvements stock</a>
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

      <div v-if="error" class="alert alert-danger alert-dismissible show">
        {{ error }}
        <button type="button" class="btn-close" @click="error = null" aria-label="Fermer"></button>
      </div>

      <div v-if="!barcodeDetectorSupported" class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Scan caméra non supporté (Chrome/Edge). Utilisez la recherche produit ci-dessous.
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
          <span class="badge bg-success">Session #{{ inventaireId }}</span>
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
                  v-if="!stream"
                  type="button"
                  class="btn btn-success"
                  :disabled="!barcodeDetectorSupported || loading"
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
                  class="btn btn-success"
                  :disabled="applying"
                  @click="appliquer"
                >
                  <i class="bi bi-check-lg me-1"></i>Appliquer l'inventaire (mettre à jour les stocks)
                </button>
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
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showQuantiteModal = false">Annuler</button>
              <button type="button" class="btn btn-primary" @click="validerQuantiteProduit">Ajouter</button>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  fetchCaisseProduits,
  createInventaire,
  addInventaireLigne,
  appliquerInventaire,
  fetchInventaireDetail,
} from '@/api';

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

const SCAN_COOLDOWN_MS = 1500;

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
    addInventaireLigne(inventaireId.value, productId, newQty).catch((e) => {
      error.value = e.message || 'Erreur ajout ligne';
    });
  }
}

async function demarrerSession() {
  error.value = '';
  loading.value = true;
  try {
    const data = await createInventaire();
    if (data.success && data.inventaire) {
      inventaireId.value = data.inventaire.id;
      lignes.value = [];
      scanned.value = [];
    }
  } catch (e) {
    error.value = e.message || 'Erreur création session';
  } finally {
    loading.value = false;
  }
}

function reinitSession() {
  inventaireId.value = null;
  lignes.value = [];
  scanned.value = [];
}

function ouvrirQuantiteProduit(p) {
  produitPourQuantite.value = p;
  quantiteSaisie.value = Number(p.stock) ?? 0;
  showQuantiteModal.value = true;
}

async function validerQuantiteProduit() {
  if (!produitPourQuantite.value || !inventaireId.value) return;
  const qte = Number(quantiteSaisie.value);
  if (qte < 0) return;
  error.value = '';
  try {
    await addInventaireLigne(inventaireId.value, produitPourQuantite.value.id, qte);
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
  } catch (e) {
    error.value = e.message || 'Erreur ajout ligne';
  }
}

function retirerLigne(productId) {
  lignes.value = lignes.value.filter((l) => l.product_id !== productId);
  if (inventaireId.value) {
    addInventaireLigne(inventaireId.value, productId, 0).catch(() => {});
  }
}

async function sauverCommentaire(ligne) {
  if (!inventaireId.value || ligne.ecart === 0) return;
  error.value = '';
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

async function appliquer() {
  if (!inventaireId.value || lignes.value.length === 0) return;
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
  if (!barcodeDetectorSupported.value) return;
  try {
    barcodeDetector.value =
      typeof window.BarcodeDetector !== 'undefined'
        ? new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'codabar'] })
        : null;
    if (!barcodeDetector.value) throw new Error('BarcodeDetector non disponible');
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    stream.value = mediaStream;
    if (videoEl.value) {
      videoEl.value.srcObject = mediaStream;
      await videoEl.value.play();
      startScanLoop();
    }
  } catch (err) {
    cameraError.value = err.message || 'Impossible d\'accéder à la caméra';
  }
}

function stopCamera() {
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

onMounted(async () => {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchCaisseProduits();
    if (data.success && data.produits) products.value = data.produits;
    if (data.success && data.categories) categories.value = data.categories || [];
  } catch (e) {
    error.value = e.message || 'Erreur chargement produits';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  stopCamera();
});
</script>

<style scoped>
video {
  max-height: 50vh;
}
</style>
