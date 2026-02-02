import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CataloguesPage from '@/views/CataloguesPage.vue';

const app = createApp(CataloguesPage);
app.use(createPinia());
app.mount('#catalogues-app');
