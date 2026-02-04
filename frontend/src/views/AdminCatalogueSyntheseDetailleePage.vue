<template>
  <div class="container-fluid mt-4">
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
      <p class="mt-3 text-muted">Chargement de la synthèse détaillée...</p>
    </div>

    <div v-else-if="store.error" class="alert alert-danger">
      <i class="bi bi-exclamation-triangle me-2"></i>{{ store.error }}
      <a href="/admin/catalogues/vue" class="btn btn-primary ms-2"><i class="bi bi-arrow-left me-1"></i>Retour</a>
    </div>

    <template v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2><i class="bi bi-file-earmark-spreadsheet me-2"></i>Synthèse détaillée du catalogue</h2>
          <h5 class="text-muted">{{ store.catalogueName }}</h5>
          <p v-if="store.organizationName" class="text-muted mb-0">
            <i class="bi bi-building me-1"></i>{{ store.organizationName }}
          </p>
        </div>
        <BackButton />
      </div>

      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-md-auto">
              <a :href="`/admin/catalogues/${store.catalogueId}/synthese-detaillee/export/xlsx`" class="btn btn-success">
                <i class="bi bi-file-earmark-excel me-1"></i>Export Excel
              </a>
            </div>
            <div class="col-md-auto">
              <a :href="`/admin/catalogues/${store.catalogueId}/synthese-detaillee/export/pdf/S`" class="btn btn-danger">
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
              <small class="text-muted d-block">Lignes</small>
              <strong class="fs-5">{{ store.statistics.nbLines }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Utilisateurs</small>
              <strong class="fs-5">{{ store.statistics.uniqueUsers }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Produits</small>
              <strong class="fs-5">{{ store.statistics.uniqueProducts }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Quantité totale</small>
              <strong class="fs-5">{{ store.formatQuantity(store.statistics.totalQuantity) }}</strong>
            </div>
            <div class="col">
              <small class="text-muted d-block">Montant total</small>
              <strong class="fs-5 text-success">{{ store.formatPrice(store.statistics.totalAmount) }}</strong>
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
              placeholder="Rechercher utilisateur, produit, catégorie ou note..."
            />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">Détail des commandes par utilisateur</h5>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover mb-0">
              <thead class="thead-administration">
                <tr>
                  <th>Utilisateur (panier)</th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th class="text-end">Prix</th>
                  <th class="text-end">Quantité</th>
                  <th class="text-end">Montant</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="store.filteredDetails.length === 0">
                  <td colspan="7" class="text-center text-muted py-4">
                    {{ store.search ? 'Aucun résultat trouvé' : 'Aucune donnée' }}
                  </td>
                </tr>
                <tr v-for="(item, idx) in store.filteredDetails" :key="idx">
                  <td>{{ item.username2 }}</td>
                  <td><strong>{{ item.produit }}</strong></td>
                  <td>{{ item.categorie || '-' }}</td>
                  <td class="text-end">{{ store.formatPrice(item.prix) }}</td>
                  <td class="text-end">{{ store.formatQuantity(item.quantite) }}</td>
                  <td class="text-end"><strong>{{ store.formatPrice(item.montant_utilisateur) }}</strong></td>
                  <td>
                    <div v-if="item.note" class="small">{{ item.note }}</div>
                    <div v-if="item.note_article" class="small text-info">{{ item.note_article }}</div>
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
import BackButton from '@/components/BackButton.vue';
import { useAdminCatalogueSyntheseDetailleeStore } from '@/stores/adminCatalogueSyntheseDetaillee';

const store = useAdminCatalogueSyntheseDetailleeStore();

async function sendPDFByEmail() {
  if (!confirm(`Envoyer la synthèse détaillée par email à ${store.organizationEmail} ?`)) return;
  try {
    const response = await fetch(`/admin/catalogues/${store.catalogueId}/synthese-detaillee/export/pdf/M`, {
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
