<template>
  <div class="container-fluid px-3 mt-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h2 class="mb-0">{{ initialData.action === 'edit' ? 'Modifier une catégorie' : 'Créer une nouvelle catégorie' }}</h2>
      <BackButton />
    </div>
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
import BackButton from '@/components/BackButton.vue';
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
