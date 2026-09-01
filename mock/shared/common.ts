import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, keywordSearch } from './utils'
import { ORGS, DOCTORS, PATIENTS, ITEMS, RULES, AUDITORS, AUDIT_GROUPS, EXPERTS, DISTRICTS, DEPTS, VIOLATION_TREE, COMPARE_TYPES } from './data/base'
import { CLUES } from './data/clues'

export default [
  {
    url: '/api/user/info',
    method: 'get',
    timeout: delay(150, 320),
    response: () =>
      ok({
        userId: 'U000128',
        name: '王振华',
        displayName: '稽核员·王振华',
        avatar: '',
        title: '主办稽核员',
        dept: '芜湖市医疗保障局 · 基金监管处',
        group: '稽核一组',
        roles: ['稽核员', '监管人员', '分析人员'],
        currentRole: '稽核员',
        permissions: ['clue:view', 'clue:judge', 'screening:manage', 'inspection:manage', 'appeal:review', 'feedback:submit'],
        loginTime: '2026-08-29 08:02:15',
        lastLoginIp: '10.32.18.126',
        orgSwitch: [
          { code: 'GOV', name: '医保监管端（稽核员视角）' },
          { code: 'H340200001', name: '机构端（芜湖市第一人民医院）' }
        ]
      })
  },
  {
    url: '/api/common/orgs',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = ORGS
      if (query.orgType) list = list.filter((o) => o.orgType === query.orgType)
      if (query.district) list = list.filter((o) => o.district === query.district)
      list = keywordSearch(list, query.keyword, ['orgCode', 'orgName', 'district', 'contact'])
      return ok(query.page ? paginate(list, query.page, query.pageSize) : list)
    }
  },
  {
    url: '/api/common/doctors',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = DOCTORS
      if (query.orgCode) list = list.filter((x) => x.orgCode === query.orgCode)
      if (query.dept) list = list.filter((x) => x.dept === query.dept)
      list = keywordSearch(list, query.keyword, ['doctorId', 'name', 'dept', 'orgName'])
      return ok(query.page ? paginate(list, query.page, query.pageSize) : list.slice(0, 100))
    }
  },
  {
    url: '/api/common/patients',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = PATIENTS
      if (query.district) list = list.filter((x) => x.district === query.district)
      if (query.insuranceType) list = list.filter((x) => x.insuranceType === query.insuranceType)
      list = keywordSearch(list, query.keyword, ['patientId', 'name', 'cardNo', 'district'])
      return ok(query.page ? paginate(list, query.page, query.pageSize) : list.slice(0, 100))
    }
  },
  {
    url: '/api/common/items',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = ITEMS
      if (query.itemType) list = list.filter((x) => x.itemType === query.itemType)
      if (query.category) list = list.filter((x) => x.category === query.category)
      list = keywordSearch(list, query.keyword, ['itemCode', 'itemName', 'category', 'spec'])
      return ok(query.page ? paginate(list, query.page, query.pageSize) : list.slice(0, 100))
    }
  },
  {
    url: '/api/common/rules',
    method: 'get',
    timeout: delay(180, 360),
    response: () => ok(RULES)
  },
  {
    url: '/api/common/auditors',
    method: 'get',
    timeout: delay(150, 300),
    response: () =>
      ok({
        auditors: AUDITORS.map((name) => {
          const pending = CLUES.filter((c) => c.assignee === name && ['待研判', '研判中'].includes(c.status)).length
          return { name, group: AUDIT_GROUPS[AUDITORS.indexOf(name) % AUDIT_GROUPS.length], pending, load: Math.min(100, pending * 3) }
        }),
        groups: AUDIT_GROUPS
      })
  },
  {
    url: '/api/common/experts',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(EXPERTS)
  },
  {
    url: '/api/common/dicts',
    method: 'get',
    timeout: delay(120, 280),
    response: () =>
      ok({
        districts: DISTRICTS,
        depts: DEPTS,
        violationTree: VIOLATION_TREE,
        compareTypes: COMPARE_TYPES,
        riskLevels: ['高', '中', '低'],
        clueStatus: ['待研判', '研判中', '线上筛查中', '线下核查中', '申诉中', '已驳回', '已流转', '已结案'],
        orgTypes: [...new Set(ORGS.map((o) => o.orgType))],
        insuranceTypes: ['职工医保', '居民医保', '离退休职工', '公务员医疗补助'],
        visitTypes: ['门诊', '住院', '门诊慢特病', '药店购药'],
        inspectTypes: ['现场核查', '延伸核查', '飞行检查', '专家会诊核查', '复查'],
        appealTypes: ['事实认定异议', '金额认定异议', '政策适用异议', '程序异议', '其他'],
        evidenceTypes: ['书证', '电子数据', '言词证据', '视听资料', '物证'],
        feedbackTypes: ['规则误判', '规则覆盖缺口', '数据质量问题', '阈值设置不当', '其他']
      })
  },
  {
    url: '/api/common/export',
    method: 'post',
    timeout: delay(900, 1800),
    response: ({ body }: any) =>
      ok({
        fileName: `${body?.name ?? '导出数据'}_20260829.xlsx`,
        total: body?.total ?? 0,
        url: '#',
        message: `已生成 Excel 文件（${body?.total ?? 0} 条记录），请在下载中心查看`
      })
  },
  {
    url: '/api/common/notices',
    method: 'get',
    timeout: delay(150, 300),
    response: () =>
      ok([
        { id: 1, type: 'danger', title: '高风险线索待处理提醒', content: '您有 3 条高风险线索已超时未研判，请尽快处理', time: '2026-08-29 08:10:00', read: false },
        { id: 2, type: 'warning', title: '机构自查即将到期', content: '芜湖广济医院自查任务将于 24 小时内到期，尚未提交', time: '2026-08-29 07:30:00', read: false },
        { id: 3, type: 'info', title: '模型版本更新', content: 'AI 研判模型已升级至 v2.3.2，准确率提升至 94.8%', time: '2026-08-28 18:00:00', read: true },
        { id: 4, type: 'info', title: '比对任务完成', content: '药品进销存差异比对（日批）已完成，发现疑点 856 条', time: '2026-08-29 07:15:32', read: true }
      ])
  }
] as MockMethod[]
