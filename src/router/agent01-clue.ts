import type { RouteRecordRaw } from 'vue-router'

/**
 * 智能体一：疑点线索管理智能体（M01 - M15）
 * 需求依据：doc/子功能/01_疑点线索管理智能体_详细功能设计.md
 *
 * 业务主线：
 *   全量数据比对 → 智能预警识别 → 线索研判分流 → 线上筛查核实
 *   → 线下核查取证 → 机构申诉复核 → 全周期跟踪与误判反馈
 */
export const AGENT01_ROUTES: RouteRecordRaw[] = [
  {
    path: '/compare',
    name: 'GroupCompare',
    meta: { title: '全量数据比对', icon: 'DataAnalysis', group: '3.1', agent: 'agent01' },
    children: [
      {
        path: 'dashboard',
        name: 'M01',
        component: () => import('@/features/agent01-clue/compare/Dashboard.vue'),
        meta: { title: '数据比对看板', code: 'M01', icon: 'Odometer', roles: ['监管人员', '分析人员'] }
      },
      {
        path: 'anomaly',
        name: 'M02',
        component: () => import('@/features/agent01-clue/compare/AnomalyList.vue'),
        meta: { title: '比对疑点清单', code: 'M02', icon: 'List', roles: ['稽核员'] }
      }
    ]
  },
  {
    path: '/alert',
    name: 'GroupAlert',
    meta: { title: '智能预警识别', icon: 'AlarmClock', group: '3.2', agent: 'agent01' },
    children: [
      {
        path: 'dashboard',
        name: 'M03',
        component: () => import('@/features/agent01-clue/alert/AlertDashboard.vue'),
        meta: { title: '实时预警看板', code: 'M03', icon: 'Bell', roles: ['监管领导', '值班人员'] }
      },
      {
        path: 'clues',
        name: 'M04',
        component: () => import('@/features/agent01-clue/alert/ClueLibrary.vue'),
        meta: { title: '线索库', code: 'M04', icon: 'Files', roles: ['稽核员', '监管人员'] }
      }
    ]
  },
  {
    path: '/judgment',
    name: 'GroupJudgment',
    meta: { title: '线索研判分流', icon: 'Cpu', group: '3.3', agent: 'agent01' },
    children: [
      {
        path: 'workbench',
        name: 'M05',
        component: () => import('@/features/agent01-clue/judgment/Workbench.vue'),
        meta: { title: '线索研判工作台', code: 'M05', icon: 'Monitor', roles: ['稽核员'] }
      },
      {
        path: 'detail/:clueId?',
        name: 'M06',
        component: () => import('@/features/agent01-clue/judgment/ClueDetail.vue'),
        meta: { title: '线索详情', code: 'M06', icon: 'Document', roles: ['稽核员'], hidden: false }
      },
      {
        path: 'graph/:clueId?',
        name: 'M07',
        component: () => import('@/features/agent01-clue/judgment/ClueGraph.vue'),
        meta: { title: '知识图谱溯源', code: 'M07', icon: 'Share', roles: ['稽核员', '分析人员'] }
      }
    ]
  },
  {
    path: '/screening',
    name: 'GroupScreening',
    meta: { title: '线上筛查核实', icon: 'Search', group: '3.4', agent: 'agent01' },
    children: [
      {
        path: 'org',
        name: 'M08',
        component: () => import('@/features/agent01-clue/screening/OrgSelfCheck.vue'),
        meta: { title: '机构自查端', code: 'M08', icon: 'OfficeBuilding', roles: ['定点医药机构'], side: 'ORG' }
      },
      {
        path: 'review',
        name: 'M09',
        component: () => import('@/features/agent01-clue/screening/ScreeningReview.vue'),
        meta: { title: '线上筛查审核', code: 'M09', icon: 'DocumentChecked', roles: ['稽核员'] }
      }
    ]
  },
  {
    path: '/inspection',
    name: 'GroupInspection',
    meta: { title: '线下核查取证', icon: 'Location', group: '3.5', agent: 'agent01' },
    children: [
      {
        path: 'manage',
        name: 'M11',
        component: () => import('@/features/agent01-clue/inspection/InspectionManage.vue'),
        meta: { title: '线下核查管理端', code: 'M11', icon: 'Suitcase', roles: ['稽核员', '核查组长'] }
      },
      {
        path: 'mobile',
        name: 'M10',
        component: () => import('@/features/agent01-clue/inspection/InspectionMobile.vue'),
        meta: { title: '线下核查移动端', code: 'M10', icon: 'Iphone', roles: ['现场核查人员'] }
      }
    ]
  },
  {
    path: '/appeal',
    name: 'GroupAppeal',
    meta: { title: '机构申诉复核', icon: 'ChatDotSquare', group: '3.6', agent: 'agent01' },
    children: [
      {
        path: 'org',
        name: 'M12',
        component: () => import('@/features/agent01-clue/appeal/OrgAppeal.vue'),
        meta: { title: '机构申诉端', code: 'M12', icon: 'EditPen', roles: ['定点医药机构'], side: 'ORG' }
      },
      {
        path: 'review',
        name: 'M13',
        component: () => import('@/features/agent01-clue/appeal/AppealReview.vue'),
        meta: { title: '申诉复核端', code: 'M13', icon: 'Stamp', roles: ['稽核员', '复核人员'] }
      }
    ]
  },
  {
    path: '/lifecycle',
    name: 'GroupLifecycle',
    meta: { title: '全周期与反馈', icon: 'Timer', group: '3.7', agent: 'agent01' },
    children: [
      {
        path: 'track',
        name: 'M14',
        component: () => import('@/features/agent01-clue/lifecycle/LifecycleTrack.vue'),
        meta: { title: '线索全周期跟踪', code: 'M14', icon: 'Guide', roles: ['稽核员', '监管人员'] }
      },
      {
        path: 'feedback',
        name: 'M15',
        component: () => import('@/features/agent01-clue/lifecycle/MisjudgeFeedback.vue'),
        meta: { title: '误判反馈管理', code: 'M15', icon: 'MagicStick', roles: ['模型运营人员', '稽核员'] }
      }
    ]
  }
]
