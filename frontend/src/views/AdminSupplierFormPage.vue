<template>
  <div class="container-fluid px-3 mt-4">
    <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    </div>
    <div v-if="successMessage" class="alert alert-success alert-dismissible fade show">
      <i class="bi bi-check-circle me-2"></i>{{ successMessage }}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <h2 class="mb-4">{{ isEdit ? 'Modifier un fournisseur' : 'Créer un nouveau fournisseur' }}</h2>

    <div class="row">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <form @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="nom" class="form-label">Nom du fournisseur <span class="text-danger">*</span></label>
                  <input id="nom" v-model="form.nom" type="text" class="form-control" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="contact_nom" class="form-label">Nom du contact</label>
                  <input id="contact_nom" v-model="form.contact_nom" type="text" class="form-control">
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="email" class="form-label">Email</label>
                  <input id="email" v-model="form.email" type="email" class="form-control">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="telephone" class="form-label">Téléphone</label>
                  <input id="telephone" v-model="form.telephone" type="text" class="form-control">
                </div>
              </div>

              <div class="mb-3">
                <label for="adresse" class="form-label">Adresse</label>
                <input id="adresse" v-model="form.adresse" type="text" class="form-control">
              </div>

              <div class="row">
                <div class="col-md-4 mb-3">
                  <label for="code_postal" class="form-label">Code postal</label>
                  <input id="code_postal" v-model="form.code_postal" type="text" class="form-control">
                </div>
                <div class="col-md-8 mb-3">
                  <label for="ville" class="form-label">Ville</label>
                  <input id="ville" v-model="form.ville" type="text" class="form-control">
                </div>
              </div>

              <div class="mb-3">
                <label for="siret" class="form-label">SIRET</label>
                <input id="siret" v-model="form.siret" type="text" class="form-control">
              </div>

              <div class="mb-3">
                <label for="notes" class="form-label">Notes</label>
                <textarea id="notes" v-model="form.notes" class="form-control" rows="3"></textarea>
              </div>

              <div class="mb-3">
                <div class="form-check">
                  <input
                    id="is_active"
                    v-model="form.is_active"
                    class="form-check-input"
                    type="checkbox"
                    :true-value="1"
                    :false-value="0"
                  >
                  <label class="form-check-label" for="is_active">Fournisseur actif</label>
                </div>
              </div>

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-check-lg me-2"></i>
                  {{ isEdit ? 'Enregistrer les modifications' : 'Créer le fournisseur' }}
                </button>
                <a :href="isEdit && supplierId ? `/admin/suppliers/${supplierId}` : '/admin/suppliers'" class="btn btn-outline-secondary">
                  <i class="bi bi-x-lg me-2"></i>Annuler
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div v-if="isEdit && supplierId" class="col-12 col-lg-4 mt-3 mt-lg-0">
        <div class="card">
          <div class="card-header bg-danger text-white">
            <h5 class="card-title mb-0">Zone de danger</h5>
          </div>
          <div class="card-body">
            <p class="text-muted">
              <strong>Attention :</strong> La suppression d'un fournisseur est irréversible.
            </p>
            <p class="text-muted small">
              Pour simplement désactiver le fournisseur, utilisez la case à cocher "Fournisseur actif" ci-dessus.
            </p>
            <form
              method="POST"
              :action="`/admin/suppliers/${supplierId}/delete`"
              @submit="onDeleteSubmit"
            >
              <input type="hidden" name="_csrf" :value="csrfToken">
              <button type="submit" class="btn btn-danger w-100">
                <i class="bi bi-trash me-2"></i>Supprimer le fournisseur
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const form = ref({
  nom: '',
  contact_nom: '',
  email: '',
  telephone: '',
  adresse: '',
  code_postal: '',
  ville: '',
  siret: '',
  notes: '',
  is_active: 1,
});
const supplierId = ref(null);
const action = ref('add');
const error = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');
const isEdit = computed(() => action.value === 'edit');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  action.value = data.action || 'add';
  supplierId.value = data.supplierId || data.supplier?.id || null;
  errorMessage.value = data.errorMessage || '';
  successMessage.value = data.successMessage || '';

  if (data.supplier) {
    form.value.nom = data.supplier.nom || '';
    form.value.contact_nom = data.supplier.contact_nom || '';
    form.value.email = data.supplier.email || '';
    form.value.telephone = data.supplier.telephone || '';
    form.value.adresse = data.supplier.adresse || '';
    form.value.code_postal = data.supplier.code_postal || '';
    form.value.ville = data.supplier.ville || '';
    form.value.siret = data.supplier.siret || '';
    form.value.notes = data.supplier.notes || '';
    form.value.is_active = data.supplier.is_active ? 1 : 0;
  }
});

function onDeleteSubmit(e) {
  if (!confirm('⚠️ ATTENTION : Êtes-vous sûr de vouloir SUPPRIMER définitivement ce fournisseur ?\n\nCette action est IRRÉVERSIBLE.')) {
    e.preventDefault();
  }
}

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const body = new URLSearchParams({
      nom: form.value.nom.trim(),
      contact_nom: form.value.contact_nom || '',
      email: form.value.email || '',
      telephone: form.value.telephone || '',
      adresse: form.value.adresse || '',
      code_postal: form.value.code_postal || '',
      ville: form.value.ville || '',
      siret: form.value.siret || '',
      notes: form.value.notes || '',
      is_active: form.value.is_active ? '1' : '0',
      _csrf: csrfToken.value,
    });
    const url = isEdit.value ? `/admin/suppliers/${supplierId.value}` : '/admin/suppliers';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.redirect) {
      window.location.href = data.redirect;
      return;
    }
    error.value = data.error || 'Une erreur est survenue.';
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    loading.value = false;
  }
}
</script>
