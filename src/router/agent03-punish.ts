import type { RouteRecordRaw } from 'vue-router'

/**
 * 智能体三：违规处置智能体（M19 - M24）
 * 需求依据：doc/子功能/03_违规处置智能体_详细功能设计.md
 *
 * 功能精化说明（文档建议 M01-M20 共 20 个模块，按"每功能大类最多 2 个菜单"压缩为 6 个）：
 *   3.1 违规智能确认（AI定性 / 双人复核 / 检查报告 / 结果送达）
 *     → M19「违规确认与复核」一页 4 Tab（定性→责任→复核→报告送达），为一条连贯办理链
 *
 *   3.2 分类处置（协议处理 / 行政处罚 / 移送处理 / 依据推荐）
 *     → M20「分类处置」一页 3 Tab（三条处置路径）+ 依据推荐弹窗
 *
 *   3.3 基金追回（追回台账 / 到账核销）
 *     → M21「基金追回台账」，核销以弹窗形式内联，不另开菜单
 *
 *   3.5 整改跟踪（整改清单 / 整改反馈复查）
 *     → M22「整改跟踪」，下达与逐项复查同页
 *
 *   3.6 闭环销号（条件核验 / 销号审批 / 信用联动）
 *     → M23「闭环销号」一页 3 Tab
 *
 *   3.4 台账与经验沉淀（归档 / 战果统计 / 标准案例 / 复盘迭代）
 *     → M24「台账与经验沉淀」一页 5 Tab
 */
export const AGENT03_ROUTES: RouteRecordRaw[] = [
  {
    path: '/punish',
    name: 'GroupPunish',
    meta: { title: '违规确认与处置', icon: 'Stamp', group: '3.1', agent: 'agent03' },
    children: [
      {
        path: 'confirm',
        name: 'M19',
        component: () => import('@/features/agent03-punish/confirm/ViolationConfirm.vue'),
        meta: { title: '违规确认与复核', code: 'M19', icon: 'Tickets', roles: ['稽核员', '复核人员'] }
      },
      {
        path: 'handle',
        name: 'M20',
        component: () => import('@/features/agent03-punish/handle/ClassifiedHandle.vue'),
        meta: { title: '分类处置', code: 'M20', icon: 'Operation', roles: ['稽核员', '法制人员', '审批人员'] }
      }
    ]
  },
  {
    path: '/recovery',
    name: 'GroupRecovery',
    meta: { title: '基金追回与整改', icon: 'Money', group: '3.2', agent: 'agent03' },
    children: [
      {
        path: 'fund',
        name: 'M21',
        component: () => import('@/features/agent03-punish/recovery/FundRecovery.vue'),
        meta: { title: '基金追回台账', code: 'M21', icon: 'Coin', roles: ['稽核员', '财务人员'] }
      },
      {
        path: 'rectify',
        name: 'M22',
        component: () => import('@/features/agent03-punish/rectify/RectifyTrack.vue'),
        meta: { title: '整改跟踪', code: 'M22', icon: 'EditPen', roles: ['稽核员'] }
      }
    ]
  },
  {
    path: '/closure',
    name: 'GroupClosure',
    meta: { title: '闭环与经验沉淀', icon: 'FolderChecked', group: '3.3', agent: 'agent03' },
    children: [
      {
        path: 'cancel',
        name: 'M23',
        component: () => import('@/features/agent03-punish/cancel/CaseCancel.vue'),
        meta: { title: '闭环销号', code: 'M23', icon: 'CircleCheck', roles: ['稽核员', '科长', '处长'] }
      },
      {
        path: 'ledger',
        name: 'M24',
        component: () => import('@/features/agent03-punish/ledger/PunishLedger.vue'),
        meta: { title: '台账与经验沉淀', code: 'M24', icon: 'FolderOpened', roles: ['档案员', '监管领导', '质控员'] }
      }
    ]
  }
]
