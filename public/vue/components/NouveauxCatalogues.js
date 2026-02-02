// Composant nouveaux catalogues
export default {
  name: 'NouveauxCatalogues',
  props: {
    catalogues: {
      type: Array,
      required: true
    }
  },
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-bottom">
        <h5 class="mb-0">
          <i class="bi bi-star me-2"></i>Nouveaux catalogues disponibles
        </h5>
      </div>
      <div class="card-body">
        <div v-if="catalogues.length === 0" class="text-center text-muted">
          <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
          <p>Aucun nouveau catalogue</p>
        </div>
        <div v-else class="row g-3">
          <div v-for="catalogue in catalogues" :key="catalogue.id" class="col-md-4">
            <div class="card h-100 border">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <h6 class="card-title mb-0">{{ catalogue.originalname }}</h6>
                  <span class="badge bg-primary">Nouveau</span>
                </div>
                <p v-if="catalogue.description" class="card-text small text-muted mb-3">
                  {{ catalogue.description }}
                </p>
                <div class="small mb-2">
                  <i class="bi bi-calendar-event text-primary me-1"></i>
                  <strong>Commandes avant le :</strong> {{ catalogue.expiration }}
                </div>
                <div class="small mb-3">
                  <i class="bi bi-truck text-success me-1"></i>
                  <strong>Livraison le :</strong> {{ catalogue.livraison }}
                </div>
                <a :href="'/catalogues/' + catalogue.id" class="btn btn-sm btn-primary w-100">
                  <i class="bi bi-cart-plus me-1"></i>Commander
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
