/**
 * 看板统计数据 —— 与线索库口径一致
 */
import { CLUES } from './clues'
import { ORGS, RULES, resetSeed, rnd, rndInt, pick, dt } from './base'

/* ============ M01 数据比对看板 ============ */
export const COMPARE_OVERVIEW = {
  totalAnomaly: 2856,
  high: 342,
  mid: 1024,
  low: 1490,
  totalAmount: 1568000,
  transferredClue: 1842,
  transferRate: 64.5,
  taskRunning: 3,
  taskDone: 27,
  dataSourceCount: 8,
  lastRunTime: '2026-08-29 06:00:00',
  byCompareType: [
    { name: '药品进销存比对', count: 856, amount: 420000, high: 118, mid: 302, low: 436 },
    { name: '病历结算比对', count: 624, amount: 380000, high: 86, mid: 224, low: 314 },
    { name: '处方结算比对', count: 512, amount: 210000, high: 52, mid: 186, low: 274 },
    { name: '检查检验比对', count: 432, amount: 320000, high: 48, mid: 162, low: 222 },
    { name: '就医行为比对', count: 432, amount: 238000, high: 38, mid: 150, low: 244 }
  ],
  trend: [
    { date: '2026-08-23', count: 180, amount: 95000 },
    { date: '2026-08-24', count: 210, amount: 110000 },
    { date: '2026-08-25', count: 195, amount: 102000 },
    { date: '2026-08-26', count: 230, amount: 125000 },
    { date: '2026-08-27', count: 245, amount: 135000 },
    { date: '2026-08-28', count: 260, amount: 142000 },
    { date: '2026-08-29', count: 280, amount: 155000 }
  ],
  byDistrict: [
    { name: '镜湖区', count: 862, amount: 486000 },
    { name: '鸠江区', count: 624, amount: 342000 },
    { name: '弋江区', count: 508, amount: 286000 },
    { name: '湾沚区', count: 262, amount: 148000 },
    { name: '繁昌区', count: 236, amount: 126000 },
    { name: '南陵县', count: 210, amount: 104000 },
    { name: '无为市', count: 154, amount: 76000 }
  ],
  topOrgs: [
    { orgName: '芜湖市第一人民医院', orgType: '三级医院', count: 186, amount: 128600, high: 32 },
    { orgName: '皖南医学院弋矶山医院', orgType: '三级医院', count: 164, amount: 116200, high: 28 },
    { orgName: '芜湖市第二人民医院', orgType: '三级医院', count: 142, amount: 98400, high: 24 },
    { orgName: '皖南医学院第二附属医院', orgType: '三级医院', count: 128, amount: 86800, high: 21 },
    { orgName: '芜湖市中医医院', orgType: '三级医院', count: 116, amount: 76400, high: 18 },
    { orgName: '芜湖益丰大药房（中山路店）', orgType: '零售药店', count: 92, amount: 42600, high: 16 },
    { orgName: '芜湖市第五人民医院', orgType: '二级医院', count: 86, amount: 38200, high: 12 },
    { orgName: '芜湖国胜大药房（银湖路店）', orgType: '零售药店', count: 78, amount: 32400, high: 11 },
    { orgName: '芜湖老百姓大药房（步行街店）', orgType: '零售药店', count: 72, amount: 28600, high: 9 },
    { orgName: '芜湖广济医院', orgType: '二级医院', count: 64, amount: 24800, high: 8 }
  ],
  dataSources: [
    { name: '医保结算数据', code: 'SETTLE', todayCount: 45230, freq: '实时（2秒）', status: '正常', lastUpdate: '2026-08-29 08:29:58', quality: 99.6 },
    { name: '处方流转数据', code: 'RX', todayCount: 12850, freq: '准实时（30秒）', status: '正常', lastUpdate: '2026-08-29 08:29:32', quality: 98.9 },
    { name: '电子病历数据', code: 'EMR', todayCount: 8920, freq: '准实时（1分钟）', status: '正常', lastUpdate: '2026-08-29 08:29:05', quality: 97.2 },
    { name: '药品进销存数据', code: 'INV', todayCount: 6480, freq: '日批（T+1）', status: '正常', lastUpdate: '2026-08-29 02:15:00', quality: 96.4 },
    { name: '检查检验数据（LIS）', code: 'LIS', todayCount: 15620, freq: '准实时（1分钟）', status: '正常', lastUpdate: '2026-08-29 08:28:47', quality: 98.1 },
    { name: '医保药品目录', code: 'DRUG_DIR', todayCount: 0, freq: '月更', status: '正常', lastUpdate: '2026-08-28 18:00:00', quality: 100 },
    { name: '定点机构基础信息', code: 'ORG', todayCount: 0, freq: '日批（T+1）', status: '正常', lastUpdate: '2026-08-29 01:30:00', quality: 100 },
    { name: '参保人信息', code: 'INSURED', todayCount: 320, freq: '日批（T+1）', status: '延迟', lastUpdate: '2026-08-28 23:50:00', quality: 94.8 }
  ]
}

/* ============ 比对任务列表 ============ */
resetSeed(99009)
export const COMPARE_TASKS = [
  { taskId: 'CMP20260829001', taskName: '全市处方-结算全量比对（日批）', compareType: '处方结算比对', scope: '全市 60 家定点机构', startTime: '2026-08-29 06:00:00', endTime: '2026-08-29 06:42:18', duration: '42分18秒', dataVolume: 458620, anomalyCount: 512, status: '已完成', progress: 100, creator: '系统调度' },
  { taskId: 'CMP20260829002', taskName: '药品进销存差异比对（日批）', compareType: '药品进销存比对', scope: '全市 32 家零售药店', startTime: '2026-08-29 06:00:00', endTime: '2026-08-29 07:15:32', duration: '1时15分32秒', dataVolume: 286400, anomalyCount: 856, status: '已完成', progress: 100, creator: '系统调度' },
  { taskId: 'CMP20260829003', taskName: '病历-结算一致性比对（日批）', compareType: '病历结算比对', scope: '全市 28 家医疗机构', startTime: '2026-08-29 07:00:00', endTime: '2026-08-29 08:06:44', duration: '1时6分44秒', dataVolume: 192480, anomalyCount: 624, status: '已完成', progress: 100, creator: '系统调度' },
  { taskId: 'CMP20260829004', taskName: '检查检验项目比对（日批）', compareType: '检查检验比对', scope: '全市 28 家医疗机构', startTime: '2026-08-29 08:00:00', endTime: '', duration: '进行中', dataVolume: 156200, anomalyCount: 318, status: '进行中', progress: 72, creator: '系统调度' },
  { taskId: 'CMP20260829005', taskName: '参保人就医行为画像比对', compareType: '就医行为比对', scope: '全市 42.6 万参保人', startTime: '2026-08-29 08:15:00', endTime: '', duration: '进行中', dataVolume: 86400, anomalyCount: 142, status: '进行中', progress: 38, creator: '稽核员·王振华' },
  { taskId: 'CMP20260829006', taskName: '三级医院专项抽查比对', compareType: '病历结算比对', scope: '5 家三级医院', startTime: '2026-08-29 08:30:00', endTime: '', duration: '排队中', dataVolume: 0, anomalyCount: 0, status: '排队中', progress: 0, creator: '稽核组长·张建国' },
  { taskId: 'CMP20260828001', taskName: '全市处方-结算全量比对（日批）', compareType: '处方结算比对', scope: '全市 60 家定点机构', startTime: '2026-08-28 06:00:00', endTime: '2026-08-28 06:38:52', duration: '38分52秒', dataVolume: 442180, anomalyCount: 486, status: '已完成', progress: 100, creator: '系统调度' },
  { taskId: 'CMP20260828002', taskName: '药品进销存差异比对（日批）', compareType: '药品进销存比对', scope: '全市 32 家零售药店', startTime: '2026-08-28 06:00:00', endTime: '2026-08-28 07:22:10', duration: '1时22分10秒', dataVolume: 278600, anomalyCount: 812, status: '已完成', progress: 100, creator: '系统调度' },
  { taskId: 'CMP20260827003', taskName: '中医理疗项目专项比对', compareType: '检查检验比对', scope: '12 家中医/康复机构', startTime: '2026-08-27 14:00:00', endTime: '2026-08-27 14:36:20', duration: '36分20秒', dataVolume: 62400, anomalyCount: 168, status: '已完成', progress: 100, creator: '稽核员·陈晓东' },
  { taskId: 'CMP20260826004', taskName: '门诊慢特病长处方专项比对', compareType: '处方结算比对', scope: '全市 28 家医疗机构', startTime: '2026-08-26 09:00:00', endTime: '2026-08-26 09:28:44', duration: '28分44秒', dataVolume: 48200, anomalyCount: 96, status: '异常终止', progress: 86, creator: '稽核员·李明华' }
]

/* ============ M03 实时预警看板 ============ */
export const ALERT_OVERVIEW = {
  today: { newClueCount: 285, high: 34, mid: 102, low: 149, totalSuspectedAmount: 156800, handled: 168, handleRate: 58.9 },
  yesterday: { newClueCount: 260, high: 29, mid: 96, low: 135, totalSuspectedAmount: 142000 },
  month: { newClueCount: 6842, totalSuspectedAmount: 3860000, confirmedAmount: 1284000, recoveredAmount: 986400 },
  hourTrend: Array.from({ length: 24 }, (_, h) => {
    resetSeed(7000 + h)
    const base = h < 7 ? rndInt(2, 8) : h < 12 ? rndInt(18, 32) : h < 14 ? rndInt(8, 16) : h < 18 ? rndInt(16, 30) : rndInt(4, 14)
    return { hour: `${String(h).padStart(2, '0')}:00`, count: base, high: Math.round(base * 0.12), amount: base * rndInt(400, 900) }
  }),
  levelDist: [
    { name: '高风险', value: 34, color: '#e5484d' },
    { name: '中风险', value: 102, color: '#e8a30c' },
    { name: '低风险', value: 149, color: '#12a150' }
  ],
  categoryDist: [
    { name: '用药类', value: 96 },
    { name: '收费类', value: 78 },
    { name: '诊疗类', value: 52 },
    { name: '就医行为类', value: 38 },
    { name: '其他', value: 21 }
  ],
  topViolations: [
    { name: '超量开药', count: 42, amount: 26800 },
    { name: '重复收费', count: 36, amount: 18600 },
    { name: '虚记费用', count: 31, amount: 32400 },
    { name: '进销存不符', count: 28, amount: 21200 },
    { name: '过度诊疗', count: 24, amount: 19800 },
    { name: '串换药品', count: 21, amount: 15600 },
    { name: '频繁就医', count: 18, amount: 8400 },
    { name: '无指征收费', count: 16, amount: 10200 }
  ],
  engineStatus: [
    { name: '规则引擎', status: '正常', qps: 1280, latency: 46, load: 62 },
    { name: 'AI 识别模型', status: '正常', qps: 386, latency: 128, load: 71 },
    { name: '知识图谱服务', status: '正常', qps: 92, latency: 216, load: 44 },
    { name: '实时流处理', status: '正常', qps: 2450, latency: 32, load: 58 }
  ]
}

/** 实时预警流水（滚动展示） */
resetSeed(12312)
export const ALERT_STREAM = CLUES.slice(0, 60)
  .map((c) => ({
    clueId: c.clueId,
    time: c.detectTime,
    riskLevel: c.riskLevel,
    violationType: c.violationType,
    orgName: c.orgName,
    amount: c.suspectedAmount,
    ruleHit: c.ruleHit,
    confidence: c.confidence
  }))
  .sort((a, b) => (a.time < b.time ? 1 : -1))

/* ============ M05 研判工作台统计 ============ */
export const WORKBENCH_STATS = {
  myPending: 28,
  myOverdue: 3,
  myProcessing: 9,
  myTodayDone: 12,
  myWeekDone: 68,
  totalPending: 156,
  totalOverdue: 14,
  myAccuracy: 96.2,
  avgHandleHours: 4.6,
  rankInGroup: 2,
  groupSize: 8,
  levelSplit: { high: 6, mid: 11, low: 11 },
  sourceSplit: [
    { name: '处方结算比对', value: 9 },
    { name: '病历结算比对', value: 7 },
    { name: '药品进销存比对', value: 6 },
    { name: '检查检验比对', value: 4 },
    { name: '就医行为比对', value: 2 }
  ],
  weekTrend: [
    { date: '08-23', done: 8, confirmed: 5, rejected: 3 },
    { date: '08-24', done: 11, confirmed: 7, rejected: 4 },
    { date: '08-25', done: 9, confirmed: 6, rejected: 3 },
    { date: '08-26', done: 14, confirmed: 9, rejected: 5 },
    { date: '08-27', done: 12, confirmed: 8, rejected: 4 },
    { date: '08-28', done: 15, confirmed: 11, rejected: 4 },
    { date: '08-29', done: 12, confirmed: 8, rejected: 4 }
  ]
}

/* ============ M14 全周期统计 ============ */
export const LIFECYCLE_STATS = {
  totalClue: 6842,
  closed: 4128,
  processing: 2318,
  transferred: 396,
  closeRate: 60.3,
  avgDurationHours: 68.4,
  slaOnTime: 92.6,
  stageFunnel: [
    { stage: '智能预警', count: 6842 },
    { stage: '线索研判', count: 6842 },
    { stage: '线上筛查', count: 3260 },
    { stage: '线下核查', count: 1486 },
    { stage: '机构申诉', count: 428 },
    { stage: '确认违规', count: 2864 },
    { stage: '已流转处置', count: 2468 },
    { stage: '已结案', count: 4128 }
  ],
  durationDist: [
    { range: '≤24小时', count: 1862 },
    { range: '24-48小时', count: 1426 },
    { range: '48-72小时', count: 1084 },
    { range: '3-7天', count: 1568 },
    { range: '7-15天', count: 682 },
    { range: '>15天', count: 220 }
  ],
  monthTrend: [
    { month: '2026-03', created: 986, closed: 842, amount: 486000 },
    { month: '2026-04', created: 1042, closed: 926, amount: 528000 },
    { month: '2026-05', created: 1128, closed: 1024, amount: 586000 },
    { month: '2026-06', created: 1186, closed: 1086, amount: 624000 },
    { month: '2026-07', created: 1268, closed: 1148, amount: 682000 },
    { month: '2026-08', created: 1232, closed: 1002, amount: 654000 }
  ],
  resultDist: [
    { name: '确认违规', value: 2864 },
    { name: '合理驳回', value: 1682 },
    { name: '证据不足结案', value: 486 },
    { name: '处置中', value: 1810 }
  ]
}

/* ============ M15 误判反馈统计 ============ */
export const FEEDBACK_STATS = {
  totalFeedback: 486,
  pending: 62,
  optimizing: 38,
  optimized: 386,
  avgMisjudgeRate: 5.8,
  modelAccuracy: 94.8,
  accuracyImprove: 4.6,
  negativeSamples: 342,
  modelVersion: 'v2.3.2',
  typeDist: [
    { name: '规则误判', value: 186 },
    { name: '规则覆盖缺口', value: 112 },
    { name: '数据质量问题', value: 96 },
    { name: '阈值设置不当', value: 68 },
    { name: '其他', value: 24 }
  ],
  ruleRank: RULES.map((r) => ({
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    category: r.category,
    hitCount: r.hitCount,
    misjudgeCount: r.misjudgeCount,
    misjudgeRate: Math.round((r.misjudgeCount / r.hitCount) * 1000) / 10,
    status: r.status,
    version: r.version
  })).sort((a, b) => b.misjudgeRate - a.misjudgeRate),
  accuracyTrend: [
    { version: 'v2.1.0', accuracy: 86.4, misjudgeRate: 13.6, date: '2026-04-10' },
    { version: 'v2.1.5', accuracy: 88.2, misjudgeRate: 11.8, date: '2026-05-08' },
    { version: 'v2.2.0', accuracy: 90.1, misjudgeRate: 9.9, date: '2026-06-12' },
    { version: 'v2.2.6', accuracy: 91.8, misjudgeRate: 8.2, date: '2026-07-15' },
    { version: 'v2.3.1', accuracy: 93.2, misjudgeRate: 6.8, date: '2026-08-14' },
    { version: 'v2.3.2', accuracy: 94.8, misjudgeRate: 5.2, date: '2026-09-03' }
  ]
}

/* ============ 线上筛查统计 ============ */
export const SCREENING_STATS = {
  totalTask: 3260,
  pendingIssue: 86,
  waitingSubmit: 142,
  waitingReview: 68,
  reviewed: 2964,
  onTimeRate: 88.4,
  overdueCount: 42,
  resultDist: [
    { name: '合理说明·结案', value: 1286 },
    { name: '存疑·转线下核查', value: 1042 },
    { name: '违规苗头·直接确认', value: 636 }
  ],
  orgResponseRank: [
    { orgName: '皖南医学院弋矶山医院', issued: 42, submitted: 42, onTime: 40, rate: 95.2, avgHours: 26 },
    { orgName: '芜湖市中医医院', issued: 36, submitted: 35, onTime: 33, rate: 94.3, avgHours: 31 },
    { orgName: '芜湖市第一人民医院', issued: 58, submitted: 56, onTime: 51, rate: 91.1, avgHours: 38 },
    { orgName: '芜湖市第二人民医院', issued: 44, submitted: 41, onTime: 36, rate: 87.8, avgHours: 46 },
    { orgName: '芜湖益丰大药房（中山路店）', issued: 28, submitted: 24, onTime: 19, rate: 79.2, avgHours: 62 },
    { orgName: '芜湖广济医院', issued: 22, submitted: 18, onTime: 13, rate: 72.2, avgHours: 78 }
  ]
}

/* ============ 线下核查统计 ============ */
export const INSPECTION_STATS = {
  totalTask: 1486,
  pending: 48,
  ongoing: 32,
  done: 1386,
  todayPlan: 12,
  evidenceCount: 8642,
  ocrCount: 5286,
  ocrAccuracy: 94.6,
  avgDurationHours: 6.8,
  confirmRate: 76.4,
  typeDist: [
    { name: '现场核查', value: 862 },
    { name: '延伸核查', value: 286 },
    { name: '飞行检查', value: 168 },
    { name: '专家会诊核查', value: 96 },
    { name: '复查', value: 74 }
  ],
  evidenceTypeDist: [
    { name: '书证', value: 3862 },
    { name: '电子数据', value: 2486 },
    { name: '言词证据', value: 1024 },
    { name: '视听资料', value: 986 },
    { name: '物证', value: 284 }
  ]
}

/* ============ 申诉统计 ============ */
export const APPEAL_STATS = {
  totalAppeal: 428,
  pendingReview: 24,
  reviewing: 18,
  reviewed: 386,
  acceptRate: 32.6,
  partialRate: 21.4,
  rejectRate: 46.0,
  avgReviewHours: 18.6,
  aiPreAccuracy: 91.2,
  typeDist: [
    { name: '事实认定异议', value: 186 },
    { name: '金额认定异议', value: 112 },
    { name: '政策适用异议', value: 68 },
    { name: '程序异议', value: 38 },
    { name: '其他', value: 24 }
  ],
  resultTrend: [
    { month: '2026-04', accept: 18, partial: 12, reject: 32 },
    { month: '2026-05', accept: 22, partial: 14, reject: 36 },
    { month: '2026-06', accept: 26, partial: 16, reject: 42 },
    { month: '2026-07', accept: 24, partial: 18, reject: 38 },
    { month: '2026-08', accept: 28, partial: 21, reject: 44 }
  ]
}
