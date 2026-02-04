<template>
  <div class="container-fluid px-3 mt-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h2 class="mb-0">{{ initialData.action === 'edit' ? 'Modifier un fournisseur' : 'Créer un nouveau fournisseur' }}</h2>
      <BackButton />
    </div>
    <div class="row">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <AdminSupplierFormContent
              :supplier="initialData.supplier"
              :supplier-id="initialData.supplierId"
              :modal="false"
              :csrf-token="csrfToken"
              @success="onSuccess"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';
import AdminSupplierFormContent from '@/components/AdminSupplierFormContent.vue';

const initialData = ref({
  action: 'add',
  supplier: null,
  supplierId: null,
});

const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  initialData.value = {
    action: data.action || 'add',
    supplier: data.supplier || null,
    supplierId: data.supplierId ?? data.supplier?.id ?? null,
  };
});

function onSuccess() {
  // Redirection gérée dans AdminSupplierFormContent quand modal=false
}
</script>
