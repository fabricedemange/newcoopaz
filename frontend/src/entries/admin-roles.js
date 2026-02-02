import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminRolesPage from '@/views/AdminRolesPage.vue';

const app = createApp(AdminRolesPage);
app.use(createPinia());
app.mount('#admin-roles-app');
