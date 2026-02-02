import { createApp } from 'vue';
import { createPinia } from 'pinia';
import HomePage from '@/views/HomePage.vue';

const app = createApp(HomePage);
app.use(createPinia());
app.mount('#home-app');
