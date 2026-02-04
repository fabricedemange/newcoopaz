<template>
  <div class="admin-content-wrapper home-page">
    <div class="container mt-5">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <h2 class="mb-0">
          <i class="bi bi-house-door me-2"></i>Tableau de bord
        </h2>
      </div>

      <div v-if="store.authRequired" class="alert alert-warning">
        <i class="bi bi-lock me-2"></i>
        Vous devez vous connecter pour accéder au tableau de bord.
        <a :href="loginUrl" class="alert-link ms-2">Se connecter</a>
      </div>

      <div v-else-if="store.error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ store.error }}
        <button type="button" class="btn-close" @click="store.error = null"></button>
      </div>

      <div v-if="store.loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement des données...</p>
      </div>

      <template v-else>
        <div class="row mb-5">
          <div class="col-md-4 mb-3">
            <a href="/panier/vue" class="text-decoration-none text-reset d-block h-100 card-link-block">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center p-4">
                  <div class="mb-3"><i class="bi bi-cart3 fs-1 text-primary"></i></div>
                  <h3 class="display-4 fw-bold mb-2">{{ store.stats.paniers }}</h3>
                  <p class="text-muted mb-0">Paniers en cours</p>
                </div>
              </div>
            </a>
          </div>
          <div class="col-md-4 mb-3">
            <a href="/commandes/vue" class="text-decoration-none text-reset d-block h-100 card-link-block">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center p-4">
                  <div class="mb-3"><i class="bi bi-truck fs-1 text-success"></i></div>
                  <h3 class="display-4 fw-bold mb-2">{{ store.stats.commandes }}</h3>
                  <p class="text-muted mb-0">Commandes en attente</p>
                </div>
              </div>
            </a>
          </div>
          <div class="col-md-4 mb-3">
            <a href="/catalogues/vue" class="text-decoration-none text-reset d-block h-100 card-link-block">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center p-4">
                  <div class="mb-3"><i class="bi bi-book fs-1 text-info"></i></div>
                  <h3 class="display-4 fw-bold mb-2">{{ store.stats.catalogues }}</h3>
                  <p class="text-muted mb-0">Catalogues disponibles</p>
                </div>
              </div>
            </a>
          </div>
        </div>

        <div class="row mb-4">
          <div class="col-12 mb-4">
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white border-bottom">
                <h5 class="mb-0">
                  <a href="/panier/vue" class="text-decoration-none text-dark"><i class="bi bi-cart3 me-2"></i>Mes paniers en cours</a>
                </h5>
              </div>
              <div class="card-body p-0">
                <div v-if="!store.hasPaniers" class="p-4 text-center text-muted">
                  <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                  <p>Aucun panier en cours</p>
                </div>
                <div v-else class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead class="thead-precommandes">
                      <tr>
                        <th>ID</th><th>Catalogue</th><th>Articles</th><th>Date d'expiration</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="panier in store.paniersDetails" :key="panier.id">
                        <td><span class="badge bg-light text-dark">#{{ panier.id }}</span></td>
                        <td>{{ panier.catalogue_nom }}</td>
                        <td><span class="badge bg-secondary">{{ panier.nb_articles }}</span></td>
                        <td>
                          {{ panier.expiration }}
                          <span v-if="panierExpirationBadge(panier.expiration_commande)" class="badge ms-2" :class="panierExpirationBadge(panier.expiration_commande).class">
                            {{ panierExpirationBadge(panier.expiration_commande).text }}
                          </span>
                        </td>
                        <td>
                          <a :href="`/panier/${panier.id}/modifier/vue`" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-pencil me-1"></i>Modifier
                          </a>
                          <a :href="`/catalogues/${panier.catalogue_id}/vue`" class="btn btn-sm btn-outline-secondary ms-1">
                            <i class="bi bi-eye me-1"></i>Voir
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 mb-4">
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white border-bottom">
                <h5 class="mb-0">
                  <a href="/commandes/vue" class="text-decoration-none text-dark"><i class="bi bi-truck me-2"></i>Mes commandes en attente de livraison</a>
                </h5>
              </div>
              <div class="card-body p-0">
                <div v-if="!store.hasCommandes" class="p-4 text-center text-muted">
                  <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                  <p>Aucune commande en attente</p>
                </div>
                <div v-else class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead class="thead-precommandes">
                      <tr>
                        <th>ID</th><th>Catalogue</th><th>Articles</th><th>Date de livraison</th><th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="c in store.commandesDetails" :key="c.id">
                        <td><span class="badge bg-light text-dark">#{{ c.id }}</span></td>
                        <td>{{ c.catalogue_nom }}</td>
                        <td><span class="badge bg-secondary">{{ c.nb_articles }}</span></td>
                        <td>{{ c.livraison }}</td>
                        <td><span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>{{ c.statut }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 mb-4">
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white border-bottom">
                <h5 class="mb-0">
                  <a href="/catalogues/vue" class="text-decoration-none text-dark"><i class="bi bi-star me-2"></i>Nouveaux catalogues disponibles</a>
                </h5>
              </div>
              <div class="card-body">
                <div v-if="!store.hasNouveauxCatalogues" class="text-center text-muted">
                  <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
                  <p>Aucun nouveau catalogue</p>
                </div>
                <div v-else class="row g-3">
                  <div v-for="cat in store.nouveauxCatalogues" :key="cat.id" class="col-md-4">
                    <div class="card h-100 border">
                      <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                          <h6 class="card-title mb-0">{{ cat.originalname }}</h6>
                          <span class="badge bg-primary">Nouveau</span>
                        </div>
                        <p v-if="cat.description" class="card-text small text-muted mb-3">{{ cat.description }}</p>
                        <div class="small mb-2">
                          <i class="bi bi-calendar-event text-primary me-1"></i>
                          <strong>Commandes avant le :</strong> {{ cat.expiration }}
                        </div>
                        <div class="small mb-3">
                          <i class="bi bi-truck text-success me-1"></i>
                          <strong>Livraison le :</strong> {{ cat.livraison }}
                        </div>
                        <a :href="`/catalogues/${cat.id}/vue`" class="btn btn-sm btn-primary w-100">
                          <i class="bi bi-cart-plus me-1"></i>Commander
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useHomeStore } from '@/stores/home';
import { onMounted, computed } from 'vue';

const store = useHomeStore();

const loginUrl = computed(() => {
  const redirect = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  return redirect ? `/login?redirect=${redirect}` : '/login';
});

function panierExpirationBadge(expirationDate) {
  if (!expirationDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
  if (diffDays > 3) return null;
  const texts = { 0: "Expire aujourd'hui !", 1: 'Expire demain !', 2: 'Expire dans 2 jours', 3: 'Expire dans 3 jours' };
  const classes = { 0: 'bg-danger', 1: 'bg-warning text-dark', 2: 'bg-info', 3: 'bg-info' };
  return { text: texts[diffDays] ?? `Expire dans ${diffDays} jours`, class: classes[diffDays] ?? '' };
}

onMounted(() => {
  store.loadHomeData();
});
</script>

<style scoped>
.home-page .card-link-block:hover .card {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.12) !important;
  transform: translateY(-2px);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.home-page .card-link-block .card {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.home-page .card-header a:hover {
  color: var(--bs-primary) !important;
}
</style>
