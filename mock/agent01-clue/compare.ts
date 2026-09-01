import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import { COMPARE_OVERVIEW, COMPARE_TASKS } from '../shared/data/stats'
import { CLUES } from '../shared/data/clues'
import { ORGS, ITEMS, COMPARE_TYPES, VIOLATION_TREE, DISTRICTS, RULES, resetSeed, rndInt, rnd, pick, pad, dt } from '../shared/data/base'

/* ===== 比对疑点明细（由线索派生，保证口径一致） ===== */
resetSeed(31313)
const ANOMALIES = CLUES.map((c, i) => {
  const diffQty = rndInt(1, 28)
  return {
    anomalyId: `AN2026${pad(rndInt(7, 8), 2)}${pad(rndInt(10, 29), 2)}${pad(i + 1, 6)}`,
    compareTaskId: pick(COMPARE_TASKS.filter((t) => t.compareType === c.compareType)).taskId ?? 'CMP20260829001',
    compareType: c.compareType,
    orgCode: c.orgCode,
    orgName: c.orgName,
    orgType: c.orgType,
    district: c.district,
    itemCode: c.itemCode,
    itemName: c.itemName,
    anomalyType: c.violationType,
    anomalyDesc: c.description,
    leftValue: `${diffQty} ${c.itemName.includes('片') || c.itemName.includes('胶囊') ? '盒' : '次'}`,
    rightValue: `${diffQty + rndInt(1, 8)} ${c.itemName.includes('片') || c.itemName.includes('胶囊') ? '盒' : '次'}`,
    diffQty,
    diffAmount: c.suspectedAmount,
    diffRatio: Math.round(rnd() * 180 + 8),
    riskLevel: c.riskLevel,
    compareTime: c.detectTime,
    transferred: c.status !== '待研判',
    clueId: c.status !== '待研判' ? c.clueId : null,
    patientName: c.patientName,
    doctorName: c.doctorName,
    ruleHit: c.ruleHit
  }
})

export default [
  // 比对看板总览
  {
    url: '/api/compare/overview',
    method: 'get',
    timeout: delay(),
    response: () => ok(COMPARE_OVERVIEW)
  },
  // 比对任务列表
  {
    url: '/api/compare/tasks',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(COMPARE_TASKS, query, { eq: ['compareType', 'status'], like: ['taskName', 'taskId'] })
      list = keywordSearch(list, query.keyword, ['taskId', 'taskName', 'scope', 'creator'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  // 新建比对任务
  {
    url: '/api/compare/task/create',
    method: 'post',
    timeout: delay(600, 1200),
    response: ({ body }: any) =>
      ok({
        taskId: `CMP2026${pad(8, 2)}29${pad(rndInt(7, 99), 3)}`,
        taskName: body?.taskName ?? '自定义比对任务',
        status: '排队中',
        message: '比对任务已提交，预计 3 分钟后开始执行'
      })
  },
  // 疑点明细
  {
    url: '/api/compare/anomalies',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(ANOMALIES, query, {
        eq: ['compareType', 'riskLevel', 'district', 'anomalyType', 'orgType'],
        like: ['orgName', 'itemName', 'anomalyId', 'compareTaskId'],
        range: [{ key: 'diffAmount', min: 'amountMin', max: 'amountMax' }],
        dateRange: [{ key: 'compareTime', start: 'startTime', end: 'endTime' }]
      })
      if (query.transferred !== undefined && query.transferred !== '') {
        list = list.filter((x) => String(x.transferred) === String(query.transferred))
      }
      list = keywordSearch(list, query.keyword, ['anomalyId', 'orgName', 'itemName', 'anomalyDesc', 'patientName'])
      list = [...list].sort((a, b) => (a.compareTime < b.compareTime ? 1 : -1))
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  // 疑点批量转线索
  {
    url: '/api/compare/anomalies/transfer',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) => {
      const ids: string[] = body?.ids ?? []
      return ok({
        successCount: ids.length,
        clueIds: ids.map((_, i) => `CL20260829${pad(900 + i, 6)}`),
        message: `已成功转化 ${ids.length} 条疑点为标准化线索，并按风险等级自动分派`
      })
    }
  },
  // 字典
  {
    url: '/api/common/dict',
    method: 'get',
    timeout: delay(120, 260),
    response: () =>
      ok({
        compareTypes: COMPARE_TYPES,
        violationTree: VIOLATION_TREE,
        riskLevels: ['高', '中', '低'],
        districts: DISTRICTS,
        orgTypes: [...new Set(ORGS.map((o) => o.orgType))],
        orgs: ORGS.map((o) => ({ code: o.orgCode, name: o.orgName, type: o.orgType, district: o.district })),
        clueStatus: ['待研判', '研判中', '线上筛查中', '线下核查中', '申诉中', '已驳回', '已流转', '已结案'],
        rules: RULES.map((r) => ({ ruleId: r.ruleId, ruleName: r.ruleName, category: r.category }))
      })
  }
] as MockMethod[]
