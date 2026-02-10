<template>
  <div class="container-fluid px-3 mt-4">
      <div class="row mb-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h2 class="mb-0"><i class="bi bi-arrow-left-right me-2"></i>Mouvements de stock</h2>
            <div class="d-flex gap-2">
              <BackButton />
              <a href="/caisse" class="btn btn-outline-primary">
              <i class="bi bi-arrow-left me-2"></i>Retour caisse
            </a>
            </div>
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
          <h5 class="mb-0"><i class="bi bi-funnel me-2"></i>Filtres et tri</h5>
        </div>
        <div class="card-body">
          <div class="row g-2 mb-2">
            <div class="col-md-3">
              <label class="form-label small">Recherche produit</label>
              <input
                v-model="filters.product_search"
                type="text"
                class="form-control form-control-sm"
                placeholder="Nom du produit..."
                @keyup.enter="charger"
              />
            </div>
            <div class="col-md-2">
              <label class="form-label small">Type</label>
              <select v-model="filters.type" class="form-select form-select-sm">
                <option value="">Tous</option>
                <option value="vente">Vente</option>
                <option value="inventaire">Inventaire</option>
                <option value="ajustement">Ajustement</option>
                <option value="reception">Réception</option>
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
            <div class="col-md-2">
              <label class="form-label small">Trier par</label>
              <select v-model="filters.sort_by" class="form-select form-select-sm" @change="charger">
                <option value="created_at">Date</option>
                <option value="product_nom">Produit</option>
                <option value="type">Type</option>
                <option value="quantite">Quantité</option>
                <option value="stock_avant">Stock avant</option>
                <option value="stock_apres">Stock après</option>
              </select>
            </div>
          </div>
          <div class="row g-2">
            <div class="col-12">
              <button type="button" class="btn btn-primary btn-sm me-1" @click="charger">
                <i class="bi bi-search me-1"></i>Rechercher
              </button>
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="reinitFiltres">
                <i class="bi bi-x-circle me-1"></i>Réinitialiser
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
              <thead class="table-light">
                <tr>
                  <th class="sortable" :class="{ 'sorted': filters.sort_by === 'created_at' }" @click="setSort('created_at')">
                    Date <i v-if="filters.sort_by === 'created_at'" class="bi ms-1" :class="filters.sort_order === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                  </th>
                  <th class="sortable" :class="{ 'sorted': filters.sort_by === 'product_nom' }" @click="setSort('product_nom')">
                    Produit <i v-if="filters.sort_by === 'product_nom'" class="bi ms-1" :class="filters.sort_order === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                  </th>
                  <th class="sortable" :class="{ 'sorted': filters.sort_by === 'type' }" @click="setSort('type')">
                    Type <i v-if="filters.sort_by === 'type'" class="bi ms-1" :class="filters.sort_order === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                  </th>
                  <th class="text-end sortable" :class="{ 'sorted': filters.sort_by === 'quantite' }" @click="setSort('quantite')">
                    Quantité <i v-if="filters.sort_by === 'quantite'" class="bi ms-1" :class="filters.sort_order === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                  </th>
                  <th class="text-end sortable" :class="{ 'sorted': filters.sort_by === 'stock_avant' }" @click="setSort('stock_avant')">
                    Stock avant <i v-if="filters.sort_by === 'stock_avant'" class="bi ms-1" :class="filters.sort_order === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                  </th>
                  <th class="text-end sortable" :class="{ 'sorted': filters.sort_by === 'stock_apres' }" @click="setSort('stock_apres')">
                    Stock après <i v-if="filters.sort_by === 'stock_apres'" class="bi ms-1" :class="filters.sort_order === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                  </th>
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
import BackButton from '@/components/BackButton.vue';
import { fetchStockMouvements } from '@/api';

const movements = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const limit = 200;
const filters = reactive({
  product_search: '',
  type: '',
  date_debut: '',
  date_fin: '',
  sort_by: 'created_at',
  sort_order: 'desc',
});

function setSort(col) {
  if (filters.sort_by === col) {
    filters.sort_order = filters.sort_order === 'asc' ? 'desc' : 'asc';
  } else {
    filters.sort_by = col;
    filters.sort_order = col === 'created_at' || col === 'quantite' || col === 'stock_avant' || col === 'stock_apres' ? 'desc' : 'asc';
  }
  charger();
}

function reinitFiltres() {
  filters.product_search = '';
  filters.type = '';
  filters.date_debut = '';
  filters.date_fin = '';
  filters.sort_by = 'created_at';
  filters.sort_order = 'desc';
  charger();
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function badgeClass(type) {
  if (type === 'vente') return 'bg-secondary';
  if (type === 'inventaire') return 'bg-info';
  if (type === 'reception') return 'bg-success';
  if (type === 'ajustement') return 'bg-warning text-dark';
  return 'bg-light text-dark';
}

async function charger() {
  loading.value = true;
  error.value = '';
  try {
    const params = { limit, offset: 0, sort_by: filters.sort_by, sort_order: filters.sort_order };
    if (filters.product_search && filters.product_search.trim()) params.product_search = filters.product_search.trim();
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

<style scoped>
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { background-color: rgba(0,0,0,.05); }
.sortable.sorted { font-weight: 600; }
</style>
