/**
 * 智能体五：成果宣教智能体 —— Mock 数据集（上）
 * 覆盖 3.1 逆向复盘 + 3.2 统计分析
 * 需求依据：doc/子功能/05_成果宣教智能体_详细功能设计.md
 */
import {
  resetSeed, rnd, rndInt, pick, pickMany, pad, dt, d,
  ORGS, ALL_VIOLATION_TYPES
} from './base'

/* ==================== 全局枚举 ==================== */

/** 5.3 质量评分等级标准 */
export const GRADE_STANDARD = [
  { grade: '优秀', min: 90, max: 100, tone: 'success', handling: '纳入优秀案例库，经验推广' },
  { grade: '良好', min: 80, max: 89, tone: 'primary', handling: '正常归档，关注薄弱环节' },
  { grade: '合格', min: 70, max: 79, tone: 'warning', handling: '正常归档，针对性改进' },
  { grade: '不合格', min: 0, max: 69, tone: 'danger', handling: '自动进入重点复盘，剖析问题' }
] as const

export function gradeOf(score: number): string {
  return GRADE_STANDARD.find((g) => score >= g.min && score <= g.max)?.grade || '合格'
}
export function gradeTone(grade: string): string {
  return GRADE_STANDARD.find((g) => g.grade === grade)?.tone || 'info'
}

/** 5 个评分维度（等权 20 分） */
export const SCORE_DIMENSIONS = [
  { dimension: '定性准确性', fullScore: 20, icon: 'Aim', key: 'qualitative', points: '违规定性边界是否清晰、是否被申诉/复议改判' },
  { dimension: '程序合规性', fullScore: 20, icon: 'Finished', key: 'procedure', points: '检查程序、陈述申辩记录是否完整合法' },
  { dimension: '证据完整性', fullScore: 20, icon: 'Folder', key: 'evidence', points: '证据链是否闭环、专业性证据是否齐备' },
  { dimension: '文书规范性', fullScore: 20, icon: 'Document', key: 'document', points: '文书结构、法条引用是否准确现行' },
  { dimension: '处置适当性', fullScore: 20, icon: 'Scale', key: 'disposal', points: '过罚相当、裁量倍数是否适当、整改时限是否合理' }
] as const

/** 各维度扣分理由池 */
const DEDUCTION_POOL: Record<string, string[]> = {
  定性准确性: [
    '1条线索申诉成立，定性边界可更清晰',
    '过度诊疗认定标准把握偏严，部分符合临床规范',
    '违规类型归类与实际行为略有偏差',
    '同一行为重复定性为两类违规'
  ],
  程序合规性: [
    '现场检查未完整记录机构陈述申辩',
    '陈述申辩告知书送达时间超期 1 日',
    '双人执法签名缺 1 人',
    '听证告知程序未留痕'
  ],
  证据完整性: [
    '部分过度诊疗线索缺少临床专家评估意见',
    '进销存台账未取得原件仅有照片',
    '询问笔录未经被询问人逐页签字确认',
    '电子数据未做哈希固化'
  ],
  文书规范性: [
    '1处引用《行政处罚法》旧条款',
    '文书金额大写与小写不一致',
    '事实描述笼统未逐案说明',
    '文号年度标注格式不规范'
  ],
  处置适当性: [
    '罚款1.5倍偏轻，长期整改延期',
    '裁量未区分机构类型与承受能力',
    '整改时限设置偏长影响时效',
    '未同步启动信用扣分联动'
  ]
}

/** 5.4 重点复盘触发条件 */
export const REVIEW_TRIGGERS = [
  { trigger: '质量评分<70分', desc: '不合格案件自动触发', tone: 'danger', auto: true },
  { trigger: '申诉改判', desc: '申诉后原结论被变更', tone: 'warning', auto: true },
  { trigger: '复议撤销/变更', desc: '行政复议撤销或变更原决定', tone: 'danger', auto: true },
  { trigger: '诉讼败诉', desc: '行政诉讼一审/二审败诉', tone: 'danger', auto: true },
  { trigger: '社会影响大', desc: '媒体关注、网络舆情、领导批示', tone: 'purple', auto: false },
  { trigger: '新型违规首例', desc: '新发现违规类型的首例案件', tone: 'primary', auto: true },
  { trigger: '指定复盘', desc: '局长/处长指定复盘', tone: 'info', auto: false }
] as const

export const PROBLEM_CATEGORIES = ['定性', '证据', '程序', '文书', '处置'] as const
export const SEVERITIES = ['高', '中', '低'] as const
export const ROOT_CAUSE_TYPES = ['制度', '流程', '人员', '技术'] as const
export const PRIORITIES = ['高', '中', '低'] as const
export const MEASURE_DEPTS = [
  '基金监管处', '基金监管处+专家顾问组', '基金监管处+人事处', '法制科', '模型运营组', '人事处'
] as const

export const REVIEW_REPORT_TYPES = [
  '个案复盘报告', '类案复盘报告', '月度复盘报告', '季度复盘报告', '年度复盘报告'
] as const
export const REPORT_STATUS = ['已生成', '待审核', '已发布', '已归档'] as const
export const CONFIDENTIALITY = ['公开', '内部', '秘密'] as const

export const QC_REVIEWERS = ['质控员 郑蕴', '质控员 沈黎', '质控员 何静', '质控员 孟远'] as const
export const REVIEW_MEMBERS = [
  '质控员 郑蕴', '稽核组长 韩雷', '法制科 刘明远', '基金监管处 王承志',
  '稽核一组组长 徐斌', '专家顾问 陆敏（临床）', '模型运营组 李知远'
] as const

/* ==================== 3.1.1 案件质量评分 ==================== */

export interface QualityScore {
  scoreId: string
  caseId: string
  caseName: string
  orgName: string
  orgType: string
  district: string
  violationType: string
  totalScore: number
  grade: string
  dimensions: { dimension: string; score: number; fullScore: number; deductionReason: string | null }[]
  aiScore: number
  manualScore: number
  reviewer: string
  reviewTime: string
  autoFlagged: boolean
  rank: number
  totalCases: number
  /** 案件金额（万元） */
  violationAmount: number
  recoveredAmount: number
  /** 是否发生申诉改判 / 复议撤销 / 诉讼败诉 */
  appealChanged: boolean
  reconsiderationRevoked: boolean
  litigationLost: boolean
  closeDate: string
  /** 是否已纳入优秀案例库 */
  inExcellentLib: boolean
}

const CASE_TOTAL = 156

function buildDimensions(total: number) {
  // 把总分拆到 5 个维度（每维 ≤20），低分案件扣分更重
  const base = total / 5
  const raw = SCORE_DIMENSIONS.map(() => Math.max(8, Math.min(20, Math.round(base + (rnd() * 4 - 2)))))
  // 校准到目标总分
  let diff = total - raw.reduce((s, v) => s + v, 0)
  let guard = 0
  while (diff !== 0 && guard++ < 60) {
    const i = rndInt(0, 4)
    if (diff > 0 && raw[i] < 20) { raw[i]++; diff-- }
    else if (diff < 0 && raw[i] > 8) { raw[i]--; diff++ }
  }
  return SCORE_DIMENSIONS.map((sd, i) => ({
    dimension: sd.dimension,
    score: raw[i],
    fullScore: 20,
    deductionReason: raw[i] >= 20 ? null : pick(DEDUCTION_POOL[sd.dimension])
  }))
}

resetSeed(20260901)

export const QUALITY_SCORES: QualityScore[] = Array.from({ length: 180 }, (_, i) => {
  const org = ORGS[i % ORGS.length]
  const day = -(i % 90) - 1
  // 分布：优秀 ~18%、良好 ~40%、合格 ~30%、不合格 ~12%
  const r = rnd()
  const total = r < 0.18 ? rndInt(90, 98) : r < 0.58 ? rndInt(80, 89) : r < 0.88 ? rndInt(70, 79) : rndInt(58, 69)
  const grade = gradeOf(total)
  const ai = Math.max(55, Math.min(100, total + rndInt(-2, 3)))
  const vt = pick(ALL_VIOLATION_TYPES)
  const appealChanged = total < 72 ? rnd() < 0.55 : rnd() < 0.07
  const va = Number((rnd() * 26 + 1.5).toFixed(1))
  return {
    scoreId: `QS2026${pad((i % 12) + 1, 2)}${pad((i % 28) + 1, 2)}${pad(i + 1, 4)}`,
    caseId: `CASE2026${pad((i % 12) + 1, 2)}${pad((i % 28) + 1, 2)}${pad(i + 1, 4)}`,
    caseName: `${org.orgName}2026年${(i % 12) + 1}月${vt}案`,
    orgName: org.orgName,
    orgType: org.orgType,
    district: org.district,
    violationType: vt,
    totalScore: total,
    grade,
    dimensions: buildDimensions(total),
    aiScore: ai,
    manualScore: total,
    reviewer: pick(QC_REVIEWERS),
    reviewTime: dt(day, rndInt(9, 17), pick([0, 15, 30, 45])),
    autoFlagged: total < 70,
    rank: 0,
    totalCases: CASE_TOTAL,
    violationAmount: va,
    recoveredAmount: Number((va * (0.8 + rnd() * 0.18)).toFixed(1)),
    appealChanged,
    reconsiderationRevoked: total < 68 && rnd() < 0.25,
    litigationLost: total < 65 && rnd() < 0.12,
    closeDate: d(day),
    inExcellentLib: total >= 90
  }
})

// 计算排名（分数降序）
;[...QUALITY_SCORES].sort((a, b) => b.totalScore - a.totalScore).forEach((s, idx) => { s.rank = idx + 1 })

export const QUALITY_SCORE_MAP: Record<string, QualityScore> = Object.fromEntries(
  QUALITY_SCORES.map((s) => [s.scoreId, s])
)

/** 分数段直方图（每 5 分一档，用于「我在哪」定位） */
export const SCORE_HISTOGRAM = Array.from({ length: 9 }, (_, i) => {
  const from = 55 + i * 5
  const to = from + 4
  return {
    range: `${from}-${to}`,
    from,
    to,
    count: QUALITY_SCORES.filter((s) => s.totalScore >= from && s.totalScore <= to).length
  }
})

/** 维度平均分（全市短板分析） */
export const DIMENSION_AVG = SCORE_DIMENSIONS.map((sd) => {
  const arr = QUALITY_SCORES.map((s) => s.dimensions.find((x) => x.dimension === sd.dimension)!.score)
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  return {
    dimension: sd.dimension,
    icon: sd.icon,
    points: sd.points,
    avg: Number(avg.toFixed(1)),
    fullScore: 20,
    rate: Number(((avg / 20) * 100).toFixed(1)),
    /** 该维度满分案件占比 */
    perfectRate: Number(((arr.filter((v) => v >= 20).length / arr.length) * 100).toFixed(1)),
    /** 该维度失分总额 */
    lossTotal: Number(arr.reduce((s, v) => s + (20 - v), 0).toFixed(0))
  }
})

/** 评分月度趋势 */
export const SCORE_TREND = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map(
  (m, i) => ({
    month: m,
    avgScore: Number((80.2 + i * 0.72 + (i % 2 ? 0.3 : -0.2)).toFixed(1)),
    excellent: 8 + i,
    good: 14 + Math.round(i * 1.2),
    pass: 12 - Math.round(i * 0.4),
    fail: Math.max(1, 6 - Math.round(i * 0.5))
  })
)

/* ==================== 3.1.2 重点案件复盘 ==================== */

export interface ReviewProblem {
  id: string
  category: string
  severity: string
  problem: string
  rootCause: string
  /** 原因四分类 */
  causeType: string
}
export interface ReviewMeasure {
  id: string
  measure: string
  dept: string
  deadline: string
  priority: string
  progress: number
  status: string
  owner: string
  /** 关联问题 */
  relatedProblem: string
}
export interface ReviewLesson {
  id: string
  title: string
  content: string
  tags: string[]
  /** 被引用次数（沉淀价值） */
  citedCount: number
  /** 已纳入培训素材库 */
  inTrainingLib: boolean
}
export interface CaseReviewRecord {
  reviewId: string
  caseId: string
  caseName: string
  scoreId: string
  totalScore: number
  grade: string
  reviewType: string
  triggers: string[]
  reviewTime: string
  reviewers: string[]
  caseReview: string
  problems: ReviewProblem[]
  improvementMeasures: ReviewMeasure[]
  lessonsLearned: ReviewLesson[]
  followUp: {
    totalMeasures: number
    completed: number
    inProgress: number
    notStarted: number
    nextReviewDate: string
    completionRate: number
  }
  status: string
  reportId: string | null
}

const PROBLEM_LIB: Record<string, { problem: string; rootCause: string; causeType: string }[]> = {
  定性: [
    { problem: '过度诊疗认定标准不清晰，将部分符合临床规范的检查认定为过度诊疗', rootCause: '认定标准不细化、检查人员临床判断能力不足、未引入专家评估', causeType: '制度' },
    { problem: '重复收费与医嘱要求的多次执行项目未作区分', rootCause: '规则逻辑未关联医嘱数据，人工复核未把关', causeType: '技术' },
    { problem: '串换药品与合并结算行为定性混同', rootCause: '违规类型定义边界模糊，缺少典型场景指引', causeType: '制度' }
  ],
  证据: [
    { problem: '过度诊疗证据不足，30条中仅5条有临床专家评估意见', rootCause: '未建立常规引入专家评估机制、专家库未建立', causeType: '制度' },
    { problem: '进销存台账仅取得复印件，未做原件核对与固化', rootCause: '取证规范未明确原件要求，取证工具不足', causeType: '流程' },
    { problem: '电子结算数据未做哈希固化，证据效力存疑', rootCause: '取证工具未内置固化功能，人员意识不足', causeType: '技术' }
  ],
  程序: [
    { problem: '现场检查未完整记录机构陈述申辩', rootCause: '检查人员程序意识不足、记录规范不健全', causeType: '人员' },
    { problem: '陈述申辩告知书送达超期，程序存在瑕疵', rootCause: '时限提醒缺失，送达环节无督办', causeType: '流程' },
    { problem: '听证告知未留痕，无法证明已履行告知义务', rootCause: '文书清单未强制校验，缺少节点卡控', causeType: '流程' }
  ],
  文书: [
    { problem: '检查报告过度诊疗事实描述笼统，未逐案说明', rootCause: '文书模板指引不足、撰写能力待提升', causeType: '制度' },
    { problem: '文书引用《行政处罚法》旧条款，法条未更新', rootCause: '法规库版本联动缺失，校对规则未覆盖', causeType: '技术' },
    { problem: '金额大写与小写不一致，需补充更正', rootCause: '金额转换未做一致性校验', causeType: '技术' }
  ],
  处置: [
    { problem: '罚款裁量未区分机构类型（社区中心承受能力弱）', rootCause: '裁量基准不区分机构类型', causeType: '制度' },
    { problem: '整改时限设置偏长，整改延期未及时督办', rootCause: '整改时限缺少分级标准，督办规则未配置', causeType: '流程' },
    { problem: '未同步启动信用扣分与协议处理联动', rootCause: '处置联动流程未打通', causeType: '流程' }
  ]
}

const MEASURE_LIB = [
  { measure: '制定《过度诊疗认定指引》，细化各系统检查临床指征标准', dept: '基金监管处+专家顾问组', priority: '高', rel: '定性' },
  { measure: '建立医学专家库，过度诊疗类案件常规引入专家评估', dept: '基金监管处+人事处', priority: '高', rel: '证据' },
  { measure: '完善陈述申辩记录规范，现场检查表增加申辩必填栏', dept: '基金监管处', priority: '中', rel: '程序' },
  { measure: '优化检查报告模板，增加过度诊疗结构化描述指引', dept: '法制科', priority: '中', rel: '文书' },
  { measure: '修订裁量基准，区分机构类型与承受能力分级裁量', dept: '法制科', priority: '中', rel: '处置' },
  { measure: '申诉改判线索作为负样本回流模型，优化识别规则', dept: '模型运营组', priority: '高', rel: '定性' },
  { measure: '组织过度诊疗认定专题培训，覆盖全部稽核人员', dept: '人事处', priority: '中', rel: '人员' },
  { measure: '法规库与文书校对联动，旧条款引用自动拦截', dept: '模型运营组', priority: '高', rel: '文书' },
  { measure: '取证工具内置哈希固化与原件核对清单', dept: '基金监管处', priority: '中', rel: '证据' },
  { measure: '整改时限分级标准落地，超期自动督办提醒', dept: '基金监管处', priority: '中', rel: '处置' }
]

const LESSON_LIB = [
  { title: '过度诊疗认定必须有临床专业判断支撑', content: '仅凭医保检查人员主观判断不足以认定过度诊疗，必须引入临床专家评估或明确临床指征标准，否则易在申诉复议环节被推翻。', tags: ['过度诊疗', '证据标准', '专家评估'] },
  { title: '现场检查必须充分听取并记录机构陈述申辩', content: '机构合理性解释必须完整记录并在认定时逐条回应，否则可能因程序瑕疵被推翻，程序合法是实体认定的前提。', tags: ['程序合规', '陈述申辩'] },
  { title: '裁量应当区分机构类型并考虑情节', content: '大医院、社区中心、药店承受能力不同，裁量应区分对待；首次违规从轻、屡查屡犯从重，做到过罚相当。', tags: ['裁量基准', '过罚相当'] },
  { title: '规则误报必须回流模型形成闭环', content: '申诉改判、复议撤销的线索是模型最宝贵的负样本，必须及时回流并驱动规则修正，避免同类误报反复发生。', tags: ['模型迭代', '负样本', '闭环'] },
  { title: '电子数据取证须同步固化哈希与时间戳', content: '结算明细、进销存等电子数据应在取证时即计算哈希并加时间戳，形成不可篡改的证据链。', tags: ['电子数据', '哈希固化'] },
  { title: '法条引用必须与现行法规库实时校验', content: '法规修订频繁，文书法条引用应由系统自动比对现行法规库，旧条款引用直接拦截，避免文书被撤销。', tags: ['文书规范', '法条校验'] },
  { title: '同类案件应形成标准化办案指引', content: '将高分案件的办案路径沉淀为标准指引，可显著降低同类案件的定性与文书失分。', tags: ['标准化', '经验推广'] },
  { title: '证据链完整性应在结案前做闭环自检', content: '结案前对「事实—证据—法条—处置」四要素做闭环自检，可提前发现证据缺口。', tags: ['证据闭环', '结案自检'] }
]

resetSeed(20260902)

/** 从不合格 / 申诉改判 / 复议撤销 / 诉讼败诉案件中生成复盘 */
const REVIEW_CANDIDATES = QUALITY_SCORES
  .filter((s) => s.totalScore < 70 || s.appealChanged || s.reconsiderationRevoked || s.litigationLost)
  .slice(0, 42)

export const CASE_REVIEWS: CaseReviewRecord[] = REVIEW_CANDIDATES.map((qs, i) => {
  const triggers: string[] = []
  if (qs.totalScore < 70) triggers.push('质量评分<70分')
  if (qs.appealChanged) triggers.push('申诉改判')
  if (qs.reconsiderationRevoked) triggers.push('复议撤销/变更')
  if (qs.litigationLost) triggers.push('诉讼败诉')
  if (!triggers.length) triggers.push('指定复盘')
  if (i % 9 === 0) triggers.push('社会影响大')
  if (i % 11 === 0) triggers.push('新型违规首例')

  const day = -(i * 2 + 3)
  const cats = pickMany([...PROBLEM_CATEGORIES], rndInt(3, 5))
  const problems: ReviewProblem[] = cats.map((c, j) => {
    const p = pick(PROBLEM_LIB[c])
    return {
      id: `P${pad(j + 1, 3)}`,
      category: c,
      severity: j === 0 ? '高' : j === 1 ? '高' : j < 4 ? '中' : '低',
      problem: p.problem,
      rootCause: p.rootCause,
      causeType: p.causeType
    }
  })

  const mCount = rndInt(5, 7)
  const measures: ReviewMeasure[] = pickMany(MEASURE_LIB, mCount).map((m, j) => {
    // 越早发起的复盘、优先级越高的措施完成度越高
    const r = rnd()
    const prog = r < 0.34 ? 100 : r < 0.72 ? rndInt(20, 90) : 0
    return {
      id: `IM${pad(j + 1, 3)}`,
      measure: m.measure,
      dept: m.dept,
      deadline: d(day + rndInt(40, 130)),
      priority: m.priority,
      progress: prog,
      status: prog >= 100 ? '已完成' : prog > 0 ? '进行中' : '未开始',
      owner: pick(REVIEW_MEMBERS),
      relatedProblem: problems.find((p) => p.category === m.rel)?.id || problems[0].id
    }
  })

  const lessons: ReviewLesson[] = pickMany(LESSON_LIB, rndInt(2, 3)).map((l, j) => ({
    id: `LL${pad(j + 1, 3)}`,
    title: l.title,
    content: l.content,
    tags: l.tags,
    citedCount: rndInt(3, 42),
    inTrainingLib: rnd() < 0.72
  }))

  const completed = measures.filter((m) => m.status === '已完成').length
  const inProgress = measures.filter((m) => m.status === '进行中').length
  const notStarted = measures.filter((m) => m.status === '未开始').length

  return {
    reviewId: `REVIEW2026${pad((i % 12) + 1, 2)}${pad((i % 28) + 1, 2)}${pad(i + 1, 4)}`,
    caseId: qs.caseId,
    caseName: qs.caseName,
    scoreId: qs.scoreId,
    totalScore: qs.totalScore,
    grade: qs.grade,
    reviewType: `重点复盘（${triggers.slice(0, 2).join('+')}${qs.totalScore < 70 ? `，${qs.totalScore}分` : ''}）`,
    triggers,
    reviewTime: dt(day, 14, 0),
    reviewers: pickMany(REVIEW_MEMBERS, rndInt(3, 4)),
    caseReview:
      `${qs.closeDate} 结案，认定${qs.violationType}相关违规金额 ${qs.violationAmount} 万元，` +
      `已追回 ${qs.recoveredAmount} 万元${qs.appealChanged ? '；申诉后部分线索改判撤销' : ''}` +
      `${qs.reconsiderationRevoked ? '；行政复议变更原决定' : ''}${qs.litigationLost ? '；行政诉讼一审败诉' : ''}。`,
    problems,
    improvementMeasures: measures,
    lessonsLearned: lessons,
    followUp: {
      totalMeasures: measures.length,
      completed,
      inProgress,
      notStarted,
      nextReviewDate: d(day + 60),
      completionRate: Number(((completed / measures.length) * 100).toFixed(1))
    },
    status: completed === measures.length ? '已闭环' : inProgress ? '整改中' : '待启动',
    reportId: i < 36 ? `RR2026${pad((i % 12) + 1, 2)}${pad((i % 28) + 1, 2)}${pad(i + 1, 4)}` : null
  }
})

export const CASE_REVIEW_MAP: Record<string, CaseReviewRecord> = Object.fromEntries(
  CASE_REVIEWS.map((r) => [r.reviewId, r])
)

/** 全部改进措施（跨复盘汇总，用于措施看板） */
export const ALL_MEASURES = CASE_REVIEWS.flatMap((r) =>
  r.improvementMeasures.map((m) => ({ ...m, reviewId: r.reviewId, caseName: r.caseName }))
)

/** 全部经验教训卡（沉淀墙） */
export const ALL_LESSONS = CASE_REVIEWS.flatMap((r) =>
  r.lessonsLearned.map((l) => ({ ...l, reviewId: r.reviewId, caseName: r.caseName, reviewTime: r.reviewTime }))
)

/** 原因四分类统计（鱼骨图） */
export const CAUSE_STAT = ROOT_CAUSE_TYPES.map((t) => {
  const items = CASE_REVIEWS.flatMap((r) => r.problems).filter((p) => p.causeType === t)
  return {
    causeType: t,
    count: items.length,
    problems: [...new Set(items.map((p) => p.problem))].slice(0, 5),
    ratio: 0
  }
})
const causeTotal = CAUSE_STAT.reduce((s, c) => s + c.count, 0) || 1
CAUSE_STAT.forEach((c) => { c.ratio = Number(((c.count / causeTotal) * 100).toFixed(1)) })

/** 问题分类 × 严重程度矩阵 */
export const PROBLEM_MATRIX = PROBLEM_CATEGORIES.map((c) => ({
  category: c,
  high: CASE_REVIEWS.flatMap((r) => r.problems).filter((p) => p.category === c && p.severity === '高').length,
  medium: CASE_REVIEWS.flatMap((r) => r.problems).filter((p) => p.category === c && p.severity === '中').length,
  low: CASE_REVIEWS.flatMap((r) => r.problems).filter((p) => p.category === c && p.severity === '低').length
}))

/* ==================== 3.1.3 复盘报告 ==================== */

export interface ReviewReport {
  reportId: string
  reportType: string
  reportName: string
  caseId: string | null
  reviewId: string | null
  generateTime: string
  generateMode: string
  status: string
  approver: string
  approvalTime: string | null
  confidentiality: string
  totalWordCount: number
  sections: { no: string; name: string; content: string; wordCount: number }[]
  attachments: string[]
  distribution: string[]
  readStatus: { total: number; read: number; readRate: number }
  feedback: { from: string; time: string; content: string }[]
  downloadUrl: string
  tags: string[]
}

const RR_ATTACHMENTS = ['质量评分表.xlsx', '问题清单.xlsx', '改进措施跟踪表.xlsx', '申诉复核决定书.pdf', '专家评估意见.pdf']
const RR_DISTRIBUTION = ['局领导', '基金监管处全体', '法制科', '各稽核组（学习参考）', '模型运营组']
const RR_FEEDBACK = [
  { from: '稽核一组组长 徐斌', content: '复盘深刻，已组织学习，后续过度诊疗案件将引入专家评估。' },
  { from: '法制科 刘明远', content: '裁量基准修订建议已采纳，本季度内完成修订稿。' },
  { from: '模型运营组 李知远', content: '负样本已纳入 v2.4 训练集，误报率预计下降 3 个百分点。' },
  { from: '基金监管处 王承志', content: '同意复盘结论，改进措施纳入年度重点工作台账督办。' },
  { from: '稽核二组组长', content: '经验教训卡已打印张贴，作为组内办案自检清单。' }
]

resetSeed(20260903)

export const REVIEW_REPORTS: ReviewReport[] = CASE_REVIEWS.filter((r) => r.reportId).map((r, i) => {
  const day = -(i * 2 + 1)
  const isPeriodic = i % 9 === 8
  const type = isPeriodic
    ? pick(['类案复盘报告', '月度复盘报告', '季度复盘报告'] as const)
    : '个案复盘报告'
  const highN = r.problems.filter((p) => p.severity === '高').length
  const midN = r.problems.filter((p) => p.severity === '中').length
  const lowN = r.problems.filter((p) => p.severity === '低').length
  const causeGroups = ROOT_CAUSE_TYPES.map((t) => {
    const ps = r.problems.filter((p) => p.causeType === t)
    return ps.length ? `${t}：${[...new Set(ps.map((p) => p.rootCause.split('、')[0]))].join('、')}` : ''
  }).filter(Boolean)
  const total = rndInt(22, 38)
  const read = Math.round(total * (0.78 + rnd() * 0.2))

  const sections = [
    {
      no: '一', name: '复盘概述',
      content: `本案质量评分 ${r.totalScore} 分（${r.grade}）${r.triggers.includes('申诉改判') ? '，且申诉后部分线索改判' : ''}，依据重点复盘触发条件列为重点复盘对象。复盘时间 ${r.reviewTime.slice(0, 10)}，参与人员：${r.reviewers.join('、')}。`,
      wordCount: 180
    },
    {
      no: '二', name: '案件回顾',
      content: r.caseReview + `办案主体为${r.caseName.slice(0, 12)}相关稽核组，全流程历时约 ${rndInt(18, 46)} 天。`,
      wordCount: 260
    },
    {
      no: '三', name: '质量评分',
      content: `总分 ${r.totalScore} 分（${r.grade}）；${QUALITY_SCORE_MAP[r.scoreId].dimensions.map((dm) => `${dm.dimension}${dm.score}`).join('、')}；同期 ${CASE_TOTAL} 件中排名第 ${QUALITY_SCORE_MAP[r.scoreId].rank} 位。`,
      wordCount: 160
    },
    {
      no: '四', name: '问题剖析',
      content: `共剖析出 ${r.problems.length} 个问题（高 ${highN}、中 ${midN}、低 ${lowN}）：${r.problems.map((p, j) => `${j + 1}.【${p.category}·${p.severity}】${p.problem}`).join('；')}。`,
      wordCount: 520
    },
    {
      no: '五', name: '原因分析',
      content: causeGroups.join('；') + '。深层原因在于标准细化、专家机制、能力建设与技术支撑四方面协同不足。',
      wordCount: 300
    },
    {
      no: '六', name: '改进措施',
      content: `共制定 ${r.improvementMeasures.length} 项改进措施，明确责任部门与完成时限：${r.improvementMeasures.map((m, j) => `${j + 1}.${m.measure}（${m.dept}，${m.deadline}前，${m.priority}优先）`).join('；')}。`,
      wordCount: 480
    },
    {
      no: '七', name: '经验教训',
      content: `提炼 ${r.lessonsLearned.length} 条经验教训：${r.lessonsLearned.map((l, j) => `${j + 1}.${l.title}——${l.content}`).join('；')}已纳入培训素材库供全员学习。`,
      wordCount: 340
    }
  ]

  const status = i < 28 ? '已发布' : i < 33 ? '待审核' : '已生成'

  return {
    reportId: r.reportId!,
    reportType: type,
    reportName: isPeriodic
      ? `2026年${(i % 12) + 1}月${type.replace('报告', '')}情况报告`
      : `${r.caseName}复盘报告`,
    caseId: r.caseId,
    reviewId: r.reviewId,
    generateTime: dt(day, 17, 0),
    generateMode: 'AI生成+人工修改',
    status,
    approver: '基金监管处 王承志',
    approvalTime: status === '已发布' ? dt(day + 1, 9, 0) : null,
    confidentiality: i % 7 === 0 ? '公开' : '内部',
    totalWordCount: sections.reduce((s, x) => s + x.wordCount, 0),
    sections,
    attachments: pickMany(RR_ATTACHMENTS, rndInt(3, 5)),
    distribution: pickMany(RR_DISTRIBUTION, rndInt(3, 5)),
    readStatus: { total, read, readRate: Number((read / total).toFixed(3)) },
    feedback: status === '已发布' ? pickMany(RR_FEEDBACK, rndInt(1, 3)).map((f, j) => ({ ...f, time: dt(day + 2 + j, 10 + j * 4, 0) })) : [],
    downloadUrl: `/reports/${r.reportId}.pdf`,
    tags: [...new Set([...r.problems.map((p) => p.category), ...r.lessonsLearned.flatMap((l) => l.tags)])].slice(0, 6)
  }
}) as ReviewReport[]

export const REVIEW_REPORT_MAP: Record<string, ReviewReport> = Object.fromEntries(
  REVIEW_REPORTS.map((r) => [r.reportId, r])
)

/* ==================== 3.2.1 监管可视化大屏 ==================== */

export const DASHBOARD = {
  dashboardId: 'DASH-MAIN-001',
  updateTime: dt(0, 14, 30),
  timeRange: '2026年',
  area: '芜湖市',
  refreshInterval: 300,

  coreIndicators: [
    { name: '发现疑点线索', value: 28810, unit: '条', trend: '+12.5%', up: true, todayNew: 285, icon: 'Search', tone: 'cyan' },
    { name: '问题阳性率', value: 51.1, unit: '%', trend: '+3.2%', up: true, confirmedCount: 14722, icon: 'Aim', tone: 'lime' },
    { name: '开展检查任务', value: 76, unit: '次', trend: '+8.6%', up: true, ongoing: 12, completed: 64, icon: 'Files', tone: 'blue' },
    { name: '覆盖定点机构', value: 1558, unit: '家', trend: '+15.3%', up: true, coverageRate: 78.5, icon: 'OfficeBuilding', tone: 'violet' },
    { name: '违规金额认定', value: 568.0, unit: '万元', trend: '+22.1%', up: true, insuranceFund: 426.0, icon: 'Money', tone: 'amber' },
    { name: '基金追回金额', value: 528.0, unit: '万元', trend: '+25.6%', up: true, recoveryRate: 93.0, icon: 'Coin', tone: 'lime' },
    { name: '处罚金额', value: 852.0, unit: '万元', trend: '+31.2%', up: true, penaltyCases: 45, icon: 'Stamp', tone: 'red' },
    { name: '整改完成率', value: 91.2, unit: '%', trend: '+5.8%', up: true, total: 148, completed: 135, icon: 'CircleCheck', tone: 'cyan' }
  ],

  clueTrend: {
    xAxis: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    series: [
      { name: '新增线索', data: [1850, 2120, 2460, 2680, 2750, 2880, 3120, 2881] },
      { name: '确认违规', data: [820, 980, 1150, 1280, 1350, 1420, 1560, 1472] },
      { name: '阳性率(%)', data: [44.3, 46.2, 46.7, 47.8, 49.1, 49.3, 50.0, 51.1] }
    ]
  },

  violationTypeDistribution: [
    { name: '重复收费', value: 4520, amount: 168.0, ratio: 15.7 },
    { name: '过度诊疗', value: 3210, amount: 124.0, ratio: 11.1 },
    { name: '超量开药', value: 5680, amount: 68.0, ratio: 19.7 },
    { name: '串换药品', value: 1850, amount: 82.0, ratio: 6.4 },
    { name: '虚假诊疗', value: 890, amount: 96.0, ratio: 3.1 },
    { name: '无指征收费', value: 2560, amount: 30.0, ratio: 8.9 },
    { name: '分解住院', value: 450, amount: 45.0, ratio: 1.6 },
    { name: '其他', value: 9650, amount: 55.0, ratio: 33.5 }
  ],

  /** 区域热力（含经纬度用于散点地图） */
  areaHeatmap: [
    { area: '市本级', clueCount: 5150, amount: 114.0, level: '高', orgCount: 112, lng: 118.376, lat: 31.326 },
    { area: '镜湖区', clueCount: 3420, amount: 68.0, level: '高', orgCount: 186, lng: 118.385, lat: 31.34 },
    { area: '鸠江区', clueCount: 3120, amount: 62.0, level: '高', orgCount: 178, lng: 118.392, lat: 31.369 },
    { area: '弋江区', clueCount: 2850, amount: 56.0, level: '高', orgCount: 165, lng: 118.372, lat: 31.31 },
    { area: '湾沚区', clueCount: 2680, amount: 52.0, level: '中', orgCount: 168, lng: 118.575, lat: 31.128 },
    { area: '繁昌区', clueCount: 2210, amount: 43.0, level: '中', orgCount: 142, lng: 118.198, lat: 31.081 },
    { area: '南陵县', clueCount: 1980, amount: 38.0, level: '中', orgCount: 136, lng: 118.336, lat: 30.919 },
    { area: '无为市', clueCount: 2400, amount: 46.0, level: '中', orgCount: 148, lng: 117.911, lat: 31.303 }
  ],

  orgRankingTOP10: [
    { rank: 1, orgName: '芜湖广济医院', type: '三级医院', amount: 28.6, count: 86, violationType: '虚假诊疗' },
    { rank: 2, orgName: '芜湖仁和大药房（镜湖店）', type: '零售药店', amount: 19.8, count: 124, violationType: '串换药品' },
    { rank: 3, orgName: '镜湖区赭山社区卫生服务中心', type: '社区中心', amount: 15.2, count: 65, violationType: '过度诊疗' },
    { rank: 4, orgName: '芜湖济民医院', type: '二级医院', amount: 13.6, count: 72, violationType: '重复收费' },
    { rank: 5, orgName: '芜湖百姓缘大药房（鸠江店）', type: '零售药店', amount: 11.2, count: 96, violationType: '超量开药' },
    { rank: 6, orgName: '鸠江区官陡社区卫生服务中心', type: '社区中心', amount: 9.8, count: 54, violationType: '无指征收费' },
    { rank: 7, orgName: '芜湖弋江医院', type: '二级医院', amount: 8.6, count: 48, violationType: '分解住院' },
    { rank: 8, orgName: '芜湖国大药房（弋江店）', type: '零售药店', amount: 7.4, count: 82, violationType: '串换药品' },
    { rank: 9, orgName: '湾沚区中医医院', type: '二级医院', amount: 6.5, count: 41, violationType: '过度诊疗' },
    { rank: 10, orgName: '南陵县人民医院', type: '二级医院', amount: 5.8, count: 38, violationType: '重复收费' }
  ],

  taskProgress: [
    { status: '待派发', count: 5, tone: 'faint' },
    { status: '待签收', count: 3, tone: 'blue' },
    { status: '自查中', count: 8, tone: 'cyan' },
    { status: '核查中', count: 6, tone: 'violet' },
    { status: '申诉中', count: 2, tone: 'amber' },
    { status: '待结果', count: 3, tone: 'blue' },
    { status: '处置中', count: 4, tone: 'red' },
    { status: '已结案', count: 45, tone: 'lime' }
  ],

  /** 文档 3.2.1 缺失字段，按处置口径补齐 */
  disposalTypeDistribution: [
    { name: '协议处理', value: 62, amount: 380.0 },
    { name: '行政处罚', value: 45, amount: 852.0 },
    { name: '移送司法', value: 6, amount: 28.0 },
    { name: '约谈整改', value: 88, amount: 0 },
    { name: '暂停结算', value: 14, amount: 0 },
    { name: '解除协议', value: 4, amount: 0 }
  ],

  fundTrend: {
    xAxis: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    series: [
      { name: '违规认定', data: [42.5, 48.2, 55.6, 62.8, 65.2, 68.5, 75.6, 72.0] },
      { name: '基金追回', data: [38.2, 44.5, 51.2, 58.6, 61.5, 64.2, 71.8, 68.0] },
      { name: '处罚金额', data: [62.0, 72.5, 85.0, 96.8, 102.0, 108.5, 120.5, 85.0] }
    ]
  },

  latestActivities: [
    { time: '14:28:15', type: '线索', content: '新增高风险线索：芜湖广济医院虚假诊疗，疑似金额 5600 元', level: '高' },
    { time: '14:25:32', type: '任务', content: '任务 TASK202608290003 完成线下核查，进入结果生成', level: '中' },
    { time: '14:20:08', type: '处置', content: '芜湖仁和大药房行政处罚决定书已送达签收', level: '中' },
    { time: '14:16:44', type: '线索', content: '镜湖区赭山社区卫生服务中心过度诊疗线索 12 条待研判', level: '中' },
    { time: '14:12:07', type: '处置', content: '芜湖济民医院基金追回 13.6 万元已到账核销', level: '中' },
    { time: '14:08:51', type: '任务', content: '飞行检查组签收专项任务，2 小时内抵达现场', level: '高' },
    { time: '14:03:26', type: '线索', content: '药品回流疑点新增 8 条，涉及跨机构结算', level: '高' },
    { time: '13:58:12', type: '处置', content: '芜湖国大药房整改验收通过，信用分恢复 2 分', level: '低' },
    { time: '13:52:40', type: '任务', content: '湾沚区自查任务超期预警，已自动督办', level: '中' },
    { time: '13:47:18', type: '线索', content: '模型拦截误报 5 条（家属代取药场景）', level: '低' }
  ],

  efficiencyIndicators: [
    { name: '线索发现时长', before: '平均7天', after: '实时（秒级）', improvement: 100 },
    { name: '任务办结周期', before: '平均45天', after: '平均18天', improvement: 60 },
    { name: '文书生成时长', before: '平均4小时/份', after: '5分钟/份', improvement: 98 },
    { name: '人力投入', before: '50人', after: '25人', improvement: 50 },
    { name: '屡查屡犯率', before: '15%', after: '7.7%', improvement: 48.7 }
  ],

  /** 六大智能体实时处理量（大屏专用） */
  agentPulse: [
    { no: 1, name: '疑点线索管理', today: 285, total: 28810, health: 99.6, tone: 'cyan' },
    { no: 2, name: '专项任务管理', today: 12, total: 76, health: 99.8, tone: 'blue' },
    { no: 3, name: '违规处置', today: 18, total: 156, health: 99.4, tone: 'amber' },
    { no: 4, name: '文书生成', today: 42, total: 1240, health: 99.9, tone: 'violet' },
    { no: 5, name: '成果宣教', today: 8, total: 128, health: 99.7, tone: 'lime' },
    { no: 6, name: '系统管理与支撑', today: 0, total: 0, health: 99.9, tone: 'pink' }
  ]
}

/* ==================== 3.2.2 多维对比分析 ==================== */

export const ANALYSIS_DIMENSIONS = [
  { key: 'area', name: '统筹区', icon: 'Location' },
  { key: 'insurance', name: '险种', icon: 'CreditCard' },
  { key: 'orgLevel', name: '机构等级', icon: 'OfficeBuilding' },
  { key: 'dept', name: '科室', icon: 'FirstAidKit' },
  { key: 'violationType', name: '违规类型', icon: 'WarnTriangleFilled' },
  { key: 'riskLevel', name: '风险等级', icon: 'Odometer' },
  { key: 'time', name: '时间', icon: 'Clock' },
  { key: 'disposalType', name: '处置类型', icon: 'Stamp' }
] as const

export const ANALYSIS_METHODS = ['同比', '环比', '占比分析', '趋势分析', '排名分析', '相关性分析'] as const

export const MULTI_DIM = {
  analysisId: 'ANA202608290001',
  analysisType: '多维对比分析',
  timeRange: '2026年1-8月',
  dimensions: ['区域', '机构类型', '违规类型'],
  summary: { totalClue: 20560, totalViolation: 456.0, totalPenalty: 680.0, totalRecovered: 420.0, positiveRate: 50.5 },

  byArea: [
    { area: '市本级', clue: 5150, violation: 114.0, penalty: 180.0, recovered: 105.0, positiveRate: 52.1, orgCount: 112, yoy: '+18.5%' },
    { area: '镜湖区', clue: 3420, violation: 68.0, penalty: 102.0, recovered: 63.0, positiveRate: 51.0, orgCount: 186, yoy: '+15.2%' },
    { area: '鸠江区', clue: 3120, violation: 62.0, penalty: 93.0, recovered: 58.0, positiveRate: 50.2, orgCount: 178, yoy: '+14.1%' },
    { area: '弋江区', clue: 2850, violation: 56.0, penalty: 84.0, recovered: 52.0, positiveRate: 49.8, orgCount: 165, yoy: '+12.8%' },
    { area: '湾沚区', clue: 2680, violation: 52.0, penalty: 78.0, recovered: 48.0, positiveRate: 49.5, orgCount: 168, yoy: '+20.3%' },
    { area: '繁昌区', clue: 1420, violation: 44.0, penalty: 61.0, recovered: 40.0, positiveRate: 49.2, orgCount: 142, yoy: '+16.4%' },
    { area: '南陵县', clue: 980, violation: 31.0, penalty: 42.0, recovered: 28.0, positiveRate: 48.8, orgCount: 136, yoy: '+17.1%' },
    { area: '无为市', clue: 940, violation: 29.0, penalty: 40.0, recovered: 26.0, positiveRate: 49.0, orgCount: 148, yoy: '+16.2%' }
  ],

  byOrgType: [
    { type: '三级医院', clue: 2450, violation: 168.0, penalty: 280.0, recovered: 155.0, avgAmount: 0.069, ratio: 36.8 },
    { type: '二级医院', clue: 3280, violation: 96.0, penalty: 144.0, recovered: 88.0, avgAmount: 0.029, ratio: 21.1 },
    { type: '一级医院', clue: 2860, violation: 52.0, penalty: 78.0, recovered: 48.0, avgAmount: 0.018, ratio: 11.4 },
    { type: '社区卫生服务中心', clue: 3120, violation: 42.0, penalty: 56.0, recovered: 38.0, avgAmount: 0.013, ratio: 9.2 },
    { type: '零售药店', clue: 7850, violation: 88.0, penalty: 116.0, recovered: 82.0, avgAmount: 0.011, ratio: 19.3 },
    { type: '诊所/卫生院', clue: 1000, violation: 10.0, penalty: 6.0, recovered: 9.0, avgAmount: 0.010, ratio: 2.2 }
  ],

  byViolationType: [
    { type: '重复收费', clue: 3620, violation: 135.0, recovered: 125.0, recoveryRate: 92.6, trend: '上升', yoy: '+8.5%' },
    { type: '过度诊疗', clue: 2580, violation: 100.0, recovered: 92.0, recoveryRate: 92.0, trend: '上升', yoy: '+15.2%' },
    { type: '超量开药', clue: 4560, violation: 55.0, recovered: 51.0, recoveryRate: 92.7, trend: '平稳', yoy: '+3.2%' },
    { type: '串换药品', clue: 1480, violation: 66.0, recovered: 60.0, recoveryRate: 90.9, trend: '上升', yoy: '+22.8%' },
    { type: '虚假诊疗', clue: 720, violation: 78.0, recovered: 72.0, recoveryRate: 92.3, trend: '上升', yoy: '+18.6%' },
    { type: '无指征收费', clue: 2050, violation: 24.0, recovered: 22.0, recoveryRate: 91.7, trend: '下降', yoy: '-5.2%' },
    { type: '分解住院', clue: 360, violation: 36.0, recovered: 33.0, recoveryRate: 91.7, trend: '上升', yoy: '+12.5%' },
    { type: '其他', clue: 5190, violation: 62.0, recovered: 57.0, recoveryRate: 91.9, trend: '平稳', yoy: '+5.8%' }
  ],

  byInsurance: [
    { type: '职工医保', clue: 12860, violation: 296.0, recovered: 274.0, ratio: 62.5 },
    { type: '居民医保', clue: 7700, violation: 160.0, recovered: 146.0, ratio: 37.5 }
  ],

  byRiskLevel: [
    { level: '高风险', clue: 2450, violation: 218.0, positiveRate: 78.6, ratio: 11.9 },
    { level: '中风险', clue: 7300, violation: 168.0, positiveRate: 54.2, ratio: 35.5 },
    { level: '低风险', clue: 10810, violation: 70.0, positiveRate: 32.4, ratio: 52.6 }
  ],

  byDept: [
    { dept: '内科', clue: 3860, violation: 92.0, mainType: '重复收费' },
    { dept: '外科', clue: 3120, violation: 86.0, mainType: '过度诊疗' },
    { dept: '骨科', clue: 2240, violation: 68.0, mainType: '无指征收费' },
    { dept: '康复科', clue: 1980, violation: 54.0, mainType: '虚假诊疗' },
    { dept: '中医科', clue: 1650, violation: 42.0, mainType: '超量开药' },
    { dept: '门诊药房', clue: 4820, violation: 66.0, mainType: '串换药品' },
    { dept: '检验科', clue: 1560, violation: 32.0, mainType: '无指征收费' },
    { dept: '影像科', clue: 1330, violation: 16.0, mainType: '过度诊疗' }
  ],

  monthlyTrend: [
    { month: '1月', clue: 1850, violation: 42.5, penalty: 62.0, recovered: 38.2, positiveRate: 44.3 },
    { month: '2月', clue: 2120, violation: 48.2, penalty: 72.5, recovered: 44.5, positiveRate: 46.2 },
    { month: '3月', clue: 2460, violation: 55.6, penalty: 85.0, recovered: 51.2, positiveRate: 46.7 },
    { month: '4月', clue: 2680, violation: 62.8, penalty: 96.8, recovered: 58.6, positiveRate: 47.8 },
    { month: '5月', clue: 2750, violation: 65.2, penalty: 102.0, recovered: 61.5, positiveRate: 49.1 },
    { month: '6月', clue: 2880, violation: 68.5, penalty: 108.5, recovered: 64.2, positiveRate: 49.3 },
    { month: '7月', clue: 3120, violation: 75.6, penalty: 120.5, recovered: 71.8, positiveRate: 50.0 },
    { month: '8月', clue: 2700, violation: 37.6, penalty: 32.7, recovered: 30.0, positiveRate: 51.1 }
  ],

  drillDown: {
    path: ['汇总', '镜湖区', '零售药店', '串换药品', '单笔明细'],
    level1: { name: '全市汇总', clue: 20560, violation: 456.0 },
    level2: { name: '镜湖区', clue: 3420, violation: 68.0 },
    level3: { name: '零售药店', clue: 1250, violation: 22.0 },
    level4: { name: '串换药品', clue: 320, violation: 12.5 },
    level5: {
      details: [
        { clueId: 'CL202606150001', orgName: '芜湖仁和大药房（镜湖店）', patient: '张*三', item: '生活用品串换为阿莫西林', amount: 320.0, date: '2026-06-15' },
        { clueId: 'CL202606180002', orgName: '芜湖仁和大药房（镜湖店）', patient: '李*四', item: '保健品串换为降压药', amount: 450.0, date: '2026-06-18' },
        { clueId: 'CL202606210003', orgName: '芜湖国大药房（镜湖店）', patient: '王*五', item: '日用品串换为二甲双胍', amount: 286.0, date: '2026-06-21' },
        { clueId: 'CL202606250004', orgName: '芜湖百姓缘大药房（镜湖店）', patient: '赵*六', item: '滋补品串换为阿托伐他汀', amount: 512.0, date: '2026-06-25' },
        { clueId: 'CL202607020005', orgName: '芜湖仁和大药房（镜湖店）', patient: '孙*七', item: '化妆品串换为医保目录药品', amount: 398.0, date: '2026-07-02' },
        { clueId: 'CL202607080006', orgName: '芜湖国大药房（镜湖店）', patient: '周*八', item: '保健品串换为硝苯地平', amount: 265.0, date: '2026-07-08' }
      ]
    }
  },

  /** 相关性分析（散点：机构数 vs 线索数） */
  correlation: {
    xName: '定点机构数量（家）',
    yName: '疑点线索数（条）',
    points: [
      { area: '市本级', x: 112, y: 5150 }, { area: '镜湖区', x: 186, y: 3420 },
      { area: '鸠江区', x: 178, y: 3120 }, { area: '弋江区', x: 165, y: 2850 },
      { area: '湾沚区', x: 168, y: 2680 }, { area: '繁昌区', x: 142, y: 1420 },
      { area: '南陵县', x: 136, y: 980 }, { area: '无为市', x: 148, y: 940 }
    ],
    conclusion: '市本级机构数量最少但线索数最高，反映三级医院集中、单机构线索密度显著高于区县；区县机构数量多而线索密度低，需加强基层数据接入与规则覆盖。',
    coefficient: -0.42
  }
}

/* ==================== 3.2.3 成果效能评估 ==================== */

export const EVALUATION = {
  evaluationId: 'EVA202608290001',
  evaluationPeriod: '2026年1-8月',
  compareBase: '2025年同期（系统上线前）',
  overallScore: 92,
  overallConclusion:
    '系统上线后监管效能显著提升，线索发现实时化、任务周期缩短60%、人力投入减少50%、基金挽回率提升至93%，屡查屡犯率下降48.7%，达到预期目标。',
  reportUrl: '/reports/EVA202608290001.pdf',

  /** 5 大评估维度得分（雷达） */
  dimensionScores: [
    { dimension: '效率提升', score: 96, weight: 25, icon: 'Timer' },
    { dimension: '人力节约', score: 92, weight: 20, icon: 'User' },
    { dimension: '基金挽回', score: 93, weight: 25, icon: 'Coin' },
    { dimension: '震慑效应', score: 89, weight: 15, icon: 'Warning' },
    { dimension: '覆盖率提升', score: 88, weight: 15, icon: 'Aim' }
  ],

  efficiencyImprovement: [
    { indicator: '线索发现时长', before: '平均7天', after: '实时（秒级）', improvement: 100, target: '≥90%', achieved: true, description: '智能比对引擎实时扫描，线索秒级生成' },
    { indicator: '任务办结周期', before: '平均45天', after: '平均18天', improvement: 60, target: '≥50%', achieved: true, description: '线上筛查+自动文书+电子送达大幅压缩周期' },
    { indicator: '文书生成时长', before: '平均4小时/份', after: '5分钟/份', improvement: 98, target: '≥90%', achieved: true, description: 'AI自动填充+智能撰写，一键生成规范文书' },
    { indicator: '证据归集时长', before: '平均2天/案', after: '实时自动归集', improvement: 99, target: '≥90%', achieved: true, description: '全流程证据自动关联归集' },
    { indicator: '线索研判时长', before: '平均3天/条', after: '平均0.5天/条', improvement: 83, target: '≥70%', achieved: true, description: 'AI研判建议+知识图谱溯源辅助快速定性' }
  ],

  laborSaving: {
    before: 50, after: 25, savingRate: 0.5, savingCount: 25,
    byRole: [
      { role: '数据筛查人员', before: 15, after: 3, saving: 12 },
      { role: '文书撰写人员', before: 8, after: 2, saving: 6 },
      { role: '线索研判人员', before: 12, after: 8, saving: 4 },
      { role: '档案管理人员', before: 5, after: 2, saving: 3 },
      { role: '其他', before: 10, after: 10, saving: 0 }
    ],
    redeployment: '节省的25人转岗至现场核查、复杂案件研判、模型优化等高价值工作',
    costSaving: { annualPersonnelCost: 125000, totalAnnualSaving: 3125000, unit: '元' }
  },

  fundRecovery: {
    annualRecovered: 528.0, unit: '万元', recoveryRate: 93.0, beforeRecoveryRate: 78.5,
    improvement: 14.5, target: '年度追回率≥90%', achieved: true,
    byType: [
      { type: '协议处理追回', amount: 380.0, rate: 95.2 },
      { type: '行政处罚追回', amount: 120.0, rate: 88.5 },
      { type: '移送案件追回', amount: 28.0, rate: 85.0 }
    ],
    byQuarter: [
      { quarter: 'Q1', shouldRecover: 120.0, recovered: 108.0, rate: 90.0 },
      { quarter: 'Q2', shouldRecover: 180.0, recovered: 168.0, rate: 93.3 },
      { quarter: 'Q3(7-8月)', shouldRecover: 228.0, recovered: 216.0, rate: 94.7 }
    ]
  },

  deterrenceEffect: {
    repeatOffenderRate: { before: 0.15, after: 0.077, decline: 0.487, description: '屡查屡犯率从15%降至7.7%，下降48.7%' },
    violationGrowthRate: { before: 0.12, after: 0.05, decline: 0.583, description: '违规金额增长率从12%降至5%，震慑效应显著' },
    orgComplianceRate: { before: 0.82, after: 0.91, improvement: 0.11, description: '机构合规率从82%提升至91%' },
    publicAwareness: { before: '低', after: '中高', description: '通过宣教推送，公众医保防骗意识显著提升' }
  },

  coverageImprovement: {
    inspectionCoverage: { before: 0.52, after: 0.785, improvement: 0.265, description: '定点机构检查覆盖率从52%提升至78.5%' },
    dataCoverage: { before: 0.65, after: 0.92, improvement: 0.27, description: '数据接入覆盖率从65%提升至92%' },
    realTimeMonitoring: { before: '无', after: '7×24小时实时监测', description: '实现全量数据实时监测预警' }
  },

  targetAchievement: [
    { target: '线索发现实时化', planned: '2026年底', actual: '2026年3月', achieved: true, ahead: true, exceeded: false, rate: 100 },
    { target: '任务周期缩短≥50%', planned: '50%', actual: '60%', achieved: true, ahead: false, exceeded: false, rate: 120 },
    { target: '人力投入减少≥40%', planned: '40%', actual: '50%', achieved: true, ahead: false, exceeded: true, rate: 125 },
    { target: '基金追回率≥90%', planned: '90%', actual: '93%', achieved: true, ahead: false, exceeded: true, rate: 103 },
    { target: '屡查屡犯率下降≥30%', planned: '30%', actual: '48.7%', achieved: true, ahead: false, exceeded: true, rate: 162 }
  ]
}

/* ==================== 3.2.4 一键分析报告 ==================== */

export const ANALYSIS_REPORT_TYPES = [
  '月度监管分析报告', '季度监管分析报告', '年度监管分析报告',
  '专项检查总结报告', '态势研判报告', '专题分析报告'
] as const

export interface AnalysisReport {
  reportId: string
  reportType: string
  reportName: string
  generateTime: string
  generateMode: string
  status: string
  period: string
  area: string
  totalWordCount: number
  exportFormats: string[]
  downloadUrl: string
  wordDownloadUrl: string
  reviewer: string | null
  reviewTime: string | null
  reviewOpinion: string | null
  sections: { no: string; name: string; content: string; wordCount: number; charts?: string[]; cases?: string[]; riskLevels?: Record<string, string> }[]
  charts: { id: string; name: string; type: string; desc: string }[]
  tables: { id: string; name: string; rows: number; cols: number }[]
  readCount: number
}

const REPORT_CHARTS = [
  { id: 'CH001', name: '核心指标卡片', type: 'indicatorCards', desc: '8 项核心指标' },
  { id: 'CH002', name: '线索发现趋势', type: 'line', desc: '1-8月 · 新增线索/确认违规/阳性率' },
  { id: 'CH003', name: '违规类型分布', type: 'pie', desc: '8 类违规占比' },
  { id: 'CH004', name: '区域违规热力图', type: 'map', desc: '全市 8 个统筹区' },
  { id: 'CH005', name: '机构违规排名TOP10', type: 'bar', desc: 'TOP10 机构' },
  { id: 'CH006', name: '基金追缴趋势', type: 'line', desc: '违规认定/基金追回/处罚金额' }
]

const REPORT_TABLES = [
  { id: 'TBL001', name: '核心指标统计表', rows: 15, cols: 5 },
  { id: 'TBL002', name: '各区监管对比表', rows: 13, cols: 8 },
  { id: 'TBL003', name: '重点机构名单', rows: 20, cols: 6 }
]

const MAIN_REPORT_SECTIONS = [
  {
    no: '一', name: '监管工作概述', wordCount: 180,
    content: '2026年8月，全市医保基金监管工作开展检查任务 12 次，发现疑点线索 2881 条，确认违规 1472 条，问题阳性率 51.1%，覆盖定点机构 328 家；认定违规金额 72.0 万元，追回基金 68.0 万元，处罚金额 85.0 万元，整改完成率 91.2%，屡查屡犯率降至 7.7%。'
  },
  {
    no: '二', name: '核心指标分析', wordCount: 520,
    charts: ['核心指标卡片', '线索趋势图', '任务类型分布图', '金额构成饼图'],
    content: '（一）线索发现：本月新增疑点线索 2881 条，其中高风险 342 条（11.9%）、中风险 1024 条（35.5%）、低风险 1515 条（52.6%）。（二）任务执行：开展专项检查 5 次、日常稽核 4 次、飞行检查 2 次、联合督查 1 次，任务完成率 83.3%，平均办结周期 18 天。（三）金额认定与追回：认定违规金额 72.0 万元，其中涉及医保基金 54.0 万元；平均处罚倍数 1.57 倍，基金追回率 94.4%。（四）机构覆盖：本月覆盖医院 89 家、药店 156 家、社区中心 52 家、其他 31 家；年度累计覆盖 1558 家，覆盖率 78.5%。'
  },
  {
    no: '三', name: '违规态势分析', wordCount: 680,
    charts: ['违规类型分布饼图', '区域热力图', '机构类型柱状图', '违规趋势折线图'],
    content: '（一）违规类型分布：超量开药 568 条（19.7%）居首，重复收费 452 条（15.7%）、过度诊疗 321 条（11.1%）分列二三位。（二）区域分布：市本级 515 条（17.9%）、镜湖区 342 条（11.9%）、鸠江区 312 条（10.8%）、弋江区 285 条（9.9%）、湾沚区 268 条（9.3%）、其他区县 1159 条（40.2%）；镜湖、鸠江、弋江主城三区合计占比 32.6%。（三）机构类型分布：零售药店 785 条（27.2%）最多，反映药店监管仍是薄弱环节。（四）趋势变化：虚假诊疗同比 +18.6%、串换药品 +22.8%、分解住院 +12.5% 呈上升态势；无指征收费 -5.2% 首现下降。'
  },
  {
    no: '四', name: '重点问题剖析', wordCount: 580,
    cases: ['芜湖某零售药店串换药品案', '芜湖某医院虚假诊疗案', '芜湖某社区卫生服务中心过度诊疗案'],
    content: '（一）药店串换药品高发：本月 185 条、涉及金额 8.2 万元、同比 +22.8%，某药店被处罚款 16.8 万元并解除协议。（二）虚假诊疗持续上升：89 条、9.6 万元、同比 +18.6%，其中一起涉嫌金额 28.6 万元已移送公安机关。（三）过度诊疗证据不足：本月 321 条，申诉改判率约 15%，反映临床专业判断支撑不足。（四）基层机构合规能力薄弱：社区中心与诊所卫生院合计占比 20.7%，合规管理制度与人员培训存在明显短板。'
  },
  {
    no: '五', name: '趋势预测与风险预警', wordCount: 420,
    riskLevels: { 药店串换药品: '高', 虚假诊疗: '高', 基层合规: '中', 分解住院: '中' },
    content: '基于近 8 个月趋势建模，预计 9 月新增线索 2800-3000 条，问题阳性率约 52%。重点风险提示：一是开学季学生医保就医异常需关注；二是中秋国庆假期药店购药异常将集中出现；三是 DRG 付费改革推进下分解住院、低标入院风险上升，需前置规则布防。'
  },
  {
    no: '六', name: '对策建议', wordCount: 520,
    content: '一、开展药店串换药品专项整治，以进销存与结算数据比对为核心手段全覆盖筛查；二、强化虚假诊疗打击，建立与公安、卫健的线索移送与联合办案机制；三、完善过度诊疗认定标准，建立医学专家库并常规引入专家评估；四、加强基层合规建设，开展社区中心与诊所专项培训与合规辅导；五、深化智能监管应用，推动规则迭代与模型优化闭环；六、推进信用监管，将违规行为与协议管理、信用评价、支付方式联动。'
  },
  {
    no: '七', name: '附件', wordCount: 80,
    content: '附件1 核心指标统计表；附件2 违规线索分类统计表；附件3 各区监管情况对比表；附件4 重点违规机构名单；附件5 典型案例汇编。'
  }
]

resetSeed(20260904)

export const ANALYSIS_REPORTS: AnalysisReport[] = Array.from({ length: 20 }, (_, i) => {
  const type = i === 0 ? '月度监管分析报告' : pick(ANALYSIS_REPORT_TYPES)
  const mon = 8 - (i % 8)
  const day = -(i * 5 + 1)
  const status = i < 12 ? '已生成' : i < 16 ? '待审核' : '生成中'
  const reviewed = i < 12
  return {
    reportId: `RPT-ANA2026${pad(mon, 2)}${pad(28 - (i % 20), 2)}${pad(i + 1, 4)}`,
    reportType: type,
    reportName:
      type.startsWith('月度') ? `2026年${mon}月芜湖市医保基金监管分析报告`
        : type.startsWith('季度') ? `2026年第${Math.ceil(mon / 3)}季度芜湖市医保基金监管分析报告`
          : type.startsWith('年度') ? '2026年度芜湖市医保基金监管分析报告'
            : type === '专项检查总结报告' ? `2026年${mon}月零售药店串换药品专项检查总结报告`
              : type === '态势研判报告' ? `2026年${mon}月医保基金违规态势研判报告`
                : `${pick(['过度诊疗', '虚假诊疗', '串换药品', '分解住院'])}类违规专题分析报告`,
    generateTime: dt(day, 16, 0),
    generateMode: 'AI自动生成+人工审核',
    status,
    period: `2026年${mon}月`,
    area: '芜湖市',
    totalWordCount: 3200 - (i % 5) * 180,
    exportFormats: ['Word', 'PDF'],
    downloadUrl: `/reports/RPT-ANA2026${pad(mon, 2)}${pad(i + 1, 4)}.pdf`,
    wordDownloadUrl: `/reports/RPT-ANA2026${pad(mon, 2)}${pad(i + 1, 4)}.docx`,
    reviewer: reviewed ? '基金监管处 王承志' : null,
    reviewTime: reviewed ? dt(day, 17, 0) : null,
    reviewOpinion: reviewed ? '报告数据准确、分析深入、建议可行，同意发布。' : null,
    sections: MAIN_REPORT_SECTIONS,
    charts: REPORT_CHARTS,
    tables: REPORT_TABLES,
    readCount: rndInt(28, 240)
  }
})

export const ANALYSIS_REPORT_MAP: Record<string, AnalysisReport> = Object.fromEntries(
  ANALYSIS_REPORTS.map((r) => [r.reportId, r])
)

/** 报告生成流水线阶段（用于生成动效） */
export const REPORT_PIPELINE = [
  { step: 1, name: '数据抽取', desc: '按时间/区域范围抽取线索、任务、处置、金额全量数据', icon: 'DataLine', ms: 900 },
  { step: 2, name: '指标计算', desc: '计算 8 项核心指标与同比环比，校验口径一致性', icon: 'Odometer', ms: 700 },
  { step: 3, name: '图表生成', desc: '自动生成 6 张图表与 3 张统计表', icon: 'PieChart', ms: 800 },
  { step: 4, name: 'AI 撰写', desc: '按七章结构撰写正文，输出态势分析与对策建议', icon: 'MagicStick', ms: 1600 },
  { step: 5, name: '排版导出', desc: '套用报告模板排版，输出 Word / PDF 双格式', icon: 'Printer', ms: 600 }
]

/* ==================== 汇总统计 ==================== */

export const REVIEW_STATS = {
  /* 3.1.1 */
  scoreTotal: QUALITY_SCORES.length,
  avgScore: Number((QUALITY_SCORES.reduce((s, x) => s + x.totalScore, 0) / QUALITY_SCORES.length).toFixed(1)),
  gradeDist: GRADE_STANDARD.map((g) => ({
    name: g.grade,
    value: QUALITY_SCORES.filter((s) => s.grade === g.grade).length,
    tone: g.tone
  })),
  excellentCount: QUALITY_SCORES.filter((s) => s.grade === '优秀').length,
  failCount: QUALITY_SCORES.filter((s) => s.grade === '不合格').length,
  autoFlaggedCount: QUALITY_SCORES.filter((s) => s.autoFlagged).length,
  appealChangedCount: QUALITY_SCORES.filter((s) => s.appealChanged).length,
  dimensionAvg: DIMENSION_AVG,
  histogram: SCORE_HISTOGRAM,
  scoreTrend: SCORE_TREND,
  /** 按区县平均分 */
  byDistrict: [...new Set(QUALITY_SCORES.map((s) => s.district))].map((dis) => {
    const arr = QUALITY_SCORES.filter((s) => s.district === dis)
    return {
      district: dis,
      count: arr.length,
      avgScore: Number((arr.reduce((s, x) => s + x.totalScore, 0) / arr.length).toFixed(1)),
      failCount: arr.filter((x) => x.grade === '不合格').length
    }
  }),

  /* 3.1.2 */
  reviewTotal: CASE_REVIEWS.length,
  reviewClosed: CASE_REVIEWS.filter((r) => r.status === '已闭环').length,
  reviewOngoing: CASE_REVIEWS.filter((r) => r.status === '整改中').length,
  measureTotal: ALL_MEASURES.length,
  measureCompleted: ALL_MEASURES.filter((m) => m.status === '已完成').length,
  measureInProgress: ALL_MEASURES.filter((m) => m.status === '进行中').length,
  measureNotStarted: ALL_MEASURES.filter((m) => m.status === '未开始').length,
  lessonTotal: ALL_LESSONS.length,
  lessonInTrainingLib: ALL_LESSONS.filter((l) => l.inTrainingLib).length,
  causeStat: CAUSE_STAT,
  problemMatrix: PROBLEM_MATRIX,
  triggerDist: REVIEW_TRIGGERS.map((t) => ({
    name: t.trigger,
    value: CASE_REVIEWS.filter((r) => r.triggers.includes(t.trigger)).length,
    tone: t.tone
  })),

  /* 3.1.3 */
  reportTotal: REVIEW_REPORTS.length,
  reportPublished: REVIEW_REPORTS.filter((r) => r.status === '已发布').length,
  reportPending: REVIEW_REPORTS.filter((r) => r.status === '待审核').length,
  avgReadRate: Number(
    ((REVIEW_REPORTS.reduce((s, r) => s + r.readStatus.readRate, 0) / REVIEW_REPORTS.length) * 100).toFixed(1)
  ),
  reportTypeDist: REVIEW_REPORT_TYPES.map((t) => ({
    name: t,
    value: REVIEW_REPORTS.filter((r) => r.reportType === t).length
  })).filter((x) => x.value > 0),

  /* 3.2.4 */
  analysisReportTotal: ANALYSIS_REPORTS.length,
  analysisReportTypeDist: ANALYSIS_REPORT_TYPES.map((t) => ({
    name: t,
    value: ANALYSIS_REPORTS.filter((r) => r.reportType === t).length
  })).filter((x) => x.value > 0)
}
