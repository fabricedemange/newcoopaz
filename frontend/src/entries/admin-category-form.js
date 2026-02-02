import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCategoryFormPage from '@/views/AdminCategoryFormPage.vue';

const app = createApp(AdminCategoryFormPage);
app.use(createPinia());
app.mount('#admin-category-form-app');
