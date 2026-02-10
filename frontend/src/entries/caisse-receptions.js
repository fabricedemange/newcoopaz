import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ReceptionsPage from '@/views/ReceptionsPage.vue';

const app = createApp(ReceptionsPage);
app.use(createPinia());
app.mount('#receptions-app');
