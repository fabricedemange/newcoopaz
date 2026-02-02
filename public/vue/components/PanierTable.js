// Composant table des paniers
export default {
  name: 'PanierTable',
  props: {
    paniers: {
      type: Array,
      required: true
    }
  },
  methods: {
    calculateDiffDays(expirationDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expDate = new Date(expirationDate);
      expDate.setHours(0, 0, 0, 0);
      const diffTime = expDate - today;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },
    getBadgeClass(diffDays) {
      if (diffDays === 0) return 'bg-danger';
      if (diffDays === 1) return 'bg-warning text-dark';
      if (diffDays <= 3) return 'bg-info';
      return '';
    },
    getBadgeText(diffDays) {
      if (diffDays === 0) return "Expire aujourd'hui !";
      if (diffDays === 1) return 'Expire demain !';
      if (diffDays === 2) return 'Expire dans 2 jours';
      if (diffDays === 3) return 'Expire dans 3 jours';
      return '';
    }
  },
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-bottom">
        <h5 class="mb-0">
          <i class="bi bi-cart3 me-2"></i>Mes paniers en cours
        </h5>
      </div>
      <div class="card-body p-0">
        <div v-if="paniers.length === 0" class="p-4 text-center text-muted">
          <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
          <p>Aucun panier en cours</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Catalogue</th>
                <th>Articles</th>
                <th>Date d'expiration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="panier in paniers" :key="panier.id">
                <td>{{ panier.catalogue_nom }}</td>
                <td>
                  <span class="badge bg-secondary">{{ panier.nb_articles }}</span>
                </td>
                <td>
                  {{ panier.expiration }}
                  <span
                    v-if="calculateDiffDays(panier.expiration_commande) <= 3"
                    :class="['badge', 'ms-2', getBadgeClass(calculateDiffDays(panier.expiration_commande))]"
                  >
                    {{ getBadgeText(calculateDiffDays(panier.expiration_commande)) }}
                  </span>
                </td>
                <td>
                  <a :href="'/panier/' + panier.id + '/modifier'" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-pencil me-1"></i>Modifier
                  </a>
                  <a :href="'/panier/' + panier.id + '/catalogue/' + panier.catalogue_id" class="btn btn-sm btn-outline-secondary ms-1">
                    <i class="bi bi-eye me-1"></i>Voir
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};
