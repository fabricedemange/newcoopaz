import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PanierDetailPage from '@/views/PanierDetailPage.vue';

const app = createApp(PanierDetailPage);
app.use(createPinia());
app.mount('#panier-app');
