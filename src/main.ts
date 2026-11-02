// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/authStore';

import 'open-props/style';
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

import './theme/variables.css';
import './theme/design-tokens.css';
import './theme/global.css';


const app = createApp(App)
  .use(IonicVue)
  .use(createPinia())
  .use(router);
// Restore the session BEFORE mounting, so the guard's first run doesn't race.
const auth = useAuthStore();
auth.init().finally(() => {
  router.isReady().then(() => app.mount('#app'));
});
