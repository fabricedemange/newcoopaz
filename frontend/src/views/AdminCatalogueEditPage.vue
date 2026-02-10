<template>
  <div class="container-fluid px-3 mt-4">
    <div v-if="!catalogue" class="alert alert-warning">Catalogue non trouvé.</div>
    <template v-else>
      <div class="row">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
            <h2 class="mb-0">Éditer le catalogue</h2>
            <BackButton />
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      </div>

      <!-- Formulaire infos catalogue -->
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="card-title mb-0">Informations du catalogue</h5>
          <small class="text-muted">{{ saveStatus }}</small>
        </div>
        <div class="card-body">
          <form @submit.prevent="saveMetadata">
            <input type="hidden" name="_csrf" :value="csrfToken">
            <div class="mb-3">
              <label for="originalname" class="form-label">Nom du catalogue <span class="text-danger">*</span></label>
              <input id="originalname" v-model="form.originalname" type="text" class="form-control" required placeholder="Nom du catalogue">
            </div>
            <div class="mb-3">
              <label for="description" class="form-label">Description</label>
              <textarea id="description" v-model="form.description" class="form-control" rows="3" placeholder="Description du catalogue"></textarea>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <label for="expiration_date" class="form-label">Date d'expiration</label>
                <input id="expiration_date" v-model="form.expiration_date" type="date" class="form-control">
              </div>
              <div class="col-md-6">
                <label for="date_livraison" class="form-label">Date de livraison</label>
                <input id="date_livraison" v-model="form.date_livraison" type="date" class="form-control">
              </div>
            </div>
            <div class="mb-3 border rounded p-3 bg-light">
              <div class="row g-2 small">
                <div class="col-md-3"><span class="text-muted">ID</span> <strong>#{{ catalogue.id }}</strong></div>
                <div class="col-md-3"><span class="text-muted">Produits</span> <strong>{{ articles.length }}</strong></div>
                <div class="col-md-3"><span class="text-muted">Statut</span> <span :class="['badge', statusBadgeClass]">{{ statusLabel }}</span></div>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Rappel commande référent</label>
              <div class="form-check">
                <input id="referent_order_reminder_enabled" v-model="form.referent_order_reminder_enabled" class="form-check-input" type="checkbox" :true-value="1" :false-value="0">
                <label class="form-check-label" for="referent_order_reminder_enabled">Envoyer un mail au référent pour prévoir la commande (Expiration + 8h)</label>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Visibilité</label>
              <div class="form-check">
                <input id="is_archived_0" v-model="form.is_archived" class="form-check-input" type="radio" value="0">
                <label class="form-check-label" for="is_archived_0">Visible de tous</label>
              </div>
              <div class="form-check">
                <input id="is_archived_2" v-model="form.is_archived" class="form-check-input" type="radio" value="2">
                <label class="form-check-label" for="is_archived_2">Invisible des utilisateurs (visible en admin)</label>
              </div>
              <div class="form-check">
                <input id="is_archived_3" v-model="form.is_archived" class="form-check-input" type="radio" value="3">
                <label class="form-check-label" for="is_archived_3">Invisible de tous, partout (archivé)</label>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              Enregistrer les modifications
            </button>
          </form>
          <form method="POST" :action="`/admin/catalogues/${catalogue.id}/delete`" class="mt-3" @submit="onDeleteCatalogue">
            <input type="hidden" name="_csrf" :value="csrfToken">
            <button type="submit" class="btn btn-danger">
              <i class="bi bi-trash me-2"></i>Supprimer le catalogue
            </button>
          </form>
        </div>
      </div>

      <!-- Articles du catalogue -->
      <div class="card mb-4">
        <div class="card-header">
          <h5 class="card-title mb-0"><i class="bi bi-journal-text me-2"></i>Articles du catalogue ({{ articles.length }})</h5>
        </div>
        <div class="card-body">
          <div v-if="articles.length === 0" class="alert alert-info">Aucun article. Ajoutez des produits ci-dessous.</div>
          <div v-else class="table-responsive">
            <table class="table table-hover">
              <thead class="thead-administration">
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Prix</th>
                  <th>Unité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="art in articles" :key="art.id">
                  <td><strong>{{ art.produit }}</strong></td>
                  <td><span v-if="art.categorie" class="badge" :style="{ backgroundColor: art.categorie_couleur || '#6c757d' }">{{ art.categorie }}</span><span v-else>-</span></td>
                  <td>{{ art.prix != null ? Number(art.prix).toFixed(2) : '-' }} €</td>
                  <td>{{ art.unite || '-' }}</td>
                  <td>
                    <a :href="`/admin/catalogues/${catalogue.id}/articles/${art.id}/edit`" class="btn btn-sm btn-outline-primary me-1">Modifier</a>
                    <button type="button" class="btn btn-sm btn-outline-danger" @click="deleteArticle(art)">Supprimer</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Ajouter des produits -->
      <div class="card mb-4">
        <div class="card-header">
          <button class="btn btn-link text-decoration-none p-0 w-100 text-start d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAddProducts" aria-expanded="false">
            <i class="bi bi-plus-circle me-2"></i>Ajouter des produits au catalogue
          </button>
        </div>
        <div id="collapseAddProducts" class="collapse">
          <div class="card-body">
            <div class="row mb-3">
              <div class="col-md-4">
                <label class="form-label">Fournisseur</label>
                <select v-model="filterSupplier" class="form-select">
                  <option value="">Tous</option>
                  <option v-for="s in suppliers" :key="s.id" :value="String(s.id)">{{ s.nom }}</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Catégorie</label>
                <select v-model="filterCategory" class="form-select">
                  <option value="">Toutes</option>
                  <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.nom }}</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Recherche</label>
                <input v-model="filterSearch" type="text" class="form-control" placeholder="Nom du produit...">
              </div>
            </div>
            <p class="small text-muted">{{ selectedProductIds.length }} produit(s) sélectionné(s)</p>
            <div class="table-responsive mb-3" style="max-height: 400px; overflow-y: auto;">
              <table class="table table-sm table-hover">
                <thead class="sticky-top thead-administration">
                  <tr>
                    <th style="width: 40px;"></th>
                    <th>Produit</th>
                    <th>Prix (€)</th>
                    <th>Qté mini</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in filteredProducts" :key="p.id">
                    <td>
                      <input v-model="selectedProductIds" type="checkbox" :value="p.id" class="form-check-input">
                    </td>
                    <td><strong>{{ p.nom }}</strong></td>
                    <td style="width: 120px;">
                      <input v-model.number="productPrix[p.id]" type="number" step="0.01" min="0" class="form-control form-control-sm" placeholder="0.00">
                    </td>
                    <td style="width: 100px;">
                      <input v-model.number="productUnite[p.id]" type="number" step="0.1" min="0.1" class="form-control form-control-sm" :placeholder="p.derniere_unite || 1">
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" class="btn btn-primary" :disabled="adding || selectedProductIds.length === 0" @click="addSelectedProducts">
              <span v-if="adding" class="spinner-border spinner-border-sm me-1"></span>
              Ajouter la sélection
            </button>
          </div>
        </div>
      </div>

      <!-- Importer depuis un catalogue -->
      <div class="card mb-4">
        <div class="card-header">
          <h5 class="card-title mb-0"><i class="bi bi-files me-2"></i>Importer depuis un autre catalogue</h5>
        </div>
        <div class="card-body">
          <div class="row align-items-end">
            <div class="col-md-8">
              <label class="form-label">Catalogue source</label>
              <select v-model="importSourceId" class="form-select">
                <option value="">-- Sélectionner un catalogue --</option>
                <option v-for="oc in otherCatalogs" :key="oc.id" :value="oc.id">
                  #{{ oc.id }} - {{ oc.originalname }} ({{ oc.nb_produits }} produits)
                </option>
              </select>
            </div>
            <div class="col-md-4">
              <button type="button" class="btn btn-success w-100" :disabled="importing || !importSourceId" @click="importFromCatalog">
                <span v-if="importing" class="spinner-border spinner-border-sm me-1"></span>
                Importer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <a :href="`/admin/catalogues/${catalogue.id}/synthese/vue`" class="btn btn-outline-secondary me-2">Synthèse</a>
        <a :href="`/admin/catalogues/${catalogue.id}/synthese-detaillee/vue`" class="btn btn-outline-secondary me-2">Synthèse détaillée</a>
        <a href="/admin/catalogues/vue" class="btn btn-outline-secondary">Retour à la liste</a>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';

const catalogue = ref(null);
const articles = ref([]);
const allProducts = ref([]);
const suppliers = ref([]);
const categories = ref([]);
const otherCatalogs = ref([]);
const error = ref('');
const saveStatus = ref('');
const saving = ref(false);
const adding = ref(false);
const importing = ref(false);

const form = ref({
  originalname: '',
  description: '',
  expiration_date: '',
  date_livraison: '',
  is_archived: '0',
  referent_order_reminder_enabled: 0,
});
const filterSupplier = ref('');
const filterCategory = ref('');
const filterSearch = ref('');
const selectedProductIds = ref([]);
const productPrix = ref({});
const productUnite = ref({});
const importSourceId = ref('');

const csrfToken = computed(() => window.CSRF_TOKEN || '');

function toDateStr(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  // Formater en YYYY-MM-DD en utilisant les méthodes locales (pas UTC)
  // pour éviter le décalage d'un jour causé par toISOString()
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const statusLabel = computed(() => {
  const c = catalogue.value;
  if (!c) return '';
  if (!c.expiration_date) return 'Permanent';
  const exp = new Date(c.expiration_date).getTime();
  const now = Date.now();
  return exp + 86400000 < now ? 'Expiré' : 'Actif';
});

const statusBadgeClass = computed(() => {
  const s = statusLabel.value;
  if (s === 'Expiré') return 'bg-danger';
  if (s === 'Actif') return 'bg-success';
  return 'bg-primary';
});

const filteredProducts = computed(() => {
  let list = allProducts.value || [];
  if (filterSupplier.value != null && filterSupplier.value !== '') {
    const sid = String(filterSupplier.value);
    list = list.filter(p => p != null && String(p.supplier_id ?? '') === sid);
  }
  if (filterCategory.value != null && filterCategory.value !== '') {
    const cid = String(filterCategory.value);
    list = list.filter(p => p != null && String(p.category_id ?? '') === cid);
  }
  if (filterSearch.value) {
    const q = filterSearch.value.toLowerCase();
    list = list.filter(p => (p.nom || '').toLowerCase().includes(q));
  }
  return list;
});


function onDeleteCatalogue(e) {
  if (!confirm('Supprimer ce catalogue (cela supprimera tous les paniers, commandes et articles associés) ?')) e.preventDefault();
}

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  catalogue.value = data.catalogue || null;
  articles.value = data.articles || [];
  allProducts.value = data.allProducts || [];
  suppliers.value = data.suppliers || [];
  categories.value = data.categories || [];
  otherCatalogs.value = data.otherCatalogs || [];
  error.value = data.error || '';

  if (data.catalogue) {
    const c = data.catalogue;
    form.value.originalname = c.originalname || '';
    form.value.description = c.description || '';
    form.value.expiration_date = toDateStr(c.expiration_date);
    form.value.date_livraison = toDateStr(c.date_livraison);
    form.value.is_archived = String(c.is_archived ?? 0);
    form.value.referent_order_reminder_enabled = c.referent_order_reminder_enabled ? 1 : 0;
  }
  (allProducts.value || []).forEach(p => {
    productPrix.value[p.id] = p.dernier_prix ?? '';
    productUnite.value[p.id] = p.derniere_unite ?? 1;
  });
});

async function saveMetadata() {
  if (!catalogue.value) return;
  error.value = '';
  saving.value = true;
  saveStatus.value = 'Enregistrement...';
  try {
    const body = new URLSearchParams({
      _csrf: csrfToken.value,
      originalname: form.value.originalname,
      description: form.value.description || '',
      expiration_date: form.value.expiration_date || '',
      date_livraison: form.value.date_livraison || '',
      is_archived: form.value.is_archived,
      referent_order_reminder_enabled: form.value.referent_order_reminder_enabled ? '1' : '',
    });
    const res = await fetch(`/admin/catalogues/${catalogue.value.id}/edit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      saveStatus.value = 'Enregistré';
      setTimeout(() => { saveStatus.value = ''; }, 2000);
    } else {
      error.value = data.error || 'Erreur lors de l\'enregistrement.';
    }
  } catch (e) {
    error.value = 'Erreur de connexion.';
  } finally {
    saving.value = false;
  }
}

async function deleteArticle(art) {
  if (!catalogue.value || !confirm('Retirer cet article du catalogue ?')) return;
  try {
    const body = new URLSearchParams({ _csrf: csrfToken.value });
    const res = await fetch(`/admin/catalogues/${catalogue.value.id}/articles/${art.id}/delete`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      articles.value = articles.value.filter(a => a.id !== art.id);
    } else {
      error.value = data.error || 'Erreur lors de la suppression.';
    }
  } catch (e) {
    error.value = 'Erreur de connexion.';
  }
}

async function addSelectedProducts() {
  if (!catalogue.value || selectedProductIds.value.length === 0) return;
  error.value = '';
  adding.value = true;
  try {
    const products = selectedProductIds.value.map(pid => ({
      product_id: pid,
      prix: productPrix.value[pid] ?? 0,
      unite: productUnite.value[pid] ?? 1,
    }));
    const body = JSON.stringify({ products });
    const res = await fetch(`/admin/catalogues/${catalogue.value.id}/articles/add-multiple`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      if (data.added > 0) window.location.reload();
      else error.value = data.error || 'Aucun produit ajouté (déjà présents).';
    } else {
      error.value = data.error || 'Erreur lors de l\'ajout.';
    }
  } catch (e) {
    error.value = 'Erreur de connexion.';
  } finally {
    adding.value = false;
  }
}

async function importFromCatalog() {
  if (!catalogue.value || !importSourceId.value) return;
  error.value = '';
  importing.value = true;
  try {
    const body = new URLSearchParams({
      _csrf: csrfToken.value,
      source_catalog_id: importSourceId.value,
    });
    const res = await fetch(`/admin/catalogues/${catalogue.value.id}/import-from-catalog`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.added > 0) {
      window.location.reload();
    } else {
      error.value = data.error || (data.added === 0 ? 'Aucun produit à importer (déjà présents).' : 'Erreur.');
    }
  } catch (e) {
    error.value = 'Erreur de connexion.';
  } finally {
    importing.value = false;
  }
}
</script>
