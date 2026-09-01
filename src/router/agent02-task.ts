import type { RouteRecordRaw } from 'vue-router'

/**
 * 智能体二：专项任务管理智能体（M16 - M18）
 * 需求依据：doc/子功能/02_专项任务管理智能体_详细功能设计.md
 *
 * 功能精化说明（每个功能大类最多两个菜单，避免菜单冗余）：
 *   3.1 任务智能生成（线索聚类 / 合并去重 / 要素生成 / 多类型任务）
 *   + 3.2 任务自动派发（批量·定向·分级派发 / 限时签收 / 同步生成文书）
 *     → 合并为 M16「任务生成与派发」一个菜单
 *       理由：聚类→去重→要素确认→立项→派发是一条连贯操作链，
 *             拆分会造成反复跳转，合并后可一屏完成立项到派达
 *
 *   3.3 任务进度管控（泳道进度 / 超时督办 / 任务看板）
 *     → M17「任务进度管控」，看板与泳道以视图切换实现，不另开菜单
 *
 *   3.4 任务结果管理（结果自动整合 / 初步结果生成 / 复核 / 推送）
 *     → M18「任务结果管理」
 */
export const AGENT02_ROUTES: RouteRecordRaw[] = [
  {
    path: '/task',
    name: 'GroupTask',
    meta: { title: '专项任务管理', icon: 'Files', group: '2', agent: 'agent02' },
    children: [
      {
        path: 'generate',
        name: 'M16',
        component: () => import('@/features/agent02-task/generate/TaskGenerate.vue'),
        meta: {
          title: '任务生成与派发',
          code: 'M16',
          icon: 'MagicStick',
          roles: ['监管人员', '稽核组长']
        }
      },
      {
        path: 'progress',
        name: 'M17',
        component: () => import('@/features/agent02-task/progress/TaskProgress.vue'),
        meta: {
          title: '任务进度管控',
          code: 'M17',
          icon: 'Odometer',
          roles: ['监管人员', '稽核员', '稽核组长']
        }
      },
      {
        path: 'result',
        name: 'M18',
        component: () => import('@/features/agent02-task/result/TaskResult.vue'),
        meta: {
          title: '任务结果管理',
          code: 'M18',
          icon: 'DocumentChecked',
          roles: ['稽核组长', '复核人员']
        }
      }
    ]
  }
]
