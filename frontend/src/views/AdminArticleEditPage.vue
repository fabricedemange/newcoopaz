<template>
  <div class="container-fluid px-3 mt-4">
    <div v-if="!article" class="alert alert-warning">Article non trouvé.</div>
    <template v-else>
      <div class="row">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
            <h2 class="mb-0">Éditer un article</h2>
            <BackButton />
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12 col-md-8 offset-md-2">
          <div v-if="error" class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
          </div>

          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">Informations de l'article</h5>
            </div>
            <div class="card-body">
              <div v-if="article.produit" class="mb-3">
                <label class="form-label">Produit</label>
                <p class="form-control-plaintext mb-0">{{ article.produit }}</p>
                <small class="form-text text-muted">Modifiable dans la fiche produit</small>
              </div>
              <div v-if="article.description != null" class="mb-3">
                <label class="form-label">Description</label>
                <p class="form-control-plaintext mb-0">{{ article.description || '-' }}</p>
              </div>

              <form @submit.prevent="submit">
                <input type="hidden" name="_csrf" :value="csrfToken">
                <div class="mb-3">
                  <label for="prix" class="form-label">Prix <span class="text-danger">*</span></label>
                  <div class="input-group">
                    <input id="prix" v-model.number="form.prix" type="number" step="0.01" class="form-control" required placeholder="0.00">
                    <span class="input-group-text">€</span>
                  </div>
                </div>
                <div class="mb-3">
                  <label for="unite" class="form-label">Qté mini <span class="text-danger">*</span></label>
                  <input id="unite" v-model="form.unite" type="text" class="form-control" required placeholder="1">
                  <div class="form-text">Unité ou quantité minimale commandable</div>
                </div>
                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-success" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                    Enregistrer les modifications
                  </button>
                  <a :href="`/admin/catalogues/${catalogueId}/edit`" class="btn btn-secondary">Annuler</a>
                </div>
              </form>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-2 mt-3">
            <a :href="`/admin/catalogues/${catalogueId}/edit`" class="btn btn-outline-secondary">
              Retour à l'édition du catalogue
            </a>
            <a href="/admin/catalogues/vue" class="btn btn-outline-secondary">
              Retour à la liste des catalogues
            </a>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';

const article = ref(null);
const catalogueId = ref(null);
const error = ref('');
const loading = ref(false);
const form = ref({ prix: '', unite: '' });

const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  article.value = data.article || null;
  catalogueId.value = data.catalogueId || data.catalogue_id || null;
  error.value = data.error || '';
  if (data.article) {
    form.value.prix = data.article.prix ?? '';
    form.value.unite = data.article.unite ?? '';
  }
});

async function submit() {
  if (!article.value || !catalogueId.value) return;
  error.value = '';
  loading.value = true;
  try {
    const body = new URLSearchParams({
      _csrf: csrfToken.value,
      prix: String(form.value.prix ?? ''),
      unite: String(form.value.unite ?? ''),
    });
    const res = await fetch(`/admin/catalogues/${catalogueId.value}/articles/${article.value.id}/edit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
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
