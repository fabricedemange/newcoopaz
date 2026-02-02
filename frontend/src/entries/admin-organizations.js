import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminOrganizationsPage from '@/views/AdminOrganizationsPage.vue';

const app = createApp(AdminOrganizationsPage);
app.use(createPinia());
app.mount('#admin-organizations-app');
