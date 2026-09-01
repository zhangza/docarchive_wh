/**
 * 智能体五：成果宣教智能体 —— Mock 数据集（下）
 * 覆盖 3.3 模型自学习迭代 + 3.4 合规成果宣教
 * 需求依据：doc/子功能/05_成果宣教智能体_详细功能设计.md
 */
import { resetSeed, rnd, rndInt, pick, pickMany, pad, dt, d } from './base'

/* ==================== 3.3.1 案例数据回流 ==================== */

export const SAMPLE_TYPES = ['正样本', '负样本', '误判样本', '申诉改判样本', '复议改判样本'] as const
export const FEATURE_TYPES = ['数值型', '类别型', '文本型', '时序型'] as const
export const FEEDBACK_STATUS = ['回流中', '回流完成', '回流失败'] as const

export interface FeedbackSample {
  clueId: string
  violationType: string
  orgType: string
  amount: number
  confirmed: boolean
  sampleType: string
  appealChanged?: boolean
  misjudgmentReason?: string
  features: Record<string, any>
}

const POS_SAMPLES: FeedbackSample[] = [
  { clueId: 'CL202608150001', violationType: '重复收费', orgType: '三级医院', amount: 5600.0, confirmed: true, sampleType: '正样本', features: { sameItemCount: 2, sameDept: true, amountDiff: 800, timeDiff: 0 } },
  { clueId: 'CL202608180002', violationType: '串换药品', orgType: '零售药店', amount: 320.0, confirmed: true, sampleType: '正样本', features: { drugCategoryMismatch: true, purchaseAmountAbnormal: true, inventoryMismatch: true } },
  { clueId: 'CL202608190005', violationType: '虚假诊疗', orgType: '二级医院', amount: 28600.0, confirmed: true, sampleType: '正样本', features: { noAdmissionRecord: true, deviceLogMissing: true, patientDenied: true, staffTestimony: true } },
  { clueId: 'CL202608210006', violationType: '分解住院', orgType: '二级医院', amount: 12400.0, confirmed: true, sampleType: '正样本', features: { readmitWithin15Days: true, sameDiagnosis: true, drgGroupSame: true } },
  { clueId: 'CL202608230007', violationType: '超量开药', orgType: '社区中心', amount: 860.0, confirmed: true, sampleType: '正样本', features: { dosageOverLimit: 3.2, chronicDisease: true, familyPickup: false } },
  { clueId: 'CL202608250008', violationType: '无指征收费', orgType: '一级医院', amount: 1560.0, confirmed: true, sampleType: '正样本', features: { diagnosisMatch: 0.18, examCount: 6, noSymptomRecord: true } }
]

const NEG_SAMPLES: FeedbackSample[] = [
  { clueId: 'CL202608200003', violationType: '过度诊疗', orgType: '社区中心', amount: 280.0, confirmed: false, sampleType: '申诉改判样本', appealChanged: true, misjudgmentReason: '患者有胸闷症状，心脏彩超检查有临床指征', features: { hasSymptom: true, expertOpinion: '有指征', diagnosisMatch: 0.6 } },
  { clueId: 'CL202608220004', violationType: '超量开药', orgType: '三级医院', amount: 180.0, confirmed: false, sampleType: '误判样本', misjudgmentReason: '家属代取药，合并结算', features: { familyPickup: true, mergeSettlement: true, historyPrescription: true } },
  { clueId: 'CL202608240009', violationType: '重复收费', orgType: '三级医院', amount: 420.0, confirmed: false, sampleType: '误判样本', misjudgmentReason: '医嘱明确要求术后每日换药，属正常多次执行', features: { doctorOrderRepeat: true, dailyExecution: true, postOperation: true } },
  { clueId: 'CL202608260010', violationType: '过度诊疗', orgType: '二级医院', amount: 650.0, confirmed: false, sampleType: '复议改判样本', appealChanged: true, misjudgmentReason: '复议阶段补充临床指南依据，检查符合诊疗规范', features: { hasSymptom: true, expertOpinion: '有指征', guidelineMatch: 0.88 } },
  { clueId: 'CL202608270011', violationType: '无指征收费', orgType: '零售药店', amount: 96.0, confirmed: false, sampleType: '误判样本', misjudgmentReason: '慢病长处方政策允许一次结算 3 个月用量', features: { longPrescriptionPolicy: true, chronicDisease: true, dosageOverLimit: 1.0 } }
]

export interface FeedbackBatch {
  feedbackId: string
  feedbackType: string
  batchNo: string
  feedbackTime: string
  status: string
  source: string
  mode: string
  dataSummary: {
    totalCases: number
    totalClues: number
    positiveSamples: number
    negativeSamples: number
    misjudgmentSamples: number
    appealChangedSamples: number
    reconsiderationChangedSamples: number
  }
  positiveSamples: FeedbackSample[]
  negativeSamples: FeedbackSample[]
  dataProcessing: {
    deduplication: { before: number; after: number; removed: number }
    cleaning: { invalidRecords: number; missingFields: number; outliers: number }
    annotation: { autoAnnotated: number; manualReviewed: number; annotationRate: number }
    featureExtraction: { featuresExtracted: number; featureTypes: string[] }
  }
  trainingSet: {
    setId: string
    totalSamples: number
    trainSet: number
    validationSet: number
    testSet: number
    positiveRatio: number
    negativeRatio: number
    version: string
    storagePath: string
  }
  dataSecurity: {
    desensitization: boolean
    desensitizationFields: string[]
    encryption: string
    accessControl: string[]
    auditLog: boolean
  }
  modelUpdate: {
    currentModelVersion: string
    newTrainingSetVersion: string
    nextTrainingDate: string
    expectedImprovement: string
  }
}

resetSeed(20260905)

export const FEEDBACK_BATCHES: FeedbackBatch[] = Array.from({ length: 14 }, (_, i) => {
  const mon = 8 - i
  const y = mon > 0 ? 2026 : 2025
  const m = mon > 0 ? mon : mon + 12
  const clues = 2881 - i * 168
  const pos = Math.round(clues * (0.512 - i * 0.004))
  const neg = clues - pos
  const dedup = clues - rndInt(18, 36)
  const mis = 86 - i * 4
  return {
    feedbackId: `FB2026${pad(m, 2)}${pad(29 - (i % 20), 2)}${pad(i + 1, 4)}`,
    feedbackType: '案例数据回流',
    batchNo: `BATCH-${y}-${pad(m, 2)}`,
    feedbackTime: dt(-(i * 30 + 2), 2, 0),
    status: i === 0 ? '回流完成' : i === 13 ? '回流失败' : '回流完成',
    source: '全流程监管数据库',
    mode: i % 3 === 0 ? '定期批量回流（月度全量）' : '实时回流 + 定期批量回流',
    dataSummary: {
      totalCases: 45 - i * 2,
      totalClues: clues,
      positiveSamples: pos,
      negativeSamples: neg,
      misjudgmentSamples: mis,
      appealChangedSamples: 32 - i,
      reconsiderationChangedSamples: Math.max(0, 5 - Math.floor(i / 3))
    },
    positiveSamples: POS_SAMPLES,
    negativeSamples: NEG_SAMPLES,
    dataProcessing: {
      deduplication: { before: clues, after: dedup, removed: clues - dedup },
      cleaning: { invalidRecords: rndInt(8, 18), missingFields: rndInt(4, 12), outliers: rndInt(3, 9) },
      annotation: { autoAnnotated: dedup, manualReviewed: mis, annotationRate: 1.0 },
      featureExtraction: { featuresExtracted: 48 - i, featureTypes: [...FEATURE_TYPES] }
    },
    trainingSet: {
      setId: `TRAIN-${y}-${pad(m, 2)}`,
      totalSamples: dedup,
      trainSet: Math.round(dedup * 0.7),
      validationSet: Math.round(dedup * 0.15),
      testSet: dedup - Math.round(dedup * 0.7) - Math.round(dedup * 0.15),
      positiveRatio: Number((pos / clues).toFixed(3)),
      negativeRatio: Number((neg / clues).toFixed(3)),
      version: `v2.${4 - Math.floor(i / 3)}`,
      storagePath: `/models/training/v2.${4 - Math.floor(i / 3)}/`
    },
    dataSecurity: {
      desensitization: true,
      desensitizationFields: ['patientName', 'patientIdCard', 'doctorName', 'phone'],
      encryption: 'AES-256',
      accessControl: ['模型运营组', '算法工程师'],
      auditLog: true
    },
    modelUpdate: {
      currentModelVersion: 'v2.3.1',
      newTrainingSetVersion: 'v2.4',
      nextTrainingDate: d(14),
      expectedImprovement: '准确率+1.5%, 误报率-2%'
    }
  }
})

export const FEEDBACK_BATCH_MAP: Record<string, FeedbackBatch> = Object.fromEntries(
  FEEDBACK_BATCHES.map((b) => [b.feedbackId, b])
)

/** 样本流转桑基图（数据源 → 处理 → 训练集） */
export const SAMPLE_FLOW = {
  nodes: [
    { name: '确认违规线索', tone: 'lime' },
    { name: '申诉改判线索', tone: 'amber' },
    { name: '复议撤销线索', tone: 'red' },
    { name: '误判反馈', tone: 'pink' },
    { name: '去重清洗', tone: 'blue' },
    { name: '自动标注', tone: 'cyan' },
    { name: '人工复核', tone: 'violet' },
    { name: '特征提取', tone: 'blue' },
    { name: '训练集', tone: 'lime' },
    { name: '验证集', tone: 'cyan' },
    { name: '测试集', tone: 'violet' }
  ],
  links: [
    { source: '确认违规线索', target: '去重清洗', value: 1472 },
    { source: '申诉改判线索', target: '去重清洗', value: 32 },
    { source: '复议撤销线索', target: '去重清洗', value: 5 },
    { source: '误判反馈', target: '人工复核', value: 86 },
    { source: '去重清洗', target: '自动标注', value: 1484 },
    { source: '自动标注', target: '特征提取', value: 1484 },
    { source: '人工复核', target: '特征提取', value: 86 },
    { source: '特征提取', target: '训练集', value: 1100 },
    { source: '特征提取', target: '验证集', value: 235 },
    { source: '特征提取', target: '测试集', value: 235 }
  ]
}

/* ==================== 3.3.2 模型优化 ==================== */

export const SUGGESTION_TYPES = ['规则阈值调整', '新增识别规则', '模型参数优化', '误判规则修正'] as const
export const REVIEW_STEP_STATUS = ['已完成', '进行中', '待开始'] as const

export interface OptSuggestion {
  id: string
  type: string
  ruleId?: string
  ruleName: string
  ruleDescription?: string
  currentThreshold?: string
  suggestedThreshold?: string
  currentLogic?: string
  suggestedLogic?: string
  modelId?: string
  modelName?: string
  currentParams?: Record<string, any>
  suggestedParams?: Record<string, any>
  currentAccuracy?: number
  expectedAccuracy?: number
  reason: string
  misjudgmentCount?: number
  misjudgmentRate?: number
  missCount?: number
  missRate?: number
  trendGrowth?: number
  estimatedClueCount?: number
  expectedImprovement?: string
  aiConfidence: number
  priority: string
  implementation: string
  grayRelease: boolean
  /** 人工处置状态 */
  decision: string
  decisionBy: string | null
  decisionTime: string | null
  decisionNote: string | null
}

const SUGGESTIONS_BASE: OptSuggestion[] = [
  {
    id: 'SUG001', type: '规则阈值调整', ruleId: 'RULE-DRUG-003', ruleName: '慢性病开药不超过7日量',
    currentThreshold: '7日量', suggestedThreshold: '7日量（增加代取药场景识别）',
    reason: '本月该规则误报86条，其中32条为家属代取药合并结算场景，误报率6.7%。增加代取药识别逻辑后，预计误报率降至3%以下。',
    misjudgmentCount: 86, misjudgmentRate: 0.067, expectedImprovement: '误报率-3.7%',
    aiConfidence: 92, priority: '高', implementation: '规则引擎配置调整+代取药特征工程', grayRelease: true,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG002', type: '规则阈值调整', ruleId: 'RULE-EXAM-001', ruleName: '无指征检查识别',
    currentThreshold: '诊断与检查关键词匹配度<50%', suggestedThreshold: '诊断与检查关联度<30%（引入临床指南知识库）',
    reason: '当前规则仅基于诊断关键词匹配，漏报率约15%。引入临床指南知识库后，可计算诊断-检查关联度评分，预计召回率提升至85%以上。',
    missCount: 156, missRate: 0.15, expectedImprovement: '召回率+10%',
    aiConfidence: 85, priority: '高', implementation: '引入临床指南知识库+关联度评分模型', grayRelease: true,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG003', type: '新增识别规则', ruleName: '药品回流识别',
    ruleDescription: '识别参保人医保购药后短期内同药品在其他机构大量结算的药品回流行为',
    reason: '本月发现药品回流线索128条，同比增长35%，呈上升趋势，但当前无专门识别规则，依赖人工发现。新增规则后可自动识别。',
    trendGrowth: 0.35, estimatedClueCount: 200,
    aiConfidence: 88, priority: '中', implementation: '新增跨机构购药行为关联规则', grayRelease: false,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG004', type: '模型参数优化', modelId: 'MODEL-CLASSIFY-001', ruleName: '违规类型分类模型',
    modelName: '违规类型分类模型',
    currentParams: { learningRate: 0.001, maxDepth: 8, featureWeights: { amount: 0.2, time: 0.15, dept: 0.15, item: 0.25, patient: 0.25 } },
    suggestedParams: { learningRate: 0.0005, maxDepth: 10, featureWeights: { amount: 0.15, time: 0.1, dept: 0.15, item: 0.3, patient: 0.3 } },
    reason: '基于v2.4训练集交叉验证，调整学习率和树深度后，验证集准确率从89.2%提升至91.5%；增加项目和患者特征权重后，分类F1值提升2.1%。',
    currentAccuracy: 0.892, expectedAccuracy: 0.915,
    aiConfidence: 90, priority: '中', implementation: '模型重训+参数调优', grayRelease: true,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG005', type: '误判规则修正', ruleId: 'RULE-FEE-002', ruleName: '重复收费识别',
    currentLogic: '同一就诊号相同项目编码出现2次及以上',
    suggestedLogic: '同一就诊号相同项目编码出现2次及以上，且排除医嘱明确要求的多次执行项目（如每日换药、每日监测）',
    reason: '本月该规则误报45条，其中28条为医嘱明确要求每日执行的项目（如术后每日换药），被误判为重复收费。增加医嘱排除逻辑后，预计误报率从5.2%降至2%以下。',
    misjudgmentCount: 45, misjudgmentRate: 0.052, expectedImprovement: '误报率-3.2%',
    aiConfidence: 95, priority: '高', implementation: '规则逻辑优化+医嘱数据关联', grayRelease: false,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG006', type: '新增识别规则', ruleName: '低标入院识别（DRG）',
    ruleDescription: '结合 DRG 分组与入院指征，识别不符合住院标准的低标入院行为',
    reason: 'DRG 付费改革推进后，低标入院线索由人工零星发现 18 条，预计实际规模在 150 条以上，需新增规则前置布防。',
    trendGrowth: 0.28, estimatedClueCount: 150,
    aiConfidence: 82, priority: '高', implementation: '接入 DRG 分组结果 + 入院指征知识库', grayRelease: true,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG007', type: '规则阈值调整', ruleId: 'RULE-ADM-004', ruleName: '分解住院识别',
    currentThreshold: '15日内同诊断再入院', suggestedThreshold: '15日内同诊断再入院，且排除计划性分次治疗（如化疗周期）',
    reason: '肿瘤化疗、透析等计划性分次治疗被误判为分解住院，本月误报 22 条，误报率 10.8% 已超阈值。',
    misjudgmentCount: 22, misjudgmentRate: 0.108, expectedImprovement: '误报率-6.5%',
    aiConfidence: 93, priority: '高', implementation: '接入治疗计划数据 + 白名单诊断', grayRelease: false,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  },
  {
    id: 'SUG008', type: '模型参数优化', modelId: 'MODEL-RISK-002', ruleName: '机构风险评分模型',
    modelName: '机构风险评分模型',
    currentParams: { windowDays: 90, decayFactor: 0.85, weights: { history: 0.3, amount: 0.3, frequency: 0.2, credit: 0.2 } },
    suggestedParams: { windowDays: 180, decayFactor: 0.9, weights: { history: 0.35, amount: 0.25, frequency: 0.2, credit: 0.2 } },
    reason: '延长观察窗口至 180 天并提高历史违规权重后，高风险机构命中率由 68% 提升至 79%，可更精准指导任务派发。',
    currentAccuracy: 0.68, expectedAccuracy: 0.79,
    aiConfidence: 86, priority: '中', implementation: '模型重训 + 权重调优', grayRelease: true,
    decision: '待确认', decisionBy: null, decisionTime: null, decisionNote: null
  }
]

export interface OptBatch {
  optimizationId: string
  optimizationType: string
  generateTime: string
  status: string
  source: string
  currentVersion: string
  suggestedVersion: string
  suggestions: OptSuggestion[]
  summary: {
    totalSuggestions: number
    highPriority: number
    mediumPriority: number
    thresholdAdjustment: number
    newRule: number
    modelParamOptimization: number
    ruleFix: number
  }
  reviewProcess: {
    currentStep: string
    steps: { step: number; name: string; status: string; assignee: string; time: string | null; deadline: string | null }[]
  }
}

const REVIEW_FLOW = [
  { name: 'AI生成建议', assignee: 'AI 模型优化引擎' },
  { name: '算法工程师审核', assignee: '算法工程师 李知远' },
  { name: '业务专家确认', assignee: '基金监管处 王承志' },
  { name: '灰度发布', assignee: '模型运营组' },
  { name: '全量生效', assignee: '模型运营组' }
]

resetSeed(20260906)

export const OPT_BATCHES: OptBatch[] = Array.from({ length: 12 }, (_, i) => {
  const mon = 8 - i
  const y = mon > 0 ? 2026 : 2025
  const m = mon > 0 ? mon : mon + 12
  const day = -(i * 30 + 2)
  // 当前批次停在「算法工程师审核」，历史批次已全量生效
  const stepIdx = i === 0 ? 1 : i === 1 ? 2 : 4
  const sugs = (i === 0 ? SUGGESTIONS_BASE : pickMany(SUGGESTIONS_BASE, rndInt(3, 6))).map((s) => ({
    ...s,
    decision: i === 0 ? '待确认' : pick(['已采纳', '已采纳', '已采纳', '已驳回', '需修改']),
    decisionBy: i === 0 ? null : '算法工程师 李知远',
    decisionTime: i === 0 ? null : dt(day + 2, 10, 30),
    decisionNote: i === 0 ? null : pick([
      '建议合理，纳入本次灰度范围',
      '已采纳，需同步补充回归测试用例',
      '业务影响面较大，本期暂缓',
      '需先补充特征工程再上线'
    ])
  }))
  return {
    optimizationId: `OPT2026${pad(m, 2)}${pad(29 - (i % 20), 2)}${pad(i + 1, 4)}`,
    optimizationType: '模型优化建议',
    generateTime: dt(day, 3, 0),
    status: i === 0 ? '待人工确认' : i === 1 ? '灰度发布中' : '已全量生效',
    source: '误判分析+模型表现监控',
    currentVersion: `v2.${3 - Math.floor(i / 4)}.1`,
    suggestedVersion: `v2.${4 - Math.floor(i / 4)}.0`,
    suggestions: sugs,
    summary: {
      totalSuggestions: sugs.length,
      highPriority: sugs.filter((s) => s.priority === '高').length,
      mediumPriority: sugs.filter((s) => s.priority === '中').length,
      thresholdAdjustment: sugs.filter((s) => s.type === '规则阈值调整').length,
      newRule: sugs.filter((s) => s.type === '新增识别规则').length,
      modelParamOptimization: sugs.filter((s) => s.type === '模型参数优化').length,
      ruleFix: sugs.filter((s) => s.type === '误判规则修正').length
    },
    reviewProcess: {
      currentStep: REVIEW_FLOW[Math.min(stepIdx, 4)].name,
      steps: REVIEW_FLOW.map((f, j) => ({
        step: j + 1,
        name: f.name,
        status: j < stepIdx ? '已完成' : j === stepIdx ? '进行中' : '待开始',
        assignee: f.assignee,
        time: j < stepIdx ? dt(day + j, 3 + j * 4, 0) : null,
        deadline: j >= stepIdx ? d(day + 2 + j * 3) : null
      }))
    }
  }
})

export const OPT_BATCH_MAP: Record<string, OptBatch> = Object.fromEntries(
  OPT_BATCHES.map((b) => [b.optimizationId, b])
)

/** 模型版本管理 */
export const VERSION_MANAGEMENT = {
  currentVersion: 'v2.3.1',
  releaseDate: '2026-07-01',
  rollbackSupported: true,
  grayVersion: 'v2.4.0-gray',
  grayTraffic: 20,
  grayStartDate: d(-6),
  historyVersions: [
    { version: 'v2.4.0', date: d(6), accuracy: 0.915, falsePositiveRate: 0.042, changes: '代取药场景识别+医嘱排除逻辑+临床指南关联度', status: '灰度中', trafficRatio: 20 },
    { version: 'v2.3.1', date: '2026-07-01', accuracy: 0.892, falsePositiveRate: 0.068, changes: '优化过度诊疗识别逻辑', status: '当前版本', trafficRatio: 80 },
    { version: 'v2.3.0', date: '2026-05-15', accuracy: 0.885, falsePositiveRate: 0.075, changes: '新增串换药品识别规则', status: '历史版本', trafficRatio: 0 },
    { version: 'v2.2.0', date: '2026-03-01', accuracy: 0.872, falsePositiveRate: 0.082, changes: '模型架构升级', status: '历史版本', trafficRatio: 0 },
    { version: 'v2.1.0', date: '2026-01-10', accuracy: 0.861, falsePositiveRate: 0.091, changes: '特征工程扩展至 42 维', status: '历史版本', trafficRatio: 0 },
    { version: 'v2.0.0', date: '2025-11-01', accuracy: 0.848, falsePositiveRate: 0.103, changes: '首个多模型融合版本', status: '历史版本', trafficRatio: 0 }
  ]
}

/** 模型清单 */
export const MODEL_LIST = [
  { modelId: 'MODEL-CLASSIFY-001', name: '违规类型分类模型', type: '分类模型', accuracy: 0.892, version: 'v2.3.1', role: '将疑点线索归类到 8 类违规类型', status: '运行中' },
  { modelId: 'MODEL-RISK-002', name: '机构风险评分模型', type: '回归模型', accuracy: 0.68, version: 'v1.8.2', role: '输出机构风险分，指导任务派发优先级', status: '运行中' },
  { modelId: 'MODEL-JUDGE-003', name: '线索研判建议模型', type: '分类模型', accuracy: 0.906, version: 'v2.1.0', role: '给出立案/排除/待补充证据的研判建议', status: '运行中' },
  { modelId: 'MODEL-AMOUNT-004', name: '违规金额核算模型', type: '回归模型', accuracy: 0.938, version: 'v1.5.0', role: '自动核算违规金额与涉及基金金额', status: '运行中' },
  { modelId: 'MODEL-DOC-005', name: '文书撰写生成模型', type: '生成模型', accuracy: 0.924, version: 'v1.2.0', role: 'AI 撰写文书五段正文', status: '运行中' },
  { modelId: 'MODEL-EDU-006', name: '宣教素材生成模型', type: '生成模型', accuracy: 0.911, version: 'education-v1.2', role: '生成脱敏典型案例与合规提示素材', status: '运行中' }
]

/** 规则清单 */
export const RULE_LIST = [
  { ruleId: 'RULE-DRUG-003', name: '慢性病开药不超过7日量', type: '阈值规则', fpr: 0.067, status: '待优化' },
  { ruleId: 'RULE-EXAM-001', name: '无指征检查识别', type: '匹配规则', fpr: 0.082, status: '待优化' },
  { ruleId: 'RULE-FEE-002', name: '重复收费识别', type: '逻辑规则', fpr: 0.052, status: '待优化' },
  { ruleId: 'RULE-ADM-004', name: '分解住院识别', type: '时序规则', fpr: 0.108, status: '待优化' },
  { ruleId: 'RULE-SWAP-005', name: '串换药品识别', type: '关联规则', fpr: 0.065, status: '正常' },
  { ruleId: 'RULE-FAKE-006', name: '虚假诊疗识别', type: '关联规则', fpr: 0.095, status: '正常' },
  { ruleId: 'RULE-BACK-007', name: '药品回流识别', type: '关联规则', fpr: 0, status: '待上线' },
  { ruleId: 'RULE-DRG-008', name: '低标入院识别（DRG）', type: '组合规则', fpr: 0, status: '待上线' }
]

/* ==================== 3.3.3 准确率监控 ==================== */

export const METRIC_STATUS = ['优秀', '良好', '待改进'] as const
export const ALERT_STATUS = ['接近阈值', '略超阈值', '严重超标'] as const

export const MONITOR = {
  monitorId: 'MON202608290001',
  monitorType: '模型准确率监控',
  monitorTime: dt(0, 4, 0),
  modelVersion: 'v2.3.1',
  monitorPeriod: '2026年8月',
  status: '监控正常',
  nextEvaluation: '2026-09-30（月度全量评估）',
  reportUrl: '/monitor/MON202608290001.pdf',
  thresholds: { accuracy: 0.85, falsePositiveRate: 0.10 },

  overallMetrics: {
    accuracy: 0.892, precision: 0.912, recall: 0.856, f1Score: 0.883,
    falsePositiveRate: 0.068, falseNegativeRate: 0.144, auc: 0.935,
    sampleCount: 2881, positiveCount: 1472, negativeCount: 1409
  },

  confusionMatrix: {
    truePositive: 1260, falsePositive: 122, falseNegative: 212, trueNegative: 1287
  },

  byViolationType: [
    { type: '重复收费', accuracy: 0.945, precision: 0.962, recall: 0.928, f1: 0.945, fpr: 0.038, sampleCount: 452, status: '优秀' },
    { type: '超量开药', accuracy: 0.933, precision: 0.948, recall: 0.918, f1: 0.933, fpr: 0.052, sampleCount: 568, status: '优秀' },
    { type: '串换药品', accuracy: 0.918, precision: 0.935, recall: 0.901, f1: 0.918, fpr: 0.065, sampleCount: 185, status: '良好' },
    { type: '无指征收费', accuracy: 0.902, precision: 0.918, recall: 0.885, f1: 0.901, fpr: 0.082, sampleCount: 256, status: '良好' },
    { type: '虚假诊疗', accuracy: 0.886, precision: 0.905, recall: 0.865, f1: 0.885, fpr: 0.095, sampleCount: 89, status: '良好' },
    { type: '分解住院', accuracy: 0.872, precision: 0.892, recall: 0.850, f1: 0.871, fpr: 0.108, sampleCount: 45, status: '待改进' },
    { type: '其他', accuracy: 0.865, precision: 0.882, recall: 0.848, f1: 0.865, fpr: 0.118, sampleCount: 965, status: '待改进' },
    { type: '过度诊疗', accuracy: 0.852, precision: 0.878, recall: 0.825, f1: 0.851, fpr: 0.118, sampleCount: 321, status: '待改进' }
  ],

  byOrgType: [
    { type: '三级医院', accuracy: 0.912, fpr: 0.058, sampleCount: 245 },
    { type: '零售药店', accuracy: 0.905, fpr: 0.065, sampleCount: 785 },
    { type: '二级医院', accuracy: 0.898, fpr: 0.072, sampleCount: 328 },
    { type: '一级医院', accuracy: 0.885, fpr: 0.085, sampleCount: 286 },
    { type: '社区卫生服务中心', accuracy: 0.862, fpr: 0.108, sampleCount: 312 },
    { type: '诊所/卫生院', accuracy: 0.858, fpr: 0.115, sampleCount: 100 }
  ],

  byArea: [
    { area: '市本级', accuracy: 0.908, fpr: 0.062, sampleCount: 515 },
    { area: '镜湖区', accuracy: 0.898, fpr: 0.068, sampleCount: 342 },
    { area: '鸠江区', accuracy: 0.895, fpr: 0.072, sampleCount: 312 },
    { area: '弋江区', accuracy: 0.888, fpr: 0.078, sampleCount: 285 },
    { area: '湾沚区', accuracy: 0.885, fpr: 0.081, sampleCount: 268 },
    { area: '繁昌区', accuracy: 0.882, fpr: 0.085, sampleCount: 221 },
    { area: '南陵县', accuracy: 0.878, fpr: 0.088, sampleCount: 198 },
    { area: '无为市', accuracy: 0.876, fpr: 0.090, sampleCount: 240 }
  ],

  trend: {
    xAxis: ['3月', '4月', '5月', '6月', '7月', '8月'],
    accuracy: [0.872, 0.878, 0.885, 0.888, 0.890, 0.892],
    precision: [0.895, 0.900, 0.905, 0.908, 0.910, 0.912],
    recall: [0.832, 0.840, 0.848, 0.852, 0.854, 0.856],
    f1Score: [0.862, 0.869, 0.876, 0.879, 0.881, 0.883],
    fpr: [0.082, 0.078, 0.075, 0.072, 0.070, 0.068]
  },

  confidenceDistribution: [
    { range: '0-30%', count: 85, ratio: 0.030, accuracy: 0.52 },
    { range: '30-50%', count: 215, ratio: 0.075, accuracy: 0.68 },
    { range: '50-70%', count: 528, ratio: 0.183, accuracy: 0.82 },
    { range: '70-90%', count: 1256, ratio: 0.436, accuracy: 0.91 },
    { range: '90-100%', count: 797, ratio: 0.277, accuracy: 0.97 }
  ],

  /** ROC 曲线（用于可视化） */
  rocCurve: [
    { fpr: 0, tpr: 0 }, { fpr: 0.02, tpr: 0.28 }, { fpr: 0.04, tpr: 0.48 },
    { fpr: 0.068, tpr: 0.652 }, { fpr: 0.10, tpr: 0.756 }, { fpr: 0.15, tpr: 0.842 },
    { fpr: 0.22, tpr: 0.896 }, { fpr: 0.32, tpr: 0.935 }, { fpr: 0.48, tpr: 0.964 },
    { fpr: 0.68, tpr: 0.984 }, { fpr: 0.85, tpr: 0.995 }, { fpr: 1, tpr: 1 }
  ],

  /** PR 曲线 */
  prCurve: [
    { recall: 0, precision: 1 }, { recall: 0.15, precision: 0.985 }, { recall: 0.32, precision: 0.968 },
    { recall: 0.52, precision: 0.945 }, { recall: 0.68, precision: 0.928 }, { recall: 0.856, precision: 0.912 },
    { recall: 0.92, precision: 0.862 }, { recall: 0.96, precision: 0.788 }, { recall: 1, precision: 0.652 }
  ],

  alerts: [
    { alertId: 'ALT001', type: '指标预警', level: '中', metric: '过度诊疗识别准确率', value: 0.852, threshold: 0.85, status: '接近阈值', message: '过度诊疗识别准确率85.2%，接近85%预警阈值，建议关注', suggestion: '引入临床专家评估机制，优化过度诊疗认定标准', time: dt(0, 4, 5), handled: false },
    { alertId: 'ALT002', type: '指标预警', level: '低', metric: '分解住院误报率', value: 0.108, threshold: 0.10, status: '略超阈值', message: '分解住院误报率10.8%，略超10%阈值', suggestion: '优化分解住院识别规则，增加DRG分组关联分析', time: dt(0, 4, 5), handled: false },
    { alertId: 'ALT003', type: '指标预警', level: '低', metric: '其他类误报率', value: 0.118, threshold: 0.10, status: '略超阈值', message: '「其他」类违规误报率11.8%，超出阈值1.8个百分点', suggestion: '细化「其他」类违规子类型，拆分为独立规则', time: dt(-1, 4, 5), handled: true },
    { alertId: 'ALT004', type: '指标预警', level: '低', metric: '诊所/卫生院准确率', value: 0.858, threshold: 0.85, status: '接近阈值', message: '诊所/卫生院场景准确率85.8%，样本量偏少（100条）', suggestion: '扩充基层机构训练样本，单独调优基层场景模型', time: dt(-2, 4, 5), handled: true }
  ],

  modelComparison: [
    { version: 'v2.4.0', accuracy: 0.915, f1: 0.906, fpr: 0.042, releaseDate: d(6), status: '灰度中' },
    { version: 'v2.3.1', accuracy: 0.892, f1: 0.883, fpr: 0.068, releaseDate: '2026-07-01', status: '当前版本' },
    { version: 'v2.3.0', accuracy: 0.885, f1: 0.876, fpr: 0.075, releaseDate: '2026-05-15', status: '历史版本' },
    { version: 'v2.2.0', accuracy: 0.872, f1: 0.862, fpr: 0.082, releaseDate: '2026-03-01', status: '历史版本' }
  ]
}

/* ==================== 3.4.1 宣教素材生成 ==================== */

export const MATERIAL_TYPES = [
  '典型案例', '合规要点', '政策解读', '防骗提示', '就医指引', '业务培训', '监管动态', '政策科普'
] as const
export const MATERIAL_STATUS = ['草稿', '待审核', '审核中', '已驳回', '已发布'] as const
export const AUDIENCES = ['医院端', '医保端', '公众端'] as const
export const MATERIAL_FORMATS = ['图文', '图文+H5', 'H5', '长图', '短视频脚本'] as const

export const MATERIAL_TYPE_META: Record<string, { prefix: string; tone: string; icon: string; audience: string[] }> = {
  典型案例: { prefix: '【典型案例】', tone: 'red', icon: 'WarnTriangleFilled', audience: ['医院端', '医保端', '公众端'] },
  合规要点: { prefix: '【合规指引】', tone: 'blue', icon: 'Checked', audience: ['医院端'] },
  政策解读: { prefix: '【政策解读】', tone: 'violet', icon: 'Reading', audience: ['医院端', '医保端'] },
  防骗提示: { prefix: '【防骗提示】', tone: 'amber', icon: 'Bell', audience: ['公众端'] },
  就医指引: { prefix: '【就医指引】', tone: 'cyan', icon: 'FirstAidKit', audience: ['公众端'] },
  业务培训: { prefix: '【业务培训】', tone: 'lime', icon: 'School', audience: ['医保端'] },
  监管动态: { prefix: '【监管动态】', tone: 'pink', icon: 'TrendCharts', audience: ['医保端'] },
  政策科普: { prefix: '【政策科普】', tone: 'cyan', icon: 'Guide', audience: ['公众端'] }
}

const MATERIAL_TITLES: Record<string, string[]> = {
  典型案例: [
    '串换药品骗医保，药店被解除协议并罚款',
    '虚假住院骗医保，医院被处罚款280万',
    '过度诊疗被查实，社区中心整改并退回基金',
    '重复收费百余笔，三级医院被约谈并追回',
    '虚构购药记录，药店负责人被移送公安'
  ],
  合规要点: [
    '定点医药机构医保合规管理十项要点',
    '零售药店进销存管理与医保结算合规指引',
    '住院病历书写与医保结算合规要点',
    '医保目录范围内结算的十个禁区'
  ],
  政策解读: [
    '《医疗保障基金使用监督管理条例实施细则》重点解读',
    '医保个人账户家庭共济怎么用？一文读懂',
    'DRG 付费下医疗机构结算行为规范解读',
    '医保定点协议管理办法修订要点解读'
  ],
  防骗提示: [
    '医保卡千万别这样用！这些行为涉嫌违法',
    '医保卡借给家人用？这些后果你必须知道',
    '有人高价收购药品？小心成为骗保帮凶',
    '"免费体检送药品"套路揭秘，别让医保卡被盗刷'
  ],
  就医指引: [
    '医保就医购药全攻略，一文读懂',
    '异地就医备案怎么办？三步搞定',
    '门诊慢特病待遇如何申请？流程详解'
  ],
  业务培训: [
    '过度诊疗认定标准与证据规范',
    '行政处罚文书制作规范与常见错误',
    '证据固化与电子数据取证实务'
  ],
  监管动态: [
    '2026年8月全市医保监管态势分析',
    '零售药店串换药品专项整治阶段成效',
    '本季度重点违规类型与查处情况通报'
  ],
  政策科普: [
    "医保基金是老百姓的'看病钱'，这些红线不能碰",
    '一分钟看懂医保报销比例怎么算',
    '医保基金监管：人人都是守护者'
  ]
}

export interface EduMaterial {
  materialId: string
  materialType: string
  materialName: string
  generateTime: string
  generateMode: string
  status: string
  audience: string[]
  desensitization: {
    applied: boolean
    originalOrgName: string
    displayOrgName: string
    originalPersonNames: string[]
    displayPersonNames: string[]
    sensitiveInfoRemoved: string[]
  }
  content: {
    title: string
    summary: string
    caseBackground?: string
    violationFacts?: string[]
    evidence?: string[]
    handlingResult?: { recovery: string; penalty: string; agreement: string; transfer: string }
    legalBasis?: string
    caseWarning?: string[]
    complianceTips?: string[]
  }
  format: {
    type: string
    wordCount: number
    images: number
    h5Url: string | null
    longImageUrl: string | null
    videoScript: string | null
  }
  review: {
    aiGenerated: boolean
    aiVersion: string
    reviewer: string | null
    reviewTime: string | null
    reviewOpinion: string | null
    modifications: { original: string; modified: string; reason: string }[]
  }
  publishInfo: {
    publishTime: string | null
    publisher: string | null
    channels: string[]
    status: string
  }
  tags: string[]
  relatedCases: string[]
  /** 效果指标 */
  stats: { read: number; likes: number; shares: number; comments: number; favorites: number; score: number }
}

const CASE_CONTENT = {
  summary:
    '芜湖某零售药店通过将生活用品、保健品串换为医保目录药品结算、虚构购药记录等方式，骗取医保基金5.6万元，被医保部门责令退回基金、处3倍罚款16.8万元，并解除医保定点服务协议。',
  caseBackground:
    '2026年5月，医保智能监管系统在数据比对中发现，芜湖某零售药店医保结算药品数量与进销存库存数量严重不符，部分结算药品无进货记录，系统自动生成高风险疑点线索。',
  violationFacts: [
    '2026年3月至5月，将生活用品、保健品串换为阿莫西林、降压药等医保目录药品结算，涉及金额3.2万元',
    '虚构参保人购药记录并刷卡结算，涉及金额2.4万元',
    '上述行为合计骗取医保基金5.6万元'
  ],
  evidence: [
    '医保结算明细数据', '药店药品进销存台账', '现场检查笔录及照片',
    '药店法定代表人及店员询问笔录', '参保人员陈述材料', 'POS机销售记录'
  ],
  handlingResult: {
    recovery: '责令退回骗取的医保基金5.6万元',
    penalty: '处骗取金额3倍罚款，计16.8万元',
    agreement: '解除医保定点零售药店服务协议',
    transfer: '涉嫌犯罪线索移送公安机关'
  },
  legalBasis:
    '《医疗保障基金使用监督管理条例》第四十条第一款第（一）项：定点医药机构通过虚构医药服务项目等方式骗取医疗保障基金支出的，由医疗保障行政部门责令退回，处骗取金额2倍以上5倍以下的罚款。',
  caseWarning: [
    '串换药品是药店常见违规手段，看似"变通经营"，实则涉嫌骗取医保基金，性质严重',
    '智能监管系统通过进销存数据与结算数据比对，能够精准发现账实不符问题，违规行为难以隐藏',
    '定点医药机构应严格遵守医保协议，一旦被解除协议，将失去医保结算资格，经营影响巨大'
  ],
  complianceTips: [
    '建立健全药品进销存管理制度，确保账实相符',
    '严格按照医保目录范围结算，不得串换药品、项目',
    '不得为参保人员套取医保基金提供便利',
    '加强员工医保政策培训，提升合规意识'
  ]
}

const EDU_CHANNELS = [
  '医保局官网', '微信公众号', '机构端APP', '公众端H5', '支付宝生活号',
  '机构端APP站内消息', '机构端H5页面', '医保工作群', '医保监管系统站内消息', '邮件', '短信'
]

resetSeed(20260907)

export const EDU_MATERIALS: EduMaterial[] = Array.from({ length: 68 }, (_, i) => {
  const type = MATERIAL_TYPES[i % MATERIAL_TYPES.length]
  const meta = MATERIAL_TYPE_META[type]
  const titles = MATERIAL_TITLES[type]
  const rawTitle = titles[i % titles.length]
  const mon = 8 - (i % 6)
  const day = -(i * 2 + 1)
  const isCase = type === '典型案例'
  const status = i < 46 ? '已发布' : i < 56 ? '待审核' : i < 62 ? '审核中' : i < 65 ? '草稿' : '已驳回'
  const published = status === '已发布'
  const read = published ? rndInt(8000, 58000) : 0
  const fmt = isCase ? '图文+H5' : pick([...MATERIAL_FORMATS])

  return {
    materialId: `MAT2026${pad(mon, 2)}${pad(28 - (i % 24), 2)}${pad(i + 1, 4)}`,
    materialType: type,
    materialName: isCase ? `芜湖某${i % 2 ? '零售药店' : '医疗机构'}${rawTitle.split('，')[0]}案` : rawTitle,
    generateTime: dt(day, 10, 0),
    generateMode: 'AI生成+人工审核',
    status,
    audience: meta.audience,
    desensitization: {
      applied: true,
      originalOrgName: i % 2 ? '芜湖仁和大药房（镜湖店）' : '芜湖广济医院',
      displayOrgName: i % 2 ? '芜湖某零售药店' : '芜湖某医院',
      originalPersonNames: [pick(['陈明', '王丽', '李强', '张涛'])],
      displayPersonNames: [pick(['陈某', '王某', '李某', '张某'])],
      sensitiveInfoRemoved: ['详细地址', '联系方式', '身份证号']
    },
    content: {
      title: meta.prefix + rawTitle,
      summary: isCase ? CASE_CONTENT.summary : `${rawTitle}——${type === '合规要点' ? '面向定点医药机构的合规管理要点解读，帮助机构守住医保结算红线。' : type === '政策解读' ? '逐条解读政策要点与执行口径，明确机构与参保人的权利义务。' : type === '防骗提示' ? '揭示常见骗保套路与法律后果，提醒参保人守好自己的医保卡。' : type === '就医指引' ? '梳理办理流程与所需材料，让参保人少跑腿、办得快。' : type === '业务培训' ? '结合真实案例讲透认定标准与证据规范，提升一线办案能力。' : type === '监管动态' ? '汇总本期监管态势与查处成效，明确下阶段重点方向。' : '用通俗语言讲清医保基金的来源与用途，凝聚共同守护共识。'}`,
      ...(isCase ? {
        caseBackground: CASE_CONTENT.caseBackground,
        violationFacts: CASE_CONTENT.violationFacts,
        evidence: CASE_CONTENT.evidence,
        handlingResult: CASE_CONTENT.handlingResult,
        legalBasis: CASE_CONTENT.legalBasis,
        caseWarning: CASE_CONTENT.caseWarning,
        complianceTips: CASE_CONTENT.complianceTips
      } : {
        complianceTips: [
          '严格按照医保政策规定开展业务，不触碰结算红线',
          '定期开展内部自查，发现问题及时整改',
          '加强人员培训，把合规要求落到岗到人'
        ]
      })
    },
    format: {
      type: fmt,
      wordCount: rndInt(680, 1800),
      images: rndInt(1, 6),
      h5Url: fmt.includes('H5') ? `https://yibao.wuhu.gov.cn/education/${type === '典型案例' ? 'case' : 'guide'}/2026${pad(mon, 2)}${pad(i + 1, 4)}` : null,
      longImageUrl: fmt === '长图' || isCase ? `/education/MAT2026${pad(mon, 2)}${pad(i + 1, 4)}_long.jpg` : null,
      videoScript: fmt === '短视频脚本' ? `/education/MAT2026${pad(mon, 2)}${pad(i + 1, 4)}_script.docx` : null
    },
    review: {
      aiGenerated: true,
      aiVersion: 'education-v1.2',
      reviewer: status === '草稿' ? null : '宣传科 张岚',
      reviewTime: status === '草稿' ? null : dt(day, 14, 0),
      reviewOpinion: published ? '案例事实清楚、警示到位、脱敏合规，同意发布。' : status === '已驳回' ? '脱敏不彻底，机构特征仍可识别，退回修改。' : null,
      modifications: [
        { original: i % 2 ? '芜湖仁和大药房（镜湖店）' : '芜湖广济医院', modified: i % 2 ? '芜湖某零售药店' : '芜湖某医院', reason: '脱敏处理' },
        { original: '详细地址', modified: '已删除', reason: '保护机构隐私' }
      ]
    },
    publishInfo: {
      publishTime: published ? dt(day, 15, 0) : null,
      publisher: published ? '宣传科 张岚' : null,
      channels: published ? pickMany(EDU_CHANNELS, rndInt(3, 5)) : [],
      status
    },
    tags: isCase
      ? ['串换药品', '药店违规', '欺诈骗保', '解除协议', '警示教育']
      : pickMany(['合规管理', '政策解读', '医保目录', '防骗', '就医指引', 'DRG', '进销存', '培训'], rndInt(3, 5)),
    relatedCases: i > 2 ? [`MAT2026${pad(mon, 2)}${pad(15, 2)}${pad(i - 1, 4)}`, `MAT2026${pad(mon, 2)}${pad(20, 2)}${pad(i - 2, 4)}`] : [],
    stats: {
      read,
      likes: published ? Math.round(read * (0.08 + rnd() * 0.04)) : 0,
      shares: published ? Math.round(read * (0.05 + rnd() * 0.04)) : 0,
      comments: published ? Math.round(read * (0.008 + rnd() * 0.012)) : 0,
      favorites: published ? Math.round(read * (0.03 + rnd() * 0.03)) : 0,
      score: published ? Number((4.2 + rnd() * 0.6).toFixed(1)) : 0
    }
  }
})

export const EDU_MATERIAL_MAP: Record<string, EduMaterial> = Object.fromEntries(
  EDU_MATERIALS.map((m) => [m.materialId, m])
)

/* ==================== 3.4.2 多端分类推送 ==================== */

export const PUSH_ENDS = [
  {
    end: '医院端', icon: 'OfficeBuilding', tone: 'blue', targetCount: 1558,
    targetScope: '全市定点医药机构',
    contentTypes: ['合规管理指引', '政策解读', '违规警示', '整改要求'],
    materialTypes: ['典型案例', '合规要点', '政策解读'],
    channels: ['机构端APP站内消息', '机构端H5页面', '医保工作群'],
    filter: '机构类型=定点医药机构'
  },
  {
    end: '医保端', icon: 'Suitcase', tone: 'violet', targetCount: 86,
    targetScope: '全市医保监管人员',
    contentTypes: ['监管动态', '业务培训', '典型案例', '政策文件'],
    materialTypes: ['典型案例', '业务培训', '监管动态'],
    channels: ['医保监管系统站内消息', '医保监管工作群', '邮件'],
    filter: '角色=医保监管人员'
  },
  {
    end: '公众端', icon: 'User', tone: 'cyan', targetCount: 520000,
    targetScope: '关注医保局公众号的参保人员（约52万）',
    contentTypes: ['政策科普', '就医指引', '防骗提示', '维权渠道'],
    materialTypes: ['防骗提示', '就医指引', '政策科普'],
    channels: ['微信公众号', '支付宝生活号', '医保局官网', '公众端H5'],
    filter: '角色=参保人员'
  }
] as const

export interface PushTargetDetail {
  end: string
  targetCount: number | string
  targetScope: string
  content: { materialId: string; title: string; type: string; priority: string }[]
  pushChannels: string[]
  pushTime: string
  pushStatus: string
  successCount: number
  failCount: number
  readCount: number
  readRate: number
  likeCount?: number
  shareCount?: number
  commentCount?: number
}

export interface PushRecord {
  pushId: string
  pushType: string
  pushName: string
  createTime: string
  status: string
  creator: string
  materials: string[]
  targets: PushTargetDetail[]
  pushStrategy: {
    type: string
    personalization: boolean
    interestTags: string[]
    timing: string
    rules: { end: string; filter: string; contentType: string[] }[]
  }
  summary: {
    totalTargets: number
    totalSuccess: number
    totalFail: number
    successRate: number
    totalRead: number
    overallReadRate: number
  }
}

resetSeed(20260908)

export const PUSH_RECORDS: PushRecord[] = Array.from({ length: 46 }, (_, i) => {
  const mon = 8 - (i % 6)
  const day = -(i * 3 + 1)
  const status = i < 38 ? '推送完成' : i < 42 ? '推送中' : '待推送'
  const done = status === '推送完成'

  const targets: PushTargetDetail[] = PUSH_ENDS.map((pe, j) => {
    // PUSH_ENDS 用 as const 声明，materialTypes 为只读元组，需展开为 string[] 才能与任意字符串比对
    const wantTypes: string[] = [...pe.materialTypes]
    const mats = EDU_MATERIALS
      .filter((m) => m.status === '已发布' && wantTypes.includes(m.materialType))
      .slice(i % 4, (i % 4) + 3)
    const succ = pe.end === '公众端' ? 520000 - rndInt(600, 1600) : pe.targetCount
    const rate = pe.end === '医院端' ? 0.78 + rnd() * 0.08 : pe.end === '医保端' ? 0.86 + rnd() * 0.08 : 0.26 + rnd() * 0.08
    const readCount = Math.round(succ * rate)
    return {
      end: pe.end,
      targetCount: pe.end === '公众端' ? '全市参保人员' : pe.targetCount,
      targetScope: pe.targetScope,
      content: mats.map((m) => ({
        materialId: m.materialId,
        title: m.content.title,
        type: m.materialType,
        priority: m.materialType === '典型案例' || m.materialType === '防骗提示' ? '高' : pick(['高', '中'])
      })),
      pushChannels: [...pe.channels],
      pushTime: dt(day, 15 + j, pick([0, 30])),
      pushStatus: done ? '已推送' : status === '推送中' ? (j === 0 ? '已推送' : '推送中') : '待推送',
      successCount: done ? succ : status === '推送中' && j === 0 ? succ : 0,
      failCount: done && pe.end === '公众端' ? rndInt(800, 1600) : 0,
      readCount: done ? readCount : 0,
      readRate: done ? Number(rate.toFixed(3)) : 0,
      ...(pe.end === '公众端' && done ? {
        likeCount: Math.round(readCount * 0.08),
        shareCount: Math.round(readCount * 0.055),
        commentCount: Math.round(readCount * 0.008)
      } : {})
    }
  })

  const totalTargets = 1558 + 86 + 520000
  const totalSuccess = targets.reduce((s, t) => s + t.successCount, 0)
  const totalFail = targets.reduce((s, t) => s + t.failCount, 0)
  const totalRead = targets.reduce((s, t) => s + t.readCount, 0)

  return {
    pushId: `PUSH2026${pad(mon, 2)}${pad(29 - (i % 24), 2)}${pad(i + 1, 4)}`,
    pushType: '多端分类推送',
    pushName: `2026年${mon}月${pick(['医保监管典型案例', '合规提示与政策解读', '防骗宣传专题', '业务培训素材', '监管态势通报'])}推送`,
    createTime: dt(day, 15, 0),
    status,
    creator: '宣传科 张岚',
    materials: targets.flatMap((t) => t.content.map((c) => c.materialId)).slice(0, 6),
    targets,
    pushStrategy: {
      type: '分类精准推送',
      personalization: true,
      interestTags: ['串换药品', '过度诊疗', '欺诈骗保', '合规管理'],
      timing: '工作日15:00-17:00推送（阅读高峰）',
      rules: PUSH_ENDS.map((pe) => ({ end: pe.end, filter: pe.filter, contentType: [...pe.materialTypes] }))
    },
    summary: {
      totalTargets,
      totalSuccess,
      totalFail,
      successRate: totalSuccess ? Number((totalSuccess / (totalSuccess + totalFail)).toFixed(4)) : 0,
      totalRead,
      overallReadRate: totalSuccess ? Number((totalRead / totalSuccess).toFixed(3)) : 0
    }
  }
})

export const PUSH_RECORD_MAP: Record<string, PushRecord> = Object.fromEntries(
  PUSH_RECORDS.map((p) => [p.pushId, p])
)

export const SCHEDULED_PUSHES = [
  { id: 'SCH001', name: '每周合规提醒', schedule: '每周一上午10:00', cron: '0 10 * * 1', target: '医院端', materialType: '合规要点', status: '已启用', lastRun: dt(-2, 10, 0), nextRun: dt(5, 10, 0), runCount: 34 },
  { id: 'SCH002', name: '每月监管动态', schedule: '每月5日上午10:00', cron: '0 10 5 * *', target: '医保端', materialType: '监管动态', status: '已启用', lastRun: dt(-26, 10, 0), nextRun: dt(4, 10, 0), runCount: 8 },
  { id: 'SCH003', name: '医保政策科普', schedule: '每周三、五下午16:00', cron: '0 16 * * 3,5', target: '公众端', materialType: '政策科普', status: '已启用', lastRun: dt(-1, 16, 0), nextRun: dt(2, 16, 0), runCount: 68 },
  { id: 'SCH004', name: '典型案例警示', schedule: '每月20日下午15:00', cron: '0 15 20 * *', target: '医院端', materialType: '典型案例', status: '已启用', lastRun: dt(-11, 15, 0), nextRun: dt(19, 15, 0), runCount: 8 },
  { id: 'SCH005', name: '季度业务培训', schedule: '每季度首月10日上午9:00', cron: '0 9 10 1,4,7,10 *', target: '医保端', materialType: '业务培训', status: '已停用', lastRun: dt(-52, 9, 0), nextRun: null, runCount: 3 }
]

/* ==================== 3.4.3 宣教效果统计 ==================== */

export const EDU_STATS = {
  statsId: 'EDUSTAT202608290001',
  statsPeriod: '2026年8月',
  generateTime: dt(0, 18, 0),
  reportUrl: '/education/EDUSTAT202608290001.pdf',

  overall: {
    totalMaterials: 45, totalPushes: 128, totalTarget: 2560000, totalDelivered: 2556000,
    deliveryRate: 0.9984, totalRead: 685000, overallReadRate: 0.268,
    totalLikes: 52000, totalShares: 36000, totalComments: 8500, totalFavorites: 28000,
    avgReadTime: '3分25秒'
  },

  byMaterialType: [
    { type: '典型案例', count: 12, pushes: 36, read: 185000, readRate: 0.312, likes: 18500, shares: 12500, avgScore: 4.6 },
    { type: '政策解读', count: 10, pushes: 28, read: 156000, readRate: 0.298, likes: 12000, shares: 8500, avgScore: 4.5 },
    { type: '防骗提示', count: 8, pushes: 24, read: 142000, readRate: 0.256, likes: 8500, shares: 6800, avgScore: 4.3 },
    { type: '合规要点', count: 8, pushes: 24, read: 125000, readRate: 0.285, likes: 9800, shares: 6500, avgScore: 4.4 },
    { type: '就医指引', count: 5, pushes: 12, read: 52000, readRate: 0.225, likes: 2200, shares: 1200, avgScore: 4.2 },
    { type: '业务培训', count: 2, pushes: 4, read: 25000, readRate: 0.85, likes: 1000, shares: 500, avgScore: 4.7 }
  ],

  byEnd: [
    { end: '医院端', target: 1558, delivered: 1558, read: 1285, readRate: 0.825, learningCompletion: 0.75, examPassRate: 0.92 },
    { end: '医保端', target: 86, delivered: 86, read: 78, readRate: 0.907, learningCompletion: 0.88, examPassRate: 0.95 },
    { end: '公众端', target: 2558356, delivered: 2554356, read: 683637, readRate: 0.267, learningCompletion: null, examPassRate: null }
  ],

  hotMaterialsTOP10: [
    { rank: 1, id: 'MAT202608150001', title: '【典型案例】虚假住院骗医保，医院被处罚款280万', type: '典型案例', read: 58000, likes: 6500, shares: 4200, score: 4.8 },
    { rank: 2, id: 'MAT202608200002', title: '【防骗提示】医保卡借给家人用？这些后果你必须知道', type: '防骗提示', read: 45000, likes: 4200, shares: 3800, score: 4.6 },
    { rank: 3, id: 'MAT202608100003', title: '【政策解读】医保个人账户家庭共济怎么用？一文读懂', type: '政策解读', read: 38000, likes: 3500, shares: 2800, score: 4.5 },
    { rank: 4, id: 'MAT202608290001', title: '【典型案例】串换药品骗医保，药店被解除协议并罚款', type: '典型案例', read: 32000, likes: 3200, shares: 2500, score: 4.6 },
    { rank: 5, id: 'MAT202608050004', title: '【合规指引】定点医疗机构医保合规管理十项要点', type: '合规要点', read: 28000, likes: 2800, shares: 1800, score: 4.4 },
    { rank: 6, id: 'MAT202608120005', title: "【政策科普】医保基金是老百姓的'看病钱'，这些红线不能碰", type: '政策科普', read: 26500, likes: 2600, shares: 2100, score: 4.5 },
    { rank: 7, id: 'MAT202608180006', title: '【防骗提示】有人高价收购药品？小心成为骗保帮凶', type: '防骗提示', read: 24200, likes: 2350, shares: 1950, score: 4.4 },
    { rank: 8, id: 'MAT202608080007', title: '【政策解读】DRG 付费下医疗机构结算行为规范解读', type: '政策解读', read: 21800, likes: 1980, shares: 1420, score: 4.5 },
    { rank: 9, id: 'MAT202608220008', title: '【典型案例】过度诊疗被查实，社区中心整改并退回基金', type: '典型案例', read: 19600, likes: 1860, shares: 1280, score: 4.3 },
    { rank: 10, id: 'MAT202608250009', title: '【就医指引】异地就医备案怎么办？三步搞定', type: '就医指引', read: 16400, likes: 1120, shares: 860, score: 4.2 }
  ],

  learningStats: {
    totalCourses: 8, totalLearners: 1644, completedLearners: 1233, completionRate: 0.75, avgStudyTime: '45分钟',
    examStats: { totalExaminees: 1100, passCount: 1012, passRate: 0.92, avgScore: 86.5, excellentRate: 0.35 },
    byOrgType: [
      { type: '三级医院', learners: 89, completion: 0.82, passRate: 0.96 },
      { type: '二级医院', learners: 156, completion: 0.78, passRate: 0.94 },
      { type: '社区卫生服务中心', learners: 186, completion: 0.72, passRate: 0.90 },
      { type: '零售药店', learners: 1127, completion: 0.73, passRate: 0.91 },
      { type: '诊所/卫生院', learners: 86, completion: 0.68, passRate: 0.88 }
    ],
    courses: [
      { name: '医保基金使用监督管理条例精讲', learners: 1644, completion: 0.82, duration: '45分钟' },
      { name: '定点医药机构合规管理实务', learners: 1558, completion: 0.78, duration: '60分钟' },
      { name: '医保目录与结算规范', learners: 1420, completion: 0.75, duration: '40分钟' },
      { name: '药店进销存管理与合规结算', learners: 986, completion: 0.71, duration: '35分钟' },
      { name: 'DRG 付费下的结算行为规范', learners: 640, completion: 0.68, duration: '50分钟' },
      { name: '过度诊疗认定标准与证据规范', learners: 86, completion: 0.88, duration: '55分钟' },
      { name: '行政处罚文书制作规范', learners: 86, completion: 0.85, duration: '45分钟' },
      { name: '证据固化与电子数据取证实务', learners: 86, completion: 0.83, duration: '50分钟' }
    ]
  },

  trend: {
    xAxis: ['3月', '4月', '5月', '6月', '7月', '8月'],
    pushCount: [85, 92, 105, 112, 120, 128],
    readCount: [380000, 420000, 485000, 550000, 620000, 685000],
    readRate: [0.215, 0.228, 0.242, 0.255, 0.262, 0.268],
    completionRate: [0.62, 0.65, 0.68, 0.71, 0.73, 0.75]
  },

  /** 渠道效果对比 */
  byChannel: [
    { channel: '微信公众号', push: 42, delivered: 1980000, read: 528000, readRate: 0.267 },
    { channel: '公众端H5', push: 38, delivered: 420000, read: 118000, readRate: 0.281 },
    { channel: '机构端APP', push: 36, delivered: 56088, read: 46280, readRate: 0.825 },
    { channel: '支付宝生活号', push: 24, delivered: 96000, read: 21600, readRate: 0.225 },
    { channel: '医保局官网', push: 28, delivered: 42000, read: 8820, readRate: 0.210 },
    { channel: '医保监管系统', push: 32, delivered: 2752, read: 2496, readRate: 0.907 },
    { channel: '短信', push: 12, delivered: 18000, read: 5040, readRate: 0.280 }
  ],

  /** 受众偏好（词云/柱） */
  audiencePreference: [
    { tag: '欺诈骗保案例', weight: 96 }, { tag: '医保卡使用禁区', weight: 88 },
    { tag: '家庭共济', weight: 82 }, { tag: '异地就医', weight: 76 },
    { tag: '报销比例', weight: 72 }, { tag: '门诊慢特病', weight: 65 },
    { tag: '药店合规', weight: 62 }, { tag: 'DRG 付费', weight: 55 },
    { tag: '进销存管理', weight: 48 }, { tag: '维权渠道', weight: 42 },
    { tag: '过度诊疗', weight: 58 }, { tag: '证据规范', weight: 36 }
  ],

  effectEvaluation: {
    overallEffect: '良好',
    score: 88,
    highlights: [
      '典型案例类阅读率最高（31.2%），警示效果好',
      '医保端学习完成率达 88%，业务培训成效明显',
      '整体阅读率从 21.5% 提升至 26.8%，稳步上行',
      '机构合规培训考试通过率 92%，合规意识显著增强'
    ],
    improvements: [
      '公众端阅读率偏低（26.7%），需优化标题和推送时间',
      '就医指引类阅读率最低（22.5%），需改进内容形式',
      '社区中心学习完成率偏低（72%），需加强督促',
      '部分素材互动性不足，可增加问答、测试等互动形式'
    ],
    suggestions: [
      '优化公众端推送标题，采用疑问式、场景式表达提升点击率',
      '增加短视频、漫画等可视化素材形式，降低阅读门槛',
      '建立机构学习督促机制，学习完成率纳入协议考核',
      '增加素材互动环节（问答、测试、投票），提升参与感',
      '根据受众偏好标签精准推送个性化内容，提高匹配度'
    ]
  }
}

/* ==================== 汇总统计 ==================== */

export const PROMOTE_STATS = {
  /* 3.3 */
  feedbackTotal: FEEDBACK_BATCHES.length,
  feedbackSuccess: FEEDBACK_BATCHES.filter((b) => b.status === '回流完成').length,
  sampleTotal: FEEDBACK_BATCHES[0].dataSummary.totalClues,
  positiveTotal: FEEDBACK_BATCHES[0].dataSummary.positiveSamples,
  negativeTotal: FEEDBACK_BATCHES[0].dataSummary.negativeSamples,
  misjudgmentTotal: FEEDBACK_BATCHES[0].dataSummary.misjudgmentSamples,
  optBatchTotal: OPT_BATCHES.length,
  suggestionTotal: OPT_BATCHES.reduce((s, b) => s + b.suggestions.length, 0),
  pendingSuggestions: OPT_BATCHES[0].suggestions.filter((s) => s.decision === '待确认').length,
  adoptedSuggestions: OPT_BATCHES.flatMap((b) => b.suggestions).filter((s) => s.decision === '已采纳').length,
  modelTotal: MODEL_LIST.length,
  ruleTotal: RULE_LIST.length,
  ruleToOptimize: RULE_LIST.filter((r) => r.status === '待优化').length,
  currentAccuracy: MONITOR.overallMetrics.accuracy,
  currentFpr: MONITOR.overallMetrics.falsePositiveRate,
  alertTotal: MONITOR.alerts.length,
  alertUnhandled: MONITOR.alerts.filter((a) => !a.handled).length,
  versionTotal: VERSION_MANAGEMENT.historyVersions.length,

  /* 3.4 */
  materialTotal: EDU_MATERIALS.length,
  materialPublished: EDU_MATERIALS.filter((m) => m.status === '已发布').length,
  materialPending: EDU_MATERIALS.filter((m) => m.status === '待审核' || m.status === '审核中').length,
  materialTypeDist: MATERIAL_TYPES.map((t) => ({
    name: t,
    value: EDU_MATERIALS.filter((m) => m.materialType === t).length,
    tone: MATERIAL_TYPE_META[t].tone
  })),
  pushTotal: PUSH_RECORDS.length,
  pushDone: PUSH_RECORDS.filter((p) => p.status === '推送完成').length,
  scheduledTotal: SCHEDULED_PUSHES.length,
  scheduledEnabled: SCHEDULED_PUSHES.filter((s) => s.status === '已启用').length,
  totalRead: EDU_STATS.overall.totalRead,
  overallReadRate: EDU_STATS.overall.overallReadRate,
  learningCompletionRate: EDU_STATS.learningStats.completionRate,
  examPassRate: EDU_STATS.learningStats.examStats.passRate,
  effectScore: EDU_STATS.effectEvaluation.score
}
