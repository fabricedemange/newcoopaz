// Composant table des commandes
export default {
  name: 'CommandeTable',
  props: {
    commandes: {
      type: Array,
      required: true
    }
  },
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-bottom">
        <h5 class="mb-0">
          <i class="bi bi-truck me-2"></i>Mes commandes en attente de livraison
        </h5>
      </div>
      <div class="card-body p-0">
        <div v-if="commandes.length === 0" class="p-4 text-center text-muted">
          <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
          <p>Aucune commande en attente</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Catalogue</th>
                <th>Articles</th>
                <th>Date de livraison</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="commande in commandes" :key="commande.id">
                <td>{{ commande.catalogue_nom }}</td>
                <td>
                  <span class="badge bg-secondary">{{ commande.nb_articles }}</span>
                </td>
                <td>{{ commande.livraison }}</td>
                <td>
                  <span class="badge bg-success">
                    <i class="bi bi-check-circle me-1"></i>{{ commande.statut }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};
