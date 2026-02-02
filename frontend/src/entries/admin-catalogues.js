import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCataloguesPage from '@/views/AdminCataloguesPage.vue';

const app = createApp(AdminCataloguesPage);
app.use(createPinia());
app.mount('#admin-catalogues-app');
