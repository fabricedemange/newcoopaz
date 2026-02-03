<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <form @submit.prevent="submit">
      <input type="hidden" name="_csrf" :value="csrfToken">

      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="sup-nom" class="form-label">Nom du fournisseur <span class="text-danger">*</span></label>
          <input id="sup-nom" v-model="form.nom" type="text" class="form-control" required>
        </div>
        <div class="col-md-6 mb-3">
          <label for="sup-contact_nom" class="form-label">Nom du contact</label>
          <input id="sup-contact_nom" v-model="form.contact_nom" type="text" class="form-control">
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="sup-email" class="form-label">Email</label>
          <input id="sup-email" v-model="form.email" type="email" class="form-control">
        </div>
        <div class="col-md-6 mb-3">
          <label for="sup-telephone" class="form-label">Téléphone</label>
          <input id="sup-telephone" v-model="form.telephone" type="text" class="form-control">
        </div>
      </div>

      <div class="mb-3">
        <label for="sup-adresse" class="form-label">Adresse</label>
        <input id="sup-adresse" v-model="form.adresse" type="text" class="form-control">
      </div>

      <div class="row">
        <div class="col-md-4 mb-3">
          <label for="sup-code_postal" class="form-label">Code postal</label>
          <input id="sup-code_postal" v-model="form.code_postal" type="text" class="form-control">
        </div>
        <div class="col-md-8 mb-3">
          <label for="sup-ville" class="form-label">Ville</label>
          <input id="sup-ville" v-model="form.ville" type="text" class="form-control">
        </div>
      </div>

      <div class="mb-3">
        <label for="sup-siret" class="form-label">SIRET</label>
        <input id="sup-siret" v-model="form.siret" type="text" class="form-control">
      </div>

      <div class="mb-3">
        <label for="sup-notes" class="form-label">Notes</label>
        <textarea id="sup-notes" v-model="form.notes" class="form-control" rows="3"></textarea>
      </div>

      <div class="mb-3">
        <div class="form-check">
          <input
            id="sup-is_active"
            v-model="form.is_active"
            class="form-check-input"
            type="checkbox"
            :true-value="1"
            :false-value="0"
          >
          <label class="form-check-label" for="sup-is_active">Fournisseur actif</label>
        </div>
      </div>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
          <i class="bi bi-check-lg me-2"></i>
          {{ isEdit ? 'Enregistrer les modifications' : 'Créer le fournisseur' }}
        </button>
        <button
          v-if="modal"
          type="button"
          class="btn btn-outline-secondary"
          :disabled="loading"
          @click="$emit('cancel')"
        >
          <i class="bi bi-x-lg me-2"></i>Annuler
        </button>
        <a v-else :href="isEdit && supplierId ? `/admin/suppliers/${supplierId}` : '/admin/suppliers'" class="btn btn-outline-secondary">
          <i class="bi bi-x-lg me-2"></i>Annuler
        </a>
      </div>
    </form>

    <!-- Zone danger (édition, page complète uniquement) -->
    <div v-if="isEdit && supplierId && !modal" class="card mt-4 border-danger">
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
        <form method="POST" :action="`/admin/suppliers/${supplierId}/delete`" @submit="onDeleteSubmit">
          <input type="hidden" name="_csrf" :value="csrfToken">
          <button type="submit" class="btn btn-danger w-100">
            <i class="bi bi-trash me-2"></i>Supprimer le fournisseur
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  supplier: { type: Object, default: null },
  supplierId: { type: [Number, String], default: null },
  modal: { type: Boolean, default: false },
  csrfToken: { type: String, default: () => window.CSRF_TOKEN || '' },
});

const emit = defineEmits(['success', 'cancel']);

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
const error = ref('');
const loading = ref(false);

const isEdit = computed(() => !!props.supplierId && !!props.supplier);

function initForm() {
  if (props.supplier) {
    const s = props.supplier;
    form.value = {
      nom: s.nom || '',
      contact_nom: s.contact_nom || '',
      email: s.email || '',
      telephone: s.telephone || '',
      adresse: s.adresse || '',
      code_postal: s.code_postal || '',
      ville: s.ville || '',
      siret: s.siret || '',
      notes: s.notes || '',
      is_active: s.is_active ? 1 : 0,
    };
  } else {
    form.value = {
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
    };
  }
  error.value = '';
}

watch(() => [props.supplier, props.supplierId], initForm, { immediate: true });

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
      _csrf: props.csrfToken,
    });
    const url = isEdit.value ? `/admin/suppliers/${props.supplierId}` : '/admin/suppliers';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      const m = data.redirect && data.redirect.match(/\/admin\/suppliers\/(\d+)/);
      const id = m ? parseInt(m[1], 10) : null;
      emit('success', id);
      if (!props.modal && data.redirect) {
        window.location.href = data.redirect;
      }
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
