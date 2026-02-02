import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminProductFormPage from '@/views/AdminProductFormPage.vue';

const app = createApp(AdminProductFormPage);
app.use(createPinia());
app.mount('#admin-product-form-app');
