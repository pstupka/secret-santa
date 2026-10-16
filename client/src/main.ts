import { createPinia } from 'pinia';
import { createApp } from 'vue';

import { connectApi } from '@/api';
import App from '@/App.vue';
import { createAppI18n } from '@/i18n';
import { createAppRouter } from '@/router';
import { useAuthStore } from '@/stores/auth';
import '@/assets/main.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const router = createAppRouter();
connectApi(useAuthStore(pinia), router);

app.use(router);
app.use(createAppI18n());
app.mount('#app');
