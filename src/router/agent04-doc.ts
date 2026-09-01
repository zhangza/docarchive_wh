import type { RouteRecordRaw } from 'vue-router'

/**
 * 智能体四：文书生成智能体（M25 - M30）
 * 需求依据：doc/子功能/04_文书生成智能体_详细功能设计.md
 *
 * 【命名原则】菜单名称严格对齐需求文档 `### 3.x` 标题，不做语义改写：
 *   3.1 文书模板库    → M25 文书模板库
 *   3.2 文书智能生成  → M26 文书智能生成
 *   3.3 智能校对      → M27 智能校对
 *   3.4 签章与送达    → M28 签章与送达
 *   3.5 证据全链管理  → M29 证据全链管理
 *   3.6 案卷归档      → M30 案卷归档
 *
 * 【功能覆盖】文档 17 个子功能全量落地，仅在「同一业务对象的连续办理环节」上
 * 以页内 Tab 承载，不做跨业务合并：
 *   M25 文书模板库    ← 3.1.1 制式模板库 + 3.1.2 模板维护
 *                       （六大类分类导航 + 22 模板列表 + 详情抽屉 4 Tab + 维护弹窗 + 版本回滚）
 *   M26 文书智能生成  ← 3.2.1 数据自动填充 + 3.2.2 AI 辅助撰写 + 3.2.3 文号自动生成 + 3.2.4 批量生成
 *                       （3 Tab：生成工作台〔抽屉内含填充校验 / AI 五段撰写双 Tab〕/ 文号管理 / 批量生成）
 *   M27 智能校对      ← 3.3.1 法条引用校对 + 3.3.2 要素完整性校对 + 3.3.3 一致性校对 + 3.3.4 文字规范校对
 *                       （左待校对列表 + 右 2 Tab：法条引用校对 / 要素与文字校对，含一键修正）
 *   M28 签章与送达    ← 3.4.1 在线签章 + 3.4.2 电子送达 + 3.4.3 多格式导出（3 Tab）
 *   M29 证据全链管理  ← 3.5.1 证据归集管理 + 3.5.2 证据链可视化 + 3.5.3 防篡改固化导出（3 Tab）
 *   M30 案卷归档      ← 3.6.1 案卷自动组装 + 3.6.2 档案检索 + 3.6.3 档案借阅 + 3.6.4 纸质扫码入档
 *                       （3 Tab：案卷组装〔含档案检索〕/ 档案借阅 / 纸质扫码入档）
 */
export const AGENT04_ROUTES: RouteRecordRaw[] = [
  {
    path: '/docgen',
    name: 'GroupDocGen',
    meta: { title: '文书生成与校对', icon: 'Document', group: '4.1', agent: 'agent04' },
    children: [
      {
        path: 'template',
        name: 'M25',
        component: () => import('@/features/agent04-doc/template/TemplateLibrary.vue'),
        meta: { title: '文书模板库', code: 'M25', icon: 'Files', roles: ['模板管理员', '法制人员'] }
      },
      {
        path: 'generate',
        name: 'M26',
        component: () => import('@/features/agent04-doc/generate/DocGenerate.vue'),
        meta: { title: '文书智能生成', code: 'M26', icon: 'MagicStick', roles: ['稽核员', '法制人员'] }
      },
      {
        path: 'proofread',
        name: 'M27',
        component: () => import('@/features/agent04-doc/proofread/DocProofread.vue'),
        meta: { title: '智能校对', code: 'M27', icon: 'DocumentChecked', roles: ['法制人员', '复核人员'] }
      }
    ]
  },
  {
    path: '/docsign',
    name: 'GroupDocSign',
    meta: { title: '签章送达与证据', icon: 'Stamp', group: '4.2', agent: 'agent04' },
    children: [
      {
        path: 'delivery',
        name: 'M28',
        component: () => import('@/features/agent04-doc/delivery/SignDelivery.vue'),
        meta: { title: '签章与送达', code: 'M28', icon: 'Promotion', roles: ['稽核员', '部门负责人', '法定代表人'] }
      },
      {
        path: 'evidence',
        name: 'M29',
        component: () => import('@/features/agent04-doc/evidence/EvidenceChain.vue'),
        meta: { title: '证据全链管理', code: 'M29', icon: 'Folder', roles: ['稽核员', '法制人员'] }
      }
    ]
  },
  {
    path: '/docarchive',
    name: 'GroupDocArchive',
    meta: { title: '案卷归档管理', icon: 'FolderOpened', group: '4.3', agent: 'agent04' },
    children: [
      {
        path: 'casefile',
        name: 'M30',
        component: () => import('@/features/agent04-doc/casefile/CaseFileArchive.vue'),
        meta: { title: '案卷归档', code: 'M30', icon: 'Box', roles: ['档案员', '稽核员'] }
      }
    ]
  }
]
