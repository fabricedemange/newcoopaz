import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AccountEditPage from '@/views/AccountEditPage.vue';

const app = createApp(AccountEditPage);
app.use(createPinia());
app.mount('#auth-account-app');
