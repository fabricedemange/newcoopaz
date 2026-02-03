<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <button class="btn btn-outline-secondary d-md-none mb-3" @click="history.back()">
        <i class="bi bi-arrow-left me-2"></i>Retour
      </button>

      <div v-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i><strong>Erreur :</strong> {{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement de la commande...</p>
      </div>

      <template v-else-if="store.commande">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="bi bi-receipt me-2"></i>Commande #{{ store.commande.id }}</h2>
          <a href="/commandes/vue" class="btn btn-secondary"><i class="bi bi-arrow-left me-1"></i>Retour aux commandes</a>
        </div>

        <div class="card mb-4">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0"><i class="bi bi-info-circle me-2"></i>Informations</h5>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <p><strong>Demandeur :</strong> <i class="bi bi-person-circle"></i> {{ store.commande.username }}</p>
                <p><strong>Catalogue :</strong> {{ store.commande.originalname }}</p>
                <p v-if="store.commande.catalog_description"><strong>Description :</strong> {{ store.commande.catalog_description }}</p>
                <p><strong>Date de commande :</strong> {{ store.commande.created_formatted }}</p>
              </div>
              <div class="col-md-6">
                <p><strong>Date d'expiration :</strong> {{ store.commande.expiration_formatted }} <span v-if="store.commande.isExpired" class="badge bg-danger ms-2">Expiré</span></p>
                <p><strong>Date de livraison :</strong> {{ store.commande.livraison_formatted }}</p>
                <p><strong>Statut :</strong> <span :class="store.commande.modifiable ? 'badge bg-warning' : 'badge bg-secondary'">{{ store.commande.modifiable ? 'Modifiable' : 'Non modifiable' }}</span></p>
              </div>
            </div>
            <div v-if="store.commande.note" class="alert alert-info mt-3"><strong>Note :</strong> {{ store.commande.note }}</div>
          </div>
        </div>

        <div v-if="store.commande.modifiable" class="mb-4">
          <button class="btn btn-warning" @click="confirmReopen">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Repasser en panier
          </button>
        </div>

        <div v-for="cat in store.articlesByCategory" :key="cat.name" class="card mb-4">
          <div class="card-header" :style="{ backgroundColor: cat.color + '20', borderLeft: '4px solid ' + cat.color }">
            <h5 class="mb-0">
              <i class="bi bi-tag-fill me-2" :style="{ color: cat.color }"></i>{{ cat.name }}
              <span class="badge bg-secondary ms-2">{{ cat.articles.length }} article(s)</span>
            </h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="thead-precommandes">
                  <tr>
                    <th style="width: 40%;">Produit</th>
                    <th style="width: 10%;">Fournisseur</th>
                    <th style="width: 10%;" class="text-end">Prix unitaire</th>
                    <th style="width: 10%;" class="text-center">Quantité</th>
                    <th style="width: 10%;" class="text-end">Total</th>
                    <th style="width: 20%;">Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="article in cat.articles" :key="article.id">
                    <td>
                      <strong>{{ article.produit }}</strong>
                      <br v-if="article.description"><small v-if="article.description" class="text-muted">{{ article.description }}</small>
                    </td>
                    <td>{{ article.fournisseur || '-' }}</td>
                    <td class="text-end">{{ formatPrice(article.prix) }} / {{ article.unite }}</td>
                    <td class="text-center"><span class="badge bg-primary">{{ article.quantity }}</span></td>
                    <td class="text-end"><strong>{{ formatPrice((parseFloat(article.prix) || 0) * (parseFloat(article.quantity) || 0)) }}</strong></td>
                    <td>
                      <div v-if="store.editingNoteId === article.id" class="input-group input-group-sm">
                        <input v-model="editingNoteValue" type="text" class="form-control" placeholder="Note optionnelle" @keyup.enter="saveArticleNote(article)" />
                        <button class="btn btn-success" @click="saveArticleNote(article)"><i class="bi bi-check"></i></button>
                        <button class="btn btn-secondary" @click="store.setEditingNoteId(null)"><i class="bi bi-x"></i></button>
                      </div>
                      <div v-else class="d-flex align-items-center gap-2">
                        <span class="flex-grow-1">{{ article.note || '-' }}</span>
                        <button class="btn btn-sm btn-outline-primary" @click="startEditNote(article)"><i class="bi bi-pencil"></i></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card bg-light">
          <div class="card-body">
            <div class="row">
              <div class="col-md-6"><h5>Total de la commande</h5></div>
              <div class="col-md-6 text-end"><h4 class="text-primary">{{ formatPrice(store.totalCommande) }}</h4></div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useCommandeDetailStore } from '@/stores/commandeDetail';
import { onMounted, ref, watch } from 'vue';

const store = useCommandeDetailStore();
const commandeIdRef = ref(null);
const editingNoteValue = ref('');

function getCommandeIdFromPath() {
  const parts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
  return parts[2] || null;
}

function formatPrice(price) {
  if (price == null) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}

function startEditNote(article) {
  store.setEditingNoteId(article.id);
  editingNoteValue.value = article.note || '';
}

function saveArticleNote(article) {
  const note = editingNoteValue.value;
  store.saveNote(article.id, note, typeof window !== 'undefined' ? window.CSRF_TOKEN : '').catch((e) => {
    console.error('saveNote:', e);
    if (typeof window !== 'undefined') alert('Erreur lors de la sauvegarde de la note');
  });
}

function confirmReopen() {
  if (!commandeIdRef.value) return;
  if (!confirm('Confirmer la réouverture de cette commande en panier ?')) return;
  store.reopenCommande(commandeIdRef.value, typeof window !== 'undefined' ? window.CSRF_TOKEN : '');
}

watch(() => store.editingNoteId, (id) => {
  if (!id) editingNoteValue.value = '';
});

onMounted(() => {
  const id = getCommandeIdFromPath();
  commandeIdRef.value = id;
  if (id) store.loadDetail(id);
});
</script>
