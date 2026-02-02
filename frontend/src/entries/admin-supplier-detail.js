import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminSupplierDetailPage from '@/views/AdminSupplierDetailPage.vue';

const app = createApp(AdminSupplierDetailPage);
app.use(createPinia());
app.mount('#admin-supplier-detail-app');
