<template>
  <div class="container-fluid px-3 mt-4">
    <div v-if="!product" class="alert alert-warning">Produit non trouvé.</div>
    <template v-else>
      <div class="row">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h2 class="mb-0">
              {{ product.nom }}
              <span v-if="product.is_active" class="badge bg-success">Actif</span>
              <span v-else class="badge bg-secondary">Inactif</span>
            </h2>
            <div class="d-flex gap-2">
              <BackButton />
              <a :href="`/admin/products/${product.id}/edit`" class="btn btn-primary">
                <i class="bi bi-pencil me-2"></i>Modifier
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12 col-lg-4 mb-3">
          <div v-if="product.image_url" class="card mb-3">
            <div class="card-header">
              <h5 class="card-title mb-0">Image</h5>
            </div>
            <div class="card-body text-center">
              <img :src="product.image_url" :alt="product.nom" class="img-fluid rounded" style="max-height: 300px;">
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-info-circle me-2"></i>Informations
              </h5>
            </div>
            <div class="card-body">
              <dl class="row mb-0">
                <dt class="col-sm-5">Catégorie</dt>
                <dd class="col-sm-7">
                  <span
                    v-if="product.categorie"
                    class="badge"
                    :style="{ backgroundColor: product.categorie_couleur || '#6c757d' }"
                  >
                    {{ product.categorie }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </dd>
                <dt class="col-sm-5">Fournisseur</dt>
                <dd class="col-sm-7">
                  <a v-if="product.supplier_id || product.fournisseur_id" :href="`/admin/suppliers/${product.supplier_id || product.fournisseur_id}`">
                    {{ product.fournisseur }}
                  </a>
                  <span v-else class="text-muted">-</span>
                </dd>
                <dt class="col-sm-5">Prix (€)</dt>
                <dd class="col-sm-7">
                  <strong :class="product.prix != null && Number(product.prix) < 0 ? 'text-warning' : 'text-primary'">
                    {{ product.prix != null && product.prix !== '' ? Number(product.prix).toFixed(2) : '-' }} €
                  </strong>
                </dd>
                <dt class="col-sm-5">Unité</dt>
                <dd class="col-sm-7">{{ product.unite || '-' }}</dd>
                <dt class="col-sm-5">Quantité minimale (vente)</dt>
                <dd class="col-sm-7">{{ product.quantite_min != null && product.quantite_min !== '' ? product.quantite_min : '-' }}</dd>
                <dt class="col-sm-5">Seuil de stock (alerte)</dt>
                <dd class="col-sm-7">{{ product.stock_min != null && product.stock_min !== '' ? product.stock_min : '-' }}</dd>
                <dt class="col-sm-5">Description / Commentaire</dt>
                <dd class="col-sm-7">{{ product.description || '-' }}</dd>
                <dt class="col-sm-5">Réf. fournisseur</dt>
                <dd class="col-sm-7">{{ product.reference_fournisseur || '-' }}</dd>
                <dt class="col-sm-5">Code EAN</dt>
                <dd class="col-sm-7">{{ product.code_ean || '-' }}</dd>
                <dt class="col-sm-5">Conditionnement</dt>
                <dd class="col-sm-7">{{ product.conditionnement || '-' }}</dd>
                <dt class="col-sm-5">DLC</dt>
                <dd class="col-sm-7">{{ product.dlc_jours != null && product.dlc_jours !== '' ? product.dlc_jours + ' jours' : '-' }}</dd>
                <dt class="col-sm-5">Origine</dt>
                <dd class="col-sm-7">{{ product.origine || '-' }}</dd>
                <dt class="col-sm-5">Labels</dt>
                <dd class="col-sm-7">
                  <span v-if="product.label" class="badge bg-success">{{ product.label }}</span>
                  <span v-else class="text-muted">-</span>
                </dd>
                <dt class="col-sm-5">Allergènes</dt>
                <dd class="col-sm-7">
                  <span v-if="product.allergenes" class="badge bg-warning text-dark">{{ product.allergenes }}</span>
                  <span v-else class="text-muted">-</span>
                </dd>
                <dt class="col-sm-5">Créé le</dt>
                <dd class="col-sm-7">{{ formatDateTime(product.created_at) }}</dd>
                <template v-if="product.updated_at">
                  <dt class="col-sm-5">Modifié le</dt>
                  <dd class="col-sm-7">{{ formatDateTime(product.updated_at) }}</dd>
                </template>
              </dl>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-8">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-journal-text me-2"></i>
                Catalogues utilisant ce produit ({{ catalogues.length }})
              </h5>
            </div>
            <div class="card-body">
              <div v-if="catalogues.length === 0" class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Ce produit n'est encore présent dans aucun catalogue.
              </div>
              <div v-else class="table-responsive">
                <table class="table table-hover">
                  <thead class="thead-administration">
                    <tr>
                      <th>Catalogue</th>
                      <th>Date de livraison</th>
                      <th>Prix</th>
                      <th>Unité</th>
                      <th>Paniers</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="cat in catalogues" :key="cat.id">
                      <td>
                        <a :href="`/admin/catalogues/${cat.id}/edit`" class="text-decoration-none">{{ cat.originalname }}</a>
                      </td>
                      <td>{{ formatDate(cat.date_livraison) }}</td>
                      <td><strong>{{ (cat.prix != null && cat.prix !== '') ? Number(cat.prix).toFixed(2) : '-' }} €</strong></td>
                      <td>{{ cat.unite || '-' }}</td>
                      <td><span class="badge bg-info">{{ cat.nb_paniers || 0 }} panier(s)</span></td>
                      <td>
                        <a :href="`/admin/catalogues/${cat.id}/edit`" class="btn btn-sm btn-outline-primary" title="Voir le catalogue">
                          <i class="bi bi-eye"></i>
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';

const product = ref(null);
const catalogues = ref([]);

function formatDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString('fr-FR');
}

function formatDateTime(val) {
  if (!val) return '-';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleString('fr-FR');
}

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  product.value = data.product || null;
  catalogues.value = data.catalogues || [];
});
</script>
