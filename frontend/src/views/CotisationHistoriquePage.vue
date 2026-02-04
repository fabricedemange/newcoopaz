<template>
  <div class="admin-content-wrapper">
    <div class="container-fluid mt-4">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <h2 class="mb-0 text-precommandes"><i class="bi bi-coin me-2"></i>Mon historique de cotisation</h2>
        <BackButton />
      </div>

      <div v-if="error" class="alert alert-danger alert-dismissible fade show">
        <i class="bi bi-exclamation-triangle me-2"></i><strong>Erreur :</strong> {{ error }}
        <button type="button" class="btn-close" @click="error = null"></button>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-precommandes" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="mt-3 text-muted">Chargement...</p>
      </div>

      <div v-else-if="cotisations.length === 0" class="alert alert-info text-center">
        <h4>Aucune cotisation enregistrée</h4>
        <p>Vous n'avez pas encore de cotisation mensuelle (5-15 €) enregistrée dans l'historique.</p>
      </div>

      <template v-else>
        <p class="text-muted mb-3">{{ cotisations.length }} cotisation(s) au total</p>
        <div class="table-responsive">
          <table class="table table-hover">
            <thead class="thead-precommandes">
              <tr>
                <th>Date</th>
                <th>N° ticket</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in cotisations" :key="c.vente_id + '-' + (c.date_cotisation || '')">
                <td>{{ formatDate(c.date_cotisation) }}</td>
                <td>{{ c.numero_ticket || '—' }}</td>
                <td><strong>{{ formatMontant(c.montant_cotisation) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import { fetchMonHistoriqueCotisation } from '@/api';

const loading = ref(true);
const error = ref(null);
const cotisations = ref([]);

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMontant(val) {
  const n = parseFloat(val);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchMonHistoriqueCotisation({ limit: 200 });
    cotisations.value = data.cotisations || [];
  } catch (e) {
    error.value = e.message || 'Erreur chargement historique';
    cotisations.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
