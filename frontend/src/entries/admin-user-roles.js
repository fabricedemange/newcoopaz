import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminUserRolesPage from '@/views/AdminUserRolesPage.vue';

const app = createApp(AdminUserRolesPage);
app.use(createPinia());
app.mount('#admin-user-roles-app');
