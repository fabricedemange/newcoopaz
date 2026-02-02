import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminUserFormPage from '@/views/AdminUserFormPage.vue';

const app = createApp(AdminUserFormPage);
app.use(createPinia());
app.mount('#admin-user-form-app');
