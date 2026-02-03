<template>
  <div class="container-fluid px-3 mt-4">
    <h2 class="mb-4">{{ initialData.action === 'edit' ? 'Modifier une catégorie' : 'Créer une nouvelle catégorie' }}</h2>
    <div class="row">
      <div class="col-12 col-lg-8">
        <div class="card">
          <div class="card-body">
            <AdminCategoryFormContent
              :all-categories="initialData.allCategories"
              :category="initialData.category"
              :category-id="initialData.categoryId"
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
import AdminCategoryFormContent from '@/components/AdminCategoryFormContent.vue';

const initialData = ref({
  action: 'add',
  category: null,
  categoryId: null,
  allCategories: [],
});

const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  initialData.value = {
    action: data.action || 'add',
    category: data.category || null,
    categoryId: data.categoryId ?? data.category?.id ?? null,
    allCategories: data.allCategories || [],
  };
});

function onSuccess() {
  // Redirection gérée dans AdminCategoryFormContent quand modal=false
}
</script>
