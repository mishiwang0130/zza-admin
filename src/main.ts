import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';

// 先引 Element Plus 自带样式，再引项目样式，保证主题变量覆盖生效
import 'element-plus/dist/index.css';
import '@/styles/index.css';

import App from '@/App.vue';
import router from '@/router';
import { setupDirectives } from '@/directives';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

setupDirectives(app);

app.mount('#app');
