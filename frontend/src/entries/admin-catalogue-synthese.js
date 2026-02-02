import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminCatalogueSynthesePage from '@/views/AdminCatalogueSynthesePage.vue';

const app = createApp(AdminCatalogueSynthesePage);
app.use(createPinia());
app.mount('#admin-catalogue-synthese-app');
