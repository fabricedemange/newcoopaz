import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCatalogueEditPage from '@/views/AdminCatalogueEditPage.vue';

const app = createApp(AdminCatalogueEditPage);
app.use(createPinia());
app.mount('#admin-catalogue-edit-app');
