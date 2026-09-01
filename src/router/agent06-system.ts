import type { RouteRecordRaw } from 'vue-router'

/**
 * 智能体六：系统管理与支撑模块（M41 - M48）
 * 需求依据：doc/子功能/06_系统管理与支撑模块_详细功能设计.md
 *
 * 【视觉主题】采用与智能体一至四一致的浅色业务办理风格（zh-page / section-card），
 *   本模块为管理配置类功能，不使用大屏主题。
 *
 * 【功能覆盖】文档 8 个一级功能组（3.1-3.8）全量落地为 8 个菜单页，
 *   二级功能以页内 Tabs 承载：
 *   M41 动态规则引擎     ← 3.1（规则配置/参数管理/试跑验证/灰度发布）
 *   M42 知识图谱管理     ← 3.2（实体关系/图谱浏览维护）
 *   M43 政策法规案例库   ← 3.3（三库维护/智能引用）
 *   M44 数据源与接口     ← 3.4（数据接入/平台对接/通道监控）
 *   M45 组织与权限       ← 3.5（组织人员/角色权限/双人复核）
 *   M46 数据安全与审计   ← 3.6（脱敏加密/留痕审计/信创适配）
 *   M47 消息与时限督办   ← 3.7（消息中心/时限督办）
 *   M48 运行监控         ← 3.8（智能体监控/系统运维）
 */
export const AGENT06_ROUTES: RouteRecordRaw[] = [
  {
    path: '/sysrule',
    name: 'GroupSysRule',
    meta: { title: '规则与知识', icon: 'SetUp', group: '6.1', agent: 'agent06' },
    children: [
      {
        path: 'engine',
        name: 'M41',
        component: () => import('@/features/agent06-system/rule/RuleEngine.vue'),
        meta: { title: '动态规则引擎', code: 'M41', icon: 'SetUp', roles: ['规则管理员', '系统管理员'] }
      },
      {
        path: 'graph',
        name: 'M42',
        component: () => import('@/features/agent06-system/graph/KnowledgeGraph.vue'),
        meta: { title: '知识图谱管理', code: 'M42', icon: 'Share', roles: ['知识工程师', '数据管理员'] }
      }
    ]
  },
  {
    path: '/sysdata',
    name: 'GroupSysData',
    meta: { title: '法规与数据', icon: 'Collection', group: '6.2', agent: 'agent06' },
    children: [
      {
        path: 'legal',
        name: 'M43',
        component: () => import('@/features/agent06-system/legal/LegalLibrary.vue'),
        meta: { title: '政策法规案例库', code: 'M43', icon: 'Notebook', roles: ['法制审核', '系统管理员'] }
      },
      {
        path: 'datasource',
        name: 'M44',
        component: () => import('@/features/agent06-system/datasource/DataSource.vue'),
        meta: { title: '数据源与接口', code: 'M44', icon: 'Connection', roles: ['数据管理员', '接口管理员'] }
      }
    ]
  },
  {
    path: '/sysorg',
    name: 'GroupSysOrg',
    meta: { title: '组织与安全', icon: 'Lock', group: '6.3', agent: 'agent06' },
    children: [
      {
        path: 'permission',
        name: 'M45',
        component: () => import('@/features/agent06-system/org/OrgPermission.vue'),
        meta: { title: '组织与权限', code: 'M45', icon: 'UserFilled', roles: ['系统管理员'] }
      },
      {
        path: 'security',
        name: 'M46',
        component: () => import('@/features/agent06-system/security/SecurityAudit.vue'),
        meta: { title: '数据安全与审计', code: 'M46', icon: 'Lock', roles: ['安全管理员', '审计员'] }
      }
    ]
  },
  {
    path: '/sysops',
    name: 'GroupSysOps',
    meta: { title: '消息与监控', icon: 'Monitor', group: '6.4', agent: 'agent06' },
    children: [
      {
        path: 'message',
        name: 'M47',
        component: () => import('@/features/agent06-system/message/MessageCenter.vue'),
        meta: { title: '消息与时限督办', code: 'M47', icon: 'BellFilled', roles: ['系统管理员', '督办员'] }
      },
      {
        path: 'monitor',
        name: 'M48',
        component: () => import('@/features/agent06-system/monitor/OpsMonitor.vue'),
        meta: { title: '运行监控', code: 'M48', icon: 'Odometer', roles: ['运维工程师', '模型运营'] }
      }
    ]
  }
]
