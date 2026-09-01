/**
 * 违规处置数据集 —— 全平台处置口径唯一来源
 * 需求依据：doc/子功能/03_违规处置智能体_详细功能设计.md
 * 与机构/人员/线索/任务等共享数据集保持口径一致
 */
import {
  ORGS, AUDITORS, AUDIT_GROUPS, DEPTS, DOCTORS,
  resetSeed, rnd, rndInt, pick, pickMany, pad, dt, d
} from './base'

/* ============ 全局枚举（文档 5.3 / 5.4） ============ */

/** 问题性质（4 级） */
export const PROBLEM_NATURES = ['一般违规', '较重违规', '严重违规', '涉嫌欺诈骗保'] as const

/** 处置措施与审批层级 */
export const HANDLE_MEASURES = [
  { measure: '约谈', apply: '情节较轻，首次违规', approval: '科长审批', type: '协议处理' },
  { measure: '拒付', apply: '未结算的违规费用', approval: '科长审批', type: '协议处理' },
  { measure: '基金追回', apply: '已支付的违规基金', approval: '科长审批', type: '协议处理' },
  { measure: '责令整改', apply: '存在管理漏洞需限期改正', approval: '科长审批', type: '协议处理' },
  { measure: '暂停结算', apply: '情节较重或整改不力', approval: '处长审批', type: '协议处理' },
  { measure: '暂停服务协议', apply: '严重违规或暂停结算后不改（1-6个月）', approval: '局长审批', type: '协议处理' },
  { measure: '解除服务协议', apply: '特别严重违规', approval: '局长办公会', type: '协议处理' },
  { measure: '行政处罚', apply: '欺诈骗保或情节严重', approval: '局长审批+法制审核', type: '行政处罚' },
  { measure: '移送公安', apply: '涉嫌犯罪', approval: '局长审批+法制审核', type: '移送处理' }
]

/** 违规类型 */
export const PUNISH_VIOLATION_TYPES = [
  '重复收费', '过度诊疗', '无指征收费', '超量开药', '串换药品',
  '虚假诊疗', '虚构住院', '虚增费用', '串换项目', '欺诈骗保', '管理问题'
]

/** 追回方式（5 值） */
export const RECOVERY_METHODS = ['主动退回', '医保结算扣缴', '银行划拨', '法院强制执行', '其他'] as const

/** 追回状态（6 值） */
export const RECOVERY_STATUS = ['待追回', '追回中', '已追回', '部分追回', '逾期未追回', '核销（无法追回）'] as const

/** 复核意见（4 值） */
export const REVIEW_OPINIONS = ['通过', '退回修改', '需补充证据', '需集体审议'] as const

/** 行政处罚 12 节点 */
export const PENALTY_STEPS = [
  '立案审批', '调查取证', '案件调查终结报告', '事先告知', '听证告知', '陈述申辩/听证',
  '法制审核', '集体讨论', '处罚决定', '送达', '执行', '结案'
]

/** 处罚种类（5 项） */
export const PENALTY_KINDS = ['警告', '罚款', '没收违法所得', '暂停医药服务', '吊销执业资格（建议）'] as const

/** 移送类型（4 值） */
export const TRANSFER_TYPES = [
  { type: '涉嫌犯罪移送公安', target: '芜湖市公安局经济犯罪侦查支队', cond: '个人≥5000元，单位≥5万元' },
  { type: '违纪移送纪检', target: '芜湖市纪委监委驻卫健委纪检组', cond: '涉及公职人员、党员违纪违法' },
  { type: '移送卫健', target: '芜湖市卫生健康委员会', cond: '医疗机构或医务人员执业违规' },
  { type: '移送给市监', target: '芜湖市市场监督管理局', cond: '价格违法、不正当竞争' }
]

/** 整改状态 */
export const RECTIFY_STATUS = ['待整改', '整改中', '待复查', '复查不通过', '已完成', '已超期'] as const

/** 销号条件校验项 */
export const CANCEL_CONDITIONS = [
  { key: 'confirmed', name: '违规定性完成', desc: '违规确认书已双人复核通过并送达' },
  { key: 'handled', name: '处置措施执行到位', desc: '协议处理/行政处罚/移送处理已执行完毕' },
  { key: 'recovered', name: '基金追回到位', desc: '应追金额已全额到账核销' },
  { key: 'rectified', name: '整改验收通过', desc: '整改清单逐项复查通过' },
  { key: 'documented', name: '文书齐备归档', desc: '成套执法文书齐备并归入电子案卷' }
]

/** 信用等级 */
export const CREDIT_LEVELS = [
  { level: 'A', name: '优秀', range: '90-100', color: '#12a150' },
  { level: 'B', name: '良好', range: '80-89', color: '#1668dc' },
  { level: 'C', name: '一般', range: '70-79', color: '#e8a30c' },
  { level: 'D', name: '较差', range: '60-69', color: '#d4380d' },
  { level: 'E', name: '差', range: '60以下', color: '#e5484d' }
]

/* ============ 类型定义 ============ */

export interface Confirmation {
  confirmationId: string
  taskId: string
  orgName: string
  orgCode: string
  orgType: string
  district: string
  confirmTime: string
  status: string
  problemNature: string
  violationTypes: { type: string; level: string; count: number; amount: number }[]
  natureReason: string
  legalBasis: { law: string; article: string; content: string }[]
  amount: {
    totalViolationAmount: number
    insuranceFundAmount: number
    personalAccountAmount: number
    selfPayAmount: number
    byInsurance: Record<string, number>
    penaltyAmount: number
    penaltyBasis: string
    penaltyMultiple: number
    totalRecoverable: number
  }
  responsibility: {
    orgResponsibility: { org: string; type: string; degree: string; description: string }
    deptResponsibility: { dept: string; type: string; degree: string; description: string }[]
    personalResponsibility: { name: string; dept: string; type: string; degree: string; description: string }[]
  }
  aiSuggestion: { suggestedHandling: string; suggestedMeasures: string[]; confidence: number; reason: string }
  needDualReview: boolean
  dualReviewReasons: string[]
  review: {
    reviewId: string
    firstReviewer: { name: string; role: string; opinion: string; signTime: string }
    secondReviewer: {
      name: string; role: string
      reviewItems: { item: string; result: string; comment: string }[]
      opinion: string; result: string; signTime: string
    } | null
    status: string
  }
  report: { reportId: string; reportNo: string; status: string; generateTime: string } | null
  delivery: { pushTime: string; pushMethod: string[]; signed: boolean; signTime: string; readStatus: string } | null
}

export interface Handling {
  handlingId: string
  confirmationId: string
  taskId: string
  handlingType: string
  orgName: string
  orgCode: string
  problemNature: string
  createTime: string
  status: string
  totalAmount: number
  measures: {
    measureId: string; measureType: string; target: string; content: string
    amount: number; deadline: string; status: string; approval: string
    document: { name: string; no: string }
  }[]
  approval: {
    proposer: string; proposeTime: string; reviewer: string; reviewTime: string
    approver: string; approveTime: string; approvalOpinion: string; approvalLevel: string
  }
}

export interface Penalty {
  penaltyId: string
  caseNo: string
  taskId: string
  orgName: string
  createTime: string
  currentStep: string
  stepIndex: number
  status: string
  violationFacts: { type: string; description: string; fraudAmount: number; insuranceFundAmount: number }
  legalBasis: { law: string; articles: { article: string; content: string }[] }
  penaltyDecision: {
    measures: { type: string; content: string; amount: number; multiple: number }[]
    totalAmount: number; decisionDate: string; decisionMaker: string
  }
  procedureRecords: { step: string; done: boolean; time: string; operator: string; doc: string }[]
  execution: { status: string; refundedAmount: number; finePaidAmount: number; refundDeadline: string }
}

export interface Transfer {
  transferId: string
  taskId: string
  orgName: string
  transferType: string
  targetOrg: string
  createTime: string
  status: string
  fraudAmount: number
  reason: string
  legalBasis: string[]
  suspects: { name: string; role: string; type: string }[]
  approval: { proposer: string; legalReviewer: string; legalOpinion: string; approver: string; approveTime: string }
  documents: { name: string; no: string }[]
  evidenceMaterials: { name: string; type: string; pages: number }[]
  followUp: { status: string; feedback: string; feedbackDeadline: string; reminderCount: number }
}

export interface Recovery {
  recoveryId: string
  taskId: string
  confirmationId: string
  orgName: string
  orgCode: string
  orgType: string
  district: string
  violationType: string
  createTime: string
  status: string
  recoveryMethod: string
  amount: {
    shouldPrincipal: number; shouldFine: number; shouldInterest: number; shouldTotal: number
    recoveredTotal: number; unrecoveredTotal: number; recoveryRate: number
  }
  byInsurance: Record<string, { should: number; recovered: number }>
  plan: { deadline: string; method: string; installment: boolean }
  records: { recordId: string; date: string; amount: number; method: string; voucherNo: string; operator: string; confirmer: string }[]
  overdue: boolean
  overdueDays: number
}

export interface Rectify {
  rectifyId: string
  taskId: string
  orgName: string
  orgCode: string
  district: string
  issueTime: string
  deadline: string
  status: string
  progress: number
  items: {
    itemId: string; violationType: string; problem: string; requirement: string
    deadline: string; status: string
    feedback: { content: string; evidence: string[]; feedbackTime: string; feedbacker: string } | null
    review: { result: string; opinion: string; reviewer: string; reviewTime: string } | null
  }[]
  overdue: boolean
  reviewer: string
}

export interface CancelCase {
  cancelId: string
  taskId: string
  confirmationId: string
  caseName: string
  orgName: string
  orgCode: string
  district: string
  applyTime: string
  status: string
  conditions: { key: string; name: string; passed: boolean; detail: string }[]
  allPassed: boolean
  approval: {
    level: string
    nodes: { role: string; name: string; result: string; opinion: string; time: string }[]
    finalResult: string
    cancelNo: string
    cancelTime: string
  }
  credit: {
    creditId: string
    orgScoreBefore: number
    orgScoreAfter: number
    orgLevelBefore: string
    orgLevelAfter: string
    deduction: number
    reason: string
    personalRecords: { name: string; dept: string; deduction: number; measure: string }[]
    publicity: boolean
    validUntil: string
  } | null
  totalAmount: number
  recoveredAmount: number
}

/* ============ 违规确认数据 ============ */
resetSeed(70001)

const LEGAL_LIBRARY = [
  { law: '《医疗保障基金使用监督管理条例》', article: '第十五条', content: '定点医药机构及其工作人员不得分解住院、挂床住院，不得违反诊疗规范过度诊疗、过度检查、分解处方、超量开药、重复开药。' },
  { law: '《医疗保障基金使用监督管理条例》', article: '第三十八条', content: '定点医药机构违反本条例规定，由医疗保障行政部门责令改正，并可以约谈有关负责人；造成医疗保障基金损失的，责令退回，处造成损失金额1倍以上2倍以下的罚款。' },
  { law: '《医疗保障基金使用监督管理条例》', article: '第四十条', content: '定点医药机构以骗取医疗保障基金为目的，实施虚构医药服务项目等行为，由医疗保障行政部门责令退回，处骗取金额2倍以上5倍以下的罚款。' },
  { law: '《医疗保障基金使用监督管理条例》', article: '第二十一条', content: '定点医药机构应当按照规定保管财务账目、会计凭证、处方、病历、治疗检查记录等资料。' },
  { law: '《医疗机构医疗保障定点管理暂行办法》', article: '第四十九条', content: '定点医疗机构违反本办法规定，医疗保障经办机构可以中止或解除医保协议。' },
  { law: '《芜湖市基本医疗保险定点医药机构服务协议》', article: '第二十八条', content: '乙方存在违规行为造成基金损失的，甲方有权追回违规费用，并按协议约定处理。' }
]

const NATURE_REASONS: Record<string, string> = {
  一般违规: '违规情节轻微，涉及金额较小，属首次发现，机构能积极配合检查并主动整改',
  较重违规: '违规行为涉及多个科室，具有一定普遍性，涉及金额较大，反映内部管理存在明显漏洞',
  严重违规: '违规行为具有系统性特征，涉及金额巨大，且此前已有同类问题被查处，属屡查屡犯',
  涉嫌欺诈骗保: '存在主观故意骗取医保基金的行为，虚构医药服务项目、伪造诊疗记录，涉嫌构成诈骗罪'
}

const HANDLING_SUGGESTION: Record<string, { handling: string; measures: string[] }> = {
  一般违规: { handling: '协议处理', measures: ['约谈', '基金追回', '责令整改'] },
  较重违规: { handling: '协议处理', measures: ['基金追回', '责令整改', '暂停结算'] },
  严重违规: { handling: '协议处理+行政处罚', measures: ['基金追回', '行政处罚', '暂停服务协议'] },
  涉嫌欺诈骗保: { handling: '协议处理+行政处罚+移送处理', measures: ['基金追回', '行政处罚', '解除服务协议', '移送公安'] }
}

const REVIEW_ITEMS = ['违规定性', '金额核算', '证据充分性', '程序合规性', '法律依据']

function natureByAmount(amount: number, isFraud: boolean): string {
  if (isFraud) return '涉嫌欺诈骗保'
  if (amount >= 80000) return '严重违规'
  if (amount >= 20000) return '较重违规'
  return '一般违规'
}

function penaltyMultipleOf(nature: string): number {
  if (nature === '涉嫌欺诈骗保') return rndInt(20, 50) / 10
  if (nature === '严重违规') return rndInt(15, 20) / 10
  if (nature === '较重违规') return rndInt(10, 15) / 10
  return 0
}

function genConfirmations(count: number): Confirmation[] {
  const out: Confirmation[] = []
  const statusPool = ['待复核', '复核中', '已退回', '复核通过', '已送达', '已处置']
  for (let i = 0; i < count; i++) {
    const org = pick(ORGS)
    const isFraud = rnd() < 0.16
    const total = isFraud ? rndInt(50000, 320000) : rndInt(2000, 120000)
    const nature = natureByAmount(total, isFraud)
    const fundAmount = Math.round(total * (0.72 + rnd() * 0.18))
    const personalAcc = Math.round((total - fundAmount) * 0.6)
    const multiple = penaltyMultipleOf(nature)
    const penalty = multiple ? Math.round(total * multiple) : 0
    const status = pick(statusPool)
    const vtCount = rndInt(1, 3)
    const vts = pickMany(isFraud ? ['虚假诊疗', '虚构住院', '欺诈骗保', '串换药品'] : PUNISH_VIOLATION_TYPES, vtCount)
    const violationTypes = vts.map((t) => ({
      type: t,
      level: '二级',
      count: rndInt(2, 60),
      amount: Math.round(total / vtCount)
    }))
    const depts = pickMany(DEPTS, rndInt(1, 3))
    const docs = pickMany(DOCTORS, rndInt(1, 2))
    const firstName = pick(AUDITORS)
    const secondName = pick(AUDITORS.filter((a) => a !== firstName))

    const dualReasons: string[] = []
    if (isFraud) dualReasons.push('认定涉嫌欺诈骗保')
    if (total >= 10000) dualReasons.push('违规金额 ≥ 10000 元')
    if (nature === '严重违规' || isFraud) dualReasons.push('拟解除服务协议')
    if (penalty > 0) dualReasons.push('拟行政处罚')
    if (isFraud) dualReasons.push('拟移送公安/纪检')
    const needDual = dualReasons.length > 0

    const reviewed = ['复核通过', '已送达', '已处置'].includes(status)
    const sug = HANDLING_SUGGESTION[nature]
    const cid = `CONF20260910${pad(i + 1, 4)}`

    out.push({
      confirmationId: cid,
      taskId: `TASK202608${pad(rndInt(1, 30), 3)}`,
      orgName: org.orgName,
      orgCode: org.orgCode,
      orgType: org.orgType,
      district: org.district,
      confirmTime: dt(-rndInt(0, 20), rndInt(8, 17), rndInt(0, 59)),
      status,
      problemNature: nature,
      violationTypes,
      natureReason: NATURE_REASONS[nature],
      legalBasis: pickMany(LEGAL_LIBRARY, rndInt(2, 3)),
      amount: {
        totalViolationAmount: total,
        insuranceFundAmount: fundAmount,
        personalAccountAmount: personalAcc,
        selfPayAmount: total - fundAmount - personalAcc,
        byInsurance: {
          职工医保: Math.round(fundAmount * 0.62),
          居民医保: fundAmount - Math.round(fundAmount * 0.62)
        },
        penaltyAmount: penalty,
        penaltyBasis: penalty
          ? nature === '涉嫌欺诈骗保'
            ? '《医疗保障基金使用监督管理条例》第四十条：处骗取金额2倍以上5倍以下罚款'
            : '《医疗保障基金使用监督管理条例》第三十八条：处造成损失金额1倍以上2倍以下罚款'
          : '不予罚款',
        penaltyMultiple: multiple,
        totalRecoverable: total + penalty
      },
      responsibility: {
        orgResponsibility: {
          org: org.orgName,
          type: '主体责任',
          degree: '主要责任',
          description: '未建立有效的医保基金使用内控制度，对科室诊疗收费行为监督管理不到位'
        },
        deptResponsibility: depts.map((dp) => ({
          dept: dp,
          type: '管理责任',
          degree: pick(['主要责任', '次要责任']),
          description: `${dp}未严格执行医保诊疗规范与收费标准，科室负责人履职不到位`
        })),
        personalResponsibility: docs.map((dc: any) => ({
          name: dc.name,
          dept: dc.dept,
          type: '直接责任',
          degree: pick(['主要责任', '次要责任', '连带责任']),
          description: '违反诊疗规范开具处方/收费项目，直接造成医保基金损失'
        }))
      },
      aiSuggestion: {
        suggestedHandling: sug.handling,
        suggestedMeasures: sug.measures,
        confidence: rndInt(82, 97),
        reason: `依据核查证据链与${nature}认定标准，比对同类历史案例 ${rndInt(6, 28)} 件，建议采取${sug.measures.join('、')}`
      },
      needDualReview: needDual,
      dualReviewReasons: dualReasons,
      review: {
        reviewId: `REV20260910${pad(i + 1, 4)}`,
        firstReviewer: {
          name: firstName,
          role: '承办人',
          opinion: '经核查，违规事实清楚、证据充分，定性与金额核算准确，建议按上述意见处置',
          signTime: dt(-rndInt(0, 18), rndInt(9, 17), 0)
        },
        secondReviewer: reviewed
          ? {
              name: secondName,
              role: '复核人',
              reviewItems: REVIEW_ITEMS.map((it) => ({
                item: it,
                result: '符合',
                comment: `${it}审核无异议`
              })),
              opinion: '定性准确、金额核算无误、证据链完整、程序合规、法律依据适当，同意按承办意见处置',
              result: '通过',
              signTime: dt(-rndInt(0, 16), rndInt(9, 17), 0)
            }
          : status === '已退回'
            ? {
                name: secondName,
                role: '复核人',
                reviewItems: REVIEW_ITEMS.map((it, k) => ({
                  item: it,
                  result: k === 2 ? '不符合' : '符合',
                  comment: k === 2 ? '部分违规事实缺少原始凭证支撑，需补充证据' : `${it}审核无异议`
                })),
                opinion: '证据充分性不足，请补充相关原始凭证后重新提交复核',
                result: '需补充证据',
                signTime: dt(-rndInt(0, 14), rndInt(9, 17), 0)
              }
            : null,
        status: reviewed ? '复核通过' : status === '已退回' ? '已退回' : '待复核'
      },
      report: reviewed
        ? {
            reportId: `RPT20260910${pad(i + 1, 4)}`,
            reportNo: `芜医保检报〔2026〕${pad(i + 1, 3)}号`,
            status: '已生成',
            generateTime: dt(-rndInt(0, 15), rndInt(9, 17), 0)
          }
        : null,
      delivery: ['已送达', '已处置'].includes(status)
        ? {
            pushTime: dt(-rndInt(0, 13), rndInt(9, 17), 0),
            pushMethod: ['系统通知', '短信', '电子送达'],
            signed: rnd() > 0.2,
            signTime: dt(-rndInt(0, 12), rndInt(9, 17), 0),
            readStatus: '已读'
          }
        : null
    })
  }
  return out
}

export const CONFIRMATIONS = genConfirmations(62)
export const CONFIRMATION_MAP: Record<string, Confirmation> = {}
CONFIRMATIONS.forEach((c) => (CONFIRMATION_MAP[c.confirmationId] = c))

/* ============ 协议处理 ============ */
resetSeed(70002)

const MEASURE_DOCS: Record<string, string> = {
  约谈: '约谈通知书',
  拒付: '拒付通知书',
  基金追回: '违规费用追回通知书',
  责令整改: '整改意见书',
  暂停结算: '暂停医保结算通知书',
  暂停服务协议: '暂停医保服务协议通知书',
  解除服务协议: '解除医保服务协议通知书'
}

function genHandlings(count: number): Handling[] {
  const out: Handling[] = []
  const statusPool = ['待审批', '审批中', '已审批', '执行中', '已执行']
  for (let i = 0; i < count; i++) {
    const conf = pick(CONFIRMATIONS)
    const sug = HANDLING_SUGGESTION[conf.problemNature]
    const chosen = sug.measures.filter((m) => !['行政处罚', '移送公安'].includes(m))
    const status = pick(statusPool)
    const proposer = pick(AUDITORS)
    const maxLevel = chosen.includes('解除服务协议')
      ? '局长办公会'
      : chosen.includes('暂停服务协议')
        ? '局长审批'
        : chosen.includes('暂停结算')
          ? '处长审批'
          : '科长审批'
    out.push({
      handlingId: `HAND20260915${pad(i + 1, 4)}`,
      confirmationId: conf.confirmationId,
      taskId: conf.taskId,
      handlingType: '协议处理',
      orgName: conf.orgName,
      orgCode: conf.orgCode,
      problemNature: conf.problemNature,
      createTime: dt(-rndInt(0, 16), rndInt(8, 17), 0),
      status,
      totalAmount: conf.amount.totalViolationAmount,
      measures: chosen.map((m, k) => ({
        measureId: `MS${pad(i + 1, 3)}${pad(k + 1, 2)}`,
        measureType: m,
        target: conf.orgName,
        content:
          m === '约谈'
            ? '约谈机构法定代表人及医保办负责人，指出违规问题并责令改正'
            : m === '基金追回'
              ? `责令退回违规使用的医保基金 ${conf.amount.totalViolationAmount.toLocaleString('zh-CN')} 元`
              : m === '责令整改'
                ? '限期整改内控制度缺失、科室收费管理不到位等问题'
                : m === '暂停结算'
                  ? '暂停医保费用结算 1 个月，期间发生费用由机构先行垫付'
                  : m === '暂停服务协议'
                    ? `暂停医保服务协议 ${rndInt(1, 6)} 个月`
                    : '解除医保服务协议，自送达之日起生效',
        amount: m === '基金追回' ? conf.amount.totalViolationAmount : 0,
        deadline: d(rndInt(10, 40)),
        status: status === '已执行' ? '已执行' : status === '执行中' ? pick(['已执行', '执行中']) : '待执行',
        approval: HANDLE_MEASURES.find((h) => h.measure === m)?.approval || '科长审批',
        document: { name: MEASURE_DOCS[m] || '处理通知书', no: `芜医保${m === '约谈' ? '约' : '处'}〔2026〕${pad(i * 3 + k + 1, 3)}号` }
      })),
      approval: {
        proposer,
        proposeTime: dt(-rndInt(2, 15), rndInt(8, 17), 0),
        reviewer: pick(AUDITORS.filter((a) => a !== proposer)),
        reviewTime: dt(-rndInt(1, 12), rndInt(8, 17), 0),
        approver: maxLevel === '科长审批' ? '基金监管处 · 张科长' : maxLevel === '处长审批' ? '基金监管处 · 王处长' : '芜湖市医疗保障局 · 李局长',
        approveTime: ['已审批', '执行中', '已执行'].includes(status) ? dt(-rndInt(0, 10), rndInt(8, 17), 0) : '',
        approvalOpinion: ['已审批', '执行中', '已执行'].includes(status) ? '同意按承办意见处置，请依法依规执行并跟踪落实' : '',
        approvalLevel: maxLevel
      }
    })
  }
  return out
}

export const HANDLINGS = genHandlings(48)

/* ============ 行政处罚 ============ */
resetSeed(70003)

function genPenalties(count: number): Penalty[] {
  const out: Penalty[] = []
  const heavy = CONFIRMATIONS.filter((c) => c.amount.penaltyAmount > 0)
  for (let i = 0; i < count; i++) {
    const conf = heavy[i % heavy.length]
    const stepIndex = rndInt(0, 11)
    const step = PENALTY_STEPS[stepIndex]
    const isFraud = conf.problemNature === '涉嫌欺诈骗保'
    const fine = conf.amount.penaltyAmount
    out.push({
      penaltyId: `PEN20260920${pad(i + 1, 4)}`,
      caseNo: `芜医保罚〔2026〕${pad(i + 1, 3)}号`,
      taskId: conf.taskId,
      orgName: conf.orgName,
      createTime: dt(-rndInt(0, 25), rndInt(8, 17), 0),
      currentStep: step,
      stepIndex,
      status: stepIndex >= 11 ? '已结案' : stepIndex >= 9 ? '已送达' : stepIndex >= 8 ? '已决定' : '办理中',
      violationFacts: {
        type: isFraud ? '欺诈骗保' : conf.violationTypes[0].type,
        description: `${conf.orgName}于 2026 年 8 月期间，${isFraud ? '虚构医药服务项目、伪造诊疗记录' : '违反诊疗规范与收费标准'}，骗取（造成损失）医保基金 ${conf.amount.insuranceFundAmount.toLocaleString('zh-CN')} 元`,
        fraudAmount: conf.amount.totalViolationAmount,
        insuranceFundAmount: conf.amount.insuranceFundAmount
      },
      legalBasis: {
        law: '《医疗保障基金使用监督管理条例》',
        articles: isFraud
          ? [{ article: '第四十条', content: '以骗取医疗保障基金为目的，实施虚构医药服务项目等行为，责令退回，处骗取金额2倍以上5倍以下的罚款' }]
          : [{ article: '第三十八条', content: '造成医疗保障基金损失的，责令退回，处造成损失金额1倍以上2倍以下的罚款' }]
      },
      penaltyDecision: {
        measures: [
          { type: '责令退回', content: `责令退回违规使用的医保基金`, amount: conf.amount.insuranceFundAmount, multiple: 0 },
          { type: '罚款', content: `按${conf.amount.penaltyMultiple}倍处以罚款`, amount: fine, multiple: conf.amount.penaltyMultiple },
          ...(isFraud ? [{ type: '解除服务协议', content: '解除医保服务协议', amount: 0, multiple: 0 }] : [])
        ],
        totalAmount: conf.amount.insuranceFundAmount + fine,
        decisionDate: stepIndex >= 8 ? dt(-rndInt(0, 8), rndInt(9, 17), 0) : '',
        decisionMaker: '芜湖市医疗保障局 · 李局长'
      },
      procedureRecords: PENALTY_STEPS.map((s, k) => ({
        step: s,
        done: k <= stepIndex,
        time: k <= stepIndex ? dt(-(stepIndex - k) - rndInt(0, 2), rndInt(9, 17), 0) : '',
        operator: k <= stepIndex ? pick(AUDITORS) : '',
        doc:
          k <= stepIndex
            ? ['立案审批表', '调查取证记录', '案件调查终结报告', '事先告知书', '听证告知书', '陈述申辩笔录', '法制审核意见', '集体讨论记录', '行政处罚决定书', '送达回证', '执行凭证', '结案报告'][k]
            : ''
      })),
      execution: {
        status: stepIndex >= 11 ? '执行完毕' : stepIndex >= 10 ? '执行中' : '未开始',
        refundedAmount: stepIndex >= 10 ? Math.round(conf.amount.insuranceFundAmount * (stepIndex >= 11 ? 1 : 0.6)) : 0,
        finePaidAmount: stepIndex >= 10 ? Math.round(fine * (stepIndex >= 11 ? 1 : 0.5)) : 0,
        refundDeadline: d(rndInt(5, 30))
      }
    })
  }
  return out
}

export const PENALTIES = genPenalties(22)

/* ============ 移送处理 ============ */
resetSeed(70004)

function genTransfers(count: number): Transfer[] {
  const out: Transfer[] = []
  const fraudConfs = CONFIRMATIONS.filter((c) => c.problemNature === '涉嫌欺诈骗保')
  for (let i = 0; i < count; i++) {
    const conf = fraudConfs[i % Math.max(1, fraudConfs.length)] || CONFIRMATIONS[i]
    const tt = TRANSFER_TYPES[i % TRANSFER_TYPES.length]
    const status = pick(['待审批', '法制审核中', '已审批', '已移送', '已反馈'])
    const proposer = pick(AUDITORS)
    out.push({
      transferId: `TRANS20260925${pad(i + 1, 4)}`,
      taskId: conf.taskId,
      orgName: conf.orgName,
      transferType: tt.type,
      targetOrg: tt.target,
      createTime: dt(-rndInt(0, 18), rndInt(8, 17), 0),
      status,
      fraudAmount: conf.amount.totalViolationAmount,
      reason: `${conf.orgName}虚构医药服务项目骗取医保基金 ${conf.amount.totalViolationAmount.toLocaleString('zh-CN')} 元，${tt.cond}，涉嫌构成诈骗罪，依法移送`,
      legalBasis: [
        '《中华人民共和国刑法》第二百六十六条（诈骗罪）',
        '《医疗保障基金使用监督管理条例》第四十条',
        '《行政执法机关移送涉嫌犯罪案件的规定》第三条'
      ],
      suspects: pickMany(DOCTORS, rndInt(1, 2)).map((dc: any, k: number) => ({
        name: dc.name,
        role: k === 0 ? '医保办主任' : '科室主任',
        type: k === 0 ? '单位犯罪直接负责的主管人员' : '单位犯罪直接责任人员'
      })),
      approval: {
        proposer,
        legalReviewer: '法规科 · 陈科长',
        legalOpinion: '经审核，移送理由充分、法律依据准确、证据材料齐备，符合移送条件，同意移送',
        approver: '芜湖市医疗保障局 · 李局长',
        approveTime: ['已审批', '已移送', '已反馈'].includes(status) ? dt(-rndInt(0, 12), rndInt(9, 17), 0) : ''
      },
      documents: [
        { name: '案件移送函', no: `芜医保移〔2026〕${pad(i + 1, 3)}号` },
        { name: '案件调查报告', no: '' },
        { name: '涉案物品清单', no: '' },
        { name: '证据材料清单', no: '' }
      ],
      evidenceMaterials: [
        { name: '医保结算数据明细', type: '电子数据', pages: rndInt(20, 120) },
        { name: '虚假诊疗病历复印件', type: '书证', pages: rndInt(15, 80) },
        { name: '当事人问询笔录', type: '笔录', pages: rndInt(6, 24) },
        { name: '现场检查照片', type: '书证', pages: rndInt(8, 30) }
      ],
      followUp: {
        status: status === '已反馈' ? '已立案' : status === '已移送' ? '待反馈' : '未移送',
        feedback: status === '已反馈' ? '公安机关已受理并立案侦查，案件编号 皖芜公经立字〔2026〕' + pad(i + 1, 3) + '号' : '',
        feedbackDeadline: d(rndInt(10, 45)),
        reminderCount: status === '已移送' ? rndInt(0, 3) : 0
      }
    })
  }
  return out
}

export const TRANSFERS = genTransfers(12)

/* ============ 基金追回台账 ============ */
resetSeed(70005)

function genRecoveries(count: number): Recovery[] {
  const out: Recovery[] = []
  for (let i = 0; i < count; i++) {
    const conf = CONFIRMATIONS[i % CONFIRMATIONS.length]
    const principal = conf.amount.insuranceFundAmount
    const fine = conf.amount.penaltyAmount
    const interest = Math.round(principal * 0.004 * rndInt(0, 30))
    const shouldTotal = principal + fine + interest
    const status = pick(RECOVERY_STATUS)
    let recovered = 0
    if (status === '已追回') recovered = shouldTotal
    else if (status === '部分追回') recovered = Math.round(shouldTotal * (0.2 + rnd() * 0.6))
    else if (status === '追回中') recovered = Math.round(shouldTotal * rnd() * 0.4)
    const overdue = status === '逾期未追回'
    const method = pick(RECOVERY_METHODS)
    const recCount = recovered > 0 ? rndInt(1, 3) : 0
    const records = Array.from({ length: recCount }, (_, k) => ({
      recordId: `RECD${pad(i + 1, 3)}${pad(k + 1, 2)}`,
      date: dt(-rndInt(1, 20), rndInt(9, 17), 0),
      amount: Math.round(recovered / recCount),
      method,
      voucherNo: `${pick(['工行', '建行', '农行', '中行'])}回单${dt(-rndInt(1, 20), 0, 0).slice(0, 10).replace(/-/g, '')}${pad(rndInt(1, 999), 3)}`,
      operator: pick(AUDITORS),
      confirmer: pick(AUDITORS)
    }))
    out.push({
      recoveryId: `REC20260915${pad(i + 1, 4)}`,
      taskId: conf.taskId,
      confirmationId: conf.confirmationId,
      orgName: conf.orgName,
      orgCode: conf.orgCode,
      orgType: conf.orgType,
      district: conf.district,
      violationType: conf.violationTypes[0].type,
      createTime: dt(-rndInt(0, 22), rndInt(8, 17), 0),
      status,
      recoveryMethod: method,
      amount: {
        shouldPrincipal: principal,
        shouldFine: fine,
        shouldInterest: interest,
        shouldTotal,
        recoveredTotal: recovered,
        unrecoveredTotal: shouldTotal - recovered,
        recoveryRate: shouldTotal ? Math.round((recovered / shouldTotal) * 1000) / 10 : 0
      },
      byInsurance: {
        职工医保: { should: Math.round(shouldTotal * 0.62), recovered: Math.round(recovered * 0.62) },
        居民医保: { should: shouldTotal - Math.round(shouldTotal * 0.62), recovered: recovered - Math.round(recovered * 0.62) }
      },
      plan: { deadline: d(overdue ? -rndInt(5, 40) : rndInt(5, 40)), method, installment: rnd() < 0.25 },
      records,
      overdue,
      overdueDays: overdue ? rndInt(3, 60) : 0
    })
  }
  return out
}

export const RECOVERIES = genRecoveries(58)

/* ============ 整改跟踪 ============ */
resetSeed(70006)

const RECTIFY_ITEMS_LIB = [
  { vt: '重复收费', problem: '住院期间静脉输液费用重复收取', req: '全面自查近一年重复收费情况，退回违规费用，完善收费系统校验规则' },
  { vt: '过度诊疗', problem: '对无指征患者开展高值检查', req: '建立检查项目指征审核机制，加强临床路径管理与病历质控' },
  { vt: '超量开药', problem: '慢性病门诊超7日量开药', req: '在 HIS 系统中设置处方用量上限校验，对涉事医师开展合规培训' },
  { vt: '管理问题', problem: '医保基金使用内控制度缺失', req: '建立医保基金使用内部控制制度，明确科室与岗位职责，落实月度自查' },
  { vt: '无指征收费', problem: '常规开展无指征检验项目', req: '规范检验项目开单流程，建立无指征收费问责机制' },
  { vt: '串换药品', problem: '将非医保药品串换为医保药品结算', req: '规范药品进销存管理，医保结算目录与实际发药严格一致' }
]

function genRectifies(count: number): Rectify[] {
  const out: Rectify[] = []
  for (let i = 0; i < count; i++) {
    const conf = CONFIRMATIONS[i % CONFIRMATIONS.length]
    const itemCount = rndInt(2, 5)
    const libs = pickMany(RECTIFY_ITEMS_LIB, itemCount)
    const status = pick(RECTIFY_STATUS)
    const overdue = status === '已超期'
    const items = libs.map((lb, k) => {
      const itemStatus =
        status === '已完成'
          ? '已完成'
          : status === '待整改'
            ? '待整改'
            : pick(['待整改', '整改中', '待复查', '已完成'])
      const hasFeedback = ['待复查', '已完成', '复查不通过'].includes(itemStatus)
      const hasReview = ['已完成', '复查不通过'].includes(itemStatus)
      return {
        itemId: `RI${pad(i + 1, 3)}${pad(k + 1, 2)}`,
        violationType: lb.vt,
        problem: lb.problem,
        requirement: lb.req,
        deadline: d(overdue ? -rndInt(3, 30) : rndInt(5, 35)),
        status: itemStatus,
        feedback: hasFeedback
          ? {
              content: '已按整改要求完成制度修订与系统改造，组织全院医保政策培训，涉事费用已全额退回',
              evidence: ['整改情况报告.pdf', '制度修订文件.pdf', '培训签到表.jpg', '退款凭证.pdf'],
              feedbackTime: dt(-rndInt(1, 12), rndInt(9, 17), 0),
              feedbacker: `${conf.orgName} · 医保办`
            }
          : null,
        review: hasReview
          ? {
              result: itemStatus === '已完成' ? '通过' : '不通过',
              opinion:
                itemStatus === '已完成'
                  ? '经复查，整改措施落实到位，制度与系统改造已生效，同意通过'
                  : '整改材料不能充分证明系统校验规则已生效，请补充系统截图与测试记录后重新提交',
              reviewer: pick(AUDITORS),
              reviewTime: dt(-rndInt(0, 8), rndInt(9, 17), 0)
            }
          : null
      }
    })
    const done = items.filter((it) => it.status === '已完成').length
    out.push({
      rectifyId: `RECT20260915${pad(i + 1, 4)}`,
      taskId: conf.taskId,
      orgName: conf.orgName,
      orgCode: conf.orgCode,
      district: conf.district,
      issueTime: dt(-rndInt(5, 30), rndInt(8, 17), 0),
      deadline: d(overdue ? -rndInt(3, 25) : rndInt(5, 40)),
      status,
      progress: Math.round((done / items.length) * 100),
      items,
      overdue,
      reviewer: pick(AUDITORS)
    })
  }
  return out
}

export const RECTIFIES = genRectifies(54)

/* ============ 闭环销号 ============ */
resetSeed(70007)

function genCancelCases(count: number): CancelCase[] {
  const out: CancelCase[] = []
  for (let i = 0; i < count; i++) {
    const conf = CONFIRMATIONS[i % CONFIRMATIONS.length]
    const status = pick(['条件核验中', '待审批', '审批中', '已销号', '条件不满足'])
    const allPassed = ['待审批', '审批中', '已销号'].includes(status)
    const conditions = CANCEL_CONDITIONS.map((c, k) => {
      const passed = allPassed ? true : k < 3 ? true : rnd() > 0.5
      return {
        key: c.key,
        name: c.name,
        passed,
        detail: passed
          ? c.key === 'confirmed'
            ? `违规确认书 ${conf.confirmationId} 已复核通过并送达签收`
            : c.key === 'handled'
              ? '协议处理措施已全部执行完毕'
              : c.key === 'recovered'
                ? `应追 ${conf.amount.totalRecoverable.toLocaleString('zh-CN')} 元已全额到账核销`
                : c.key === 'rectified'
                  ? '整改清单逐项复查通过，已出具整改验收意见'
                  : '成套执法文书齐备，已归入电子案卷'
          : c.key === 'recovered'
            ? `尚有 ${Math.round(conf.amount.totalRecoverable * 0.35).toLocaleString('zh-CN')} 元未到账`
            : c.key === 'rectified'
              ? '仍有整改事项处于复查不通过状态'
              : '部分执法文书缺失，待补齐归档'
      }
    })
    const level = conf.problemNature === '涉嫌欺诈骗保' || conf.problemNature === '严重违规' ? '处长审批' : '科长审批'
    const canceled = status === '已销号'
    const deduction = { 一般违规: 3, 较重违规: 8, 严重违规: 15, 涉嫌欺诈骗保: 25 }[conf.problemNature] || 5
    const before = rndInt(72, 96)
    const after = Math.max(35, before - deduction)
    const levelOf = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'E')

    out.push({
      cancelId: `CA20261020${pad(i + 1, 4)}`,
      taskId: conf.taskId,
      confirmationId: conf.confirmationId,
      caseName: `${conf.orgName}${conf.violationTypes[0].type}违规案`,
      orgName: conf.orgName,
      orgCode: conf.orgCode,
      district: conf.district,
      applyTime: dt(-rndInt(0, 15), rndInt(8, 17), 0),
      status,
      conditions,
      allPassed,
      approval: {
        level,
        nodes: [
          {
            role: '承办人',
            name: pick(AUDITORS),
            result: allPassed ? '已提交' : '待提交',
            opinion: allPassed ? '本案定性、处置、追回、整改、文书均已到位，符合销号条件，申请核准销号' : '',
            time: allPassed ? dt(-rndInt(3, 12), rndInt(9, 17), 0) : ''
          },
          {
            role: '组长',
            name: '稽核组长·张建国',
            result: ['审批中', '已销号'].includes(status) ? '同意' : '待审批',
            opinion: ['审批中', '已销号'].includes(status) ? '经复核，销号条件齐备，同意上报' : '',
            time: ['审批中', '已销号'].includes(status) ? dt(-rndInt(2, 10), rndInt(9, 17), 0) : ''
          },
          {
            role: level === '处长审批' ? '处长' : '科长',
            name: level === '处长审批' ? '基金监管处 · 王处长' : '基金监管处 · 张科长',
            result: canceled ? '核准销号' : '待审批',
            opinion: canceled ? '同意核准销号，按规定同步信用联动并归档' : '',
            time: canceled ? dt(-rndInt(0, 6), rndInt(9, 17), 0) : ''
          }
        ],
        finalResult: canceled ? '核准销号' : '审批中',
        cancelNo: canceled ? `芜医保结〔2026〕${pad(i + 1, 3)}号` : '',
        cancelTime: canceled ? dt(-rndInt(0, 5), rndInt(9, 17), 0) : ''
      },
      credit: canceled
        ? {
            creditId: `CREDIT20261020${pad(i + 1, 4)}`,
            orgScoreBefore: before,
            orgScoreAfter: after,
            orgLevelBefore: levelOf(before),
            orgLevelAfter: levelOf(after),
            deduction,
            reason: `${conf.problemNature}，涉及金额 ${conf.amount.totalViolationAmount.toLocaleString('zh-CN')} 元，按信用管理办法扣减 ${deduction} 分`,
            personalRecords: conf.responsibility.personalResponsibility.map((p) => ({
              name: p.name,
              dept: p.dept,
              deduction: p.degree === '主要责任' ? 6 : p.degree === '次要责任' ? 3 : 2,
              measure: p.degree === '主要责任' ? '暂停医保处方权 3 个月' : '通报批评并记入个人执业信用'
            })),
            publicity: conf.problemNature === '涉嫌欺诈骗保' || conf.problemNature === '严重违规',
            validUntil: d(365)
          }
        : null,
      totalAmount: conf.amount.totalRecoverable,
      recoveredAmount: canceled ? conf.amount.totalRecoverable : Math.round(conf.amount.totalRecoverable * 0.65)
    })
  }
  return out
}

export const CANCEL_CASES = genCancelCases(38)

/* ============ 档案 ============ */
resetSeed(70008)

export interface Archive {
  archiveId: string
  archiveNo: string
  caseName: string
  orgName: string
  district: string
  archiveTime: string
  archiver: string
  year: string
  volumeCount: number
  pageCount: number
  status: string
  materials: { category: string; count: number; source: string }[]
  paperUploaded: boolean
  ocrRecognized: boolean
  retentionYears: number
}

const ARCHIVE_CATEGORIES = [
  { category: '线索材料', source: '疑点线索管理智能体' },
  { category: '任务材料', source: '专项任务管理智能体' },
  { category: '核查记录', source: '疑点线索管理智能体' },
  { category: '证据材料', source: '现场取证' },
  { category: '违规确认书', source: '违规处置智能体' },
  { category: '处置决定文书', source: '违规处置智能体' },
  { category: '申诉材料', source: '机构端' },
  { category: '整改材料', source: '机构端' },
  { category: '销号材料', source: '违规处置智能体' }
]

export const ARCHIVES: Archive[] = Array.from({ length: 56 }, (_, i) => {
  const cc = CANCEL_CASES[i % CANCEL_CASES.length]
  const materials = ARCHIVE_CATEGORIES.map((c) => ({ ...c, count: rndInt(2, 26) }))
  return {
    archiveId: `ARC20260925${pad(i + 1, 4)}`,
    archiveNo: `芜医保档〔2026〕${pad(i + 1, 3)}号`,
    caseName: cc.caseName,
    orgName: cc.orgName,
    district: cc.district,
    archiveTime: dt(-rndInt(0, 30), rndInt(9, 17), 0),
    archiver: pick(AUDITORS),
    year: '2026',
    volumeCount: rndInt(1, 3),
    pageCount: materials.reduce((a, b) => a + b.count, 0) * rndInt(2, 5),
    status: pick(['归档中', '已归档', '已移交']),
    materials,
    paperUploaded: rnd() > 0.3,
    ocrRecognized: rnd() > 0.35,
    retentionYears: 30
  }
})

/* ============ 标准口径与典型案例 ============ */
resetSeed(70009)

export interface StandardItem {
  standardId: string
  violationType: string
  standardName: string
  judgeCriteria: string
  amountRule: string
  discretionBase: string
  version: string
  effective: string
  updateTime: string
  updater: string
  useCount: number
}

export const STANDARDS: StandardItem[] = [
  { violationType: '超量开药', standardName: '慢性病门诊超量开药判定标准', judgeCriteria: '慢性病门诊单次处方超过7日用量（长处方备案除外）即认定超量', amountRule: '超出部分药品费用×医保支付比例', discretionBase: '首次且金额<5000元从轻；屡犯或金额≥50000元从重' },
  { violationType: '重复收费', standardName: '重复收费判定标准', judgeCriteria: '同一诊疗项目在同一就诊/住院期间被重复计费2次及以上', amountRule: '重复计费部分全额认定', discretionBase: '单科室偶发从轻；跨科室系统性从重' },
  { violationType: '过度诊疗', standardName: '过度诊疗判定标准', judgeCriteria: '诊疗项目与患者诊断无相关指征，或超出临床路径规定频次', amountRule: '无指征部分费用全额认定', discretionBase: '主动整改从轻；普遍性开展从重' },
  { violationType: '无指征收费', standardName: '无指征检验检查判定标准', judgeCriteria: '检验检查项目无对应诊断指征且病历无合理说明', amountRule: '无指征项目费用全额认定', discretionBase: '按涉及人次与金额分档' },
  { violationType: '串换药品', standardName: '串换药品判定标准', judgeCriteria: '实际发放药品与医保结算目录不一致', amountRule: '串换部分结算金额全额认定', discretionBase: '故意串换从重，一律不予从轻' },
  { violationType: '虚假诊疗', standardName: '虚假诊疗判定标准', judgeCriteria: '无实际诊疗行为而生成诊疗记录并结算', amountRule: '虚假诊疗结算金额全额认定', discretionBase: '一律认定为涉嫌欺诈骗保，移送公安' },
  { violationType: '虚构住院', standardName: '虚构住院判定标准', judgeCriteria: '患者未实际住院或挂床，生成住院记录并结算', amountRule: '虚构住院期间全部结算费用', discretionBase: '一律认定为涉嫌欺诈骗保' },
  { violationType: '分解住院', standardName: '分解住院判定标准', judgeCriteria: '同一患者同一疾病15日内重复住院且无医学必要', amountRule: '后续住院结算费用全额认定', discretionBase: '按次数与金额分档' },
  { violationType: '管理问题', standardName: '内控制度缺失判定标准', judgeCriteria: '未建立医保基金使用内控制度或制度未有效执行', amountRule: '不直接核算金额，责令整改', discretionBase: '限期整改，逾期未改从重' }
].map((s, i) => ({
  standardId: `STD${pad(i + 1, 3)}`,
  ...s,
  version: `v${rndInt(1, 3)}.${rndInt(0, 9)}`,
  effective: '现行有效',
  updateTime: dt(-rndInt(20, 180), rndInt(9, 17), 0),
  updater: pick(AUDITORS),
  useCount: rndInt(12, 260)
}))

export interface TypicalCase {
  caseId: string
  caseName: string
  orgType: string
  violationType: string
  problemNature: string
  amount: number
  penaltyAmount: number
  result: string
  handleMeasures: string[]
  background: string
  facts: string
  basis: string
  appealChanged: boolean
  decisionDate: string
  useCount: number
  score: number
}

export const TYPICAL_CASES: TypicalCase[] = Array.from({ length: 56 }, (_, i) => {
  const conf = CONFIRMATIONS[i % CONFIRMATIONS.length]
  const sug = HANDLING_SUGGESTION[conf.problemNature]
  return {
    caseId: `CASE2026${pad(i + 1, 4)}`,
    caseName: `${conf.orgName}${conf.violationTypes[0].type}案`,
    orgType: conf.orgType,
    violationType: conf.violationTypes[0].type,
    problemNature: conf.problemNature,
    amount: conf.amount.totalViolationAmount,
    penaltyAmount: conf.amount.penaltyAmount,
    result: sug.handling,
    handleMeasures: sug.measures,
    background: `${conf.orgName}在 2026 年度医保基金专项检查中被发现存在${conf.violationTypes.map((v) => v.type).join('、')}等问题`,
    facts: `经线上筛查与现场核查，认定违规金额 ${conf.amount.totalViolationAmount.toLocaleString('zh-CN')} 元，其中医保基金 ${conf.amount.insuranceFundAmount.toLocaleString('zh-CN')} 元`,
    basis: conf.legalBasis.map((l) => `${l.law}${l.article}`).join('；'),
    appealChanged: rnd() < 0.18,
    decisionDate: dt(-rndInt(10, 200), rndInt(9, 17), 0),
    useCount: rndInt(3, 88),
    score: rndInt(72, 98)
  }
})

/* ============ 复盘评分 ============ */
resetSeed(70010)

export interface ReviewScore {
  scoreId: string
  caseId: string
  caseName: string
  orgName: string
  scoreTime: string
  totalScore: number
  grade: string
  dimensions: { name: string; score: number; weight: number; comment: string }[]
  isKeyReview: boolean
  keyReason: string
  problems: string[]
  suggestions: string[]
  modelFeedback: { ruleId: string; ruleName: string; adjustSuggestion: string; adopted: boolean } | null
  reviewer: string
}

const SCORE_DIMENSIONS = [
  { name: '定性准确性', weight: 30 },
  { name: '程序合规性', weight: 25 },
  { name: '证据完整性', weight: 20 },
  { name: '文书规范性', weight: 15 },
  { name: '处置适当性', weight: 10 }
]

export const REVIEW_SCORES: ReviewScore[] = Array.from({ length: 42 }, (_, i) => {
  const tc = TYPICAL_CASES[i % TYPICAL_CASES.length]
  const dims = SCORE_DIMENSIONS.map((d) => {
    const s = rndInt(62, 100)
    return {
      ...d,
      score: s,
      comment: s >= 90 ? '表现优秀，可作为范例' : s >= 78 ? '基本规范，个别细节可优化' : '存在明显不足，需重点改进'
    }
  })
  const total = Math.round(dims.reduce((a, b) => a + (b.score * b.weight) / 100, 0))
  const isKey = total < 80 || tc.appealChanged
  return {
    scoreId: `RS${pad(i + 1, 4)}`,
    caseId: tc.caseId,
    caseName: tc.caseName,
    orgName: tc.caseName.replace(/[^\u4e00-\u9fa5]+案$/, ''),
    scoreTime: dt(-rndInt(2, 90), rndInt(9, 17), 0),
    totalScore: total,
    grade: total >= 90 ? '优秀' : total >= 80 ? '良好' : total >= 70 ? '合格' : '待改进',
    dimensions: dims,
    isKeyReview: isKey,
    keyReason: tc.appealChanged ? '机构申诉后改判' : total < 80 ? '综合评分低于 80 分' : '',
    problems: isKey
      ? pickMany(
          [
            '证据链中缺少关键原始凭证，仅凭结算数据认定',
            '事先告知程序履行时限超出规定',
            '违规金额核算未区分统筹基金与个人账户',
            '文书表述与法条引用存在细微偏差',
            '处置措施与违规情节匹配度不足'
          ],
          rndInt(1, 3)
        )
      : [],
    suggestions: isKey
      ? pickMany(
          [
            '补充原始凭证调取环节，形成完整证据闭环',
            '在系统中固化程序时限校验节点',
            '金额核算模板增加基金类型拆分字段',
            '文书生成引用现行有效法条并强制校验',
            '优化裁量基准，明确情节与措施对应关系'
          ],
          rndInt(1, 3)
        )
      : [],
    modelFeedback: isKey
      ? {
          ruleId: `RULE-${pick(['DRUG', 'CHG', 'BHV'])}-${pad(rndInt(1, 20), 3)}`,
          ruleName: pick(['慢性病开药不超过7日量', '同项目重复收费检测', '无指征检验项目识别', '分解住院识别']),
          adjustSuggestion: `建议将阈值由 ${rndInt(3, 8)} 调整为 ${rndInt(5, 12)}，并增加病历指征关键词校验`,
          adopted: rnd() > 0.45
        }
      : null,
    reviewer: pick(AUDITORS)
  }
})

/* ============ 统计数据 ============ */
export const PUNISH_STATS = {
  /* 违规确认 */
  confirmTotal: CONFIRMATIONS.length,
  pendingReview: CONFIRMATIONS.filter((c) => c.review.status === '待复核').length,
  reviewPassed: CONFIRMATIONS.filter((c) => c.review.status === '复核通过').length,
  returned: CONFIRMATIONS.filter((c) => c.review.status === '已退回').length,
  natureDist: PROBLEM_NATURES.map((n) => ({
    name: n,
    value: CONFIRMATIONS.filter((c) => c.problemNature === n).length
  })),
  /* 处置 */
  handlingTotal: HANDLINGS.length,
  penaltyTotal: PENALTIES.length,
  transferTotal: TRANSFERS.length,
  handleTypeDist: [
    { name: '协议处理', value: HANDLINGS.length },
    { name: '行政处罚', value: PENALTIES.length },
    { name: '移送处理', value: TRANSFERS.length }
  ],
  measureDist: HANDLE_MEASURES.map((m) => ({
    name: m.measure,
    value: HANDLINGS.reduce((a, h) => a + h.measures.filter((x) => x.measureType === m.measure).length, 0)
  })).filter((x) => x.value > 0),
  /* 追回 */
  shouldRecoverTotal: RECOVERIES.reduce((a, b) => a + b.amount.shouldTotal, 0),
  recoveredTotal: RECOVERIES.reduce((a, b) => a + b.amount.recoveredTotal, 0),
  unrecoveredTotal: RECOVERIES.reduce((a, b) => a + b.amount.unrecoveredTotal, 0),
  overdueCount: RECOVERIES.filter((r) => r.overdue).length,
  recoveryStatusDist: RECOVERY_STATUS.map((s) => ({
    name: s,
    value: RECOVERIES.filter((r) => r.status === s).length
  })),
  recoveryMethodDist: RECOVERY_METHODS.map((m) => ({
    name: m,
    value: RECOVERIES.filter((r) => r.recoveryMethod === m).length
  })),
  /* 整改 */
  rectifyTotal: RECTIFIES.length,
  rectifyDone: RECTIFIES.filter((r) => r.status === '已完成').length,
  rectifyOverdue: RECTIFIES.filter((r) => r.overdue).length,
  rectifyStatusDist: RECTIFY_STATUS.map((s) => ({
    name: s,
    value: RECTIFIES.filter((r) => r.status === s).length
  })),
  /* 销号 */
  cancelTotal: CANCEL_CASES.length,
  canceled: CANCEL_CASES.filter((c) => c.status === '已销号').length,
  cancelPending: CANCEL_CASES.filter((c) => ['条件核验中', '待审批', '审批中'].includes(c.status)).length,
  /* 战果统计（3.4.2） */
  achievement: {
    inspectPersonTimes: 486,
    coveredHospitals: 28,
    coveredPharmacies: 32,
    clueCount: 6842,
    positiveRate: 62.4,
    violationAmount: CONFIRMATIONS.reduce((a, b) => a + b.amount.totalViolationAmount, 0),
    penaltyAmount: CONFIRMATIONS.reduce((a, b) => a + b.amount.penaltyAmount, 0),
    recoveredAmount: RECOVERIES.reduce((a, b) => a + b.amount.recoveredTotal, 0),
    rectifyCompleteRate: 84.6,
    transferCount: TRANSFERS.length,
    creditLinkCount: CANCEL_CASES.filter((c) => c.credit).length
  },
  byDistrict: ['镜湖区', '鸠江区', '弋江区', '湾沚区', '繁昌区', '南陵县', '无为市'].map((dd) => {
    const list = CONFIRMATIONS.filter((c) => c.district === dd)
    return {
      name: dd,
      count: list.length,
      amount: list.reduce((a, b) => a + b.amount.totalViolationAmount, 0),
      penalty: list.reduce((a, b) => a + b.amount.penaltyAmount, 0)
    }
  }),
  byViolationType: PUNISH_VIOLATION_TYPES.map((t) => {
    const list = CONFIRMATIONS.filter((c) => c.violationTypes.some((v) => v.type === t))
    return {
      name: t,
      count: list.length,
      amount: list.reduce((a, b) => a + b.amount.totalViolationAmount, 0)
    }
  }).filter((x) => x.count > 0),
  monthTrend: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((m, i) => ({
    month: m,
    confirmed: [6, 9, 12, 15, 11, 9][i],
    handled: [5, 8, 10, 13, 10, 8][i],
    violationAmount: [186000, 264000, 352000, 428000, 316000, 284000][i],
    recoveredAmount: [142000, 208000, 286000, 344000, 252000, 196000][i]
  })),
  /* 档案 */
  archiveTotal: ARCHIVES.length,
  archivedCount: ARCHIVES.filter((a) => a.status === '已归档').length,
  paperUploadedCount: ARCHIVES.filter((a) => a.paperUploaded).length,
  /* 标准与案例 */
  standardTotal: STANDARDS.length,
  caseTotal: TYPICAL_CASES.length,
  /* 复盘 */
  reviewScoreTotal: REVIEW_SCORES.length,
  avgScore: Math.round((REVIEW_SCORES.reduce((a, b) => a + b.totalScore, 0) / REVIEW_SCORES.length) * 10) / 10,
  keyReviewCount: REVIEW_SCORES.filter((r) => r.isKeyReview).length,
  adoptedFeedback: REVIEW_SCORES.filter((r) => r.modelFeedback?.adopted).length,
  scoreDimAvg: SCORE_DIMENSIONS.map((d) => ({
    name: d.name,
    value: Math.round(
      REVIEW_SCORES.reduce((a, b) => a + (b.dimensions.find((x) => x.name === d.name)?.score || 0), 0) /
        REVIEW_SCORES.length
    )
  })),
  /* 信用 */
  creditRecords: CANCEL_CASES.filter((c) => c.credit).length,
  creditLevelDist: CREDIT_LEVELS.map((l) => ({
    name: `${l.level}（${l.name}）`,
    value: CANCEL_CASES.filter((c) => c.credit?.orgLevelAfter === l.level).length,
    color: l.color
  }))
}
