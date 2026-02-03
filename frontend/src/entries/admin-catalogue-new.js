import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCatalogueNewPage from '@/views/AdminCatalogueNewPage.vue';

const app = createApp(AdminCatalogueNewPage);
app.use(createPinia());
app.mount('#admin-catalogue-new-app');
