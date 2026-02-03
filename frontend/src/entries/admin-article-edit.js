import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminArticleEditPage from '@/views/AdminArticleEditPage.vue';

const app = createApp(AdminArticleEditPage);
app.use(createPinia());
app.mount('#admin-article-edit-app');
