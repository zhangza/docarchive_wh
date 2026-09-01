import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import { APPEAL_STATS } from '../shared/data/stats'
import { APPEALS } from '../shared/data/detail'
import { CLUES } from '../shared/data/clues'
import { AUDITORS, resetSeed, rnd, rndInt, pick, pad, dt } from '../shared/data/base'

resetSeed(61616)
const AP_TYPES = ['事实认定异议', '金额认定异议', '政策适用异议', '程序异议', '其他']
const AP_STATUS = ['待受理', '已受理', 'AI初核中', '复核中', '已复核', '已撤回', '已逾期']
const AP_RESULT = ['申诉成立·撤销原结论', '部分撤销原结论', '申诉不成立·维持原结论']

const GEN_AP = CLUES.filter((c) => ['申诉中', '已流转', '已结案', '已驳回'].includes(c.status))
  .slice(0, 160)
  .map((c, i) => {
    const status = pick(AP_STATUS)
    const done = status === '已复核'
    const off = -rndInt(1, 26)
    const appealAmount = Math.round(c.suspectedAmount * (0.2 + rnd() * 0.7) * 100) / 100
    return {
      appealId: `AP2026${pad(rndInt(7, 8), 2)}${pad(rndInt(10, 31), 2)}${pad(i + 10, 4)}`,
      clueId: c.clueId,
      inspectTaskId: `INS2026${pad(8, 2)}${pad(rndInt(10, 30), 2)}${pad(i + 10, 4)}`,
      orgCode: c.orgCode,
      orgName: c.orgName,
      orgType: c.orgType,
      district: c.district,
      violationType: c.violationType,
      violationCategory: c.violationCategory,
      riskLevel: c.riskLevel,
      submitTime: dt(off, rndInt(9, 17), rndInt(0, 59)),
      deadline: dt(off + 15, 18, 0),
      applicant: `医保办·${pick(['张桂芳', '李建平', '王海燕', '陈立', '刘振'])}${pick(['主任', '科长', '负责人'])}`,
      contact: `1${pick(['3', '5', '8'])}${rndInt(100000000, 999999999)}`,
      appealType: pick(AP_TYPES),
      originalResult: `确认违规 · ${c.suspectedAmount.toFixed(2)} 元`,
      originalAmount: c.suspectedAmount,
      appealAmount,
      status,
      aiConfidence: rndInt(58, 96),
      aiConclusion: pick(['申诉成立', '申诉部分成立', '申诉不成立']),
      result: done ? pick(AP_RESULT) : '',
      finalAmount: done ? Math.round((c.suspectedAmount - appealAmount * (0.3 + rnd() * 0.7)) * 100) / 100 : 0,
      reviewer: done ? pick(AUDITORS) : '',
      reviewTime: done ? dt(off + rndInt(2, 12), rndInt(9, 17), rndInt(0, 59)) : '',
      materialCount: rndInt(2, 7),
      overdue: status === '已逾期',
      remainDays: ['待受理', '已受理', 'AI初核中', '复核中'].includes(status) ? rndInt(1, 14) : 0
    }
  })

const TYPICAL_AP_LIST = APPEALS.map((a) => ({
  appealId: a.appealId,
  clueId: a.clueId,
  inspectTaskId: a.inspectTaskId,
  orgCode: a.orgCode,
  orgName: a.orgName,
  orgType: '三级医院',
  district: '镜湖区',
  violationType: a.violationType,
  violationCategory: '用药类',
  riskLevel: '高',
  submitTime: a.submitTime,
  deadline: a.deadline,
  applicant: a.applicant,
  contact: a.contact,
  appealType: a.appealType,
  originalResult: a.originalResult,
  originalAmount: a.originalAmount,
  appealAmount: a.appealAmount,
  status: a.status,
  aiConfidence: a.aiPreReview.confidence,
  aiConclusion: a.aiPreReview.conclusion,
  result: a.review.result,
  finalAmount: a.review.finalAmount,
  reviewer: a.review.reviewer,
  reviewTime: a.review.time,
  materialCount: a.materials.length,
  overdue: false,
  remainDays: 0,
  isTypical: true
}))

const ALL_AP = [...TYPICAL_AP_LIST, ...GEN_AP]
const AP_MAP = new Map<string, any>(APPEALS.map((a) => [a.appealId, a]))

export default [
  { url: '/api/appeal/stats', method: 'get', timeout: delay(), response: () => ok(APPEAL_STATS) },
  {
    url: '/api/appeal/list',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(ALL_AP, query, {
        eq: ['status', 'appealType', 'district', 'result', 'orgType', 'orgCode', 'riskLevel'],
        like: ['orgName', 'appealId', 'clueId', 'violationType', 'applicant'],
        range: [{ key: 'appealAmount', min: 'amountMin', max: 'amountMax' }],
        dateRange: [{ key: 'submitTime', start: 'startTime', end: 'endTime' }]
      })
      if (query.overdue === 'true') list = list.filter((x) => x.overdue)
      list = keywordSearch(list, query.keyword, ['appealId', 'clueId', 'orgName', 'violationType', 'applicant'])
      list = [...list].sort((a, b) => (a.submitTime < b.submitTime ? 1 : -1))
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/appeal/detail',
    method: 'get',
    timeout: delay(400, 800),
    response: ({ query }: any) => {
      if (AP_MAP.has(query.appealId)) return ok(AP_MAP.get(query.appealId))
      const a = ALL_AP.find((x) => x.appealId === query.appealId) ?? ALL_AP[0]
      return ok({
        ...a,
        reason: `我院对该线索认定结论提出异议：${a.violationType}相关行为系依据患者实际病情及诊疗规范开展，${pick([
          '相关检查已实际执行且报告可查',
          '患者属特殊病种，符合长处方政策适用条件',
          '系统结算时点差异造成数据重复计入',
          '医嘱执行记录因系统故障延迟回传'
        ])}，请予复核并撤销/调整相应认定金额 ${a.appealAmount.toFixed(2)} 元。`,
        materials: Array.from({ length: a.materialCount }, (_, i) => ({
          name: pick(['LIS 检验报告单', '电子病历（病程记录）', '处方原件复印件', '情况说明（加盖公章）', '政策依据文件', '系统操作日志导出', '患者知情同意书']) + `_${i + 1}`,
          type: pick(['PDF', 'PNG', 'JPG', 'XLSX']),
          size: `${rndInt(120, 2400)} KB`,
          uploadTime: a.submitTime,
          verify: rnd() > 0.85 ? '需补正' : '通过'
        })),
        aiPreReview: {
          conclusion: a.aiConclusion,
          confidence: a.aiConfidence,
          time: a.submitTime,
          analysis: `AI 初核比对机构提交材料与原核查证据链：${a.aiConclusion === '申诉成立' ? '机构提交的关键证据可完整覆盖争议事实，原认定依据不足' : a.aiConclusion === '申诉部分成立' ? '部分争议项证据充分，其余项证据仍不足以推翻原认定' : '机构提交材料未能推翻原核查证据链，原认定依据充分'}，建议复核人员重点关注下列要点。`,
          points: [
            `材料完整度 ${rndInt(66, 100)}%，关键证据${rnd() > 0.4 ? '齐全' : '存在缺失'}`,
            `与原核查证据一致性 ${rndInt(45, 96)}%`,
            `政策适用检索命中 ${rndInt(1, 4)} 条相关条款`,
            `同类申诉历史采信率 ${rndInt(22, 68)}%`
          ]
        },
        review:
          a.status === '已复核'
            ? {
                reviewer: a.reviewer,
                approver: pick(['稽核组长·张建国', '稽核组长·赵桂芳']),
                time: a.reviewTime,
                result: a.result,
                finalAmount: a.finalAmount,
                opinion: `经复核，${a.result}。最终认定涉及医保基金 ${a.finalAmount.toFixed(2)} 元，已同步更新线索结论并告知机构。`
              }
            : null,
        timeline: [
          { title: '机构提交申诉', time: a.submitTime, operator: a.applicant, status: 'done' },
          { title: '受理审查', time: a.status === '待受理' ? '' : dt(-6, 9, 30), operator: '稽核员·王振华', status: a.status === '待受理' ? 'wait' : 'done' },
          { title: 'AI 智能初核', time: ['待受理', '已受理'].includes(a.status) ? '' : dt(-6, 9, 45), operator: 'AI 复核引擎 v2.3.2', status: ['待受理', '已受理'].includes(a.status) ? 'wait' : 'done' },
          { title: '人工复核', time: a.reviewTime, operator: a.reviewer || '待分派', status: a.status === '已复核' ? 'done' : a.status === '复核中' ? 'process' : 'wait' },
          { title: '结论告知机构', time: a.status === '已复核' ? dt(-4, 11, 0) : '', operator: '系统自动', status: a.status === '已复核' ? 'done' : 'wait' }
        ]
      })
    }
  },
  {
    url: '/api/appeal/submit',
    method: 'post',
    timeout: delay(700, 1300),
    response: ({ body }: any) =>
      ok({ appealId: `AP20260901${pad(rndInt(100, 999), 4)}`, clueId: body?.clueId, status: '待受理', submitTime: '2026-09-01 09:20:00', message: '申诉已提交，将在 3 个工作日内完成受理审查' })
  },
  {
    url: '/api/appeal/ai-review',
    method: 'post',
    timeout: delay(1400, 2600),
    response: ({ body }: any) =>
      ok({
        appealId: body?.appealId,
        conclusion: '申诉部分成立',
        confidence: 92,
        costMs: rndInt(1500, 2800),
        analysis: '机构提交的 LIS 检验报告可证明糖化血红蛋白检测实际执行，该项 62.00 元收费应予撤销；但超量开药事实证据充分，原认定应予维持。',
        recommendResult: '部分撤销原结论',
        recommendAmount: 180.0
      })
  },
  {
    url: '/api/appeal/accept',
    method: 'post',
    timeout: delay(),
    response: ({ body }: any) => ok({ appealId: body?.appealId, status: '已受理', message: '申诉已受理，已自动触发 AI 智能初核' })
  },
  {
    url: '/api/appeal/review',
    method: 'post',
    timeout: delay(700, 1300),
    response: ({ body }: any) =>
      ok({
        appealId: body?.appealId,
        result: body?.result,
        finalAmount: body?.finalAmount ?? 0,
        message: `复核决定已提交：${body?.result}，结论已推送机构工作台`
      })
  },
  /* 机构端：我的申诉 */
  {
    url: '/api/org/appeal/mine',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = ALL_AP.filter((x) => x.orgCode === (query.orgCode || 'H340200001'))
      if (query.status) list = list.filter((x) => x.status === query.status)
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  /* 可申诉线索（机构端选择） */
  {
    url: '/api/org/appeal/appealable',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      const list = CLUES.filter((c) => c.orgCode === (query.orgCode || 'H340200001') && ['已流转', '已结案'].includes(c.status)).map((c) => ({
        clueId: c.clueId,
        violationType: c.violationType,
        riskLevel: c.riskLevel,
        confirmAmount: c.suspectedAmount,
        confirmTime: c.detectTime,
        appealDeadline: '2026-09-15 18:00:00',
        appealed: false
      }))
      return ok(paginate(list, query.page, query.pageSize))
    }
  }
] as MockMethod[]
