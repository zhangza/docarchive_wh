﻿import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { AGENT01_ROUTES } from './agent01-clue'
import { AGENT02_ROUTES } from './agent02-task'
import { AGENT03_ROUTES } from './agent03-punish'
import { AGENT04_ROUTES } from './agent04-doc'
import { AGENT05_ROUTES } from './agent05-promote'
import { AGENT06_ROUTES } from './agent06-system'

/** 智能体元信息：新增智能体只需在 AGENTS 中追加一项 */
export interface AgentMeta {
  /** 智能体唯一标识，与 features / api / mock 下的目录名保持一致 */
  key: string
  /** 智能体序号，用于菜单排序与文档对应 */
  no: number
  /** 智能体显示名 */
  name: string
  /** 需求文档（位于 doc/子功能/） */
  doc: string
  /** 是否已实现；false 时不进入菜单与路由 */
  ready: boolean
  /** 该智能体的路由集合 */
  routes: RouteRecordRaw[]
}

export const AGENTS: AgentMeta[] = [
  {
    key: 'agent01-clue',
    no: 1,
    name: '疑点线索管理',
    doc: '01_疑点线索管理智能体_详细功能设计.md',
    ready: true,
    routes: AGENT01_ROUTES
  },
  {
    key: 'agent02-task',
    no: 2,
    name: '专项任务管理',
    doc: '02_专项任务管理智能体_详细功能设计.md',
    ready: true,
    routes: AGENT02_ROUTES
  },
  {
    key: 'agent03-punish',
    no: 3,
    name: '违规处置',
    doc: '03_违规处置智能体_详细功能设计.md',
    ready: true,
    routes: AGENT03_ROUTES
  },
  {
    key: 'agent04-doc',
    no: 4,
    name: '文书生成',
    doc: '04_文书生成智能体_详细功能设计.md',
    ready: true,
    routes: AGENT04_ROUTES
  },
  {
    key: 'agent05-promote',
    no: 5,
    name: '成果宣教',
    doc: '05_成果宣教智能体_详细功能设计.md',
    ready: true,
    routes: AGENT05_ROUTES
  },
  {
    key: 'agent06-system',
    no: 6,
    name: '系统管理与支撑',
    doc: '06_系统管理与支撑模块_详细功能设计.md',
    ready: true,
    routes: AGENT06_ROUTES
  }
]

/** 侧边菜单路由：自动聚合所有已实现智能体的路由 */
export const MENU_ROUTES: RouteRecordRaw[] = AGENTS.filter(
  (a) => a.ready && a.routes.length > 0
).flatMap((a) => a.routes)

/** 已上线的智能体（用于侧栏智能体切换） */
export const READY_AGENTS = AGENTS.filter((a) => a.ready && a.routes.length > 0)

/**
 * 路径 → 智能体 key 的映射表
 * 例：'/task' → 'agent02-task'
 */
const PATH_AGENT_MAP: Record<string, string> = {}
READY_AGENTS.forEach((a) => {
  a.routes.forEach((r) => {
    PATH_AGENT_MAP[r.path] = a.key
  })
})

/** 根据当前路由路径反查所属智能体，未命中返回第一个已上线智能体 */
export function resolveAgentByPath(path: string): AgentMeta | undefined {
  const root = '/' + (path.split('/')[1] || '')
  const key = PATH_AGENT_MAP[root]
  return READY_AGENTS.find((a) => a.key === key) || READY_AGENTS[0]
}

/** 智能体入口路径（该智能体第一个子菜单） */
export function agentEntryPath(a?: AgentMeta): string {
  const g = a?.routes?.[0]
  const c: any = g?.children?.[0]
  if (!g || !c) return PORTAL_PATH
  return `${g.path}/${String(c.path).split('/:')[0]}`
}

/** 平台统一入口（门户） */
export const PORTAL_PATH = '/portal'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: PORTAL_PATH },
  {
    // 门户为独立全屏页，不套主壳布局
    path: PORTAL_PATH,
    name: 'Portal',
    component: () => import('@/features/portal/Portal.vue'),
    meta: { title: '平台统一入口', standalone: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: MENU_ROUTES
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: PORTAL_PATH
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  const t = (to.meta?.title as string) || ''
  document.title = t ? `${t} · 智行合医医保基金智能监管平台` : '智行合医 · 医保基金智能监管平台'
})

export default router
