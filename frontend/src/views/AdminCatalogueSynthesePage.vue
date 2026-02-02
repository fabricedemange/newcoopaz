<template>
  <div class="container-fluid mt-4">
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement de la synthèse...</p>
    </div>

    <div v-else-if="store.error" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ store.error }}
      <a href="/admin/catalogues/vue" class="btn btn-primary ms-2"><i class="bi bi-arrow-left me-1"></i>Retour</a>
    </div>

    <template v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2><i class="bi bi-file-earmark-text me-2"></i>Synthèse du catalogue</h2>
          <h5 class="text-muted">{{ store.catalogueName }}</h5>
          <p v-if="store.organizationName" class="text-muted mb-0">
            <i class="bi bi-building me-1"></i>{{ store.organizationName }}
          </p>
        </div>
        <a href="/admin/catalogues/vue" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>Retour
        </a>
      </div>

      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-md-auto">
              <a :href="`/admin/catalogues/${store.catalogueId}/synthese/export/xlsx`" class="btn btn-success">
                <i class="bi bi-file-earmark-excel me-1"></i>Export Excel
              </a>
            </div>
            <div class="col-md-auto">
              <a :href="`/admin/catalogues/${store.catalogueId}/synthese/export/pdf/S`" class="btn btn-danger">
                <i class="bi bi-file-earmark-pdf me-1"></i>Export PDF
              </a>
            </div>
            <div v-if="store.organizationEmail" class="col-md-auto">
              <button type="button" class="btn btn-primary" @click="sendPDFByEmail">
                <i class="bi bi-envelope me-1"></i>Envoyer par email
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body py-2">
          <div class="row text-center">
            <div class="col">
              <small class="text-muted d-block">Produits</small>
              <strong class="fs-5">{{ store.statistics.nbProducts }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Quantité totale</small>
              <strong class="fs-5">{{ store.formatQuantity(store.statistics.totalQuantity) }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Montant total</small>
              <strong class="fs-5 text-success">{{ store.formatPrice(store.statistics.totalAmount) }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Moyenne/produit</small>
              <strong class="fs-5">{{ store.formatPrice(store.statistics.averageAmount) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body">
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              v-model="store.search"
              type="text"
              class="form-control"
              placeholder="Rechercher un produit, catégorie ou note..."
            />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">Synthèse des commandes</h5>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th class="text-end">Prix unitaire</th>
                  <th class="text-end">Quantité</th>
                  <th class="text-end">Montant total</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="store.filteredSynthese.length === 0">
                  <td colspan="6" class="text-center text-muted py-4">
                    {{ store.search ? 'Aucun résultat trouvé' : 'Aucune commande' }}
                  </td>
                </tr>
                <tr v-for="(item, idx) in store.filteredSynthese" :key="idx">
                  <td><strong>{{ item.produit }}</strong></td>
                  <td>
                    <span
                      v-if="item.categorie"
                      class="badge"
                      :style="{ backgroundColor: item.categorie_couleur || '#6c757d' }"
                    >
                      {{ item.categorie }}
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td class="text-end">{{ store.formatPrice(item.prix) }}</td>
                  <td class="text-end"><strong>{{ store.formatQuantity(item.total_commande) }}</strong></td>
                  <td class="text-end">
                    <strong>{{ store.formatPrice(parseFloat(item.prix || 0) * parseFloat(item.total_commande || 0)) }}</strong>
                  </td>
                  <td>
                    <div v-if="item.note" class="small"><i class="bi bi-chat-square-text me-1"></i>{{ item.note }}</div>
                    <div v-if="item.note_article" class="small text-info"><i class="bi bi-info-circle me-1"></i>{{ item.note_article }}</div>
                    <span v-if="!item.note && !item.note_article">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAdminCatalogueSyntheseStore } from '@/stores/adminCatalogueSynthese';

const store = useAdminCatalogueSyntheseStore();

async function sendPDFByEmail() {
  if (!confirm(`Envoyer la synthèse par email à ${store.organizationEmail} ?`)) return;
  try {
    const response = await fetch(`/admin/catalogues/${store.catalogueId}/synthese/export/pdf/M`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (response.ok) alert('Email envoyé avec succès !');
    else throw new Error("Erreur lors de l'envoi de l'email");
  } catch (e) {
    alert(e.message || "Erreur lors de l'envoi de l'email");
  }
}

onMounted(() => {
  store.loadData();
});
</script>
