import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminUsersPage from '@/views/AdminUsersPage.vue';

const app = createApp(AdminUsersPage);
app.use(createPinia());
app.mount('#admin-users-app');
