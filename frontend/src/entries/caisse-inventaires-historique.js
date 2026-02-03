import { createApp } from 'vue';
import { createPinia } from 'pinia';
import InventaireHistoriquePage from '@/views/InventaireHistoriquePage.vue';

const app = createApp(InventaireHistoriquePage);
app.use(createPinia());
app.mount('#inventaires-historique-app');
