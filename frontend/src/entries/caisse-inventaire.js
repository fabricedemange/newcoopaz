import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CaisseInventairePage from '@/views/CaisseInventairePage.vue';

const app = createApp(CaisseInventairePage);
app.use(createPinia());
app.mount('#inventaire-app');
