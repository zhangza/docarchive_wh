import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import { SCREENING_STATS } from '../shared/data/stats'
import { SELF_CHECKS } from '../shared/data/detail'
import { CLUES } from '../shared/data/clues'
import { AUDITORS, resetSeed, rnd, rndInt, pick, pad, dt } from '../shared/data/base'

/* ===== 自查任务全集（1条标杆 + 批量生成） ===== */
resetSeed(41414)
const SC_STATUS = ['待下发', '待提交', '已提交', '待审核', '已初筛', '已完成', '已逾期']
const SC_RESULT = ['合理说明·结案', '存疑·转线下核查', '违规苗头·直接确认']

const GEN_SC = CLUES.filter((c) => ['线上筛查中', '线下核查中', '申诉中', '已流转', '已结案', '已驳回'].includes(c.status))
  .slice(0, 240)
  .map((c, i) => {
    const status = pick(SC_STATUS)
    const submitted = ['已提交', '待审核', '已初筛', '已完成'].includes(status)
    const dayOffset = -rndInt(1, 30)
    return {
      taskId: `SC2026${pad(rndInt(7, 8), 2)}${pad(rndInt(10, 29), 2)}${pad(i + 10, 4)}`,
      clueId: c.clueId,
      orgCode: c.orgCode,
      orgName: c.orgName,
      orgType: c.orgType,
      district: c.district,
      violationType: c.violationType,
      violationCategory: c.violationCategory,
      riskLevel: c.riskLevel,
      suspectedAmount: c.suspectedAmount,
      itemName: c.itemName,
      patientName: c.patientName,
      issueTime: dt(dayOffset, rndInt(8, 17), rndInt(0, 59)),
      deadline: dt(dayOffset + 7, 18, 0),
      submitTime: submitted ? dt(dayOffset + rndInt(1, 6), rndInt(9, 18), rndInt(0, 59)) : '',
      status,
      screenResult: ['已初筛', '已完成'].includes(status) ? pick(SC_RESULT) : '',
      materialCount: submitted ? rndInt(1, 6) : 0,
      needFix: submitted && rnd() > 0.65,
      aiConfidence: submitted ? rndInt(58, 96) : 0,
      overdue: status === '已逾期',
      assignee: pick(AUDITORS),
      remainHours: ['待提交', '待下发'].includes(status) ? rndInt(2, 160) : 0
    }
  })

const TYPICAL_SC_LIST = SELF_CHECKS.map((s) => ({
  taskId: s.taskId,
  clueId: s.clueId,
  orgCode: s.orgCode,
  orgName: s.orgName,
  orgType: '三级医院',
  district: '镜湖区',
  violationType: s.violationType,
  violationCategory: '用药类',
  riskLevel: s.riskLevel,
  suspectedAmount: s.suspectedAmount,
  itemName: '格列美脲片',
  patientName: '张伟民',
  issueTime: s.issueTime,
  deadline: s.deadline,
  submitTime: s.submitTime,
  status: s.status,
  screenResult: s.screenResult,
  materialCount: 4,
  needFix: true,
  aiConfidence: 76,
  overdue: false,
  assignee: '稽核员·王振华',
  remainHours: 0,
  isTypical: true
}))

const ALL_SC = [...TYPICAL_SC_LIST, ...GEN_SC]
const SC_MAP = new Map<string, any>(SELF_CHECKS.map((s) => [s.taskId, s]))

export default [
  { url: '/api/screening/stats', method: 'get', timeout: delay(), response: () => ok(SCREENING_STATS) },
  {
    url: '/api/screening/tasks',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(ALL_SC, query, {
        eq: ['status', 'riskLevel', 'district', 'orgType', 'screenResult', 'violationCategory', 'orgCode'],
        like: ['orgName', 'taskId', 'clueId', 'violationType'],
        range: [{ key: 'suspectedAmount', min: 'amountMin', max: 'amountMax' }],
        dateRange: [{ key: 'issueTime', start: 'startTime', end: 'endTime' }]
      })
      if (query.overdue === 'true') list = list.filter((x) => x.overdue)
      list = keywordSearch(list, query.keyword, ['taskId', 'clueId', 'orgName', 'violationType', 'patientName'])
      list = [...list].sort((a, b) => (a.issueTime < b.issueTime ? 1 : -1))
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/screening/detail',
    method: 'get',
    timeout: delay(400, 800),
    response: ({ query }: any) => {
      if (SC_MAP.has(query.taskId)) return ok(SC_MAP.get(query.taskId))
      const t = ALL_SC.find((x) => x.taskId === query.taskId) ?? ALL_SC[0]
      const diff1 = rndInt(1, 6)
      return ok({
        ...t,
        orgReply: `经我院自查，${t.itemName}相关诊疗行为系依据患者实际病情开展，因${pick(['信息系统模板带出', '结算时点差异', '家属代取合并结算', '病历录入延迟', '医嘱执行记录未及时回传'])}导致数据存在差异，现补充说明并提交相关材料，请核查。`,
        materials: [
          { name: '门诊/住院处方（复印件）', type: 'PDF', size: `${rndInt(120, 680)} KB`, uploadTime: t.submitTime || '—', verify: '通过', ocrConfidence: rndInt(88, 98) },
          { name: '医嘱执行记录截图', type: 'PNG', size: `${rndInt(200, 900)} KB`, uploadTime: t.submitTime || '—', verify: rnd() > 0.75 ? '需补正' : '通过', ocrConfidence: rndInt(82, 96) },
          { name: '情况说明（加盖公章）', type: 'PDF', size: `${rndInt(180, 520)} KB`, uploadTime: t.submitTime || '—', verify: '通过', ocrConfidence: rndInt(85, 97) }
        ],
        selfReport: [
          { itemName: t.itemName, selfQty: 4 - diff1, insuranceQty: 4, diff: -diff1, unitPrice: 45, diffAmount: diff1 * 45, match: false },
          { itemName: '空腹血糖', selfQty: 1, insuranceQty: 1, diff: 0, unitPrice: 8, diffAmount: 0, match: true },
          { itemName: '诊查费', selfQty: 1, insuranceQty: 1, diff: 0, unitPrice: 15, diffAmount: 0, match: true }
        ],
        aiScreen: {
          conclusion: t.screenResult || pick(SC_RESULT),
          confidence: t.aiConfidence || rndInt(62, 94),
          analysis: `机构说明具备${rnd() > 0.5 ? '一定' : '较强'}合理性，但自报数据与医保结算数据仍存在 ${diff1} 单位差异（${(diff1 * 45).toFixed(2)} 元），${t.needFix ? '且关键材料存在需补正项，' : ''}建议${t.screenResult || '进一步核实'}。`,
          points: [`自报与结算差异 ${diff1} 单位（${(diff1 * 45).toFixed(2)} 元）`, `材料完整度 ${rndInt(66, 100)}%`, `OCR 平均置信度 ${rndInt(85, 97)}%`, `机构历史自查采信率 ${rndInt(52, 92)}%`]
        }
      })
    }
  },
  {
    url: '/api/screening/issue',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) => {
      const ids: string[] = body?.clueIds ?? []
      return ok({ successCount: ids.length, taskIds: ids.map((_, i) => `SC20260829${pad(500 + i, 4)}`), deadline: '2026-09-05 18:00:00', message: `已向 ${ids.length} 家机构下发自查任务，期限 7 日` })
    }
  },
  {
    url: '/api/screening/submit',
    method: 'post',
    timeout: delay(700, 1300),
    response: ({ body }: any) => ok({ taskId: body?.taskId, status: '已提交', submitTime: '2026-09-01 15:42:18', message: '自查说明及材料已提交，系统将自动进行数据比对与初筛' })
  },
  {
    url: '/api/screening/ai-screen',
    method: 'post',
    timeout: delay(1200, 2200),
    response: ({ body }: any) =>
      ok({
        taskId: body?.taskId,
        conclusion: '存疑线索',
        confidence: 76,
        analysis: '自报数据与结算数据差异未完全消除，且关键材料缺失，建议转线下核查。',
        recommendNext: '转线下核查',
        costMs: rndInt(1400, 2600)
      })
  },
  {
    url: '/api/screening/review',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) => ok({ taskId: body?.taskId, result: body?.result, message: `初筛结论已确认：${body?.result}` })
  },
  {
    url: '/api/screening/urge',
    method: 'post',
    timeout: delay(),
    response: ({ body }: any) => ok({ count: (body?.taskIds ?? []).length, message: `已向 ${(body?.taskIds ?? []).length} 家机构发送催办通知（工作台 + 短信）` })
  },

  /* ===== 机构端：我的自查任务 ===== */
  {
    url: '/api/org/self-check/mine',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = ALL_SC.filter((x) => x.orgCode === (query.orgCode || 'H340200001'))
      if (query.status) list = list.filter((x) => x.status === query.status)
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/org/self-check/summary',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      const list = ALL_SC.filter((x) => x.orgCode === (query.orgCode || 'H340200001'))
      return ok({
        orgName: list[0]?.orgName ?? '芜湖市第一人民医院',
        creditScore: 78,
        creditLevel: 'B级（一般信用）',
        total: list.length,
        waitingSubmit: list.filter((x) => ['待提交', '待下发'].includes(x.status)).length,
        submitted: list.filter((x) => ['已提交', '待审核', '已初筛'].includes(x.status)).length,
        closed: list.filter((x) => x.status === '已完成').length,
        overdue: list.filter((x) => x.overdue).length,
        totalAmount: Math.round(list.reduce((s, x) => s + x.suspectedAmount, 0) * 100) / 100,
        onTimeRate: 91.1,
        notice: '请于期限内完成自查并上传材料，逾期未提交将直接转入线下核查程序并计入机构信用评价。'
      })
    }
  }
] as MockMethod[]
