/**
 * 专项任务数据 —— 全平台任务口径唯一来源
 * 与线索库、机构、人员等共享数据集保持口径一致
 */
import {
  ORGS, AUDITORS, AUDIT_GROUPS, DISTRICTS, DEPTS,
  resetSeed, rnd, rndInt, pick, pickMany, pad, dt, d
} from './base'

/* ============ 类型定义 ============ */

export interface TaskClueRef {
  clueId: string
  violationType: string
  dept: string
  riskLevel: string
  amount: number
}

export interface TaskDraft {
  draftId: string
  groupId: string
  groupName: string
  clusterDim: Record<string, string>
  clueCount: number
  orgCount: number
  totalSuspectedAmount: number
  riskDistribution: Record<string, number>
  suggestedTaskType: string
  taskElements: {
    taskName: string
    taskType: string
    inspectOrg: string
    inspectScope: { orgs: string[]; depts: string[]; timeRange: string; violationTypes: string[] }
    clueList: TaskClueRef[]
    totalClueCount: number
    totalSuspectedAmount: number
    timeLimit: { deadline: string; workdays: number; selfCheckDeadline: string; inspectionDeadline: string }
    recommendedGroup: { groupId: string; groupName: string; leader: string; members: string[]; specialty: string[]; jurisdiction: string }
    inspectMethod: string
    priority: string
  }
  dedupeInfo: {
    beforeCount: number
    afterCount: number
    mergedCount: number
    mergeRecords: { mergeId: string; keptClueId: string; mergedClueIds: string[]; mergeType: string; mergeReason: string; mergedAmount: number; keptAmount: number }[]
  }
}

export interface Task {
  taskId: string
  taskName: string
  taskType: string
  status: string
  riskLevel: string
  priority: string
  inspectOrg: string
  orgCode: string
  orgType: string
  district: string
  depts: string[]
  clueCount: number
  totalSuspectedAmount: number
  confirmedAmount: number
  assigneeGroup: string
  assigneeMembers: string[]
  leader: string
  dispatchType: string
  dispatchTime: string
  signTime: string
  selfCheckTime: string
  inspectionTime: string
  appealTime: string
  resultTime: string
  closeTime: string
  deadline: string
  workdays: number
  progress: number
  slaStatus: string
  createTime: string
  creator: string
}

export interface DispatchRecord {
  dispatchId: string
  dispatchTime: string
  dispatchType: string
  operator: string
  tasks: { taskId: string; taskName: string; taskType: string; riskLevel: string; assigneeGroup: string; assigneeMembers: string[]; leader: string; noticeOrg: boolean; orgContact: string }[]
}

export interface TaskStats {
  total: number
  byStatus: { status: string; count: number }[]
  byType: { type: string; count: number }[]
  byRisk: { risk: string; count: number }[]
  bySla: { status: string; count: number }[]
  monthTrend: { month: string; created: number; closed: number }[]
  topOrgs: { orgName: string; count: number; amount: number }[]
}

/* ============ 任务草稿（聚类结果） ============ */
resetSeed(50001)

const TASK_TYPES = ['日常稽核', '专项检查', '飞行检查', '联合督查']
const TASK_STATUS = ['草稿', '待派发', '已派发', '已签收', '自查中', '核查中', '申诉中', '结果确认中', '已结案']
const SLA_STATUS = ['正常', '临期', '超期']
const PRIORITY = ['高', '中', '低']
const INSPECT_METHODS = ['线上自查为主', '线上+现场结合', '现场检查为主']

const DRAFT_GROUPS = [
  {
    groupId: 'GRP001',
    groupName: '芜湖市第一医院-多疑点合并检查',
    dim: { org: '芜湖市第一医院', violationType: '混合' },
    orgCount: 1, clueCount: 12, totalAmount: 28500, riskDist: { 高: 3, 中: 6, 低: 3 },
    suggestedType: '日常稽核',
    depts: ['内分泌科', '心血管内科', '骨科'],
    violations: ['超量开药', '重复收费', '过度诊疗', '无指征收费']
  },
  {
    groupId: 'GRP002',
    groupName: '芜湖市区药店-超量开药专项检查',
    dim: { region: '芜湖市', orgType: '药店', violationType: '超量开药' },
    orgCount: 12, clueCount: 45, totalAmount: 56000, riskDist: { 高: 8, 中: 25, 低: 12 },
    suggestedType: '专项检查',
    depts: ['全科'], violations: ['超量开药']
  },
  {
    groupId: 'GRP003',
    groupName: '皖南医学院弋矶山医院-虚假诊疗高风险专项',
    dim: { org: '皖南医学院弋矶山医院', violationType: '虚假诊疗', riskLevel: '高' },
    orgCount: 1, clueCount: 5, totalAmount: 85000, riskDist: { 高: 5, 中: 0, 低: 0 },
    suggestedType: '飞行检查',
    depts: ['呼吸内科', '心血管内科', '肿瘤科'],
    violations: ['虚假诊疗', '过度诊疗']
  },
  {
    groupId: 'GRP004',
    groupName: '芜湖市重复收费疑点联合督查',
    dim: { region: '芜湖市', violationType: '重复收费' },
    orgCount: 6, clueCount: 38, totalAmount: 42000, riskDist: { 高: 6, 中: 18, 低: 14 },
    suggestedType: '联合督查',
    depts: ['骨科', '普外科', '妇产科', '眼科'],
    violations: ['重复收费', '超标准收费', '分解收费']
  },
  {
    groupId: 'GRP005',
    groupName: '芜湖市第二医院-过度诊疗线索核查',
    dim: { org: '芜湖市第二医院', violationType: '过度诊疗' },
    orgCount: 1, clueCount: 8, totalAmount: 18600, riskDist: { 高: 2, 中: 4, 低: 2 },
    suggestedType: '日常稽核',
    depts: ['心血管内科', '神经内科'],
    violations: ['过度诊疗', '套餐式检查']
  },
  {
    groupId: 'GRP006',
    groupName: '南陵县-基层医疗机构进销存不符专项',
    dim: { region: '南陵县', violationType: '进销存不符' },
    orgCount: 8, clueCount: 24, totalAmount: 12800, riskDist: { 高: 1, 中: 9, 低: 14 },
    suggestedType: '专项检查',
    depts: ['药剂科'], violations: ['进销存不符', '账实不符']
  }
]

function genDedupInfo(before: number) {
  const merged = rndInt(1, Math.max(1, Math.floor(before / 3)))
  const after = before - merged
  const records: any[] = []
  for (let i = 0; i < merged; i++) {
    const keptAmount = rndInt(100, 5000)
    const mergeTypes = ['完全重复', '部分交叉', '费用重叠']
    records.push({
      mergeId: `MRG${pad(i + 1, 3)}`,
      keptClueId: `CL20260829${pad(rndInt(1, 800), 5)}`,
      mergedClueIds: [1, 2].map(() => `CL20260829${pad(rndInt(1, 800), 5)}`),
      mergeType: pick(mergeTypes),
      mergeReason: pick([
        '同一参保人、同一就诊日期、同一违规类型，涉及同一批结算费用',
        '两条线索均涉及同一机构同一科室同批人次，费用明细交叉重叠',
        '同一费用明细被多条规则同时命中，合并后保留置信度最高一条'
      ]),
      mergedAmount: rndInt(100, 3000),
      keptAmount: keptAmount
    })
  }
  return { beforeCount: before, afterCount: after, mergedCount: merged, mergeRecords: records }
}

/** 生成任务草稿列表 */
export function genDrafts(): TaskDraft[] {
  return DRAFT_GROUPS.map((g, i) => {
    const dimOrg = (g.dim as any).org as string | undefined
    const org = dimOrg ? (ORGS.find((o) => o.orgName === dimOrg) || ORGS[0]) : pick(ORGS)
    const clueList: TaskClueRef[] = []
    for (let c = 0; c < Math.min(g.clueCount, 5); c++) {
      clueList.push({
        clueId: `CL20260829${pad(rndInt(1, 800), 5)}`,
        violationType: pick(g.violations),
        dept: pick(g.depts),
        riskLevel: pick(['高', '中', '低']),
        amount: rndInt(50, 10000)
      })
    }
    const dedup = genDedupInfo(g.clueCount)
    const deadline = dt(22, 0, 0)
    return {
      draftId: `TD20260830${pad(i + 1, 3)}`,
      groupId: g.groupId,
      groupName: g.groupName,
      clusterDim: g.dim as unknown as Record<string, string>,
      clueCount: g.clueCount,
      orgCount: g.orgCount,
      totalSuspectedAmount: g.totalAmount,
      riskDistribution: g.riskDist,
      suggestedTaskType: g.suggestedType,
      taskElements: {
        taskName: g.groupName + '任务',
        taskType: g.suggestedType,
        inspectOrg: org.orgName,
        inspectScope: {
          orgs: [org.orgName],
          depts: g.depts,
          timeRange: '2026-08-01 至 2026-08-31',
          violationTypes: g.violations
        },
        clueList,
        totalClueCount: dedup.afterCount,
        totalSuspectedAmount: g.totalAmount,
        timeLimit: {
          deadline: deadline,
          workdays: g.suggestedType === '日常稽核' ? 15 : g.suggestedType === '专项检查' ? 30 : g.suggestedType === '飞行检查' ? 7 : 45,
          selfCheckDeadline: d(6),
          inspectionDeadline: d(12)
        },
        recommendedGroup: {
          groupId: 'GRP-JH-01',
          groupName: '稽核一组',
          leader: '王组长',
          members: ['稽核员A', '稽核员B', '稽核员C'],
          specialty: ['医院监管', '用药核查'],
          jurisdiction: '芜湖市镜湖区、弋江区'
        },
        inspectMethod: pick(INSPECT_METHODS),
        priority: g.riskDist['高'] > 3 ? '高' : g.riskDist['高'] > 0 ? '中' : '低'
      },
      dedupeInfo: dedup
    }
  })
}

export const TASK_DRAFTS = genDrafts()

/* ============ 已立项任务列表 ============ */
resetSeed(50002)

function genTasks(count: number): Task[] {
  const tasks: Task[] = []
  for (let i = 0; i < count; i++) {
    const org = pick(ORGS)
    const taskType = pick(TASK_TYPES)
    const status = pick(TASK_STATUS)
    const risk = pick(PRIORITY)
    const clueCount = rndInt(3, 30)
    const amount = rndInt(5000, 200000)
    const progress = status === '草稿' ? 0 : status === '待派发' ? 10 : status === '已派发' ? 20 : status === '已签收' ? 30 : status === '自查中' ? rndInt(35, 55) : status === '核查中' ? rndInt(56, 75) : status === '申诉中' ? rndInt(76, 85) : status === '结果确认中' ? rndInt(86, 95) : 100
    const sla = status === '已结案' ? '正常' : pick(SLA_STATUS)
    const taskId = `TASK202608${pad(i + 1, 3)}`
    tasks.push({
      taskId,
      taskName: `${org.orgName}${pick(['2026年8月违规疑点', '2026年8月进销存专项', '虚假诊疗飞行检查', '重复收费联合督查'])}${pick(['日常稽核', '检查', '督查'])}`,
      taskType,
      status,
      riskLevel: risk,
      priority: risk,
      inspectOrg: org.orgName,
      orgCode: org.orgCode,
      orgType: org.orgType,
      district: org.district,
      depts: pickMany(DEPTS, rndInt(1, 4)),
      clueCount,
      totalSuspectedAmount: amount,
      confirmedAmount: status === '已结案' || status === '结果确认中' ? Math.round(amount * rnd() * 0.7) : 0,
      assigneeGroup: pick(AUDIT_GROUPS),
      assigneeMembers: pickMany(AUDITORS, rndInt(2, 4)),
      leader: pick(AUDITORS),
      dispatchType: pick(['批量派发', '定向派发', '分级派发']),
      dispatchTime: status === '草稿' || status === '待派发' ? '' : dt(-rndInt(1, 14), rndInt(8, 17), 0),
      signTime: status === '已派发' || status === '草稿' || status === '待派发' ? '' : dt(-rndInt(1, 12), rndInt(8, 17), 0),
      selfCheckTime: ['自查中', '核查中', '申诉中', '结果确认中', '已结案'].includes(status) ? dt(-rndInt(1, 8), rndInt(8, 17), 0) : '',
      inspectionTime: ['核查中', '申诉中', '结果确认中', '已结案'].includes(status) ? dt(-rndInt(1, 6), rndInt(8, 17), 0) : '',
      appealTime: ['申诉中', '结果确认中', '已结案'].includes(status) ? dt(-rndInt(1, 4), rndInt(8, 17), 0) : '',
      resultTime: (status === '已结案' || status === '结果确认中') ? dt(-rndInt(1, 2), rndInt(8, 17), 0) : '',
      closeTime: status === '已结案' ? dt(0, rndInt(8, 17), 0) : '',
      deadline: dt(rndInt(7, 45), 18, 0),
      workdays: taskType === '日常稽核' ? 15 : taskType === '专项检查' ? 30 : taskType === '飞行检查' ? 7 : 45,
      progress,
      slaStatus: sla,
      createTime: dt(-rndInt(1, 20), rndInt(8, 17), 0),
      creator: pick(AUDITORS)
    })
  }
  return tasks
}

export const TASKS = genTasks(30)

/* ============ 派发记录 ============ */
export const DISPATCH_RECORDS: DispatchRecord[] = [
  {
    dispatchId: 'DIS202608300001',
    dispatchTime: dt(-2, 9, 0),
    dispatchType: '批量派发',
    operator: '王组长',
    tasks: [
      { taskId: 'TASK202608001', taskName: '芜湖市第一医院2026年8月违规疑点日常稽核任务', taskType: '日常稽核', riskLevel: '高', assigneeGroup: '稽核一组', assigneeMembers: ['稽核员A', '稽核员B'], leader: '王组长', noticeOrg: true, orgContact: '芜湖市第一医院 医保办 张主任 0553-12345678' },
      { taskId: 'TASK202608002', taskName: '皖南医学院弋矶山医院虚假诊疗高风险飞行检查', taskType: '飞行检查', riskLevel: '高', assigneeGroup: '稽核二组', assigneeMembers: ['稽核员D', '稽核员E'], leader: '李组长', noticeOrg: false, orgContact: '' }
    ]
  },
  {
    dispatchId: 'DIS202608300002',
    dispatchTime: dt(-1, 14, 0),
    dispatchType: '定向派发',
    operator: '王组长',
    tasks: [
      { taskId: 'TASK202608003', taskName: '芜湖市区药店超量开药专项检查', taskType: '专项检查', riskLevel: '中', assigneeGroup: '稽核三组', assigneeMembers: ['稽核员F', '稽核员G'], leader: '赵组长', noticeOrg: true, orgContact: '芜湖益丰大药房 质管部 李经理 0553-87654321' }
    ]
  }
]

/* ============ 统计数据 ============ */
export const TASK_STATS: TaskStats = {
  total: 30,
  byStatus: [
    { status: '草稿', count: 3 }, { status: '待派发', count: 4 }, { status: '已派发', count: 2 },
    { status: '已签收', count: 3 }, { status: '自查中', count: 5 }, { status: '核查中', count: 6 },
    { status: '申诉中', count: 2 }, { status: '结果确认中', count: 3 }, { status: '已结案', count: 2 }
  ],
  byType: [
    { type: '日常稽核', count: 12 }, { type: '专项检查', count: 10 },
    { type: '飞行检查', count: 5 }, { type: '联合督查', count: 3 }
  ],
  byRisk: [
    { risk: '高', count: 8 }, { risk: '中', count: 14 }, { risk: '低', count: 8 }
  ],
  bySla: [
    { status: '正常', count: 20 }, { status: '临期', count: 6 }, { status: '超期', count: 4 }
  ],
  monthTrend: [
    { month: '2026-03', created: 8, closed: 5 },
    { month: '2026-04', created: 12, closed: 8 },
    { month: '2026-05', created: 15, closed: 10 },
    { month: '2026-06', created: 20, closed: 14 },
    { month: '2026-07', created: 18, closed: 16 },
    { month: '2026-08', created: 22, closed: 12 }
  ],
  topOrgs: [
    { orgName: '芜湖市第一人民医院', count: 4, amount: 28500 },
    { orgName: '皖南医学院弋矶山医院', count: 3, amount: 85000 },
    { orgName: '芜湖市第二人民医院', count: 3, amount: 18600 },
    { orgName: '芜湖益丰大药房（中山路店）', count: 2, amount: 5600 },
    { orgName: '芜湖市中医医院', count: 2, amount: 12400 }
  ]
}

/* ============ 任务类型配置 ============ */
export const TASK_TYPE_CONFIGS = [
  { typeCode: 'SPECIAL', typeName: '专项检查', description: '针对特定违规类型或领域开展的集中性检查', defaultDays: 30, needPlan: true, approvalLevel: '处长审批', documentTemplates: ['专项检查方案', '检查通知书', '检查记录单', '询问笔录', '证据清单', '整改意见书'] },
  { typeCode: 'DAILY', typeName: '日常稽核', description: '常规性、计划性的日常监督检查', defaultDays: 15, needPlan: false, approvalLevel: '科长审批', documentTemplates: ['检查通知书', '检查记录单', '询问笔录', '证据清单'] },
  { typeCode: 'FLIGHT', typeName: '飞行检查', description: '不预先告知的突击性检查，针对高风险线索', defaultDays: 7, needPlan: true, approvalLevel: '局长审批', documentTemplates: ['飞行检查方案', '检查通知书', '现场检查记录', '询问笔录', '证据清单', '查封扣押文书'] },
  { typeCode: 'JOINT', typeName: '联合督查', description: '医保、卫健、公安、市监等多部门联合开展的督查', defaultDays: 45, needPlan: true, approvalLevel: '局领导班子审批', documentTemplates: ['联合督查方案', '联合检查通知书', '检查记录单', '询问笔录', '证据清单', '案件移送函', '整改意见书'] }
]

/* ============ 任务结果 ============ */
export interface TaskResult {
  taskId: string
  taskName: string
  resultId: string
  generateTime: string
  status: '待复核' | '已复核' | '已推送'
  summary: {
    orgName: string
    taskType: string
    inspectPeriod: string
    inspectors: string[]
    totalClueCount: number
    confirmedViolations: number
    confirmedAmount: number
    recoveredAmount: number
    appealCount: number
    appealAmount: number
  }
  violations: { no: number; violationType: string; description: string; amount: number; evidenceCount: number; status: string }[]
  opinion: string
  aiSuggestion: string
  reviewer: string
  reviewTime: string
  pushTime: string
}

export const TASK_RESULTS: TaskResult[] = [
  {
    taskId: 'TASK202608001',
    taskName: '芜湖市第一医院2026年8月违规疑点日常稽核任务',
    resultId: 'RES20260830001',
    generateTime: dt(-1, 10, 30),
    status: '已推送',
    summary: {
      orgName: '芜湖市第一医院',
      taskType: '日常稽核',
      inspectPeriod: '2026-08-01 至 2026-08-31',
      inspectors: ['稽核员A', '稽核员B'],
      totalClueCount: 9,
      confirmedViolations: 6,
      confirmedAmount: 22800,
      recoveredAmount: 18240,
      appealCount: 1,
      appealAmount: 3200
    },
    violations: [
      { no: 1, violationType: '超量开药', description: '内分泌科医师李建国为患者张伟民开具格列美脲片60片（7日量），超出慢性病门诊处方7日用量规定', amount: 180, evidenceCount: 3, status: '确认违规' },
      { no: 2, violationType: '重复收费', description: '骨科同一住院期间，静脉输液费用重复收取2次，涉及患者6人次', amount: 3600, evidenceCount: 5, status: '确认违规' },
      { no: 3, violationType: '过度诊疗', description: '心血管内科对无指征患者开展冠脉CTA检查28人次', amount: 8400, evidenceCount: 4, status: '确认违规' },
      { no: 4, violationType: '重复收费', description: '住院期间常规护理费按日重复收取，涉及12人次', amount: 2400, evidenceCount: 2, status: '确认违规' },
      { no: 5, violationType: '超标准收费', description: '门诊诊查费按副主任医师标准收取，实际为主治医师接诊', amount: 420, evidenceCount: 3, status: '确认违规' },
      { no: 6, violationType: '无指征收费', description: '对38名门诊患者常规开展超敏C反应蛋白检测，无相关诊疗指征', amount: 7800, evidenceCount: 4, status: '申诉中' }
    ],
    opinion: '经线上核查与现场核查，确认芜湖市第一医院2026年8月期间存在超量开药、重复收费、过度诊疗、超标准收费、无指征收费等违规行为，涉及违规金额22,800元。依据《医疗保障基金使用监督管理条例》及医保服务协议约定，建议追回违规基金18,240元（扣减待申诉确认部分3,200元），并约谈分管院领导，要求限期整改。',
    aiSuggestion: 'AI建议：违规事实清晰、证据链完整，建议按协议处理条款追回违规基金。其中第6项无指征收费（7,800元）被检机构已提出申诉，建议暂缓追回，待申诉复核确认后再行处理。',
    reviewer: '王组长',
    reviewTime: dt(-1, 16, 0),
    pushTime: dt(0, 8, 30)
  },
  {
    taskId: 'TASK202608002',
    taskName: '皖南医学院弋矶山医院虚假诊疗高风险飞行检查',
    resultId: 'RES20260830002',
    generateTime: dt(0, 9, 15),
    status: '待复核',
    summary: {
      orgName: '皖南医学院弋矶山医院',
      taskType: '飞行检查',
      inspectPeriod: '2026-08-28 至 2026-08-30',
      inspectors: ['稽核员D', '稽核员E'],
      totalClueCount: 5,
      confirmedViolations: 4,
      confirmedAmount: 62500,
      recoveredAmount: 0,
      appealCount: 0,
      appealAmount: 0
    },
    violations: [
      { no: 1, violationType: '虚假诊疗', description: '虚构住院患者血液透析治疗记录，涉及3名患者、12人次', amount: 36000, evidenceCount: 6, status: '确认违规' },
      { no: 2, violationType: '虚假诊疗', description: '未实际开展康复治疗，凭空生成康复理疗记录及费用', amount: 18000, evidenceCount: 4, status: '确认违规' },
      { no: 3, violationType: '过度诊疗', description: '对住院患者常规开展基因检测，无临床指征', amount: 6400, evidenceCount: 3, status: '确认违规' },
      { no: 4, violationType: '虚假诊疗', description: '虚构抢救记录并收取抢救费用', amount: 2100, evidenceCount: 2, status: '确认违规' }
    ],
    opinion: 'AI已自动生成初步检查结果，待人工复核确认后推送。',
    aiSuggestion: 'AI建议：虚假诊疗情节严重，涉嫌欺诈骗保，建议移送公安部门进一步侦查。',
    reviewer: '',
    reviewTime: '',
    pushTime: ''
  }
]