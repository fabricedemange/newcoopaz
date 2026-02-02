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

    <h2 class="mb-4">{{ isEdit ? 'Modifier une catégorie' : 'Créer une nouvelle catégorie' }}</h2>

    <div class="row">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <form @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">

              <div class="mb-3">
                <label for="nom" class="form-label">Nom de la catégorie <span class="text-danger">*</span></label>
                <input
                  id="nom"
                  v-model="form.nom"
                  type="text"
                  class="form-control"
                  required
                >
              </div>

              <div class="mb-3">
                <label for="parent_id" class="form-label">Catégorie parente</label>
                <select id="parent_id" v-model="form.parent_id" class="form-select">
                  <option value="">Aucune (catégorie principale)</option>
                  <option
                    v-for="cat in parentOptions"
                    :key="cat.id"
                    :value="cat.id"
                  >
                    {{ cat.nom }}
                  </option>
                </select>
                <small class="form-text text-muted">Laissez vide pour créer une catégorie principale</small>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="couleur" class="form-label">Couleur</label>
                  <input
                    id="couleur"
                    v-model="form.couleur"
                    type="color"
                    class="form-control form-control-color"
                  >
                  <small class="form-text text-muted">Couleur d'affichage du badge</small>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="ordre" class="form-label">Ordre d'affichage</label>
                  <input
                    id="ordre"
                    v-model.number="form.ordre"
                    type="number"
                    class="form-control"
                    min="0"
                  >
                  <small class="form-text text-muted">Plus le nombre est petit, plus la catégorie apparaît en haut</small>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Icône Bootstrap</label>
                <div class="dropdown">
                  <button
                    class="btn btn-outline-secondary dropdown-toggle w-100 text-start d-flex align-items-center justify-content-between"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <span v-if="form.icon">
                      <i :class="form.icon" class="me-2" style="font-size: 1.2rem;"></i>
                      <span class="text-muted small">{{ form.icon }}</span>
                    </span>
                    <span v-else class="text-muted">Choisir une icône...</span>
                  </button>
                  <ul class="dropdown-menu w-100" style="max-height: 400px; overflow-y: auto;">
                    <li><a class="dropdown-item" href="#" @click.prevent="form.icon = ''">Aucune icône</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li class="dropdown-header">Aliments et Nature</li>
                    <li v-for="opt in iconOptions" :key="opt.value">
                      <a class="dropdown-item" href="#" @click.prevent="form.icon = opt.value">
                        <i v-if="opt.value" :class="opt.value" class="me-2" style="font-size: 1.2rem;"></i>
                        {{ opt.label }}
                      </a>
                    </li>
                  </ul>
                </div>
                <small class="form-text text-muted d-block mt-2">
                  <a href="https://icons.getbootstrap.com/" target="_blank" rel="noopener">Consulter toutes les icônes Bootstrap</a>
                </small>
              </div>

              <div class="mb-3">
                <label for="description" class="form-label">Description</label>
                <textarea
                  id="description"
                  v-model="form.description"
                  class="form-control"
                  rows="3"
                ></textarea>
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
                  <label class="form-check-label" for="is_active">Catégorie active</label>
                </div>
              </div>

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-check-lg me-2"></i>
                  {{ isEdit ? 'Enregistrer les modifications' : 'Créer la catégorie' }}
                </button>
                <a href="/admin/categories" class="btn btn-outline-secondary">
                  <i class="bi bi-x-lg me-2"></i>Annuler
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div v-if="isEdit && categoryId" class="col-12 col-lg-4 mt-3 mt-lg-0">
        <div class="card mb-3">
          <div class="card-header">
            <h5 class="card-title mb-0">Aperçu</h5>
          </div>
          <div class="card-body">
            <p>Badge:</p>
            <span class="badge" :style="{ backgroundColor: form.couleur || '#6c757d', fontSize: '1rem' }">
              <i v-if="form.icon" :class="form.icon" class="me-1"></i>
              {{ form.nom || 'Nom' }}
            </span>
          </div>
        </div>

        <div class="card">
          <div class="card-header bg-danger text-white">
            <h5 class="card-title mb-0">Zone de danger</h5>
          </div>
          <div class="card-body">
            <p class="text-muted">
              <strong>Attention :</strong> La suppression d'une catégorie est irréversible.
            </p>
            <p class="text-muted small">La suppression sera refusée si des produits ou sous-catégories y sont rattachés.</p>
            <form
              method="POST"
              :action="`/admin/categories/${categoryId}/delete`"
              @submit="onDeleteSubmit"
            >
              <input type="hidden" name="_csrf" :value="csrfToken">
              <button type="submit" class="btn btn-danger w-100">
                <i class="bi bi-trash me-2"></i>Supprimer la catégorie
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
  description: '',
  parent_id: '',
  ordre: 0,
  couleur: '#6c757d',
  icon: '',
  is_active: 1,
});
const allCategories = ref([]);
const categoryId = ref(null);
const action = ref('add');
const error = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');
const isEdit = computed(() => action.value === 'edit');

const parentOptions = computed(() => {
  const list = allCategories.value || [];
  if (!categoryId.value) return list;
  return list.filter(c => Number(c.id) !== Number(categoryId.value));
});

const iconOptions = [
  { value: 'bi bi-basket', label: 'Panier (fruits/légumes)' },
  { value: 'bi bi-apple', label: 'Pomme (fruits)' },
  { value: 'bi bi-egg', label: 'Œuf' },
  { value: 'bi bi-cup-hot', label: 'Tasse chaude' },
  { value: 'bi bi-cup-straw', label: 'Boisson' },
  { value: 'bi bi-droplet', label: 'Goutte' },
  { value: 'bi bi-flower1', label: 'Fleur (aromates)' },
  { value: 'bi bi-tree', label: 'Arbre (fruits à coque)' },
  { value: 'bi bi-snow', label: 'Flocon (surgelés)' },
  { value: 'bi bi-fire', label: 'Feu' },
  { value: 'bi bi-box-seam', label: 'Boîte' },
  { value: 'bi bi-bag', label: 'Sac (vrac)' },
  { value: 'bi bi-cart', label: 'Caddie' },
  { value: 'bi bi-star', label: 'Étoile' },
  { value: 'bi bi-tag', label: 'Étiquette' },
  { value: 'bi bi-shop', label: 'Boutique' },
  { value: 'bi bi-truck', label: 'Camion' },
];

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  action.value = data.action || 'add';
  allCategories.value = data.allCategories || [];
  categoryId.value = data.categoryId || data.category?.id || null;
  errorMessage.value = data.errorMessage || '';
  successMessage.value = data.successMessage || '';

  if (data.category) {
    form.value.nom = data.category.nom || '';
    form.value.description = data.category.description || '';
    form.value.parent_id = data.category.parent_id != null ? String(data.category.parent_id) : '';
    form.value.ordre = data.category.ordre ?? 0;
    form.value.couleur = data.category.couleur || '#6c757d';
    form.value.icon = data.category.icon || '';
    form.value.is_active = data.category.is_active ? 1 : 0;
  }
});

function onDeleteSubmit(e) {
  if (!confirm('⚠️ ATTENTION : Êtes-vous sûr de vouloir SUPPRIMER définitivement cette catégorie ?\n\nCette action est IRRÉVERSIBLE.')) {
    e.preventDefault();
  }
}

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const body = new URLSearchParams({
      nom: form.value.nom.trim(),
      description: form.value.description || '',
      parent_id: form.value.parent_id || '',
      ordre: String(form.value.ordre ?? 0),
      couleur: form.value.couleur || '',
      icon: form.value.icon || '',
      is_active: form.value.is_active ? '1' : '0',
      _csrf: csrfToken.value,
    });
    const url = isEdit.value ? `/admin/categories/${categoryId.value}` : '/admin/categories';
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
