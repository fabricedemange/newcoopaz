<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <form @submit.prevent="submit">
      <input type="hidden" name="_csrf" :value="csrfToken">

      <div class="mb-3">
        <label for="cat-nom" class="form-label">Nom de la catégorie <span class="text-danger">*</span></label>
        <input id="cat-nom" v-model="form.nom" type="text" class="form-control" required>
      </div>

      <div class="mb-3">
        <label for="cat-parent_id" class="form-label">Catégorie parente</label>
        <select id="cat-parent_id" v-model="form.parent_id" class="form-select">
          <option value="">Aucune (catégorie principale)</option>
          <option v-for="cat in parentOptions" :key="cat.id" :value="cat.id">{{ cat.nom }}</option>
        </select>
        <small class="form-text text-muted">Laissez vide pour créer une catégorie principale</small>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="cat-couleur" class="form-label">Couleur</label>
          <input id="cat-couleur" v-model="form.couleur" type="color" class="form-control form-control-color">
          <small class="form-text text-muted">Couleur d'affichage du badge</small>
        </div>
        <div class="col-md-6 mb-3">
          <label for="cat-ordre" class="form-label">Ordre d'affichage</label>
          <input id="cat-ordre" v-model.number="form.ordre" type="number" class="form-control" min="0">
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
        <label for="cat-description" class="form-label">Description</label>
        <textarea id="cat-description" v-model="form.description" class="form-control" rows="3"></textarea>
      </div>

      <div class="mb-3">
        <div class="form-check">
          <input
            id="cat-is_active"
            v-model="form.is_active"
            class="form-check-input"
            type="checkbox"
            :true-value="1"
            :false-value="0"
          >
          <label class="form-check-label" for="cat-is_active">Catégorie active</label>
        </div>
      </div>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
          <i class="bi bi-check-lg me-2"></i>
          {{ isEdit ? 'Enregistrer les modifications' : 'Créer la catégorie' }}
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
        <a v-else href="/admin/categories" class="btn btn-outline-secondary">
          <i class="bi bi-x-lg me-2"></i>Annuler
        </a>
      </div>
    </form>

    <!-- Zone danger (édition, page complète uniquement) -->
    <div v-if="isEdit && categoryId && !modal" class="card mt-4 border-danger">
      <div class="card-header bg-danger text-white">
        <h5 class="card-title mb-0">Zone de danger</h5>
      </div>
      <div class="card-body">
        <p class="text-muted">
          <strong>Attention :</strong> La suppression d'une catégorie est irréversible.
        </p>
        <p class="text-muted small">La suppression sera refusée si des produits ou sous-catégories y sont rattachés.</p>
        <form method="POST" :action="`/admin/categories/${categoryId}/delete`" @submit="onDeleteSubmit">
          <input type="hidden" name="_csrf" :value="csrfToken">
          <button type="submit" class="btn btn-danger w-100">
            <i class="bi bi-trash me-2"></i>Supprimer la catégorie
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  allCategories: { type: Array, default: () => [] },
  category: { type: Object, default: null },
  categoryId: { type: [Number, String], default: null },
  modal: { type: Boolean, default: false },
  csrfToken: { type: String, default: () => window.CSRF_TOKEN || '' },
});

const emit = defineEmits(['success', 'cancel']);

const form = ref({
  nom: '',
  description: '',
  parent_id: '',
  ordre: 0,
  couleur: '#6c757d',
  icon: '',
  is_active: 1,
});
const error = ref('');
const loading = ref(false);

const isEdit = computed(() => !!props.categoryId && !!props.category);

const parentOptions = computed(() => {
  const list = props.allCategories || [];
  if (!props.categoryId) return list;
  return list.filter((c) => Number(c.id) !== Number(props.categoryId));
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

function initForm() {
  if (props.category) {
    const c = props.category;
    form.value = {
      nom: c.nom || '',
      description: c.description || '',
      parent_id: c.parent_id != null ? String(c.parent_id) : '',
      ordre: c.ordre ?? 0,
      couleur: c.couleur || '#6c757d',
      icon: c.icon || '',
      is_active: c.is_active ? 1 : 0,
    };
  } else {
    form.value = {
      nom: '',
      description: '',
      parent_id: '',
      ordre: 0,
      couleur: '#6c757d',
      icon: '',
      is_active: 1,
    };
  }
  error.value = '';
}

watch(() => [props.category, props.categoryId], initForm, { immediate: true });

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
      _csrf: props.csrfToken,
    });
    const url = isEdit.value ? `/admin/categories/${props.categoryId}` : '/admin/categories';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      emit('success', data.id ?? null);
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
