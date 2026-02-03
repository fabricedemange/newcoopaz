import { createApp } from 'vue';
import { createPinia } from 'pinia';
import StockMouvementsPage from '@/views/StockMouvementsPage.vue';

const app = createApp(StockMouvementsPage);
app.use(createPinia());
app.mount('#stock-mouvements-app');
