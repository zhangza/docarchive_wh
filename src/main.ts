import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ElementPlus from 'element-plus'

import App from './App.vue'
import router from './router'

// 顺序：Element Plus 基础样式 → 项目 Design Token 与全局样式（覆盖在后）
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'

const app = createApp(App)

// 全量注册 Element Plus 图标，供 <component :is="'IconName'" /> 动态使用
Object.entries(ElementPlusIconsVue).forEach(([key, comp]) => {
  app.component(key, comp as any)
})

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn, size: 'default' })

/**
 * 生产环境 Mock：
 * `vite-plugin-mock` 只在 Vite 开发服务器生效，静态部署（Netlify / Nginx）后
 * `/api/**` 无人提供服务会直接 404。此处在挂载前装载 axios adapter 层的 Mock，
 * 对接真实后端时把 `VITE_USE_MOCK` 改为 `false` 即可关闭（代码也不会被打包）。
 */
async function bootstrap() {
  if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCK === 'true') {
    const { setupProdMock } = await import('@/mock/prodMock')
    setupProdMock()
  }
  await router.isReady()
  app.mount('#app')
  document.querySelector('.app-loading')?.remove()
}

bootstrap()
