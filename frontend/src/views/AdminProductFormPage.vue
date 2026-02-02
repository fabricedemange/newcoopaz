<template>
  <div class="container-fluid px-3 mt-4">
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <h2 class="mb-4">{{ isEdit ? 'Modifier un produit' : 'Créer un nouveau produit' }}</h2>

    <div class="row">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <form @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">

              <h5 class="mb-3">Informations principales</h5>
              <div class="mb-3">
                <label for="nom" class="form-label">Nom du produit <span class="text-danger">*</span></label>
                <input id="nom" v-model="form.nom" type="text" class="form-control" required>
              </div>
              <div class="mb-3">
                <label for="description" class="form-label">Description</label>
                <textarea id="description" v-model="form.description" class="form-control" rows="3"></textarea>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="category_id" class="form-label">Catégorie <span class="text-danger">*</span></label>
                  <select id="category_id" v-model="form.category_id" class="form-select" required>
                    <option value="">Sélectionner une catégorie</option>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.nom }}</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label for="supplier_id" class="form-label">Fournisseur</label>
                  <select id="supplier_id" v-model="form.supplier_id" class="form-select">
                    <option value="">Aucun fournisseur</option>
                    <option v-for="sup in suppliers" :key="sup.id" :value="sup.id">{{ sup.nom }}</option>
                  </select>
                </div>
              </div>

              <hr class="my-4">
              <h5 class="mb-3">Références et codes</h5>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="reference_fournisseur" class="form-label">Référence fournisseur</label>
                  <input id="reference_fournisseur" v-model="form.reference_fournisseur" type="text" class="form-control">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="code_ean" class="form-label">Code EAN / Code-barres</label>
                  <input id="code_ean" v-model="form.code_ean" type="text" class="form-control">
                </div>
              </div>

              <hr class="my-4">
              <h5 class="mb-3">Informations complémentaires</h5>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label for="conditionnement" class="form-label">Conditionnement</label>
                  <input id="conditionnement" v-model="form.conditionnement" type="text" class="form-control" placeholder="Par 6, Au kilo...">
                </div>
                <div class="col-md-4 mb-3">
                  <label for="unite" class="form-label">Unité de mesure</label>
                  <select id="unite" v-model="form.unite" class="form-select" required>
                    <option value="Pièce">Pièce</option>
                    <option value="Kilo">Kilo</option>
                    <option value="Litre">Litre</option>
                    <option value="Unite">Unité</option>
                  </select>
                </div>
                <div class="col-md-4 mb-3">
                  <label for="quantite_min" class="form-label">Quantité minimale</label>
                  <input id="quantite_min" v-model.number="form.quantite_min" type="number" class="form-control" min="0.001" step="0.001" required>
                  <small class="form-text text-muted">Pas d'incrément (ex: 1, 0.5, 0.001)</small>
                </div>
              </div>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label for="prix" class="form-label">Prix (€)</label>
                  <input id="prix" v-model.number="form.prix" type="number" class="form-control" min="0" step="0.01">
                </div>
                <div class="col-md-4 mb-3">
                  <label for="dlc_jours" class="form-label">DLC (jours)</label>
                  <input id="dlc_jours" v-model.number="form.dlc_jours" type="number" class="form-control" min="0">
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="origine" class="form-label">Origine</label>
                  <input id="origine" v-model="form.origine" type="text" class="form-control" placeholder="France, Italie...">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="label" class="form-label">Labels</label>
                  <input id="label" v-model="form.label" type="text" class="form-control" placeholder="Bio, AOP, IGP...">
                </div>
              </div>
              <div class="mb-3">
                <label for="allergenes" class="form-label">Allergènes</label>
                <input id="allergenes" v-model="form.allergenes" type="text" class="form-control" placeholder="Gluten, Lactose...">
              </div>

              <hr class="my-4">
              <h5 class="mb-3">Image</h5>
              <div v-if="isEdit && form.image_url" class="mb-3">
                <label class="form-label">Image actuelle</label>
                <div>
                  <img :src="form.image_url" :alt="form.nom" class="img-thumbnail" style="max-width: 200px; max-height: 200px;">
                </div>
              </div>
              <div class="mb-3">
                <label for="image" class="form-label">
                  {{ isEdit && form.image_url ? "Remplacer l'image" : 'Ajouter une image' }}
                </label>
                <input
                  ref="imageInput"
                  id="image"
                  type="file"
                  class="form-control"
                  accept="image/*"
                  @change="onImageChange"
                >
              </div>

              <div class="mb-3">
                <div class="form-check">
                  <input id="is_active" v-model="form.is_active" class="form-check-input" type="checkbox" :true-value="1" :false-value="0">
                  <label class="form-check-label" for="is_active">Produit actif</label>
                </div>
              </div>

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-check-lg me-2"></i>
                  {{ isEdit ? 'Enregistrer les modifications' : 'Créer le produit' }}
                </button>
                <a :href="isEdit && productId ? `/admin/products/${productId}` : '/admin/products'" class="btn btn-outline-secondary">
                  <i class="bi bi-x-lg me-2"></i>Annuler
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div v-if="isEdit && productId" class="col-12 col-lg-4 mt-3 mt-lg-0">
        <div class="card">
          <div class="card-header bg-danger text-white">
            <h5 class="card-title mb-0">Zone de danger</h5>
          </div>
          <div class="card-body">
            <p class="text-muted">La désactivation d'un produit le masquera des catalogues.</p>
            <form method="POST" :action="`/admin/products/${productId}/delete`" @submit="onDeleteSubmit">
              <input type="hidden" name="_csrf" :value="csrfToken">
              <button type="submit" class="btn btn-danger w-100">
                <i class="bi bi-trash me-2"></i>Désactiver le produit
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
  category_id: '',
  supplier_id: '',
  reference_fournisseur: '',
  code_ean: '',
  conditionnement: '',
  unite: 'Pièce',
  quantite_min: 1,
  prix: '',
  dlc_jours: '',
  origine: '',
  label: '',
  allergenes: '',
  image_url: '',
  is_active: 1,
});
const categories = ref([]);
const suppliers = ref([]);
const productId = ref(null);
const action = ref('add');
const error = ref('');
const loading = ref(false);
const imageFile = ref(null);
const imageInput = ref(null);

const csrfToken = computed(() => window.CSRF_TOKEN || '');
const isEdit = computed(() => action.value === 'edit');

function onImageChange(e) {
  const file = e.target.files?.[0];
  imageFile.value = file || null;
}

function onDeleteSubmit(e) {
  if (!confirm('Êtes-vous sûr de vouloir désactiver ce produit ?')) e.preventDefault();
}

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  action.value = data.action || 'add';
  productId.value = data.productId || data.product?.id || null;
  categories.value = data.categories || [];
  suppliers.value = data.suppliers || [];

  if (data.product) {
    const p = data.product;
    form.value = {
      nom: p.nom || '',
      description: p.description || '',
      category_id: p.category_id != null ? String(p.category_id) : '',
      supplier_id: p.supplier_id != null ? String(p.supplier_id) : '',
      reference_fournisseur: p.reference_fournisseur || '',
      code_ean: p.code_ean || '',
      conditionnement: p.conditionnement || '',
      unite: p.unite || 'Pièce',
      quantite_min: p.quantite_min ?? 1,
      prix: p.prix ?? '',
      dlc_jours: p.dlc_jours ?? '',
      origine: p.origine || '',
      label: p.label || '',
      allergenes: p.allergenes || '',
      image_url: p.image_url || '',
      is_active: p.is_active ? 1 : 0,
    };
  }
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const url = isEdit.value ? `/admin/products/${productId.value}` : '/admin/products';
    const opts = { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } };

    if (isEdit.value && imageFile.value) {
      const fd = new FormData();
      fd.append('_csrf', csrfToken.value);
      fd.append('nom', form.value.nom.trim());
      fd.append('description', form.value.description || '');
      fd.append('category_id', form.value.category_id || '');
      fd.append('supplier_id', form.value.supplier_id || '');
      fd.append('reference_fournisseur', form.value.reference_fournisseur || '');
      fd.append('code_ean', form.value.code_ean || '');
      fd.append('conditionnement', form.value.conditionnement || '');
      fd.append('unite', form.value.unite || 'Pièce');
      fd.append('quantite_min', String(form.value.quantite_min ?? 1));
      fd.append('prix', String(form.value.prix ?? 0));
      fd.append('dlc_jours', form.value.dlc_jours !== '' && form.value.dlc_jours != null ? String(form.value.dlc_jours) : '');
      fd.append('origine', form.value.origine || '');
      fd.append('label', form.value.label || '');
      fd.append('allergenes', form.value.allergenes || '');
      fd.append('is_active', form.value.is_active ? '1' : '0');
      fd.append('image', imageFile.value);
      opts.body = fd;
    } else {
      const body = new URLSearchParams({
        _csrf: csrfToken.value,
        nom: form.value.nom.trim(),
        description: form.value.description || '',
        category_id: form.value.category_id || '',
        supplier_id: form.value.supplier_id || '',
        reference_fournisseur: form.value.reference_fournisseur || '',
        code_ean: form.value.code_ean || '',
        conditionnement: form.value.conditionnement || '',
        unite: form.value.unite || 'Pièce',
        quantite_min: String(form.value.quantite_min ?? 1),
        prix: String(form.value.prix ?? 0),
        dlc_jours: form.value.dlc_jours !== '' && form.value.dlc_jours != null ? String(form.value.dlc_jours) : '',
        origine: form.value.origine || '',
        label: form.value.label || '',
        allergenes: form.value.allergenes || '',
        is_active: form.value.is_active ? '1' : '0',
      });
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.body = body.toString();
    }

    const res = await fetch(url, opts);
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
