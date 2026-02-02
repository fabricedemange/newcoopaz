import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCategoriesPage from '@/views/AdminCategoriesPage.vue';

const app = createApp(AdminCategoriesPage);
app.use(createPinia());
app.mount('#admin-categories-app');
