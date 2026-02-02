import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminProductsPage from '@/views/AdminProductsPage.vue';

const app = createApp(AdminProductsPage);
app.use(createPinia());
app.mount('#admin-produits-app');
