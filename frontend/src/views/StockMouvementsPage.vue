<template>
  <div class="container-fluid px-3 mt-4">
      <div class="row mb-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2 class="mb-0"><i class="bi bi-arrow-left-right me-2"></i>Mouvements de stock</h2>
            <a href="/caisse" class="btn btn-outline-primary">
              <i class="bi bi-arrow-left me-2"></i>Retour caisse
            </a>
          </div>
          <p class="text-muted small mb-0 mt-2">
            Historique des mouvements de stock (ventes, ajustements, inventaires).
          </p>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger alert-dismissible show">
        {{ error }}
        <button type="button" class="btn-close" @click="error = null" aria-label="Fermer"></button>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h5 class="mb-0"><i class="bi bi-funnel me-2"></i>Filtres</h5>
        </div>
        <div class="card-body">
          <div class="row g-2">
            <div class="col-md-2">
              <label class="form-label small">Type</label>
              <select v-model="filters.type" class="form-select form-select-sm">
                <option value="">Tous</option>
                <option value="vente">Vente</option>
                <option value="inventaire">Inventaire</option>
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small">Date début</label>
              <input v-model="filters.date_debut" type="date" class="form-control form-control-sm" />
            </div>
            <div class="col-md-2">
              <label class="form-label small">Date fin</label>
              <input v-model="filters.date_fin" type="date" class="form-control form-control-sm" />
            </div>
            <div class="col-md-2 d-flex align-items-end">
              <button type="button" class="btn btn-primary btn-sm" @click="charger">
                <i class="bi bi-search me-1"></i>Rechercher
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div v-else class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Résultats ({{ total }} mouvement{{ total !== 1 ? 's' : '' }})</h5>
        </div>
        <div class="card-body p-0">
          <div v-if="movements.length === 0" class="p-4 text-center text-muted">
            Aucun mouvement trouvé.
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>Type</th>
                  <th class="text-end">Quantité</th>
                  <th class="text-end">Stock avant</th>
                  <th class="text-end">Stock après</th>
                  <th>Commentaire</th>
                  <th>Utilisateur</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in movements" :key="m.id">
                  <td>{{ formatDate(m.created_at) }}</td>
                  <td>{{ m.product_nom }}</td>
                  <td>
                    <span class="badge" :class="badgeClass(m.type)">{{ m.type }}</span>
                  </td>
                  <td class="text-end" :class="m.quantite < 0 ? 'text-danger' : 'text-success'">
                    {{ m.quantite > 0 ? '+' : '' }}{{ m.quantite }}
                  </td>
                  <td class="text-end">{{ m.stock_avant }}</td>
                  <td class="text-end">{{ m.stock_apres }}</td>
                  <td class="small text-muted">{{ m.comment || '—' }}</td>
                  <td>{{ m.created_by_username || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="total > limit" class="p-2 border-top small text-muted">
            Affichage des {{ movements.length }} premiers résultats. Utilisez les filtres pour affiner.
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { fetchStockMouvements } from '@/api';

const movements = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const limit = 50;
const filters = reactive({
  type: '',
  date_debut: '',
  date_fin: '',
});

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function badgeClass(type) {
  if (type === 'vente') return 'bg-secondary';
  if (type === 'inventaire') return 'bg-info';
  return 'bg-light text-dark';
}

async function charger() {
  loading.value = true;
  error.value = '';
  try {
    const params = { limit, offset: 0 };
    if (filters.type) params.type = filters.type;
    if (filters.date_debut) params.date_debut = filters.date_debut;
    if (filters.date_fin) params.date_fin = filters.date_fin;
    const data = await fetchStockMouvements(params);
    movements.value = data.movements || [];
    total.value = data.total ?? 0;
  } catch (e) {
    error.value = e.message || 'Erreur chargement';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  charger();
});
</script>
