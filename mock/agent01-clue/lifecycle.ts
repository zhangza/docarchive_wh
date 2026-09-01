import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import { LIFECYCLE_STATS, FEEDBACK_STATS } from '../shared/data/stats'
import { LIFECYCLES, MISJUDGE_FEEDBACKS } from '../shared/data/detail'
import { CLUES, CLUE_MAP } from '../shared/data/clues'
import { RULES, AUDITORS, resetSeed, rnd, rndInt, pick, pad, dt } from '../shared/data/base'

/* ===== 通用节点生成：根据线索状态推导已走过的阶段 ===== */
const STAGE_FLOW = [
  { stage: '数据比对', title: '全量数据比对发现疑点', operator: '比对引擎' },
  { stage: '智能预警', title: '智能识别生成标准化线索', operator: '规则引擎 + AI 模型' },
  { stage: '线索分派', title: '按风险等级自动分派稽核员', operator: '系统自动' },
  { stage: '线索研判', title: '稽核员完成人工研判', operator: '稽核员' },
  { stage: '线上筛查', title: '下发机构在线自查', operator: '稽核员' },
  { stage: '自查提交', title: '机构提交自查说明及材料', operator: '机构医保办' },
  { stage: '线下核查', title: '现场核查取证', operator: '核查组' },
  { stage: '机构申诉', title: '机构提交申诉并完成复核', operator: '机构 / 复核人员' },
  { stage: '违规确认', title: '确认违规并流转处置', operator: '稽核组长' },
  { stage: '已结案', title: '追回到账并结案归档', operator: '基金监管处' }
]

function buildNodes(clue: any) {
  resetSeed(Number(clue.clueId.slice(-6)) || 1)
  const idx: Record<string, number> = {
    待研判: 3,
    研判中: 4,
    线上筛查中: 6,
    线下核查中: 7,
    申诉中: 8,
    已驳回: 4,
    已流转: 9,
    已结案: 10
  }
  const n = idx[clue.status] ?? 4
  const flow = STAGE_FLOW.slice(0, n)
  let day = -3
  return flow.map((f, i) => {
    day += i === 0 ? 0 : rndInt(0, 1)
    const done = i < n - 1 || ['已结案', '已驳回', '已流转'].includes(clue.status)
    return {
      stage: f.stage,
      title: clue.status === '已驳回' && i === 3 ? '稽核员研判为合理·驳回' : f.title,
      time: dt(day, rndInt(8, 18), rndInt(0, 59)),
      operator: f.operator === '稽核员' ? clue.assignee ?? '稽核员·王振华' : f.operator,
      status: done ? 'done' : 'process',
      desc: `${f.stage}环节完成，处理时长 ${rndInt(1, 26)} 小时 ${rndInt(1, 59)} 分钟。`,
      duration: `${rndInt(1, 26)}小时${rndInt(1, 59)}分`
    }
  })
}

/* ===== 误判反馈全集 ===== */
resetSeed(71717)
const FB_TYPES = ['规则误判', '规则覆盖缺口', '数据质量问题', '阈值设置不当', '其他']
const FB_STATUS = ['待确认', '已确认', '优化中', '已优化', '不予采纳']
const GEN_FB = Array.from({ length: 180 }, (_, i) => {
  const rule = pick(RULES)
  const status = pick(FB_STATUS)
  const clue = pick(CLUES)
  const misjudgeRate = Math.round((rule.misjudgeCount / rule.hitCount) * 1000) / 10
  return {
    feedbackId: `FB2026${pad(rndInt(6, 9), 2)}${pad(rndInt(1, 28), 2)}${pad(i + 10, 4)}`,
    clueId: clue.clueId,
    feedbackType: pick(FB_TYPES),
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    category: rule.category,
    submitter: pick(AUDITORS),
    submitTime: dt(-rndInt(1, 80), rndInt(9, 18), rndInt(0, 59)),
    reason: pick([
      '患者属特殊病种，现行规则未设置豁免条件，导致合理长处方被误判。',
      '规则阈值偏低，正常诊疗量被大量命中，稽核工作量激增。',
      '数据源回传延迟导致比对时数据不完整，产生虚假差异。',
      '同类项目编码映射缺失，导致合理串换被识别为违规。',
      '未考虑机构等级与科室差异，统一阈值不适配三级医院实际情况。',
      '规则覆盖缺口：新型诊疗项目未纳入规则库，存在漏判风险。'
    ]),
    suggestion: pick([
      '建议增加特殊病种白名单豁免逻辑。',
      '建议将阈值由现行值上调 30%，并按机构等级差异化设置。',
      '建议增加数据完整度前置校验，不完整不触发预警。',
      '建议补全项目编码映射关系表。',
      '建议引入 AI 置信度二次过滤，低置信度不直接生成线索。'
    ]),
    hitCount: rule.hitCount,
    misjudgeCount: rule.misjudgeCount,
    misjudgeRate,
    status,
    handler: ['优化中', '已优化', '不予采纳'].includes(status) ? '模型运营·孙志远' : '',
    handleTime: ['优化中', '已优化', '不予采纳'].includes(status) ? dt(-rndInt(1, 40), rndInt(9, 18), rndInt(0, 59)) : '',
    modelVersion: status === '已优化' ? `v2.3.${rndInt(1, 2)} → v2.3.${rndInt(2, 3)}` : '',
    effectAfter:
      status === '已优化'
        ? { misjudgeRate: Math.round(misjudgeRate * 0.32 * 10) / 10, accuracy: Math.round((90 + rnd() * 8) * 10) / 10, improve: Math.round(rnd() * 60 + 20) / 10 }
        : null,
    negativeSample: status === '已优化' || status === '优化中'
  }
})

const TYPICAL_FB = MISJUDGE_FEEDBACKS.map((f) => ({ ...f, isTypical: true }))
const ALL_FB = [...TYPICAL_FB, ...GEN_FB]
const FB_MAP = new Map<string, any>(ALL_FB.map((f) => [f.feedbackId, f]))

/* ===== 全周期列表 ===== */
resetSeed(81818)
const LC_LIST = CLUES.map((c) => {
  const stageMap: Record<string, string> = {
    待研判: '线索研判',
    研判中: '线索研判',
    线上筛查中: '线上筛查',
    线下核查中: '线下核查',
    申诉中: '机构申诉',
    已驳回: '已结案',
    已流转: '违规处置',
    已结案: '已结案'
  }
  const hours = rndInt(2, 380)
  return {
    clueId: c.clueId,
    riskLevel: c.riskLevel,
    violationType: c.violationType,
    violationCategory: c.violationCategory,
    orgName: c.orgName,
    orgType: c.orgType,
    district: c.district,
    patientName: c.patientName,
    suspectedAmount: c.suspectedAmount,
    confirmAmount: ['已流转', '已结案'].includes(c.status) ? Math.round(c.suspectedAmount * (0.5 + rnd() * 0.5) * 100) / 100 : 0,
    recoveredAmount: c.status === '已结案' ? Math.round(c.suspectedAmount * (0.4 + rnd() * 0.5) * 100) / 100 : 0,
    status: c.status,
    currentStage: stageMap[c.status] ?? '线索研判',
    stageCount: rndInt(3, 10),
    createTime: c.detectTime,
    updateTime: dt(-rndInt(0, 3), rndInt(9, 18), rndInt(0, 59)),
    totalHours: hours,
    durationText: hours >= 24 ? `${Math.floor(hours / 24)}天${hours % 24}小时` : `${hours}小时`,
    slaStatus: hours > 168 ? '超时' : hours > 120 ? '临期' : '按时',
    assignee: c.assignee ?? '待分派',
    feedbackConfirmed: c.status === '已结案' ? rnd() > 0.25 : false,
    hasAppeal: c.status === '申诉中' || (['已流转', '已结案'].includes(c.status) && rnd() > 0.8)
  }
})

export default [
  /* ===== M14 全周期跟踪 ===== */
  { url: '/api/lifecycle/stats', method: 'get', timeout: delay(), response: () => ok(LIFECYCLE_STATS) },
  {
    url: '/api/lifecycle/list',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(LC_LIST, query, {
        eq: ['riskLevel', 'status', 'currentStage', 'district', 'orgType', 'slaStatus', 'violationCategory', 'assignee'],
        like: ['orgName', 'clueId', 'violationType', 'patientName'],
        range: [{ key: 'suspectedAmount', min: 'amountMin', max: 'amountMax' }],
        dateRange: [{ key: 'createTime', start: 'startTime', end: 'endTime' }]
      })
      if (query.overtime === 'true') list = list.filter((x) => x.slaStatus === '超时')
      list = keywordSearch(list, query.keyword, ['clueId', 'orgName', 'violationType', 'patientName', 'assignee'])
      list = [...list].sort((a, b) => (a.createTime < b.createTime ? 1 : -1))
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/lifecycle/detail',
    method: 'get',
    timeout: delay(400, 900),
    response: ({ query }: any) => {
      const id = query.clueId
      if (LIFECYCLES[id]) return ok(LIFECYCLES[id])
      const clue = CLUE_MAP.get(id) ?? CLUES[0]
      const nodes = buildNodes(clue)
      const lc = LC_LIST.find((x) => x.clueId === id) ?? LC_LIST[0]
      return ok({
        clueId: clue.clueId,
        totalDuration: lc.durationText,
        stageCount: nodes.length,
        currentStage: lc.currentStage,
        slaStatus: lc.slaStatus === '按时' ? '按时完成' : lc.slaStatus,
        nodes,
        feedback:
          clue.status === '已结案'
            ? {
                feedbackId: `FK${clue.detectTime.slice(0, 10).replace(/-/g, '')}${pad(rndInt(1, 9999), 4)}`,
                sendTime: dt(-1, 11, 5),
                readTime: dt(-1, 16, 20),
                channel: '机构工作台 + 短信通知',
                content: `您单位线索 ${clue.clueId}（${clue.violationType}）已完成处理，最终认定涉及医保基金 ${lc.confirmAmount.toFixed(2)} 元，请按要求整改并规范诊疗行为。`,
                confirmed: lc.feedbackConfirmed
              }
            : null
      })
    }
  },
  {
    url: '/api/lifecycle/urge',
    method: 'post',
    timeout: delay(),
    response: ({ body }: any) => ok({ count: (body?.clueIds ?? []).length, message: `已对 ${(body?.clueIds ?? []).length} 条超时线索发起督办提醒` })
  },
  {
    url: '/api/lifecycle/feedback-send',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) => ok({ feedbackId: `FK20260901${pad(rndInt(1, 9999), 4)}`, clueId: body?.clueId, message: '处理结果已推送机构工作台并发送短信通知' })
  },

  /* ===== M15 误判反馈 ===== */
  { url: '/api/feedback/stats', method: 'get', timeout: delay(), response: () => ok(FEEDBACK_STATS) },
  {
    url: '/api/feedback/list',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(ALL_FB, query, {
        eq: ['feedbackType', 'status', 'ruleId', 'category', 'submitter'],
        like: ['ruleName', 'feedbackId', 'clueId'],
        range: [{ key: 'misjudgeRate', min: 'rateMin', max: 'rateMax' }],
        dateRange: [{ key: 'submitTime', start: 'startTime', end: 'endTime' }]
      })
      list = keywordSearch(list, query.keyword, ['feedbackId', 'clueId', 'ruleName', 'reason', 'suggestion'])
      list = [...list].sort((a, b) => (a.submitTime < b.submitTime ? 1 : -1))
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/feedback/detail',
    method: 'get',
    timeout: delay(300, 700),
    response: ({ query }: any) => ok(FB_MAP.get(query.feedbackId) ?? ALL_FB[0])
  },
  {
    url: '/api/feedback/submit',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) =>
      ok({ feedbackId: `FB20260901${pad(rndInt(100, 999), 4)}`, clueId: body?.clueId, status: '待确认', message: '误判反馈已提交，将作为负样本沉淀至模型训练集' })
  },
  {
    url: '/api/feedback/handle',
    method: 'post',
    timeout: delay(700, 1300),
    response: ({ body }: any) => ok({ feedbackId: body?.feedbackId, status: body?.status, message: `反馈处理状态已更新为：${body?.status}` })
  },
  {
    url: '/api/feedback/rules',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = FEEDBACK_STATS.ruleRank
      if (query.category) list = list.filter((r) => r.category === query.category)
      if (query.keyword) list = list.filter((r) => r.ruleName.includes(query.keyword) || r.ruleId.includes(query.keyword))
      return ok(paginate(list, query.page, query.pageSize ?? 20))
    }
  },
  {
    url: '/api/feedback/optimize',
    method: 'post',
    timeout: delay(1600, 2800),
    response: ({ body }: any) =>
      ok({
        ruleId: body?.ruleId,
        oldVersion: 'v2.3.1',
        newVersion: 'v2.3.2',
        beforeMisjudgeRate: 6.7,
        afterMisjudgeRate: 2.1,
        accuracy: 94.8,
        improve: 4.6,
        trainSamples: 342,
        costMs: rndInt(1800, 3200),
        message: '规则/模型已完成优化并灰度上线，误判率下降 4.6 个百分点'
      })
  }
] as MockMethod[]
