import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CommandeDetailPage from '@/views/CommandeDetailPage.vue';

const app = createApp(CommandeDetailPage);
app.use(createPinia());
app.mount('#commande-detail-app');
