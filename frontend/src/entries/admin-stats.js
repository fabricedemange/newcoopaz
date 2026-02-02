import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminStatsPage from '@/views/AdminStatsPage.vue';

const app = createApp(AdminStatsPage);
app.use(createPinia());
app.mount('#admin-stats-app');
