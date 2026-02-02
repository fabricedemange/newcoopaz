import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminTracePage from '@/views/AdminTracePage.vue';

const app = createApp(AdminTracePage);
app.use(createPinia());
app.mount('#admin-trace-app');
