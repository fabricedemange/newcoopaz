<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid px-3 mt-4">
      <button class="btn btn-outline-secondary d-md-none mb-3" type="button" @click="goBack">
        <i class="bi bi-arrow-left me-2"></i>Retour
      </button>

      <div class="row mb-4">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0"><i class="bi bi-speedometer2 me-2"></i>Dashboard Administrateur</h2>
            <div class="d-flex gap-2 align-items-center">
              <BackButton />
              <div v-if="store.referentScopeActive" class="d-none d-md-block">
              <div class="form-check form-switch mb-0">
                <input
                  id="scopeToggle"
                  v-model="store.showAllScope"
                  class="form-check-input"
                  type="checkbox"
                  @change="store.toggleScope()"
                >
                <label class="form-check-label" for="scopeToggle">
                  {{ store.showAllScope ? 'Voir tous' : 'Mes éléments' }}
                </label>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.referentScopeActive" class="row mb-3 d-md-none">
        <div class="col-12">
          <div class="dropdown">
            <button class="btn btn-primary dropdown-toggle w-100" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi bi-filter me-2"></i>Vue
            </button>
            <ul class="dropdown-menu w-100">
              <li>
                <a class="dropdown-item" href="#" @click.prevent="store.toggleScope()">
                  <i class="bi bi-people me-2"></i>{{ store.showAllScope ? 'Mes éléments' : 'Voir tous' }}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="store.authRequired" class="alert alert-warning">
        <i class="bi bi-lock me-2"></i>
        Vous devez vous connecter.
        <a href="/login" class="alert-link ms-2">Se connecter</a>
      </div>

      <div v-else-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <div class="mb-4">
        <div class="d-flex flex-wrap gap-2 justify-content-center justify-md-start">
          <a href="#catalogues" class="badge text-decoration-none fs-6 py-2 px-3" :class="activeSection === 'catalogues' ? 'bg-primary' : 'bg-secondary'" @click.prevent="activeSection = 'catalogues'">
            <i class="bi bi-book-fill me-1"></i>Catalogues ({{ store.catalogues.length }})
          </a>
          <a href="#commandes" class="badge text-decoration-none fs-6 py-2 px-3" :class="activeSection === 'commandes' ? 'bg-success' : 'bg-secondary'" @click.prevent="activeSection = 'commandes'">
            <i class="bi bi-bag-check-fill me-1"></i>Commandes ({{ store.totalCommandes }})
          </a>
          <a href="#paniers" class="badge text-decoration-none fs-6 py-2 px-3" :class="activeSection === 'paniers' ? 'bg-warning' : 'bg-secondary'" @click.prevent="activeSection = 'paniers'">
            <i class="bi bi-cart-fill me-1"></i>Paniers ({{ store.paniers.length }})
          </a>
        </div>
      </div>

      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement du dashboard...</p>
      </div>

      <template v-else>
        <!-- Section Catalogues -->
        <div v-if="activeSection === 'catalogues'" class="row mb-4">
          <div class="col-12">
            <h3 id="catalogues" class="fs-5">Catalogues concernés par les commandes</h3>
            <div v-if="store.catalogues.length === 0" class="alert alert-info text-center">Aucun catalogue trouvé</div>
            <template v-else>
              <div class="d-none d-md-block table-responsive">
                <table class="table table-striped table-hover">
                  <thead class="thead-administration">
                    <tr>
                      <th>N°</th><th>Nom</th><th>Description</th><th>Expiration</th><th>Livraison</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in store.catalogues" :key="c.id">
                      <td><strong>{{ c.id }}</strong></td>
                      <td><a :href="`/admin/catalogues/${c.id}/edit`" class="text-decoration-none">{{ c.originalname }}</a></td>
                      <td><small>{{ truncate(c.description, 100) }}</small></td>
                      <td>{{ c.expiration_formatted }} <span v-if="c.isExpired" class="badge bg-danger">Expiré</span></td>
                      <td>{{ c.livraison_formatted }}</td>
                      <td>
                        <a :href="`/admin/catalogues/${c.id}/synthese/vue`" class="btn btn-sm btn-primary me-1"><i class="bi bi-file-earmark-spreadsheet"></i> Synthèse</a>
                        <a :href="`/admin/catalogues/${c.id}/synthese-detaillee/vue`" class="btn btn-sm btn-info"><i class="bi bi-file-earmark-text"></i> Synthèse détaillée</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="d-md-none">
                <div v-for="c in store.catalogues" :key="c.id" class="card mb-2 shadow-sm">
                  <div class="card-body p-2" style="font-size: 0.7rem;">
                    <strong>Cat #{{ c.id }}</strong> {{ c.isExpired ? ' ' : '' }}<span v-if="c.isExpired" class="badge bg-danger" style="font-size: 0.6rem;">Expiré</span>
                    <div class="text-muted" style="font-size: 0.65rem;">Expire le <strong>{{ c.expiration_formatted }}</strong> • Livré le <strong>{{ c.livraison_formatted }}</strong></div>
                    <div class="mb-1"><strong>{{ c.originalname }}</strong></div>
                    <div v-if="c.description" class="text-muted mb-2" style="font-size: 0.65rem;">{{ truncate(c.description, 80) }}</div>
                    <div class="dropdown">
                      <button class="btn btn-sm btn-secondary dropdown-toggle w-100" type="button" data-bs-toggle="dropdown" style="font-size: 0.7rem;">Actions</button>
                      <ul class="dropdown-menu" style="font-size: 0.75rem;">
<li><a class="dropdown-item" :href="`/admin/catalogues/${c.id}/synthese/vue`"><i class="bi bi-file-earmark-spreadsheet me-2"></i>Synthèse</a></li>
                    <li><a class="dropdown-item" :href="`/admin/catalogues/${c.id}/synthese-detaillee/vue`"><i class="bi bi-file-earmark-text me-2"></i>Synthèse détaillée</a></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Section Commandes -->
        <div v-if="activeSection === 'commandes'" class="row mb-4">
          <div class="col-12">
            <h3 id="commandes" class="fs-5">Commandes validées</h3>
            <div v-if="store.commandes.length === 0" class="alert alert-info text-center">Aucune commande trouvée</div>
            <template v-else>
              <div class="d-none d-md-block table-responsive">
                <table class="table table-striped table-hover">
                  <thead class="thead-administration">
                    <tr>
                      <th style="cursor: pointer" class="user-select-none" @click="store.setCommandesSort('id')">N° <i :class="'bi ms-1 ' + getCommandesSortIcon('id')"></i></th>
                      <th style="cursor: pointer" class="user-select-none" @click="store.setCommandesSort('username')">Utilisateur <i :class="'bi ms-1 ' + getCommandesSortIcon('username')"></i></th>
                      <th style="cursor: pointer" class="user-select-none" @click="store.setCommandesSort('catalogue')">Catalogue <i :class="'bi ms-1 ' + getCommandesSortIcon('catalogue')"></i></th>
                      <th style="cursor: pointer" class="user-select-none" @click="store.setCommandesSort('created_at')">Date commande <i :class="'bi ms-1 ' + getCommandesSortIcon('created_at')"></i></th>
                      <th style="cursor: pointer" class="user-select-none" @click="store.setCommandesSort('date_livraison')">Livraison <i :class="'bi ms-1 ' + getCommandesSortIcon('date_livraison')"></i></th>
                      <th style="cursor: pointer" class="user-select-none text-center" @click="store.setCommandesSort('nb_produits')">Nb produits <i :class="'bi ms-1 ' + getCommandesSortIcon('nb_produits')"></i></th>
                      <th style="cursor: pointer" class="user-select-none text-end" @click="store.setCommandesSort('montant_total')">Montant <i :class="'bi ms-1 ' + getCommandesSortIcon('montant_total')"></i></th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="cmd in store.sortedCommandes" :key="cmd.id">
                      <td><strong>{{ cmd.id }}</strong></td>
                      <td><i class="bi bi-person-circle"></i> {{ cmd.username }} <small v-if="cmd.note" class="badge bg-info">📝 {{ cmd.note }}</small></td>
                      <td>{{ cmd.catalogue }} <br><small class="text-muted">N°{{ cmd.catalog_file_id }}</small></td>
                      <td>{{ cmd.created_formatted }}</td>
                      <td>{{ cmd.livraison_formatted }}</td>
                      <td class="text-center"><span class="badge bg-primary">{{ cmd.nb_produits || 0 }}</span></td>
                      <td class="text-end"><strong>{{ (cmd.montant_total || 0).toFixed(2) }} €</strong></td>
                      <td><a :href="`/commandes/${cmd.id}/vue`" class="btn btn-sm btn-info"><i class="bi bi-eye"></i> Voir</a></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="d-md-none">
                <div v-for="cmd in store.sortedCommandes" :key="cmd.id" class="card mb-2 shadow-sm">
                  <div class="card-body p-2" style="font-size: 0.7rem;">
                    <strong>Cde #{{ cmd.id }}</strong> le <strong>{{ cmd.created_formatted }}</strong>
                    <div style="font-size: 0.65rem;"><i class="bi bi-person-circle"></i> {{ cmd.username }}</div>
                    <div style="font-size: 0.65rem;">{{ cmd.nb_produits || 0 }} produits • <strong>{{ (cmd.montant_total || 0).toFixed(2) }} €</strong></div>
                    <div class="text-center mt-2">
                      <a :href="`/commandes/${cmd.id}/vue`" class="btn btn-sm btn-info" style="min-width: 150px; font-size: 0.7rem;">Voir détails</a>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Section Paniers -->
        <div v-if="activeSection === 'paniers'" class="row mb-4">
          <div class="col-12">
            <h3 id="paniers" class="fs-5">Paniers en cours</h3>
            <div v-if="store.paniers.length === 0" class="alert alert-info text-center">Aucun panier trouvé</div>
            <template v-else>
              <div class="d-none d-md-block table-responsive">
                <table class="table table-striped table-hover">
                  <thead class="thead-administration">
                    <tr>
                      <th>N°</th><th>Utilisateur</th><th>Catalogue</th><th>Date création</th><th>Expiration</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in store.paniers" :key="p.id">
                      <td><strong>{{ p.id }}</strong></td>
                      <td><i class="bi bi-person-circle"></i> {{ p.username }} <small v-if="p.note" class="badge bg-info">📝 {{ p.note }}</small></td>
                      <td>{{ p.catalogue }} <br><small class="text-muted">N°{{ p.catalog_file_id }}</small></td>
                      <td>{{ p.created_formatted }}</td>
                      <td>{{ p.expiration_formatted }} <span v-if="p.isExpired" class="badge bg-danger">Expiré</span></td>
                      <td><a :href="`/panier/${p.id}/modifier/vue`" class="btn btn-sm btn-primary"><i class="bi bi-pencil"></i> Modifier</a></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="d-md-none">
                <div v-for="p in store.paniers" :key="p.id" class="card mb-2 shadow-sm">
                  <div class="card-body p-2" style="font-size: 0.7rem;">
                    <strong>Panier #{{ p.id }}</strong> créé le <strong>{{ p.created_formatted }}</strong> <span v-if="p.isExpired" class="badge bg-danger" style="font-size: 0.6rem;">Expiré</span>
                    <div style="font-size: 0.65rem;"><i class="bi bi-person-circle"></i> {{ p.username }}</div>
                    <div class="text-center mt-2">
                      <a :href="`/panier/${p.id}/modifier/vue`" class="btn btn-sm btn-primary" style="min-width: 150px; font-size: 0.7rem;">Modifier</a>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useAdminDashboardStore } from '@/stores/adminDashboard';
import { ref, onMounted, watch } from 'vue';
import BackButton from '@/components/BackButton.vue';

const store = useAdminDashboardStore();
const activeSection = ref('catalogues');

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function goBack() {
  window.history.back();
}

function getCommandesSortIcon(column) {
  if (store.commandesSortColumn !== column) return 'bi-arrow-down-up text-secondary opacity-50';
  return store.commandesSortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
}

onMounted(() => {
  const hash = window.location.hash.substring(1);
  if (hash && ['catalogues', 'commandes', 'paniers'].includes(hash)) {
    activeSection.value = hash;
  }
  const scope = new URLSearchParams(window.location.search).get('scope') || 'all';
  store.loadDashboard(scope);
});

watch(activeSection, (s) => {
  if (typeof window !== 'undefined') window.location.hash = s;
});
</script>
