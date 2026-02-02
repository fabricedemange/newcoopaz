import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminDashboardPage from '@/views/AdminDashboardPage.vue';

const app = createApp(AdminDashboardPage);
app.use(createPinia());
app.mount('#admin-dashboard-app');
