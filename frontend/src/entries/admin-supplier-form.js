import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminSupplierFormPage from '@/views/AdminSupplierFormPage.vue';

const app = createApp(AdminSupplierFormPage);
app.use(createPinia());
app.mount('#admin-supplier-form-app');
