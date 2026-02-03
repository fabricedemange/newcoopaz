<template>
  <div class="container-fluid px-3 mt-4">
    <div v-if="!supplier" class="alert alert-warning">Fournisseur non trouvé.</div>
    <template v-else>
      <div class="row">
        <div class="col-12">
          <h2 class="mb-4">
            {{ supplier.nom }}
            <span v-if="supplier.is_active" class="badge bg-success">Actif</span>
            <span v-else class="badge bg-secondary">Inactif</span>
          </h2>
        </div>
      </div>

      <div class="row">
        <div class="col-12 mb-3">
          <div class="d-flex gap-2">
            <a :href="`/admin/suppliers/${supplier.id}/edit`" class="btn btn-primary">
              <i class="bi bi-pencil me-2"></i>Modifier
            </a>
            <a href="/admin/suppliers" class="btn btn-outline-secondary">
              <i class="bi bi-arrow-left me-2"></i>Retour à la liste
            </a>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12 col-lg-4 mb-3">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-info-circle me-2"></i>Informations
              </h5>
            </div>
            <div class="card-body">
              <dl class="row mb-0">
                <dt class="col-sm-4">Email</dt>
                <dd class="col-sm-8">
                  <a v-if="supplier.email" :href="`mailto:${supplier.email}`">{{ supplier.email }}</a>
                  <span v-else class="text-muted">-</span>
                </dd>
                <dt class="col-sm-4">Téléphone</dt>
                <dd class="col-sm-8">{{ supplier.telephone || '-' }}</dd>
                <dt class="col-sm-4">Adresse</dt>
                <dd class="col-sm-8">
                  <template v-if="supplier.adresse || supplier.code_postal || supplier.ville">
                    {{ supplier.adresse || '' }}<br>
                    {{ supplier.code_postal || '' }} {{ supplier.ville || '' }}
                  </template>
                  <span v-else class="text-muted">-</span>
                </dd>
                <template v-if="supplier.notes">
                  <dt class="col-sm-4">Notes</dt>
                  <dd class="col-sm-8">{{ supplier.notes }}</dd>
                </template>
              </dl>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-8">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-box-seam me-2"></i>
                Produits ({{ products.length }})
              </h5>
            </div>
            <div class="card-body">
              <div v-if="products.length === 0" class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Aucun produit n'est encore assigné à ce fournisseur.
              </div>
              <div v-else class="table-responsive">
                <table class="table table-hover">
                  <thead class="thead-administration">
                    <tr>
                      <th>Produit</th>
                      <th>Catégorie</th>
                      <th>Catalogues</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="product in products" :key="product.id">
                      <td>
                        <a :href="`/admin/products/${product.id}`" class="text-decoration-none">
                          <strong>{{ product.nom }}</strong>
                        </a>
                        <br v-if="product.description">
                        <small v-if="product.description" class="text-muted">
                          {{ product.description.length > 60 ? product.description.substring(0, 60) + '...' : product.description }}
                        </small>
                      </td>
                      <td>
                        <span
                          v-if="product.categorie"
                          class="badge"
                          :style="{ backgroundColor: product.categorie_couleur || '#6c757d' }"
                        >
                          {{ product.categorie }}
                        </span>
                        <span v-else class="text-muted">-</span>
                      </td>
                      <td>
                        <span class="badge bg-info">{{ product.nb_catalogues || 0 }}</span>
                      </td>
                      <td>
                        <span v-if="product.is_active" class="badge bg-success">Actif</span>
                        <span v-else class="badge bg-secondary">Inactif</span>
                      </td>
                      <td>
                        <div class="btn-group btn-group-sm">
                          <a :href="`/admin/products/${product.id}`" class="btn btn-outline-primary" title="Voir">
                            <i class="bi bi-eye"></i>
                          </a>
                          <a :href="`/admin/products/${product.id}/edit`" class="btn btn-outline-secondary" title="Modifier">
                            <i class="bi bi-pencil"></i>
                          </a>
                        </div>
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

const supplier = ref(null);
const products = ref([]);

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  supplier.value = data.supplier || null;
  products.value = data.products || [];
});
</script>
