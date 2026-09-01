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

router.isReady().then(() => {
  app.mount('#app')
  document.querySelector('.app-loading')?.remove()
})
