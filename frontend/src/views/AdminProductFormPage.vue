<template>
  <div class="container-fluid px-3 mt-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h2 class="mb-0">{{ initialData.action === 'edit' ? 'Modifier un produit' : 'Créer un nouveau produit' }}</h2>
      <BackButton />
    </div>
    <div class="row">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <AdminProductFormContent
              :categories="initialData.categories"
              :suppliers="initialData.suppliers"
              :product="initialData.product"
              :product-id="initialData.productId"
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
import AdminProductFormContent from '@/components/AdminProductFormContent.vue';

const initialData = ref({
  action: 'add',
  product: null,
  productId: null,
  categories: [],
  suppliers: [],
});

const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  initialData.value = {
    action: data.action || 'add',
    product: data.product || null,
    productId: data.productId ?? data.product?.id ?? null,
    categories: data.categories || [],
    suppliers: data.suppliers || [],
  };
});

function onSuccess() {
  // Redirection gérée dans AdminProductFormContent quand modal=false
}
</script>
