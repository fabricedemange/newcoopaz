import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CatalogueDetailPage from '@/views/CatalogueDetailPage.vue';

const app = createApp(CatalogueDetailPage);
app.use(createPinia());
app.mount('#catalogue-detail-app');
