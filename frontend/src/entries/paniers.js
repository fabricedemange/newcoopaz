import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PaniersPage from '@/views/PaniersPage.vue';

const app = createApp(PaniersPage);
app.use(createPinia());
app.mount('#paniers-list-app');
