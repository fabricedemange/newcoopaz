<template>
  <div class="container-fluid px-3 mt-4">
      <div class="row mb-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2 class="mb-0"><i class="bi bi-clipboard-data me-2"></i>Historique des inventaires</h2>
            <div class="d-flex gap-2">
              <BackButton />
              <a href="/caisse/inventaire" class="btn btn-primary">
                <i class="bi bi-plus me-2"></i>Nouvel inventaire
              </a>
              <a href="/caisse" class="btn btn-outline-primary">
                <i class="bi bi-arrow-left me-2"></i>Retour caisse
              </a>
            </div>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Liste des sessions d'inventaire (draft ou complétées).
          </p>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger alert-dismissible show">
        {{ error }}
        <button type="button" class="btn-close" @click="error = null" aria-label="Fermer"></button>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div v-else class="card">
        <div class="card-header">
          <h5 class="mb-0">Sessions ({{ total }})</h5>
        </div>
        <div class="card-body p-0">
          <div v-if="inventaires.length === 0" class="p-4 text-center text-muted">
            Aucune session d'inventaire.
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th>Par</th>
                  <th>Nb lignes</th>
                  <th>Clôturé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="i in inventaires" :key="i.id">
                  <td>#{{ i.id }}</td>
                  <td>
                    <span class="badge" :class="i.statut === 'complete' ? 'bg-success' : 'bg-secondary'">
                      {{ i.statut === 'complete' ? 'Terminé' : 'Brouillon' }}
                    </span>
                  </td>
                  <td>{{ formatDate(i.created_at) }}</td>
                  <td>{{ i.created_by_username || '—' }}</td>
                  <td>{{ i.nb_lignes ?? 0 }}</td>
                  <td>{{ i.completed_at ? formatDate(i.completed_at) : '—' }}</td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm"
                      @click="voirDetail(i.id)"
                    >
                      <i class="bi bi-eye me-1"></i>Détail
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modale détail inventaire -->
      <div v-if="showDetailModal" class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Inventaire #{{ detail?.inventaire?.id }}</h5>
              <button type="button" class="btn-close" @click="showDetailModal = false" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <p v-if="detailLoading" class="text-muted">Chargement...</p>
              <template v-else-if="detail">
                <p class="small text-muted">
                  Statut: {{ detail.inventaire?.statut }} —
                  Créé le {{ formatDate(detail.inventaire?.created_at) }} par {{ detail.inventaire?.created_by_username }}
                </p>
                <div class="table-responsive">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th class="text-end">Qté comptée</th>
                        <th class="text-end">Stock théorique</th>
                        <th class="text-end">Écart</th>
                        <th>Commentaire (écart)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="l in (detail.lignes || [])" :key="l.product_id">
                        <td>{{ l.product_nom }}</td>
                        <td class="text-end">{{ l.quantite_comptee }}</td>
                        <td class="text-end">{{ l.stock_theorique }}</td>
                        <td class="text-end" :class="l.ecart > 0 ? 'text-success' : l.ecart < 0 ? 'text-danger' : ''">
                          {{ l.ecart > 0 ? '+' : '' }}{{ l.ecart }}
                        </td>
                        <td class="small text-muted">{{ l.comment || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { fetchInventaires, fetchInventaireDetail } from '@/api';

const inventaires = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const showDetailModal = ref(false);
const detail = ref(null);
const detailLoading = ref(false);

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

async function charger() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchInventaires({ limit: 100, offset: 0 });
    inventaires.value = data.inventaires || [];
    total.value = data.total ?? 0;
  } catch (e) {
    error.value = e.message || 'Erreur chargement';
  } finally {
    loading.value = false;
  }
}

async function voirDetail(id) {
  showDetailModal.value = true;
  detail.value = null;
  detailLoading.value = true;
  try {
    const data = await fetchInventaireDetail(id);
    detail.value = data;
  } catch (e) {
    error.value = e.message || 'Erreur détail';
  } finally {
    detailLoading.value = false;
  }
}

onMounted(() => {
  charger();
});
</script>
