import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminBandeauxPage from '@/views/AdminBandeauxPage.vue';

const app = createApp(AdminBandeauxPage);
app.use(createPinia());
app.mount('#admin-bandeaux-app');
