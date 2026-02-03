<template>
  <div class="container-fluid mt-4">
    <div v-if="store.loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3 text-muted">Chargement des traces...</p>
    </div>
    <div v-else-if="store.error" class="alert alert-danger">{{ store.error }}</div>
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="bi bi-activity me-2"></i>Traces de MAJ</h2>
        <button @click="store.loadTraces()" class="btn btn-outline-primary">
          <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
        </button>
      </div>
      <div class="mb-4">
        <input
          v-model="store.searchQuery"
          type="text"
          class="form-control"
          placeholder="Rechercher par ID, utilisateur, requête ou paramètres..."
          @input="store.currentPage = 1"
        />
      </div>
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="text-muted">{{ store.paginationInfo }} traces</div>
        <div class="d-flex align-items-center gap-2">
          <label class="mb-0">Lignes par page:</label>
          <select
            v-model.number="store.pageSize"
            class="form-select form-select-sm"
            style="width: auto"
            @change="store.currentPage = 1"
          >
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </div>
      </div>
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="thead-admin-site">
              <tr>
                <th @click="store.sortBy('id')" style="cursor: pointer; width: 80px">
                  ID <i :class="'bi ms-1 ' + store.getSortIcon('id')"></i>
                </th>
                <th @click="store.sortBy('created_at')" style="cursor: pointer; width: 160px">
                  Date Action <i :class="'bi ms-1 ' + store.getSortIcon('created_at')"></i>
                </th>
                <th @click="store.sortBy('username')" style="cursor: pointer; width: 120px">
                  Username <i :class="'bi ms-1 ' + store.getSortIcon('username')"></i>
                </th>
                <th style="width: 50%">Query</th>
                <th style="width: 150px">Params</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="store.paginatedTraces.length === 0">
                <td colspan="5" class="text-center text-muted py-4">Aucune trace trouvée</td>
              </tr>
              <tr v-for="trace in store.paginatedTraces" :key="trace.id">
                <td>{{ trace.id }}</td>
                <td>{{ store.formatDate(trace.created_at) }}</td>
                <td><span class="badge bg-primary">{{ trace.username || '—' }}</span></td>
                <td><code class="text-wrap" style="font-size: 0.85rem">{{ trace.query }}</code></td>
                <td><code class="text-wrap" style="font-size: 0.85rem">{{ store.truncate(trace.params, 80) }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="store.totalPages > 1" class="d-flex justify-content-center mt-4">
        <nav>
          <ul class="pagination">
            <li class="page-item" :class="{ disabled: store.currentPage === 1 }">
              <a class="page-link" href="javascript:void(0)" @click.prevent="store.goToPage(1)">
                <i class="bi bi-chevron-double-left"></i>
              </a>
            </li>
            <li class="page-item" :class="{ disabled: store.currentPage === 1 }">
              <a class="page-link" href="javascript:void(0)" @click.prevent="store.goToPage(store.currentPage - 1)">
                <i class="bi bi-chevron-left"></i>
              </a>
            </li>
            <template v-for="page in store.totalPages" :key="page">
              <li
                v-if="page === 1 || page === store.totalPages || (page >= store.currentPage - 2 && page <= store.currentPage + 2)"
                class="page-item"
                :class="{ active: page === store.currentPage }"
              >
                <a class="page-link" href="javascript:void(0)" @click.prevent="store.goToPage(page)">{{ page }}</a>
              </li>
              <li v-else-if="page === store.currentPage - 3 || page === store.currentPage + 3" class="page-item disabled">
                <span class="page-link">...</span>
              </li>
            </template>
            <li class="page-item" :class="{ disabled: store.currentPage === store.totalPages }">
              <a class="page-link" href="javascript:void(0)" @click.prevent="store.goToPage(store.currentPage + 1)">
                <i class="bi bi-chevron-right"></i>
              </a>
            </li>
            <li class="page-item" :class="{ disabled: store.currentPage === store.totalPages }">
              <a class="page-link" href="javascript:void(0)" @click.prevent="store.goToPage(store.totalPages)">
                <i class="bi bi-chevron-double-right"></i>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAdminTraceStore } from '@/stores/adminTrace';

const store = useAdminTraceStore();

onMounted(() => {
  store.loadTraces();
});
</script>
