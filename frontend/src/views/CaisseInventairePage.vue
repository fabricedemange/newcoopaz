<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid px-3 mt-4 ms-280">
      <div class="row mb-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2 class="mb-0"><i class="bi bi-upc-scan me-2"></i>Inventaire</h2>
            <a href="/caisse" class="btn btn-outline-primary">
              <i class="bi bi-arrow-left me-2"></i>Retour caisse
            </a>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Scan caméra pour inventaire en magasin (smartphone). Utilisez Chrome ou Edge.
          </p>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger alert-dismissible show">
        {{ error }}
        <button type="button" class="btn-close" @click="error = null" aria-label="Fermer"></button>
      </div>

      <div v-if="!barcodeDetectorSupported" class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Votre navigateur ne supporte pas le scan par caméra. Utilisez Chrome ou Edge (sur smartphone ou PC).
      </div>

      <div class="row">
        <div class="col-lg-5 mb-4">
          <div class="card">
            <div class="card-header bg-success text-white">
              <h5 class="mb-0"><i class="bi bi-camera-video me-2"></i>Caméra</h5>
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
        </div>
        <div class="col-lg-7 mb-4">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>Articles scannés</h5>
              <span class="badge bg-primary">{{ scanned.length }}</span>
            </div>
            <div class="card-body p-0">
              <div v-if="scanned.length === 0" class="p-4 text-center text-muted">
                Scannez un code-barres pour l’ajouter à la liste.
              </div>
              <ul v-else class="list-group list-group-flush">
                <li
                  v-for="(item, index) in scanned"
                  :key="index"
                  class="list-group-item d-flex justify-content-between align-items-start"
                >
                  <div>
                    <code class="me-2">{{ item.code }}</code>
                    <span v-if="item.productName" class="text-success">{{ item.productName }}</span>
                    <span v-else class="text-muted">— produit inconnu</span>
                    <div class="small text-muted mt-1">{{ item.time }}</div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { fetchCaisseProduits } from '@/api';

const videoEl = ref(null);
const stream = ref(null);
const barcodeDetector = ref(null);
const scanIntervalId = ref(null);
const cameraDetecting = ref(false);
const lastScanTime = ref(0);
const cameraError = ref('');
const error = ref('');
const loading = ref(false);
const products = ref([]);
const scanned = ref([]);

const SCAN_COOLDOWN_MS = 1500;

const barcodeDetectorSupported = computed(() => typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function');

function normalizeEan(str) {
  return String(str || '').trim().replace(/\s/g, '');
}

function findProductByEan(ean) {
  const code = normalizeEan(ean);
  return products.value.find((p) => p.code_ean && normalizeEan(p.code_ean) === code);
}

function addScanned(code) {
  const product = findProductByEan(code);
  const timeStr = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  scanned.value.unshift({
    code,
    productName: product ? product.nom : null,
    time: timeStr,
  });
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
    cameraError.value = err.message || 'Impossible d’accéder à la caméra';
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
