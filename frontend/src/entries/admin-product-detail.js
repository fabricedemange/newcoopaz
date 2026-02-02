import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminProductDetailPage from '@/views/AdminProductDetailPage.vue';

const app = createApp(AdminProductDetailPage);
app.use(createPinia());
app.mount('#admin-product-detail-app');
