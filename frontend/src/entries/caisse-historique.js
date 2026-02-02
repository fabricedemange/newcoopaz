import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CaisseHistoriquePage from '@/views/CaisseHistoriquePage.vue';

const app = createApp(CaisseHistoriquePage);
app.use(createPinia());
app.mount('#historique-ventes-app');
