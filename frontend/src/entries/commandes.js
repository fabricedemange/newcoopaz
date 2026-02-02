import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CommandesPage from '@/views/CommandesPage.vue';

const app = createApp(CommandesPage);
app.use(createPinia());
app.mount('#commandes-app');
