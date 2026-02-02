import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CaissePage from '@/views/CaissePage.vue';

const app = createApp(CaissePage);
app.use(createPinia());
app.mount('#caisse-app');
