import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminEmailQueuePage from '@/views/AdminEmailQueuePage.vue';

const app = createApp(AdminEmailQueuePage);
app.use(createPinia());
app.mount('#admin-email-queue-app');
