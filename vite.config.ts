import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteMockServe } from 'vite-plugin-mock'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        { 'element-plus': ['ElMessage', 'ElMessageBox', 'ElNotification', 'ElLoading'] }
      ],
      resolvers: [ElementPlusResolver({ importStyle: false })],
      dts: 'src/types/auto-imports.d.ts'
    }),
    Components({
      dirs: ['src/components/base', 'src/components/business'],
      extensions: ['vue'],
      deep: true,
      resolvers: [ElementPlusResolver({ importStyle: false })],
      dts: 'src/types/components.d.ts'
    }),
    viteMockServe({
      mockPath: 'mock',
      enable: true,
      logger: true,
      /**
       * Mock 目录按「智能体」分域，ignore 收到的是相对 mock/ 的 POSIX 路径：
       *   agent01-clue/*.ts   → 智能体一：疑点线索管理（已实现）
       *   agent02-task/*.ts   → 智能体二：专项任务管理（预留）
       *   ...                 → 后续智能体依次新增目录即可，无需改配置
       *   shared/common.ts    → 跨智能体公共接口（需加载）
       *   shared/utils.ts     → 纯工具，非接口文件（排除）
       *   shared/data/*.ts    → 纯数据集，非接口文件（排除）
       *   **\/_*.ts           → 下划线开头为草稿/私有片段（排除）
       */
      ignore: (fileName: string) => {
        const p = fileName.replace(/\\/g, '/')
        return (
          p === 'shared/utils.ts' ||
          p.startsWith('shared/data/') ||
          /(^|\/)_/.test(p)
        )
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5273,
    open: true
  }
})
