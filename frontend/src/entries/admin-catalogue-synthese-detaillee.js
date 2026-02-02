import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCatalogueSyntheseDetailleePage from '@/views/AdminCatalogueSyntheseDetailleePage.vue';

const app = createApp(AdminCatalogueSyntheseDetailleePage);
app.use(createPinia());
app.mount('#admin-catalogue-synthese-detaillee-app');
