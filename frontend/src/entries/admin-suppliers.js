import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminSuppliersPage from '@/views/AdminSuppliersPage.vue';

const app = createApp(AdminSuppliersPage);
app.use(createPinia());
app.mount('#admin-fournisseurs-app');
