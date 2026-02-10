<template>
  <div class="container-fluid px-3 mt-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h2 class="mb-0"><i class="bi bi-truck me-2"></i>Réceptions de commandes</h2>
      <div class="d-flex gap-2">
        <a href="/caisse/accueil" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>Retour
        </a>
        <a href="/caisse/inventaire" class="btn btn-outline-primary">Inventaire</a>
        <button v-if="mode === 'list'" type="button" class="btn btn-primary" @click="startNew">
          <i class="bi bi-plus-circle me-1"></i>Nouvelle réception
        </button>
        <button v-else type="button" class="btn btn-outline-secondary" @click="mode = 'list'; loadReceptions()">
          <i class="bi bi-list me-1"></i>Liste
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger alert-dismissible fade show">
      {{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- Liste des réceptions -->
    <template v-if="mode === 'list'">
      <div v-if="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div v-else-if="receptions.length === 0" class="alert alert-info">
        Aucune réception. Cliquez sur <strong>Nouvelle réception</strong> pour en créer une.
      </div>
      <div v-else class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>BL</th>
                  <th>Fournisseur</th>
                  <th>Précommande</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in receptions" :key="r.id">
                  <td><code>{{ r.bl_number }}</code></td>
                  <td>{{ r.supplier_nom }}</td>
                  <td>
                    <span v-if="r.is_from_preorder">
                      Oui<span v-if="r.catalog_file_id"> — #{{ r.catalog_file_id }}</span>
                    </span>
                    <span v-else>Non</span>
                  </td>
                  <td>{{ formatDate(r.created_at) }}</td>
                  <td>
                    <span :class="['badge', r.statut === 'validated' ? 'bg-success' : 'bg-secondary']">
                      {{ r.statut === 'validated' ? 'Validée' : 'Brouillon' }}
                    </span>
                  </td>
                  <td>
                    <button type="button" class="btn btn-sm btn-outline-primary me-1" @click="openDetail(r.id)">
                      <i class="bi bi-eye"></i>
                    </button>
                    <template v-if="r.statut === 'draft'">
                      <button type="button" class="btn btn-sm btn-success me-1" @click="confirmValidate(r.id)">
                        <i class="bi bi-check-lg"></i> Valider
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-danger" @click="confirmDelete(r.id)">
                        <i class="bi bi-trash"></i>
                      </button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Formulaire nouvelle / édition réception -->
    <template v-else>
      <div class="card mb-4">
        <div class="card-header">
          <h5 class="mb-0">{{ receptionId ? 'Détail / Modifier la réception' : 'Nouvelle réception' }}</h5>
        </div>
        <div class="card-body">
          <div class="row g-3 mb-4">
            <div class="col-md-4">
              <label class="form-label">Fournisseur <span class="text-danger">*</span></label>
              <select
                v-model="form.supplier_id"
                class="form-select"
                :disabled="!!receptionId"
                @change="onSupplierChange"
              >
                <option value="">Sélectionner un fournisseur</option>
                <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.nom }}</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">N° Bon de livraison (BL) <span class="text-danger">*</span></label>
              <input v-model="form.bl_number" type="text" class="form-control" placeholder="Ex: BL-2024-001" />
            </div>
            <div class="col-md-4 d-flex align-items-end">
              <div class="form-check">
                <input id="from_preorder" v-model="form.is_from_preorder" type="checkbox" class="form-check-input" :disabled="!!receptionId" />
                <label class="form-check-label" for="from_preorder">Réception issue d'une précommande</label>
              </div>
            </div>
          </div>
          <div v-if="!receptionId && form.supplier_id && form.is_from_preorder" class="mb-3">
            <h6 class="text-muted mb-2">Catalogues / Précommandes concernés</h6>
            <div v-if="loadingPreordersCatalogues" class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Chargement…</div>
            <div v-else-if="preordersCatalogues.length > 0" class="mb-3">
              <div class="d-flex flex-wrap gap-2 align-items-center">
                <div v-for="cat in preordersCatalogues" :key="cat.id" class="d-flex align-items-center gap-1 flex-wrap">
                  <span class="badge bg-light text-dark border">#{{ cat.id }} — {{ cat.originalname || cat.description || 'Catalogue ' + cat.id }}</span>
                  <span v-if="cat.date_livraison" class="small text-muted">(livr. {{ formatDateShort(cat.date_livraison) }})</span>
                  <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loadingPreorderCatalogId !== null" @click="prefillFromCatalogue(cat.id)">
                    <span v-if="loadingPreorderCatalogId === cat.id" class="spinner-border spinner-border-sm"></span>
                    <template v-else>Préremplir</template>
                  </button>
                </div>
              </div>
            </div>
            <p v-else class="text-muted small mb-2">Aucun catalogue (date de livraison à ce jour ou passée) pour ce fournisseur.</p>
            <h6 class="text-muted mb-2 mt-3">Dernières précommandes livrées</h6>
            <div v-if="loadingPreordersDelivered" class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Chargement…</div>
            <div v-else-if="preordersDelivered.length > 0" class="table-responsive mb-2" style="max-height: 200px;">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>BL</th>
                    <th>Date livraison</th>
                    <th>Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rec in preordersDelivered" :key="rec.id">
                    <td><code>{{ rec.bl_number }}</code></td>
                    <td>{{ formatDate(rec.validated_at) }}</td>
                    <td>{{ rec.nb_lignes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-muted small mb-2">Aucune réception validée (précommande) pour ce fournisseur.</p>
            <p v-if="form.catalog_file_id" class="small text-success mb-2">
              <i class="bi bi-check-circle me-1"></i>Précommande utilisée : #{{ form.catalog_file_id }}
              <span v-if="preordersCatalogues.find(c => c.id === form.catalog_file_id)">{{ preordersCatalogues.find(c => c.id === form.catalog_file_id).originalname || preordersCatalogues.find(c => c.id === form.catalog_file_id).description }}</span>
              <span v-else-if="currentReception?.catalog_originalname">{{ currentReception.catalog_originalname }}</span>
            </p>
          </div>

          <h6 class="mt-4">Lignes de réception</h6>
          <div v-if="!receptionId && form.supplier_id" class="mb-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" @click="showProductSearch = true">
              <i class="bi bi-plus me-1"></i>Ajouter un produit
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Produit</th>
                  <th class="text-end" style="width: 100px">Qté reçue</th>
                  <th class="text-end" style="width: 100px">Prix unit. réception</th>
                  <th class="text-end" style="width: 90px">Prix base</th>
                  <th>Commentaire</th>
                  <th v-if="!receptionId || currentReception?.statut === 'draft'" style="width: 50px"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(ligne, idx) in form.lignes"
                  :key="ligne.product_id + '-' + idx"
                  :class="{ 'table-warning': hasPriceDiff(ligne) }"
                >
                  <td>{{ ligne.product_nom }}</td>
                  <td class="text-end">
                    <input
                      v-if="!receptionId || currentReception?.statut === 'draft'"
                      v-model.number="ligne.quantite_recue"
                      type="number"
                      class="form-control form-control-sm text-end"
                      min="0.001"
                      step="0.001"
                    />
                    <span v-else>{{ ligne.quantite_recue }}</span>
                  </td>
                  <td class="text-end">
                    <input
                      v-if="!receptionId || currentReception?.statut === 'draft'"
                      v-model.number="ligne.prix_unitaire"
                      type="number"
                      class="form-control form-control-sm text-end"
                      min="0"
                      step="0.01"
                    />
                    <span v-else>{{ (Number(ligne.prix_unitaire) || 0).toFixed(2) }} €</span>
                  </td>
                  <td class="text-end">
                    <span :class="{ 'text-danger fw-bold': hasPriceDiff(ligne) }">
                      {{ ligne.prix_base != null ? Number(ligne.prix_base).toFixed(2) : '-' }} €
                    </span>
                  </td>
                  <td>
                    <input
                      v-if="!receptionId || currentReception?.statut === 'draft'"
                      v-model="ligne.comment"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Commentaire"
                    />
                    <span v-else>{{ ligne.comment || '-' }}</span>
                  </td>
                  <td v-if="!receptionId || currentReception?.statut === 'draft'">
                    <button type="button" class="btn btn-sm btn-outline-danger" @click="form.lignes.splice(idx, 1)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="form.lignes.length === 0" class="text-muted small">Aucune ligne. Préremplir depuis une précommande ou ajouter des produits.</div>

          <div class="mt-4 d-flex gap-2 flex-wrap">
            <template v-if="!receptionId">
              <button type="button" class="btn btn-primary" :disabled="saving || !canSave" @click="saveDraft">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-save me-1"></i>Enregistrer le brouillon
              </button>
              <button type="button" class="btn btn-success" :disabled="saving || !canValidate" @click="saveAndValidate">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                <i class="bi bi-check-lg me-1"></i>Enregistrer et valider
              </button>
            </template>
            <template v-else-if="currentReception?.statut === 'draft'">
              <button type="button" class="btn btn-primary" :disabled="saving || !canSave" @click="updateDraft">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                Enregistrer
              </button>
              <button type="button" class="btn btn-success" :disabled="saving || !canValidate" @click="validateReception">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                Valider la réception
              </button>
            </template>
            <button type="button" class="btn btn-outline-secondary" @click="mode = 'list'; loadReceptions()">
              Annuler / Retour
            </button>
          </div>
        </div>
      </div>

      <!-- Modal recherche produit (ajout manuel) -->
      <div v-if="showProductSearch" class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Ajouter un produit</h5>
              <button type="button" class="btn-close" @click="showProductSearch = false"></button>
            </div>
            <div class="modal-body">
              <input
                v-model="productSearch"
                type="text"
                class="form-control mb-3"
                placeholder="Rechercher par nom..."
                @input="debounceProductSearch"
              />
              <div v-if="productSearchLoading" class="text-center py-2"><div class="spinner-border spinner-border-sm"></div></div>
              <ul v-else class="list-group list-group-flush">
                <li
                  v-for="p in productSearchResults"
                  :key="p.id"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  style="cursor: pointer"
                  @click="addProductLine(p)"
                >
                  <span>{{ p.nom }}</span>
                  <span class="text-muted small">{{ (Number(p.prix) || 0).toFixed(2) }} €</span>
                </li>
                <li v-if="productSearchResults.length === 0 && productSearch.length >= 2" class="list-group-item text-muted">Aucun produit trouvé</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import {
  fetchReceptions,
  fetchReceptionDetail,
  fetchReceptionsPreorderLines,
  fetchReceptionsPreordersDelivered,
  fetchReceptionsPreordersCatalogues,
  fetchReceptionProducts,
  fetchAdminSuppliers,
  postReception,
  patchReception,
  postReceptionValidate,
  deleteReception,
} from '@/api';

const mode = ref('list');
const receptions = ref([]);
const suppliers = ref([]);
const loading = ref(false);
const error = ref(null);
const receptionId = ref(null);
const currentReception = ref(null);
const form = ref({
  supplier_id: '',
  bl_number: '',
  is_from_preorder: false,
  catalog_file_id: null,
  lignes: [],
});
const saving = ref(false);
const preordersDelivered = ref([]);
const loadingPreordersDelivered = ref(false);
const preordersCatalogues = ref([]);
const loadingPreordersCatalogues = ref(false);
const loadingPreorderCatalogId = ref(null);
const showProductSearch = ref(false);
const productSearch = ref('');
const productSearchResults = ref([]);
const productSearchLoading = ref(false);
let productSearchTimer = null;

const canSave = computed(() => {
  return form.value.supplier_id && (form.value.bl_number || '').trim() && form.value.lignes.length > 0;
});
const canValidate = computed(() => canSave.value);

function formatDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('fr-FR');
}
function formatDateShort(val) {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('fr-FR');
}

function hasPriceDiff(ligne) {
  const base = ligne.prix_base != null ? Number(ligne.prix_base) : null;
  const rec = ligne.prix_unitaire != null ? Number(ligne.prix_unitaire) : null;
  if (base == null || rec == null) return false;
  return Math.abs(rec - base) > 0.001;
}

function onSupplierChange() {
  form.value.lignes = [];
  form.value.catalog_file_id = null;
  productSearchResults.value = [];
  preordersDelivered.value = [];
  preordersCatalogues.value = [];
}

watch(
  () => [form.value.supplier_id, form.value.is_from_preorder],
  ([supplierId, isFromPreorder]) => {
    if (!supplierId || !isFromPreorder) {
      preordersDelivered.value = [];
      preordersCatalogues.value = [];
      return;
    }
    loadingPreordersDelivered.value = true;
    loadingPreordersCatalogues.value = true;
    Promise.all([
      fetchReceptionsPreordersDelivered(supplierId),
      fetchReceptionsPreordersCatalogues(supplierId),
    ])
      .then(([delivered, catalogues]) => {
        preordersDelivered.value = delivered.receptions || [];
        preordersCatalogues.value = catalogues.catalogues || [];
      })
      .catch(() => {
        preordersDelivered.value = [];
        preordersCatalogues.value = [];
      })
      .finally(() => {
        loadingPreordersDelivered.value = false;
        loadingPreordersCatalogues.value = false;
      });
  },
  { immediate: true }
);

function loadReceptions() {
  loading.value = true;
  error.value = null;
  fetchReceptions()
    .then((data) => {
      receptions.value = data.receptions || [];
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      loading.value = false;
    });
}

function loadSuppliers() {
  fetchAdminSuppliers()
    .then((data) => {
      suppliers.value = data.suppliers || [];
    })
    .catch(() => {});
}

function startNew() {
  receptionId.value = null;
  currentReception.value = null;
  form.value = { supplier_id: '', bl_number: '', is_from_preorder: false, catalog_file_id: null, lignes: [] };
  mode.value = 'form';
  loadSuppliers();
}

function applyPreorderLinesToForm(data) {
  const lines = (data.lines || []).map((l) => ({
    product_id: l.product_id,
    product_nom: l.product_nom,
    quantite_recue: Number(l.quantite_commandee) || 0,
    prix_unitaire: Number(l.prix_base) || 0,
    prix_base: l.prix_base != null ? Number(l.prix_base) : null,
    comment: '',
  }));
  form.value.lignes = lines;
}

function prefillFromCatalogue(catalogFileId) {
  if (!form.value.supplier_id) return;
  loadingPreorderCatalogId.value = catalogFileId;
  fetchReceptionsPreorderLines(form.value.supplier_id, catalogFileId)
    .then((data) => {
      applyPreorderLinesToForm(data);
      form.value.catalog_file_id = catalogFileId;
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      loadingPreorderCatalogId.value = null;
    });
}

function debounceProductSearch() {
  clearTimeout(productSearchTimer);
  productSearchTimer = setTimeout(doProductSearch, 300);
}

function doProductSearch() {
  if (!form.value.supplier_id || productSearch.value.length < 2) {
    productSearchResults.value = [];
    return;
  }
  productSearchLoading.value = true;
  fetchReceptionProducts(form.value.supplier_id, productSearch.value)
    .then((data) => {
      productSearchResults.value = data.products || [];
    })
    .catch(() => {
      productSearchResults.value = [];
    })
    .finally(() => {
      productSearchLoading.value = false;
    });
}

function addProductLine(p) {
  const exists = form.value.lignes.some((l) => l.product_id === p.id);
  if (exists) return;
  form.value.lignes.push({
    product_id: p.id,
    product_nom: p.nom,
    quantite_recue: 1,
    prix_unitaire: Number(p.prix) || 0,
    prix_base: p.prix != null ? Number(p.prix) : null,
    comment: '',
  });
  showProductSearch.value = false;
  productSearch.value = '';
  productSearchResults.value = [];
}

function buildLignesPayload() {
  return form.value.lignes
    .filter((l) => (Number(l.quantite_recue) || 0) > 0)
    .map((l) => ({
      product_id: l.product_id,
      quantite_recue: Number(l.quantite_recue) || 0,
      prix_unitaire: Number(l.prix_unitaire) || 0,
      comment: (l.comment || '').trim() || '',
    }));
}

function saveDraft() {
  if (!canSave.value) return;
  saving.value = true;
  error.value = null;
  postReception({
    supplier_id: form.value.supplier_id,
    bl_number: form.value.bl_number.trim(),
    is_from_preorder: form.value.is_from_preorder,
    catalog_file_id: form.value.catalog_file_id || undefined,
    lignes: buildLignesPayload(),
  })
    .then((data) => {
      receptionId.value = data.reception?.id;
      currentReception.value = data.reception;
      loadReceptions();
      alert('Brouillon enregistré.');
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      saving.value = false;
    });
}

function saveAndValidate() {
  if (!canValidate.value) return;
  if (!confirm('Enregistrer et valider la réception ? Les stocks seront mis à jour.')) return;
  saving.value = true;
  error.value = null;
  postReception({
    supplier_id: form.value.supplier_id,
    bl_number: form.value.bl_number.trim(),
    is_from_preorder: form.value.is_from_preorder,
    catalog_file_id: form.value.catalog_file_id || undefined,
    lignes: buildLignesPayload(),
  })
    .then((data) => {
      const id = data.reception?.id;
      if (id) return postReceptionValidate(id);
      throw new Error('Réception non créée');
    })
    .then(() => {
      alert('Réception validée. Les stocks ont été mis à jour.');
      mode.value = 'list';
      loadReceptions();
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      saving.value = false;
    });
}

function openDetail(id) {
  receptionId.value = id;
  mode.value = 'form';
  loading.value = true;
  error.value = null;
  fetchReceptionDetail(id)
    .then((data) => {
      currentReception.value = data.reception;
      form.value = {
        supplier_id: data.reception.supplier_id,
        bl_number: data.reception.bl_number,
        is_from_preorder: !!data.reception.is_from_preorder,
        catalog_file_id: data.reception.catalog_file_id ?? null,
        lignes: (data.lignes || []).map((l) => ({
          product_id: l.product_id,
          product_nom: l.product_nom,
          quantite_recue: l.quantite_recue,
          prix_unitaire: l.prix_unitaire,
          prix_base: l.prix_base,
          comment: l.comment || '',
        })),
      };
      loadSuppliers();
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      loading.value = false;
    });
}

function updateDraft() {
  if (!receptionId.value || !canSave.value) return;
  saving.value = true;
  error.value = null;
  patchReception(receptionId.value, {
    bl_number: form.value.bl_number.trim(),
    is_from_preorder: form.value.is_from_preorder,
    catalog_file_id: form.value.catalog_file_id ?? undefined,
    lignes: buildLignesPayload(),
  })
    .then(() => {
      loadReceptions();
      alert('Réception mise à jour.');
      openDetail(receptionId.value);
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      saving.value = false;
    });
}

function validateReception() {
  if (!receptionId.value || !canValidate.value) return;
  if (!confirm('Valider cette réception ? Les quantités en stock seront augmentées. Cette action est définitive.')) return;
  saving.value = true;
  error.value = null;
  postReceptionValidate(receptionId.value)
    .then(() => {
      alert('Réception validée. Les stocks ont été mis à jour.');
      mode.value = 'list';
      loadReceptions();
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      saving.value = false;
    });
}

function confirmValidate(id) {
  if (!confirm('Valider cette réception ? Les stocks seront mis à jour.')) return;
  saving.value = true;
  postReceptionValidate(id)
    .then(() => {
      loadReceptions();
      alert('Réception validée.');
    })
    .catch((e) => {
      error.value = e.message;
    })
    .finally(() => {
      saving.value = false;
    });
}

function confirmDelete(id) {
  if (!confirm('Supprimer ce brouillon ?')) return;
  deleteReception(id)
    .then(() => loadReceptions())
    .catch((e) => {
      error.value = e.message;
    });
}

onMounted(() => {
  loadReceptions();
});
</script>
