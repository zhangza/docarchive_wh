import type { RouteRecordRaw } from 'vue-router'

/**
 * 智能体五：成果宣教智能体（M31 - M40）
 * 需求依据：doc/子功能/05_成果宣教智能体_详细功能设计.md
 *
 * 【命名原则】菜单名称严格对齐需求文档 `### 3.x` / 第四章模块表标题，不做语义改写。
 * 【视觉主题】本智能体全部页面采用「深空数据大屏（Nebula Dark）」主题，
 *   与前四个智能体的浅色业务办理风格形成明确区分，令牌见 tokens.scss 的 --viz-*。
 *
 * 【功能覆盖】文档 13 个模块（M01-M13）全量落地为 10 个菜单页：
 *   M31 监管可视化大屏 ← 3.2.1（文档 M04，全屏指挥大屏，本智能体门面）
 *   M32 案件质量评分   ← 3.1.1（文档 M01）
 *   M33 重点案件复盘   ← 3.1.2（文档 M02，含改进措施看板 + 经验教训墙 + 鱼骨图）
 *   M34 复盘报告管理   ← 3.1.3（文档 M03）
 *   M35 多维对比分析   ← 3.2.2（文档 M05，八维度 + 五级钻取）
 *   M36 成果效能评估   ← 3.2.3（文档 M06，五大维度 + 目标达成）
 *   M37 一键分析报告   ← 3.2.4（文档 M07，生成流水线 + 七章报告）
 *   M38 模型自学习迭代 ← 3.3.1 + 3.3.2（文档 M08 案例数据回流 + M09 模型优化建议）
 *   M39 准确率监控     ← 3.3.3（文档 M10，混淆矩阵 + ROC/PR + 预警）
 *   M40 宣教素材与推送 ← 3.4.1 + 3.4.2 + 3.4.3（文档 M11 素材生成 + M12 多端推送 + M13 效果统计）
 */
export const AGENT05_ROUTES: RouteRecordRaw[] = [
  {
    path: '/insight',
    name: 'GroupInsight',
    meta: { title: '监管态势与分析', icon: 'DataLine', group: '5.1', agent: 'agent05' },
    children: [
      {
        path: 'dashboard',
        name: 'M31',
        component: () => import('@/features/agent05-promote/dashboard/SupervisionDashboard.vue'),
        meta: { title: '监管可视化大屏', code: 'M31', icon: 'Monitor', roles: ['监管领导', '值班人员'] }
      },
      {
        path: 'analysis',
        name: 'M35',
        component: () => import('@/features/agent05-promote/analysis/MultiDimAnalysis.vue'),
        meta: { title: '多维对比分析', code: 'M35', icon: 'DataAnalysis', roles: ['分析人员', '稽核员'] }
      },
      {
        path: 'evaluation',
        name: 'M36',
        component: () => import('@/features/agent05-promote/evaluation/EffectEvaluation.vue'),
        meta: { title: '成果效能评估', code: 'M36', icon: 'Trophy', roles: ['监管领导', '分析人员'] }
      },
      {
        path: 'report',
        name: 'M37',
        component: () => import('@/features/agent05-promote/analysis/AnalysisReport.vue'),
        meta: { title: '一键分析报告', code: 'M37', icon: 'Tickets', roles: ['分析人员', '管理员'] }
      }
    ]
  },
  {
    path: '/review',
    name: 'GroupReview',
    meta: { title: '逆向复盘', icon: 'Refresh', group: '5.2', agent: 'agent05' },
    children: [
      {
        path: 'score',
        name: 'M32',
        component: () => import('@/features/agent05-promote/score/CaseQualityScore.vue'),
        meta: { title: '案件质量评分', code: 'M32', icon: 'Odometer', roles: ['质控员', '稽核员'] }
      },
      {
        path: 'case',
        name: 'M33',
        component: () => import('@/features/agent05-promote/review/CaseReview.vue'),
        meta: { title: '重点案件复盘', code: 'M33', icon: 'Search', roles: ['质控员', '复盘小组'] }
      },
      {
        path: 'report',
        name: 'M34',
        component: () => import('@/features/agent05-promote/report/ReviewReport.vue'),
        meta: { title: '复盘报告管理', code: 'M34', icon: 'Document', roles: ['质控员', '管理员'] }
      }
    ]
  },
  {
    path: '/model',
    name: 'GroupModel',
    meta: { title: '模型迭代与监控', icon: 'Cpu', group: '5.3', agent: 'agent05' },
    children: [
      {
        path: 'iteration',
        name: 'M38',
        component: () => import('@/features/agent05-promote/model/ModelIteration.vue'),
        meta: { title: '模型自学习迭代', code: 'M38', icon: 'Refresh', roles: ['模型运营', '算法工程师'] }
      },
      {
        path: 'monitor',
        name: 'M39',
        component: () => import('@/features/agent05-promote/monitor/AccuracyMonitor.vue'),
        meta: { title: '准确率监控', code: 'M39', icon: 'Odometer', roles: ['模型运营', '算法工程师'] }
      }
    ]
  },
  {
    path: '/education',
    name: 'GroupEducation',
    meta: { title: '合规成果宣教', icon: 'Bell', group: '5.4', agent: 'agent05' },
    children: [
      {
        path: 'promotion',
        name: 'M40',
        component: () => import('@/features/agent05-promote/education/EduPromotion.vue'),
        meta: { title: '宣教素材与推送', code: 'M40', icon: 'Promotion', roles: ['宣传人员', '运营人员'] }
      }
    ]
  }
]
