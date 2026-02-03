<template>
  <div class="container-fluid px-3 mt-4">
    <div class="row">
      <div class="col-12">
        <h2 class="mb-4">Ajouter un nouveau catalogue</h2>
      </div>
    </div>

    <div class="row">
      <div class="col-12 col-md-10 offset-md-1">
        <div v-if="error" class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
        </div>

        <!-- Choix du type -->
        <div v-if="view === 'choice'" class="row g-3 mb-4">
          <div class="col-12 col-md-6">
            <div class="card h-100 border-primary" style="cursor: pointer;" @click="view = 'excel'">
              <div class="card-body text-center">
                <i class="bi bi-file-earmark-excel text-success" style="font-size: 3rem;"></i>
                <h5 class="card-title mt-3">Importer depuis Excel</h5>
                <p class="card-text text-muted">Chargez un fichier Excel existant (.xls, .xlsx)</p>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="card h-100 border-primary" style="cursor: pointer;" @click="view = 'new'">
              <div class="card-body text-center">
                <i class="bi bi-file-earmark-plus text-primary" style="font-size: 3rem;"></i>
                <h5 class="card-title mt-3">Créer un nouveau catalogue</h5>
                <p class="card-text text-muted">Depuis un ancien catalogue ou la base produits</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulaire Excel -->
        <div v-if="view === 'excel'" class="card mb-4">
          <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
            <h5 class="card-title mb-0">
              <i class="bi bi-file-earmark-excel me-2"></i>Importer un catalogue depuis Excel
            </h5>
            <button type="button" class="btn btn-light btn-sm" @click="view = 'choice'">
              <i class="bi bi-arrow-left me-1"></i>Retour au choix
            </button>
          </div>
          <div class="card-body">
            <form @submit.prevent="submitExcel">
              <input type="hidden" name="_csrf" :value="csrfToken">
              <div class="mb-3">
                <label for="excel" class="form-label">Fichier Excel du catalogue <span class="text-danger">*</span></label>
                <input id="excel" ref="excelInput" type="file" class="form-control" accept=".xls,.xlsx" required>
                <div class="form-text">Formats acceptés : .xls, .xlsx (Maximum 10 Mo)</div>
              </div>
              <div class="mb-3">
                <label for="excel_expiration" class="form-label">Date d'expiration</label>
                <input id="excel_expiration" v-model="excelForm.expiration_date" type="date" class="form-control">
              </div>
              <div class="mb-3">
                <label for="excel_description" class="form-label">Description</label>
                <textarea id="excel_description" v-model="excelForm.description" class="form-control" rows="3" placeholder="Description du catalogue (optionnel)"></textarea>
              </div>
              <button type="submit" class="btn btn-success" :disabled="uploading">
                <span v-if="uploading" class="spinner-border spinner-border-sm me-1"></span>
                <i class="bi bi-upload me-2"></i>Importer le catalogue
              </button>
            </form>
          </div>
        </div>

        <!-- Formulaire Nouveau catalogue -->
        <template v-if="view === 'new'">
          <!-- Étape 1: Infos générales -->
          <div v-if="newStep === 1" class="card mb-4">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">
                <i class="bi bi-1-circle me-2"></i>Informations générales du catalogue
              </h5>
              <button type="button" class="btn btn-light btn-sm" @click="view = 'choice'">
                <i class="bi bi-arrow-left me-1"></i>Retour au choix
              </button>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="catalogue_name" class="form-label">Nom du catalogue <span class="text-danger">*</span></label>
                <input id="catalogue_name" v-model="newForm.name" type="text" class="form-control" required placeholder="Ex: Catalogue Bio Janvier 2026">
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="catalogue_expiration" class="form-label">Date d'expiration</label>
                  <input id="catalogue_expiration" v-model="newForm.expiration_date" type="date" class="form-control">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="catalogue_livraison" class="form-label">Date de livraison</label>
                  <input id="catalogue_livraison" v-model="newForm.date_livraison" type="date" class="form-control">
                </div>
              </div>
              <div class="mb-3">
                <label for="catalogue_description" class="form-label">Description</label>
                <textarea id="catalogue_description" v-model="newForm.description" class="form-control" rows="3" placeholder="Description du catalogue (optionnel)"></textarea>
              </div>
              <button type="button" class="btn btn-primary" @click="newStep = 2">
                <i class="bi bi-arrow-right me-2"></i>Étape suivante : Choisir la source des produits
              </button>
            </div>
          </div>

          <!-- Étape 2: Source -->
          <div v-if="newStep === 2" class="card mb-4">
            <div class="card-header bg-primary text-white">
              <h5 class="card-title mb-0">
                <i class="bi bi-2-circle me-2"></i>Choisir la source des produits
              </h5>
            </div>
            <div class="card-body">
              <div class="row g-3 mb-4">
                <div class="col-12 col-md-6">
                  <div class="card h-100 border-success" style="cursor: pointer;" @click="sourceType = 'catalog'">
                    <div class="card-body text-center">
                      <i class="bi bi-files text-success" style="font-size: 2.5rem;"></i>
                      <h5 class="card-title mt-3">Reprendre un ancien catalogue</h5>
                      <p class="card-text text-muted">Importez tous les produits (avec prix) depuis un catalogue existant</p>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="card h-100 border-success" style="cursor: pointer;" @click="sourceType = 'empty'">
                    <div class="card-body text-center">
                      <i class="bi bi-basket text-success" style="font-size: 2.5rem;"></i>
                      <h5 class="card-title mt-3">Base de produits</h5>
                      <p class="card-text text-muted">Créer un catalogue vierge et ajouter des produits ensuite</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="sourceType === 'catalog'" class="mb-3">
                <label for="source_catalog_id" class="form-label">Catalogue source <span class="text-danger">*</span></label>
                <select id="source_catalog_id" v-model="newForm.source_catalog_id" class="form-select">
                  <option value="">-- Sélectionner un catalogue --</option>
                  <option v-for="cat in catalogues" :key="cat.id" :value="cat.id">
                    #{{ cat.id }} - {{ cat.originalname }} - Exp: {{ cat.expiration_formatted || 'Pas d\'expiration' }}
                  </option>
                </select>
                <button type="button" class="btn btn-success mt-2" :disabled="creating || !newForm.source_catalog_id" @click="createFromCatalog">
                  <span v-if="creating" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-plus-circle me-2"></i>Créer le catalogue
                </button>
              </div>

              <div v-if="sourceType === 'empty'" class="mb-3">
                <p class="text-muted">Un catalogue vierge sera créé. Vous pourrez ensuite ajouter des produits depuis la base de données dans la page d'édition.</p>
                <button type="button" class="btn btn-success" :disabled="creating" @click="createEmpty">
                  <span v-if="creating" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-plus-circle me-2"></i>Créer le catalogue vierge
                </button>
              </div>

              <button type="button" class="btn btn-outline-secondary mt-2" @click="newStep = 1">
                <i class="bi bi-arrow-left me-1"></i>Retour aux informations
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const view = ref('choice'); // choice | excel | new
const newStep = ref(1);
const sourceType = ref(null); // catalog | empty
const error = ref('');
const uploading = ref(false);
const creating = ref(false);
const catalogues = ref([]);

const excelForm = ref({
  expiration_date: '',
  description: '',
});
const newForm = ref({
  name: '',
  expiration_date: '',
  date_livraison: '',
  description: '',
  source_catalog_id: '',
});

const excelInput = ref(null);
const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  error.value = data.error || '';
  loadCatalogues();
});

async function loadCatalogues() {
  try {
    const res = await fetch('/api/admin/catalogues', { credentials: 'include' });
    const data = await res.json();
    if (data.success && data.catalogues) {
      catalogues.value = data.catalogues;
    }
  } catch (e) {
    console.error('Erreur chargement catalogues:', e);
  }
}

async function submitExcel() {
  const file = excelInput.value?.files?.[0];
  if (!file) {
    error.value = 'Veuillez sélectionner un fichier Excel.';
    return;
  }
  error.value = '';
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('_csrf', csrfToken.value);
    fd.append('excel', file);
    if (excelForm.value.expiration_date) fd.append('expiration_date', excelForm.value.expiration_date);
    if (excelForm.value.description) fd.append('description', excelForm.value.description);

    const res = await fetch('/admin/catalogues/upload', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.redirect) {
      window.location.href = data.redirect;
      return;
    }
    error.value = data.error || 'Erreur lors de l\'import.';
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    uploading.value = false;
  }
}

async function createEmpty() {
  if (!newForm.value.name?.trim()) {
    error.value = 'Veuillez renseigner le nom du catalogue.';
    return;
  }
  error.value = '';
  creating.value = true;
  try {
    const body = new URLSearchParams({
      _csrf: csrfToken.value,
      name: newForm.value.name.trim(),
      expiration_date: newForm.value.expiration_date || '',
      date_livraison: newForm.value.date_livraison || '',
      description: newForm.value.description || '',
    });
    const res = await fetch('/admin/catalogues/create-empty', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.catalogId) {
      window.location.href = `/admin/catalogues/${data.catalogId}/edit`;
      return;
    }
    error.value = data.error || 'Erreur lors de la création.';
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    creating.value = false;
  }
}

async function createFromCatalog() {
  if (!newForm.value.name?.trim()) {
    error.value = 'Veuillez renseigner le nom du catalogue.';
    return;
  }
  if (!newForm.value.source_catalog_id) {
    error.value = 'Veuillez sélectionner un catalogue source.';
    return;
  }
  if (!confirm(`Créer le catalogue "${newForm.value.name}" en important tous les produits du catalogue #${newForm.value.source_catalog_id} ?`)) {
    return;
  }
  error.value = '';
  creating.value = true;
  try {
    const body = new URLSearchParams({
      _csrf: csrfToken.value,
      name: newForm.value.name.trim(),
      expiration_date: newForm.value.expiration_date || '',
      date_livraison: newForm.value.date_livraison || '',
      description: newForm.value.description || '',
      source_catalog_id: newForm.value.source_catalog_id,
    });
    const res = await fetch('/admin/catalogues/create-from-catalog', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.catalogId) {
      window.location.href = `/admin/catalogues/${data.catalogId}/edit`;
      return;
    }
    error.value = data.error || 'Erreur lors de la création.';
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    creating.value = false;
  }
}
</script>
