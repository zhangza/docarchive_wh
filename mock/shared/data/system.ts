/**
 * 系统管理与支撑模块数据集 —— 口径唯一来源
 * 需求依据：doc/子功能/06_系统管理与支撑模块_详细功能设计.md
 * 与全平台共享口径：芜湖市 / 2026-08-29 时间基准 / 人员机构与其他智能体一致
 */

/* ================= 3.1 动态规则引擎 ================= */

export const RULE_STATS = {
  totalRules: 96,
  enabledRules: 82,
  disabledRules: 14,
  todayTrigger: 568,
  avgPositiveRate: 0.502,
  avgMisjudgeRate: 0.067,
  pendingParamChanges: 3,
  grayReleases: 1,
  byType: [
    { type: '阈值类', count: 38 },
    { type: '比对类', count: 26 },
    { type: '行为类', count: 18 },
    { type: '关联类', count: 14 }
  ],
  byViolation: [
    { type: '超量开药', count: 16 },
    { type: '重复收费', count: 15 },
    { type: '串换药品', count: 12 },
    { type: '过度诊疗', count: 14 },
    { type: '虚假诊疗', count: 10 },
    { type: '分解住院', count: 9 },
    { type: '无指征收费', count: 12 },
    { type: '其他', count: 8 }
  ]
}

export const RULES = [
  {
    ruleId: 'RULE-DRUG-003', ruleName: '慢性病开药不超过7日量', ruleCode: 'DRUG_OVER_LIMIT_003',
    ruleType: '阈值类', violationType: '超量开药', category: '药品监管', status: '已启用', version: 'v2.1',
    description: '慢性病患者单次门诊开药超过7日常用量，识别超量开药违规行为',
    applicableScope: { orgTypes: ['三级医院', '二级医院', '一级医院', '社区卫生服务中心', '诊所'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: ['恶性肿瘤门诊放化疗', '尿毒症透析', '器官移植抗排异'] },
    triggerConditions: {
      logic: 'AND',
      conditions: [
        { field: '就诊类型', operator: '=', value: '门诊', fieldType: '枚举' },
        { field: '药品分类', operator: 'in', value: ['慢性病用药'], fieldType: '枚举' },
        { field: '开药数量/日剂量', operator: '>', value: 7, fieldType: '数值', unit: '日' },
        { field: '是否特殊病种', operator: '=', value: false, fieldType: '布尔' }
      ]
    },
    riskLevel: '中', defaultScore: 60,
    disposalSuggestion: '核查处方与病历，确认是否超量开药，超量部分追回医保基金',
    evidenceTemplate: '处方明细、药品说明书（常用量规定）、病历诊断',
    legalBasis: '《处方管理办法》第十九条：处方一般不得超过7日用量',
    creator: '规则管理员 赵XX', createTime: '2026-03-15 10:00:00', updateTime: '2026-07-20 14:00:00', effectiveTime: '2026-08-01 00:00:00',
    usageStats: { triggerCount: 5680, confirmedCount: 2850, positiveRate: 0.502, misjudgmentRate: 0.067 },
    tags: ['超量开药', '慢性病', '门诊', '药品监管']
  },
  {
    ruleId: 'RULE-FEE-002', ruleName: '同一就诊号重复收费识别', ruleCode: 'FEE_DUPLICATE_002',
    ruleType: '比对类', violationType: '重复收费', category: '收费监管', status: '已启用', version: 'v1.8',
    description: '同一就诊号相同项目编码出现2次及以上，且排除医嘱明确要求的多次执行项目',
    applicableScope: { orgTypes: ['三级医院', '二级医院', '一级医院'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: [] },
    triggerConditions: {
      logic: 'AND',
      conditions: [
        { field: '就诊号', operator: 'same', value: null, fieldType: '分组' },
        { field: '项目编码', operator: 'same', value: null, fieldType: '分组' },
        { field: '收费次数', operator: '>=', value: 2, fieldType: '数值', unit: '次' },
        { field: '医嘱多次执行', operator: '=', value: false, fieldType: '布尔' }
      ]
    },
    riskLevel: '高', defaultScore: 75,
    disposalSuggestion: '调取收费明细与医嘱记录，确认重复收费金额并追回',
    evidenceTemplate: '收费明细、医嘱单、执行记录',
    legalBasis: '《医疗保障基金使用监督管理条例》第三十八条',
    creator: '规则管理员 赵XX', createTime: '2026-02-10 09:00:00', updateTime: '2026-08-05 11:00:00', effectiveTime: '2026-08-10 00:00:00',
    usageStats: { triggerCount: 4520, confirmedCount: 2410, positiveRate: 0.533, misjudgmentRate: 0.052 },
    tags: ['重复收费', '住院', '收费监管']
  },
  {
    ruleId: 'RULE-INV-001', ruleName: '进销存与结算比对异常', ruleCode: 'INV_SETTLE_DIFF_001',
    ruleType: '比对类', violationType: '串换药品', category: '药品监管', status: '已启用', version: 'v1.5',
    description: '药店进销存记录与医保结算记录比对，识别无进货却有结算的串换药品行为',
    applicableScope: { orgTypes: ['零售药店'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: [] },
    triggerConditions: {
      logic: 'AND',
      conditions: [
        { field: '结算药品编码', operator: 'not in', value: ['进货记录'], fieldType: '集合' },
        { field: '时间窗口', operator: '<=', value: 30, fieldType: '数值', unit: '天' },
        { field: '结算金额', operator: '>', value: 100, fieldType: '数值', unit: '元' }
      ]
    },
    riskLevel: '高', defaultScore: 85,
    disposalSuggestion: '调取进销存台账与结算明细，现场盘点核实，涉嫌骗保的解除协议并移送',
    evidenceTemplate: '进销存台账、结算明细、现场盘点记录',
    legalBasis: '《医疗保障基金使用监督管理条例》第四十条',
    creator: '规则管理员 赵XX', createTime: '2026-01-20 10:00:00', updateTime: '2026-06-12 15:00:00', effectiveTime: '2026-06-20 00:00:00',
    usageStats: { triggerCount: 1850, confirmedCount: 980, positiveRate: 0.53, misjudgmentRate: 0.041 },
    tags: ['串换药品', '药店', '进销存']
  },
  {
    ruleId: 'RULE-EXAM-001', ruleName: '无指征检查识别', ruleCode: 'EXAM_NO_INDICATION_001',
    ruleType: '关联类', violationType: '过度诊疗', category: '诊疗监管', status: '已启用', version: 'v1.3',
    description: '诊断与检查项目关联度低于阈值，识别无临床指征的检查检验',
    applicableScope: { orgTypes: ['三级医院', '二级医院', '社区卫生服务中心'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: ['急诊抢救'] },
    triggerConditions: {
      logic: 'AND',
      conditions: [
        { field: '诊断-检查关联度', operator: '<', value: 30, fieldType: '数值', unit: '%' },
        { field: '检查费用', operator: '>', value: 200, fieldType: '数值', unit: '元' }
      ]
    },
    riskLevel: '中', defaultScore: 55,
    disposalSuggestion: '引入临床专家评估，确认无指征的检查费用追回',
    evidenceTemplate: '诊断记录、检查申请单、临床指南',
    legalBasis: '《医疗保障基金使用监督管理条例》第三十八条',
    creator: '规则管理员 赵XX', createTime: '2026-03-01 10:00:00', updateTime: '2026-07-01 09:00:00', effectiveTime: '2026-07-10 00:00:00',
    usageStats: { triggerCount: 2560, confirmedCount: 1120, positiveRate: 0.438, misjudgmentRate: 0.118 },
    tags: ['过度诊疗', '无指征检查', '临床指南']
  },
  {
    ruleId: 'RULE-HOSP-005', ruleName: '分解住院识别', ruleCode: 'HOSP_SPLIT_005',
    ruleType: '行为类', violationType: '分解住院', category: '住院监管', status: '已启用', version: 'v1.2',
    description: '同一参保人短期内在同一机构多次办理出入院，识别分解住院行为',
    applicableScope: { orgTypes: ['三级医院', '二级医院', '一级医院'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: [] },
    triggerConditions: {
      logic: 'AND',
      conditions: [
        { field: '出院-再入院间隔', operator: '<=', value: 15, fieldType: '数值', unit: '天' },
        { field: '同一机构', operator: '=', value: true, fieldType: '布尔' },
        { field: '入院次数', operator: '>=', value: 2, fieldType: '数值', unit: '次' }
      ]
    },
    riskLevel: '高', defaultScore: 70,
    disposalSuggestion: '核查住院必要性，分解住院费用追回并约谈机构',
    evidenceTemplate: '出入院记录、病程记录、DRG分组信息',
    legalBasis: '《医疗保障基金使用监督管理条例》第三十八条',
    creator: '规则管理员 赵XX', createTime: '2026-04-12 10:00:00', updateTime: '2026-07-18 14:00:00', effectiveTime: '2026-07-25 00:00:00',
    usageStats: { triggerCount: 450, confirmedCount: 260, positiveRate: 0.578, misjudgmentRate: 0.108 },
    tags: ['分解住院', '住院监管', 'DRG']
  },
  {
    ruleId: 'RULE-FAKE-001', ruleName: '挂床住院虚假诊疗识别', ruleCode: 'FAKE_HOSP_001',
    ruleType: '行为类', violationType: '虚假诊疗', category: '住院监管', status: '已启用', version: 'v1.1',
    description: '住院期间无诊疗记录或床位使用记录，识别挂床住院虚假诊疗',
    applicableScope: { orgTypes: ['三级医院', '二级医院', '一级医院'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: [] },
    triggerConditions: {
      logic: 'AND',
      conditions: [
        { field: '住院天数', operator: '>=', value: 3, fieldType: '数值', unit: '天' },
        { field: '日诊疗项目数', operator: '=', value: 0, fieldType: '数值' },
        { field: '床位使用记录', operator: '=', value: false, fieldType: '布尔' }
      ]
    },
    riskLevel: '高', defaultScore: 90,
    disposalSuggestion: '现场核查床位与人脸识别记录，涉嫌虚假诊疗的立案并移送公安',
    evidenceTemplate: '床位记录、护理记录、人脸识别记录',
    legalBasis: '《医疗保障基金使用监督管理条例》第四十条',
    creator: '规则管理员 赵XX', createTime: '2026-05-08 10:00:00', updateTime: '2026-08-01 10:00:00', effectiveTime: '2026-08-08 00:00:00',
    usageStats: { triggerCount: 890, confirmedCount: 620, positiveRate: 0.697, misjudgmentRate: 0.095 },
    tags: ['虚假诊疗', '挂床住院', '人脸识别']
  }
]

export const RULE_PARAMS = [
  {
    paramId: 'PARAM-DRUG-003-001', paramName: '慢性病开药日量上限', paramCode: 'CHRONIC_DRUG_DAY_LIMIT',
    ruleId: 'RULE-DRUG-003', ruleName: '慢性病开药不超过7日量', paramType: '数值型', unit: '日',
    currentValue: 7, defaultValue: 7, minValue: 1, maxValue: 30,
    description: '慢性病患者单次门诊开药的最大日用量，超过此值触发超量开药规则',
    changeHistory: [
      { version: 'v2.1', value: 7, changeType: '调整', reason: '根据《处方管理办法》标准值', operator: '赵XX', time: '2026-07-20 14:00:00', approver: '王处长', status: '已生效' },
      { version: 'v2.0', value: 10, changeType: '调整', reason: '试点期放宽阈值', operator: '赵XX', time: '2026-05-10 10:00:00', approver: '王处长', status: '已失效' },
      { version: 'v1.0', value: 7, changeType: '新建', reason: '初始配置', operator: '赵XX', time: '2026-03-15 10:00:00', approver: '王处长', status: '已失效' }
    ],
    pendingChange: {
      requestId: 'PARAM-CHG-202608290001', newValue: 7, changeType: '增加代取药场景识别',
      reason: '本月该规则误报86条，32条为家属代取药合并结算，增加代取药识别逻辑',
      requester: '规则管理员 赵XX', requestTime: '2026-08-29 09:00:00', status: '待审核',
      approver: '基金监管处 王处长', estimatedEffect: '误报率从6.7%降至3%以下'
    },
    lastUpdated: '2026-07-20 14:00:00', updatedBy: '规则管理员 赵XX'
  },
  {
    paramId: 'PARAM-FEE-002-001', paramName: '重复收费时间窗口', paramCode: 'DUP_FEE_TIME_WINDOW',
    ruleId: 'RULE-FEE-002', ruleName: '同一就诊号重复收费识别', paramType: '时间型', unit: '小时',
    currentValue: 24, defaultValue: 24, minValue: 1, maxValue: 72,
    description: '同一就诊号相同项目编码重复收费的判定时间窗口',
    changeHistory: [
      { version: 'v1.8', value: 24, changeType: '调整', reason: '排除跨日正常复查', operator: '赵XX', time: '2026-08-05 11:00:00', approver: '王处长', status: '已生效' }
    ],
    pendingChange: null,
    lastUpdated: '2026-08-05 11:00:00', updatedBy: '规则管理员 赵XX'
  },
  {
    paramId: 'PARAM-EXAM-001-001', paramName: '诊断-检查关联度阈值', paramCode: 'EXAM_RELEVANCE_THRESHOLD',
    ruleId: 'RULE-EXAM-001', ruleName: '无指征检查识别', paramType: '数值型', unit: '%',
    currentValue: 30, defaultValue: 50, minValue: 10, maxValue: 90,
    description: '诊断与检查关联度低于此阈值判定为无指征检查（引入临床指南知识库评分）',
    changeHistory: [
      { version: 'v1.3', value: 30, changeType: '调整', reason: '引入临床指南知识库后阈值收紧，预计召回率提升至85%', operator: '赵XX', time: '2026-07-01 09:00:00', approver: '王处长', status: '已生效' }
    ],
    pendingChange: {
      requestId: 'PARAM-CHG-202608280002', newValue: 35, changeType: '阈值微调',
      reason: '近期误报集中在边界值30-35区间，建议上调至35并观察',
      requester: '算法工程师 李XX', requestTime: '2026-08-28 15:00:00', status: '待审核',
      approver: '基金监管处 王处长', estimatedEffect: '误报率-1.2%，召回率-0.8%'
    },
    lastUpdated: '2026-07-01 09:00:00', updatedBy: '规则管理员 赵XX'
  },
  {
    paramId: 'PARAM-HOSP-005-001', paramName: '分解住院间隔天数', paramCode: 'SPLIT_HOSP_INTERVAL',
    ruleId: 'RULE-HOSP-005', ruleName: '分解住院识别', paramType: '数值型', unit: '天',
    currentValue: 15, defaultValue: 15, minValue: 3, maxValue: 31,
    description: '同一参保人出院后再次入院间隔小于该值时触发分解住院识别',
    changeHistory: [
      { version: 'v1.2', value: 15, changeType: '调整', reason: '结合DRG付费特点调整', operator: '赵XX', time: '2026-07-18 14:00:00', approver: '王处长', status: '已生效' }
    ],
    pendingChange: null,
    lastUpdated: '2026-07-18 14:00:00', updatedBy: '规则管理员 赵XX'
  },
  {
    paramId: 'PARAM-INV-001-001', paramName: '进销存比对时间窗口', paramCode: 'INV_COMPARE_WINDOW',
    ruleId: 'RULE-INV-001', ruleName: '进销存与结算比对异常', paramType: '时间型', unit: '天',
    currentValue: 30, defaultValue: 30, minValue: 7, maxValue: 90,
    description: '结算药品向前追溯进货记录的时间窗口',
    changeHistory: [
      { version: 'v1.5', value: 30, changeType: '调整', reason: '覆盖月度进货周期', operator: '赵XX', time: '2026-06-12 15:00:00', approver: '王处长', status: '已生效' }
    ],
    pendingChange: null,
    lastUpdated: '2026-06-12 15:00:00', updatedBy: '规则管理员 赵XX'
  }
]

export const RULE_TRIALS = [
  {
    trialId: 'TRIAL202608290001', trialName: '慢性病开药规则v2.2试跑验证', trialType: '参数调整试跑',
    ruleId: 'RULE-DRUG-003', ruleName: '慢性病开药不超过7日量',
    currentVersion: 'v2.1', trialVersion: 'v2.2',
    changeContent: '增加代取药场景识别逻辑，排除家属代取药合并结算场景',
    trialMode: '全量历史数据试跑',
    dataRange: { startTime: '2026-06-01', endTime: '2026-08-31', areas: ['全市'], sampleSize: '全量（约120万条门诊处方）' },
    trialTime: '2026-08-29 10:00:00', trialDuration: '15分钟', status: '已完成', operator: '规则管理员 赵XX',
    results: {
      current: { triggerCount: 5680, estimatedPositive: 2850, positiveRate: 0.502, misjudgment: 380, misjudgmentRate: 0.067, matchRate: 1.0 },
      trial: { triggerCount: 5320, estimatedPositive: 2820, positiveRate: 0.53, misjudgment: 160, misjudgmentRate: 0.03, matchRate: 0.99 },
      comparison: {
        triggerChange: -360, triggerChangeRate: -0.063, positiveRateChange: 0.028,
        misjudgmentChange: -220, misjudgmentRateChange: -0.037, confirmedLoss: 30, confirmedLossRate: 0.011,
        conclusion: '试跑版本误报率显著下降（从6.7%降至3.0%），阳性率提升（从50.2%升至53.0%），确认违规损失仅1.1%，整体效果优于当前版本，建议灰度发布。'
      }
    },
    sampleTriggers: [
      { clueId: 'CL-TRIAL-0001', orgName: '芜湖XX医院', patient: '张**', drug: '氨氯地平片', days: 15, amount: 180.0, currentTriggered: true, trialTriggered: true, reason: '超量开药（15日量>7日）' },
      { clueId: 'CL-TRIAL-0002', orgName: '芜湖XX社区中心', patient: '李**', drug: '二甲双胍', days: 14, amount: 96.0, currentTriggered: true, trialTriggered: false, reason: '家属代取药合并结算（排除）' },
      { clueId: 'CL-TRIAL-0003', orgName: '芜湖XX药店', patient: '王**', drug: '缬沙坦', days: 30, amount: 240.0, currentTriggered: true, trialTriggered: true, reason: '超量开药（30日量>7日）' }
    ],
    riskWarnings: [
      { level: '低', content: '试跑版本可能漏报约30条已确认违规（1.1%），主要为代取药场景中实际超量的边界情况', suggestion: '灰度期间重点关注代取药场景，必要时增加二次校验' }
    ],
    onlineSuggestion: '建议灰度发布（先在镜湖区、弋江区试点2周），观察实际效果后全量上线'
  },
  {
    trialId: 'TRIAL202608250001', trialName: '无指征检查规则v1.3对比试跑', trialType: '新旧规则对比试跑',
    ruleId: 'RULE-EXAM-001', ruleName: '无指征检查识别',
    currentVersion: 'v1.2', trialVersion: 'v1.3',
    changeContent: '引入临床指南知识库，关联度阈值由50%收紧至30%',
    trialMode: '抽样数据试跑（按区域分层抽样10%）',
    dataRange: { startTime: '2026-07-01', endTime: '2026-08-20', areas: ['市本级', '镜湖区'], sampleSize: '抽样（约8.6万条检查记录）' },
    trialTime: '2026-08-25 09:30:00', trialDuration: '8分钟', status: '已完成', operator: '算法工程师 李XX',
    results: {
      current: { triggerCount: 860, estimatedPositive: 310, positiveRate: 0.36, misjudgment: 96, misjudgmentRate: 0.112, matchRate: 0.86 },
      trial: { triggerCount: 1210, estimatedPositive: 520, positiveRate: 0.43, misjudgment: 108, misjudgmentRate: 0.089, matchRate: 0.97 },
      comparison: {
        triggerChange: 350, triggerChangeRate: 0.407, positiveRateChange: 0.07,
        misjudgmentChange: 12, misjudgmentRateChange: -0.023, confirmedLoss: 0, confirmedLossRate: 0,
        conclusion: '新版本召回率显著提升（+11%），误报率下降2.3%，无确认违规损失，建议全量上线。'
      }
    },
    sampleTriggers: [
      { clueId: 'CL-TRIAL-0011', orgName: '芜湖XX医院', patient: '赵**', drug: '冠状动脉CTA', days: 0, amount: 860.0, currentTriggered: false, trialTriggered: true, reason: '诊断与检查关联度22%（新增识别）' },
      { clueId: 'CL-TRIAL-0012', orgName: '芜湖XX社区中心', patient: '钱**', drug: '心脏彩超', days: 0, amount: 320.0, currentTriggered: true, trialTriggered: true, reason: '无指征检查（两版均触发）' }
    ],
    riskWarnings: [
      { level: '低', content: '抽样试跑与全量数据可能存在偏差', suggestion: '上线后首周密切监控误报率' }
    ],
    onlineSuggestion: '建议直接全量上线'
  }
]

export const RULE_RELEASES = [
  {
    releaseId: 'RELEASE202608290001', releaseName: '慢性病开药规则v2.2灰度发布',
    ruleId: 'RULE-DRUG-003', ruleName: '慢性病开药不超过7日量',
    fromVersion: 'v2.1', toVersion: 'v2.2', releaseType: '灰度发布', status: '灰度进行中',
    creator: '规则管理员 赵XX', createTime: '2026-08-29 11:00:00',
    approver: '基金监管处 王处长', approvalTime: '2026-08-29 11:30:00',
    grayStrategy: {
      type: '按区域灰度', pilotAreas: ['镜湖区', '弋江区'], grayPeriod: '2026-09-01 至 2026-09-14（2周）',
      dualRun: true, dualRunDescription: '灰度期间v2.1和v2.2双版本并行运行，v2.2结果仅用于对比观察，不生成正式线索'
    },
    grayMetrics: {
      elapsedDays: 5, remainingDays: 9,
      daily: [
        { date: '09-01', v21Trigger: 185, v22Trigger: 172, v21Misjudge: 12, v22Misjudge: 5 },
        { date: '09-02', v21Trigger: 192, v22Trigger: 178, v21Misjudge: 13, v22Misjudge: 6 },
        { date: '09-03', v21Trigger: 178, v22Trigger: 165, v21Misjudge: 11, v22Misjudge: 4 },
        { date: '09-04', v21Trigger: 186, v22Trigger: 174, v21Misjudge: 12, v22Misjudge: 5 },
        { date: '09-05', v21Trigger: 180, v22Trigger: 168, v21Misjudge: 11, v22Misjudge: 5 }
      ],
      summary: { triggerReduction: 6.9, v21PositiveRate: 0.497, v22PositiveRate: 0.525, v21MisjudgeRate: 0.064, v22MisjudgeRate: 0.029, confirmedLossRate: 0.013 }
    },
    grayEvaluation: {
      status: '观察中',
      preliminaryConclusion: '灰度前5天数据显示，v2.2版本误报率从6.4%降至2.9%，阳性率从49.7%升至52.5%，确认违规损失率1.3%，整体效果符合预期。',
      fullEvaluationDate: '2026-09-15', decision: null
    },
    versionList: [
      { version: 'v2.2', status: '灰度中', releaseDate: '2026-09-01', changes: '增加代取药场景识别' },
      { version: 'v2.1', status: '当前全量', releaseDate: '2026-08-01', changes: '阈值调整为7日' },
      { version: 'v2.0', status: '已归档', releaseDate: '2026-05-10', changes: '试点期放宽至10日' },
      { version: 'v1.0', status: '已归档', releaseDate: '2026-03-15', changes: '初始版本' }
    ],
    rollback: { supported: true, rollbackTrigger: '误报率>10%、确认违规损失率>5%、系统异常、业务方反馈严重问题', rollbackHistory: [] }
  },
  {
    releaseId: 'RELEASE202608100001', releaseName: '重复收费规则v1.8全量发布',
    ruleId: 'RULE-FEE-002', ruleName: '同一就诊号重复收费识别',
    fromVersion: 'v1.7', toVersion: 'v1.8', releaseType: '全量发布', status: '已全量',
    creator: '规则管理员 赵XX', createTime: '2026-08-05 10:00:00',
    approver: '基金监管处 王处长', approvalTime: '2026-08-06 09:00:00',
    grayStrategy: { type: '按机构类型灰度', pilotAreas: null, grayPeriod: '2026-08-06 至 2026-08-09（3天）', dualRun: false, dualRunDescription: '灰度观察3天后全量' },
    grayMetrics: { elapsedDays: 3, remainingDays: 0, daily: [], summary: { triggerReduction: 0, v21PositiveRate: 0.52, v22PositiveRate: 0.533, v21MisjudgeRate: 0.058, v22MisjudgeRate: 0.052, confirmedLossRate: 0 } },
    grayEvaluation: { status: '已完成', preliminaryConclusion: '灰度期间误报率下降，无确认违规损失，符合全量条件。', fullEvaluationDate: '2026-08-09', decision: '全量发布' },
    versionList: [
      { version: 'v1.8', status: '当前全量', releaseDate: '2026-08-10', changes: '增加医嘱多次执行排除逻辑' },
      { version: 'v1.7', status: '已归档', releaseDate: '2026-05-20', changes: '时间窗口调整' }
    ],
    rollback: { supported: true, rollbackTrigger: '误报率>10%', rollbackHistory: [] }
  }
]

/* ================= 3.2 知识图谱 ================= */

export const GRAPH_STATS = {
  entityTotal: 1258000, relationTotal: 5680000,
  todayNewEntities: 1250, todayNewRelations: 5600,
  qualityScore: 96,
  entityTypes: [
    { type: '参保人', count: 856000 }, { type: '医生', count: 45600 }, { type: '医疗机构', count: 1558 },
    { type: '零售药店', count: 2850 }, { type: '药品', count: 125000 }, { type: '诊疗项目', count: 8600 },
    { type: '疑点线索', count: 28810 }, { type: '违规案件', count: 2450 }, { type: '政策法规', count: 326 }
  ],
  relationTypes: [
    { type: '就诊', count: 2450000 }, { type: '处方', count: 1680000 }, { type: '结算', count: 1250000 },
    { type: '关联', count: 28810 }, { type: '违规', count: 2450 }, { type: '引用', count: 1560 }, { type: '其他', count: 267180 }
  ]
}

export const GRAPH_ENTITIES = [
  {
    entityId: 'ENT-ORG-0001', entityName: '芜湖市第一医院', entityType: '医疗机构', entityCode: 'HOSP340200001',
    status: '有效', area: '弋江区', relationCount: 1256, violationCount: 12,
    properties: { orgLevel: '三级甲等', orgType: '综合医院', creditRating: 'A', lastInspectionDate: '2026-06-15', totalPenaltyAmount: 85.6 },
    updateTime: '2026-08-29 02:00:00'
  },
  {
    entityId: 'ENT-DOC-0001', entityName: '李医生（心内科）', entityType: '医生', entityCode: 'DOC340200156',
    status: '有效', area: '弋江区', relationCount: 486, violationCount: 2,
    properties: { dept: '心内科', title: '主任医师', prescriptionCount: 156, avgAmount: 292.31 },
    updateTime: '2026-08-28 02:00:00'
  },
  {
    entityId: 'ENT-PAT-0001', entityName: '张**（参保人）', entityType: '参保人', entityCode: 'PAT340202***1234',
    status: '有效', area: '镜湖区', relationCount: 86, violationCount: 0,
    properties: { age: 65, gender: '男', chronicDisease: ['高血压', '冠心病'], visitCount: 15 },
    updateTime: '2026-08-27 02:00:00'
  },
  {
    entityId: 'ENT-DRUG-0001', entityName: '氨氯地平片', entityType: '药品', entityCode: 'DRUG-NH-058621',
    status: '有效', area: '全市', relationCount: 3560, violationCount: 0,
    properties: { category: '降压药', isChronic: true, avgPrice: 12.5 },
    updateTime: '2026-08-29 02:00:00'
  },
  {
    entityId: 'ENT-CLUE-0001', entityName: 'CL202608150001', entityType: '疑点线索', entityCode: 'CL202608150001',
    status: '有效', area: '弋江区', relationCount: 5, violationCount: 1,
    properties: { clueType: '重复收费', amount: 5600.0, status: '已确认违规' },
    updateTime: '2026-08-20 14:00:00'
  },
  {
    entityId: 'ENT-ORG-0002', entityName: '芜湖XX药店', entityType: '零售药店', entityCode: 'PHAR340200088',
    status: '有效', area: '镜湖区', relationCount: 685, violationCount: 5,
    properties: { orgType: '连锁药店', creditRating: 'C', lastInspectionDate: '2026-08-15', totalPenaltyAmount: 41.0 },
    updateTime: '2026-08-26 02:00:00'
  }
]

export const GRAPH_VIEW = {
  viewName: '芜湖市第一医院关联图谱（二跳）',
  centerEntity: { id: 'ENT-ORG-0001', name: '芜湖市第一医院', type: '医疗机构' },
  hops: 2,
  statistics: { entityCount: 256, relationCount: 512, density: 0.0156, avgDegree: 4.0, maxDegree: 45 },
  nodes: [
    { id: 'ENT-ORG-0001', name: '芜湖市第一医院', type: '医疗机构', value: 45, symbolSize: 46 },
    { id: 'ENT-DOC-0001', name: '李医生（心内科）', type: '医生', value: 28, symbolSize: 32 },
    { id: 'ENT-DOC-0002', name: '王医生（骨科）', type: '医生', value: 18, symbolSize: 24 },
    { id: 'ENT-PAT-0001', name: '张**', type: '参保人', value: 12, symbolSize: 18 },
    { id: 'ENT-PAT-0002', name: '李**', type: '参保人', value: 9, symbolSize: 16 },
    { id: 'ENT-PAT-0003', name: '王**', type: '参保人', value: 7, symbolSize: 14 },
    { id: 'ENT-DRUG-0001', name: '氨氯地平片', type: '药品', value: 35, symbolSize: 30 },
    { id: 'ENT-DRUG-0002', name: '二甲双胍', type: '药品', value: 22, symbolSize: 22 },
    { id: 'ENT-CLUE-0001', name: '重复收费线索', type: '疑点线索', value: 5, symbolSize: 20 },
    { id: 'ENT-CLUE-0002', name: '超量开药线索', type: '疑点线索', value: 4, symbolSize: 18 }
  ],
  edges: [
    { source: 'ENT-PAT-0001', target: 'ENT-ORG-0001', name: '就诊', value: 15 },
    { source: 'ENT-PAT-0002', target: 'ENT-ORG-0001', name: '就诊', value: 9 },
    { source: 'ENT-PAT-0003', target: 'ENT-ORG-0001', name: '就诊', value: 7 },
    { source: 'ENT-DOC-0001', target: 'ENT-ORG-0001', name: '执业', value: 1 },
    { source: 'ENT-DOC-0002', target: 'ENT-ORG-0001', name: '执业', value: 1 },
    { source: 'ENT-DOC-0001', target: 'ENT-DRUG-0001', name: '处方', value: 86 },
    { source: 'ENT-DOC-0001', target: 'ENT-DRUG-0002', name: '处方', value: 45 },
    { source: 'ENT-DOC-0002', target: 'ENT-DRUG-0002', name: '处方', value: 12 },
    { source: 'ENT-ORG-0001', target: 'ENT-CLUE-0001', name: '关联', value: 1 },
    { source: 'ENT-DOC-0001', target: 'ENT-CLUE-0002', name: '关联', value: 1 }
  ],
  pathAnalysis: {
    source: '张**（参保人）', target: '氨氯地平片',
    shortestPath: ['张**', '—就诊→', '芜湖市第一医院', '—执业→', '李医生', '—处方→', '氨氯地平片'],
    pathLength: 3, allPathsCount: 5,
    abnormalPaths: [
      { path: '张** → 芜湖市第一医院 → 李医生 → 氨氯地平片', abnormality: '同一患者30天内在同一医生处开同一种药5次，超量开药风险', riskLevel: '中' }
    ]
  },
  communities: [
    { communityId: 'C001', name: '心内科-高血压用药社区', entityCount: 45, density: 0.15, abnormality: '部分医生处方量异常偏高', riskLevel: '低' },
    { communityId: 'C002', name: '异常关联社区', entityCount: 12, density: 0.65, abnormality: '高密度关联，疑似团伙骗保', riskLevel: '高' }
  ],
  graphQuality: { isolatedEntities: 5, duplicateEntities: 2, abnormalRelations: 8, lastCheckTime: '2026-08-28 03:00:00', qualityScore: 96 }
}

/* ================= 3.3 政策法规案例库 ================= */

export const LEGAL_STATS = {
  lawTotal: 286, caseTotal: 156, templateTotal: 42,
  monthReference: 1256, insertionRate: 0.52,
  byLibrary: [
    { name: '政策法规库', count: 286 },
    { name: '典型案例库', count: 156 },
    { name: '指导文书库', count: 42 }
  ],
  byLevel: [
    { level: '法律', count: 3 }, { level: '行政法规', count: 12 }, { level: '部门规章', count: 45 },
    { level: '规范性文件', count: 156 }, { level: '政策解读', count: 70 }
  ]
}

export const LEGAL_DOCS = [
  {
    docId: 'LAW-2021-001', docType: '政策法规', library: '政策法规库',
    title: '医疗保障基金使用监督管理条例', docNo: '国务院令第735号', issuingAuthority: '国务院',
    issueDate: '2021-01-15', effectiveDate: '2021-05-01', status: '有效', level: '行政法规', category: '基金监管',
    tags: ['医保基金', '监督管理', '定点医药机构', '法律责任'],
    summary: '规范医保基金使用监督管理，明确定点医药机构、参保人员、医疗保障行政部门等各方权利义务，规定欺诈骗保行为的法律责任。',
    keyArticles: [
      { articleNo: '第三十八条', title: '定点医药机构一般违规行为', scenarios: ['分解住院', '挂床住院', '过度诊疗', '重复收费'], penaltyRange: '退回基金+1-2倍罚款' },
      { articleNo: '第四十条', title: '欺诈骗保行为', scenarios: ['虚构医药服务', '伪造变造票据', '串换药品', '虚假诊疗'], penaltyRange: '退回基金+2-5倍罚款+暂停服务+解除协议' }
    ],
    referenceCount: 156, lastReferencedTime: '2026-08-29 10:30:00', version: 'v1.0',
    creator: '法制科 刘科长', createTime: '2026-01-10 09:00:00'
  },
  {
    docId: 'LAW-2021-002', docType: '政策法规', library: '政策法规库',
    title: '医疗保障行政处罚程序暂行规定', docNo: '国家医疗保障局令第4号', issuingAuthority: '国家医疗保障局',
    issueDate: '2021-06-03', effectiveDate: '2021-07-15', status: '有效', level: '部门规章', category: '行政处罚',
    tags: ['行政处罚', '程序规定', '立案', '听证'],
    summary: '规范医疗保障行政处罚程序，明确立案、调查取证、告知听证、决定执行等全流程要求。',
    keyArticles: [
      { articleNo: '第二十二条', title: '立案条件', scenarios: ['立案'], penaltyRange: '—' }
    ],
    referenceCount: 98, lastReferencedTime: '2026-08-28 15:00:00', version: 'v1.0',
    creator: '法制科 刘科长', createTime: '2026-01-10 09:00:00'
  },
  {
    docId: 'CASE-LIB-00156', docType: '典型案例', library: '典型案例库',
    title: '芜湖某药店串换药品骗取医保基金案', docNo: 'CASE-LIB-00156', issuingAuthority: '芜湖市医保局',
    issueDate: '2025-11-20', effectiveDate: '2025-11-20', status: '有效', level: '典型案例', category: '串换药品',
    tags: ['串换药品', '零售药店', '解除协议', '3倍罚款'],
    summary: '2025年查处的某药店将米、油等生活用品串换为医保药品结算，涉及8.2万元，处退回基金8.2万元+罚款24.6万元（3倍）并解除医保服务协议。',
    keyArticles: [],
    referenceCount: 45, lastReferencedTime: '2026-08-25 11:00:00', version: 'v1.0',
    creator: '法制科 刘科长', createTime: '2025-12-01 09:00:00'
  },
  {
    docId: 'TPL-DOC-008', docType: '指导文书', library: '指导文书库',
    title: '行政处罚决定书（欺诈骗保类）', docNo: 'TPL-DOC-008', issuingAuthority: '芜湖市医保局法制科',
    issueDate: '2026-01-15', effectiveDate: '2026-01-15', status: '有效', level: '文书模板', category: '行政处罚',
    tags: ['处罚决定书', '欺诈骗保', '模板'],
    summary: '欺诈骗保类行政处罚决定书标准模板，含当事人信息、违法事实、证据列举、法条引用、处罚决定、救济途径六段结构。',
    keyArticles: [],
    referenceCount: 28, lastReferencedTime: '2026-08-29 10:35:00', version: 'v1.2',
    creator: '法制科 刘科长', createTime: '2026-01-15 09:00:00'
  }
]

export const LEGAL_REFERENCE_RESULT = {
  referenceId: 'REF202608290001', status: '已完成', aiModel: 'legal-reference-v2.1', responseTime: '1.2秒',
  recommendedLaws: [
    {
      rank: 1, docId: 'LAW-2021-001', docTitle: '医疗保障基金使用监督管理条例',
      articleNo: '第四十条第一款第（一）项', articleTitle: '欺诈骗保行为-虚构医药服务项目', relevanceScore: 98,
      articleContent: '定点医药机构通过虚构医药服务项目等方式骗取医疗保障基金支出的，由医疗保障行政部门责令退回，处骗取金额2倍以上5倍以下的罚款；责令暂停相关责任部门6个月以上1年以下涉及医疗保障基金使用的医药服务，直至解除服务协议；有执业资格的，由有关主管部门依法吊销执业资格。',
      applicability: '串换药品属于虚构医药服务项目的一种表现形式，将非医保商品串换为医保药品结算，本质是骗取医保基金，适用本条。',
      penaltyRange: '骗取金额2-5倍罚款+暂停服务6个月-1年+解除协议+吊销执业资格',
      recommendedPenalty: '处骗取金额3倍罚款（16.8万元）+解除医保服务协议', inserted: true
    },
    {
      rank: 2, docId: 'LAW-2021-002', docTitle: '医疗保障行政处罚程序暂行规定',
      articleNo: '第二十二条', articleTitle: '立案条件', relevanceScore: 85,
      articleContent: '医疗保障行政部门对依据监督检查职权或者通过投诉、举报、其他部门移送、上级交办等途径发现的违法行为线索，应当自发现线索或者收到材料之日起十五个工作日内予以核查，由医疗保障行政部门负责人决定是否立案。',
      applicability: '本案已完成现场检查，证据充分，符合立案条件，应在规定时限内立案。', inserted: true
    }
  ],
  recommendedCases: [
    {
      rank: 1, caseId: 'CASE-LIB-00156', caseName: '芜湖某药店串换药品骗取医保基金案',
      violationType: '串换药品', amount: 8.2, handlingResult: '退回基金8.2万元+罚款24.6万元（3倍）+解除协议',
      similarity: 95, summary: '2025年查处的某药店将米、油等生活用品串换为医保药品结算，涉及8.2万元，处3倍罚款并解除协议。',
      referenceValue: '高', differences: '本案金额5.6万（参考案例8.2万），违法情节类似', inserted: false
    },
    {
      rank: 2, caseId: 'CASE-LIB-00203', caseName: '苏州某药店虚构购药记录骗保案',
      violationType: '虚构医药服务', amount: 12.5, handlingResult: '退回基金12.5万元+罚款50万元（4倍）+解除协议+移送公安',
      similarity: 78, summary: '2025年查处的某药店虚构购药记录，涉及12.5万元，因金额巨大且主观恶意明显，处4倍罚款并移送公安。',
      referenceValue: '中', differences: '本案含虚构购药2.4万，但主要为串换药品，未达移送标准', inserted: false
    }
  ],
  recommendedTemplates: [
    { rank: 1, templateId: 'TPL-DOC-008', templateName: '行政处罚决定书（欺诈骗保类）', relevanceScore: 96, applicability: '本案为串换药品骗取医保基金，属于欺诈骗保类，适用此模板', inserted: true },
    { rank: 2, templateId: 'TPL-DOC-012', templateName: '解除医保服务协议通知书', relevanceScore: 90, applicability: '本案拟解除医保服务协议，需出具此通知书', inserted: true }
  ]
}

/* ================= 3.4 数据源与接口 ================= */

export const DS_LIST = [
  {
    datasourceId: 'DS-SETTLE-001', datasourceName: '医保结算系统', datasourceType: '医保结算系统',
    connectionType: 'API接口', status: '运行中', syncFrequency: '实时（Kafka消息）',
    description: '芜湖市医保结算系统，提供门诊、住院、药店购药结算明细数据',
    tableCount: 3, dailyVolume: '约24.2万条', todaySyncCount: 242000, successRate: 0.9998,
    dataQuality: 99, lastSyncTime: '2026-08-29 14:30:00', delay: '秒级'
  },
  {
    datasourceId: 'DS-HIS-003', datasourceName: '芜湖XX医院HIS系统', datasourceType: '医院HIS系统',
    connectionType: '数据库同步', status: '异常', syncFrequency: '每15分钟',
    description: '医院HIS系统医嘱、收费、住院数据同步',
    tableCount: 5, dailyVolume: '约2.9万条', todaySyncCount: 15600, successRate: 0.92,
    dataQuality: 88, lastSyncTime: '2026-08-29 11:30:00', delay: '3小时'
  },
  {
    datasourceId: 'DS-INVENTORY-002', datasourceName: '药店进销存系统', datasourceType: '药店进销存系统',
    connectionType: '文件同步', status: '运行中', syncFrequency: '每日02:00',
    description: '连锁药店进销存台账每日批量同步',
    tableCount: 2, dailyVolume: '约8.6万条', todaySyncCount: 85600, successRate: 0.998,
    dataQuality: 97, lastSyncTime: '2026-08-29 02:00:00', delay: '已完成'
  },
  {
    datasourceId: 'DS-EMR-004', datasourceName: '电子病历系统', datasourceType: '电子病历系统',
    connectionType: 'API接口', status: '运行中', syncFrequency: '每小时',
    description: '电子病历文书、诊断、检查结果数据接入（脱敏）',
    tableCount: 4, dailyVolume: '约1.8万条', todaySyncCount: 18200, successRate: 0.996,
    dataQuality: 95, lastSyncTime: '2026-08-29 14:00:00', delay: '12分钟'
  }
]

export const DS_DETAIL: Record<string, any> = {
  'DS-SETTLE-001': {
    dataTables: [
      { tableName: '门诊结算明细', tableCode: 'OUTPATIENT_SETTLE', syncMode: '增量同步', fieldCount: 45, dailyVolume: '约15万条', syncStatus: '正常', delay: '秒级' },
      { tableName: '住院结算明细', tableCode: 'INPATIENT_SETTLE', syncMode: '增量同步', fieldCount: 52, dailyVolume: '约1.2万条', syncStatus: '正常', delay: '秒级' },
      { tableName: '药店购药结算', tableCode: 'PHARMACY_SETTLE', syncMode: '增量同步', fieldCount: 38, dailyVolume: '约8万条', syncStatus: '正常', delay: '秒级' }
    ],
    cleaningRules: [
      { ruleId: 'CLEAN-001', targetTable: '门诊结算明细', rule: '金额字段保留2位小数，负数标记为退费', status: '启用' },
      { ruleId: 'CLEAN-002', targetTable: '全部', rule: '去除参保人姓名中的特殊字符，身份证号脱敏存储', status: '启用' },
      { ruleId: 'CLEAN-003', targetTable: '药店购药结算', rule: '药品编码统一映射为国家医保药品编码', status: '启用' }
    ],
    dataQuality: { completeness: 0.998, accuracy: 0.995, consistency: 0.992, timeliness: 0.999, qualityScore: 99 },
    syncStats: { todaySyncCount: 242000, todayFailCount: 50, successRate: 0.9998, totalRecords: '约8.6亿条' },
    testResult: '连通正常，数据格式正确', lastTestTime: '2026-08-29 08:00:00'
  }
}

export const IF_LIST = [
  {
    interfaceId: 'IF-GOV-PUB-001', interfaceName: '行政处罚信息公示接口', systemName: '行政执法公示平台',
    direction: '出站（数据推送）', protocol: 'RESTful API', dataFormat: 'JSON', status: '运行中',
    endpoint: 'https://public.wuhu.gov.cn/api/v1/penalty/publish', method: 'POST',
    todayCallCount: 5, successRate: 1.0, avgResponseTime: '1.2秒', totalCallCount: 456,
    lastCallTime: '2026-08-29 10:30:00', version: 'v1.2'
  },
  {
    interfaceId: 'IF-NHSA-SYNC-001', interfaceName: '监管数据上报接口', systemName: '国家医保信息平台',
    direction: '出站（数据上报）', protocol: 'RESTful API', dataFormat: 'JSON', status: '运行中',
    endpoint: 'https://nhsa.gov.cn/api/v2/supervision/report', method: 'POST',
    todayCallCount: 2, successRate: 1.0, avgResponseTime: '2.8秒', totalCallCount: 186,
    lastCallTime: '2026-08-29 06:00:00', version: 'v2.0'
  },
  {
    interfaceId: 'IF-CREDIT-001', interfaceName: '医保信用数据上报接口', systemName: '信用信息平台',
    direction: '出站（数据推送）', protocol: 'WebService', dataFormat: 'XML', status: '运行中',
    endpoint: 'https://credit.wuhu.gov.cn/ws/medicalCredit', method: 'SOAP',
    todayCallCount: 1, successRate: 1.0, avgResponseTime: '3.5秒', totalCallCount: 45,
    lastCallTime: '2026-08-28 18:00:00', version: 'v1.0'
  },
  {
    interfaceId: 'IF-POLICE-001', interfaceName: '案件移送公安接口', systemName: '公安/纪检监察',
    direction: '出站（数据推送）', protocol: 'RESTful API', dataFormat: 'JSON', status: '运行中',
    endpoint: 'https://ga.wuhu.gov.cn/api/v1/case/transfer', method: 'POST',
    todayCallCount: 0, successRate: 1.0, avgResponseTime: '1.8秒', totalCallCount: 12,
    lastCallTime: '2026-08-20 11:00:00', version: 'v1.1'
  }
]

export const DS_MONITOR = {
  monitorTime: '2026-08-29 14:30:00', overallStatus: '正常（1通道异常）',
  channelCount: 12, normalCount: 11, abnormalCount: 1, interruptedCount: 0,
  channels: [
    { channelId: 'DS-SETTLE-001', channelName: '医保结算系统', status: '正常', dataType: '实时数据流', todayVolume: 242000, changeRate: 0.017, delay: '2秒', successRate: 0.9998, dataQuality: 99, alerts: [] },
    { channelId: 'DS-HIS-003', channelName: '芜湖XX医院HIS系统', status: '异常', dataType: '数据库同步', todayVolume: 15600, changeRate: -0.453, delay: '3小时', successRate: 0.92, dataQuality: 88, alerts: [{ alertId: 'ALT-DATA-001', level: '中', type: '数据延迟', message: '数据延迟3小时，超过2小时阈值', status: '处理中', assignee: '数据管理员 孙XX' }, { alertId: 'ALT-DATA-002', level: '中', type: '数据量异常', message: '今日数据量较昨日下降45.3%', status: '处理中', assignee: '数据管理员 孙XX' }] },
    { channelId: 'DS-INVENTORY-002', channelName: '药店进销存系统', status: '正常', dataType: '文件同步（每日）', todayVolume: 85600, changeRate: 0.017, delay: '已完成', successRate: 0.998, dataQuality: 97, alerts: [] },
    { channelId: 'DS-EMR-004', channelName: '电子病历系统', status: '正常', dataType: '接口同步（每小时）', todayVolume: 18200, changeRate: 0.008, delay: '12分钟', successRate: 0.996, dataQuality: 95, alerts: [] }
  ],
  todaySummary: { totalDataVolume: 361400, avgSuccessRate: 0.992, avgDataQuality: 97, abnormalChannels: 1, activeAlerts: 2 },
  trend: {
    xAxis: ['08-23', '08-24', '08-25', '08-26', '08-27', '08-28', '08-29'],
    totalVolume: [352000, 348000, 361000, 358000, 365000, 362000, 361400],
    successRate: [0.995, 0.994, 0.996, 0.993, 0.995, 0.994, 0.992],
    abnormalCount: [0, 1, 0, 0, 1, 0, 1]
  },
  alertRules: [
    { ruleId: 'AR-001', name: '通道中断告警', condition: '通道状态=中断', level: '高', notify: ['系统消息', '短信', '电话'], enabled: true },
    { ruleId: 'AR-002', name: '实时数据延迟告警', condition: '实时延迟>5分钟', level: '中', notify: ['系统消息', '短信'], enabled: true },
    { ruleId: 'AR-003', name: '批量数据延迟告警', condition: '批量延迟>2小时', level: '中', notify: ['系统消息', '短信'], enabled: true },
    { ruleId: 'AR-005', name: '数据量突降告警', condition: '今日量/昨日量<0.5', level: '中', notify: ['系统消息'], enabled: true },
    { ruleId: 'AR-006', name: '成功率低告警', condition: '成功率<95%', level: '高', notify: ['系统消息', '短信'], enabled: true },
    { ruleId: 'AR-007', name: '数据质量低告警', condition: '质量分<90', level: '低', notify: ['系统消息'], enabled: true }
  ]
}

/* ================= 3.5 组织与权限 ================= */

export const ORG_TREE = [
  {
    id: 'ORG-ROOT', label: '芜湖市医保局', count: 86,
    children: [
      { id: 'ORG-JJG', label: '基金监管处', count: 32, children: [
        { id: 'ORG-JJG-1', label: '稽核一组', count: 10 }, { id: 'ORG-JJG-2', label: '稽核二组', count: 10 }, { id: 'ORG-JJG-3', label: '稽核三组', count: 9 }
      ] },
      { id: 'ORG-FZK', label: '法制科', count: 12 },
      { id: 'ORG-XXZX', label: '信息中心', count: 18 },
      { id: 'ORG-RSK', label: '人事处', count: 8 },
      { id: 'ORG-YBZX', label: '医保中心', count: 16 }
    ]
  }
]

export const ORG_USERS = [
  {
    userId: 'USER-0001', userName: '王建国', account: 'wangjg', employeeNo: 'WHYB2018001', status: '在职',
    phone: '138****5678', email: 'wangjg@yibao.wuhu.gov.cn', orgName: '基金监管处', position: '处长',
    roles: ['监管领导', '基金监管处处长'], dataScope: '全市', mfaEnabled: true,
    lastLoginTime: '2026-08-29 09:15:00', entryDate: '2018-03-15',
    taskCount: { pending: 12, processing: 8, completed: 156 }
  },
  {
    userId: 'USER-0002', userName: '张立军', account: 'zhanglj', employeeNo: 'WHYB2019012', status: '在职',
    phone: '139****8765', email: 'zhanglj@yibao.wuhu.gov.cn', orgName: '基金监管处稽核一组', position: '组长',
    roles: ['稽核组长'], dataScope: '本组', mfaEnabled: true,
    lastLoginTime: '2026-08-29 08:45:00', entryDate: '2019-06-01',
    taskCount: { pending: 6, processing: 5, completed: 128 }
  },
  {
    userId: 'USER-0003', userName: '李明', account: 'lim', employeeNo: 'WHYB2021025', status: '在职',
    phone: '136****2345', email: 'lim@yibao.wuhu.gov.cn', orgName: '基金监管处稽核一组', position: '稽核员',
    roles: ['稽核员'], dataScope: '本组', mfaEnabled: true,
    lastLoginTime: '2026-08-29 10:30:00', entryDate: '2021-04-15',
    taskCount: { pending: 8, processing: 6, completed: 96 }
  },
  {
    userId: 'USER-0004', userName: '刘文静', account: 'liuwj', employeeNo: 'WHYB2017008', status: '在职',
    phone: '135****6789', email: 'liuwj@yibao.wuhu.gov.cn', orgName: '法制科', position: '科长',
    roles: ['法制审核'], dataScope: '全市', mfaEnabled: true,
    lastLoginTime: '2026-08-29 09:50:00', entryDate: '2017-09-01',
    taskCount: { pending: 5, processing: 3, completed: 210 }
  },
  {
    userId: 'USER-0005', userName: '赵敏', account: 'zhaom', employeeNo: 'WHYB2020031', status: '在职',
    phone: '137****4567', email: 'zhaom@yibao.wuhu.gov.cn', orgName: '信息中心', position: '规则管理员',
    roles: ['规则管理员'], dataScope: '全市', mfaEnabled: false,
    lastLoginTime: '2026-08-29 11:00:00', entryDate: '2020-02-10',
    taskCount: { pending: 4, processing: 3, completed: 78 }
  },
  {
    userId: 'USER-0006', userName: '陈志强', account: 'chenzq', employeeNo: 'WHYB2022042', status: '停用',
    phone: '138****9012', email: 'chenzq@yibao.wuhu.gov.cn', orgName: '信息中心', position: '运维工程师',
    roles: ['运维工程师'], dataScope: '全市', mfaEnabled: true,
    lastLoginTime: '2026-08-10 16:20:00', entryDate: '2022-07-01',
    taskCount: { pending: 0, processing: 0, completed: 45 }
  }
]

export const ROLE_LIST = [
  {
    roleId: 'ROLE-001', roleName: '监管领导', roleCode: 'LEADER', roleType: '系统角色', status: '启用',
    description: '局领导及分管领导，全部数据查看与各类审批终审', dataScope: '全市', userCount: 4,
    permissionSummary: ['全部数据查看', '任务审批', '处置审批', '文书审批', '规则审批'],
    updateTime: '2026-01-10 10:00:00'
  },
  {
    roleId: 'ROLE-002', roleName: '稽核组长', roleCode: 'GROUP_LEADER', roleType: '系统角色', status: '启用',
    description: '稽核组组长，负责本组任务分配、初审与人员管理', dataScope: '本组', userCount: 3,
    permissionSummary: ['本组数据', '任务分配', '初审', '催办督办'],
    updateTime: '2026-03-15 10:00:00'
  },
  {
    roleId: 'ROLE-003', roleName: '稽核员', roleCode: 'AUDITOR', roleType: '系统角色', status: '启用',
    description: '负责疑点线索核查、专项任务执行、现场检查、违规事实认定', dataScope: '本组', userCount: 18,
    permissionSummary: ['线索研判', '任务执行', '核查记录', '文书生成', '整改跟踪'],
    functionalPermissions: [
      { module: '疑点线索管理', permissions: ['线索列表查看', '线索详情查看', '线索研判', '线索核查', '线索申诉处理'] },
      { module: '专项任务管理', permissions: ['任务签收', '任务执行', '核查记录填写', '任务结果提交'] },
      { module: '违规处置', permissions: ['处置建议提交', '整改跟踪', '整改验收'] },
      { module: '文书生成', permissions: ['文书生成', '文书编辑', '文书提交审核'] },
      { module: '成果宣教', permissions: ['复盘参与', '案例查看'] },
      { module: '系统管理', permissions: ['个人信息修改', '密码修改'] }
    ],
    fieldPermissions: { patientInfo: '脱敏显示（姓名+身份证号脱敏）', amountInfo: '可查看', medicalRecord: '可查看（需审批留痕）' },
    changeHistory: [
      { version: 'v3.2', date: '2026-06-01', change: '增加线索申诉处理权限', operator: '系统管理员' },
      { version: 'v3.1', date: '2026-03-15', change: "调整数据范围为'本组'", operator: '系统管理员' }
    ],
    updateTime: '2026-06-01 14:00:00'
  },
  {
    roleId: 'ROLE-004', roleName: '法制审核', roleCode: 'LEGAL', roleType: '系统角色', status: '启用',
    description: '法制科审核人员，负责法条引用审核、裁量审核与法规库维护', dataScope: '全市', userCount: 6,
    permissionSummary: ['法制审核', '法规库维护', '裁量复核'],
    updateTime: '2026-02-20 10:00:00'
  },
  {
    roleId: 'ROLE-005', roleName: '规则管理员', roleCode: 'RULE_ADMIN', roleType: '自定义角色', status: '启用',
    description: '负责规则配置、参数管理、试跑验证与灰度发布', dataScope: '全市', userCount: 2,
    permissionSummary: ['规则配置', '参数管理', '试跑验证', '灰度发布申请'],
    updateTime: '2026-04-10 10:00:00'
  }
]

export const REVIEW_CONFIGS = [
  {
    reviewConfigId: 'RC-001', sceneName: '违规处置决定（金额>5万元）', sceneCode: 'PENALTY_DECISION_HIGH_AMOUNT',
    module: '违规处置智能体', status: '启用',
    description: '违规处置决定涉及金额超过5万元时，需经稽核组长初审、基金监管处处长复审、分管局长终审',
    triggerCondition: '处置金额 > 50,000元 且 处置类型 ∈ [行政处罚, 解除协议, 移送公安]',
    reviewLevels: [
      { level: 1, levelName: '初审', reviewerRole: '稽核组长', timeLimit: '24小时', timeoutAction: '自动升级至上级+短信提醒' },
      { level: 2, levelName: '复审', reviewerRole: '基金监管处处长', timeLimit: '48小时', timeoutAction: '短信提醒+系统消息' },
      { level: 3, levelName: '终审', reviewerRole: '分管局长', timeLimit: '72小时', timeoutAction: '短信提醒+局长办公室催办' }
    ],
    stats: { totalReviews: 45, pending: 3, approved: 40, rejected: 2, avgReviewTime: '1.5天', timeoutRate: 0.022 }
  },
  {
    reviewConfigId: 'RC-002', sceneName: '规则参数变更', sceneCode: 'RULE_PARAM_CHANGE',
    module: '系统管理与支撑模块', status: '启用',
    description: '规则阈值、时间窗口等关键参数变更需业务负责人审核后生效',
    triggerCondition: '参数类型 ∈ [阈值, 时间窗口, 权重]',
    reviewLevels: [
      { level: 1, levelName: '审核', reviewerRole: '基金监管处处长', timeLimit: '48小时', timeoutAction: '短信提醒' }
    ],
    stats: { totalReviews: 28, pending: 3, approved: 24, rejected: 1, avgReviewTime: '0.8天', timeoutRate: 0.036 }
  },
  {
    reviewConfigId: 'RC-003', sceneName: '敏感数据导出', sceneCode: 'SENSITIVE_DATA_EXPORT',
    module: '全智能体', status: '启用',
    description: '涉及参保人敏感信息的数据导出需双人复核并留痕',
    triggerCondition: '导出数据含敏感字段 或 导出量 > 1000条',
    reviewLevels: [
      { level: 1, levelName: '初审', reviewerRole: '部门负责人', timeLimit: '24小时', timeoutAction: '短信提醒' },
      { level: 2, levelName: '复审', reviewerRole: '安全管理员', timeLimit: '24小时', timeoutAction: '短信提醒' }
    ],
    stats: { totalReviews: 15, pending: 1, approved: 13, rejected: 1, avgReviewTime: '0.5天', timeoutRate: 0 }
  },
  {
    reviewConfigId: 'RC-004', sceneName: '用户权限变更', sceneCode: 'USER_PERMISSION_CHANGE',
    module: '系统管理与支撑模块', status: '启用',
    description: '用户角色调整、数据范围变更需系统管理员与人事处双重复核',
    triggerCondition: '角色变更 或 数据范围扩大',
    reviewLevels: [
      { level: 1, levelName: '初审', reviewerRole: '人事处', timeLimit: '48小时', timeoutAction: '系统消息' },
      { level: 2, levelName: '复审', reviewerRole: '系统管理员', timeLimit: '48小时', timeoutAction: '系统消息' }
    ],
    stats: { totalReviews: 22, pending: 2, approved: 19, rejected: 1, avgReviewTime: '1.2天', timeoutRate: 0.045 }
  }
]

/* ================= 3.6 数据安全与审计 ================= */

export const SECURITY_DESENSITIZE = {
  configName: '参保人敏感信息脱敏规则', status: '启用', scope: '全系统',
  rules: [
    { fieldId: 'DF-001', fieldName: '姓名', fieldCode: 'patient_name', sensitivityLevel: '高', rule: '保留姓氏，其余用*代替', example: { original: '张建国', desensitized: '张**' }, storageMode: '加密存储（AES-256）', queryMode: '动态脱敏（按权限）', exportMode: '强制脱敏', auditRequired: true },
    { fieldId: 'DF-002', fieldName: '身份证号', fieldCode: 'id_card', sensitivityLevel: '极高', rule: '保留前6位和后4位，中间8位用*代替', example: { original: '340202199001011234', desensitized: '340202********1234' }, storageMode: '加密存储+哈希索引', queryMode: '动态脱敏（按权限）', exportMode: '强制脱敏', auditRequired: true },
    { fieldId: 'DF-003', fieldName: '手机号', fieldCode: 'phone', sensitivityLevel: '高', rule: '保留前3位和后4位，中间4位用*代替', example: { original: '13812345678', desensitized: '138****5678' }, storageMode: '加密存储', queryMode: '动态脱敏', exportMode: '强制脱敏', auditRequired: false },
    { fieldId: 'DF-004', fieldName: '医保卡号', fieldCode: 'insurance_card_no', sensitivityLevel: '高', rule: '保留后4位，其余用*代替', example: { original: 'WHB202001011234', desensitized: '************1234' }, storageMode: '加密存储', queryMode: '动态脱敏', exportMode: '强制脱敏', auditRequired: false },
    { fieldId: 'DF-005', fieldName: '诊断信息', fieldCode: 'diagnosis', sensitivityLevel: '中', rule: '普通角色显示疾病大类，授权角色显示具体诊断', example: { original: '2型糖尿病伴糖尿病肾病', desensitized: '内分泌系统疾病' }, storageMode: '明文存储（业务需要）', queryMode: '动态脱敏（按角色）', exportMode: '按权限脱敏', auditRequired: true },
    { fieldId: 'DF-006', fieldName: '病历内容', fieldCode: 'medical_record', sensitivityLevel: '极高', rule: '默认不显示，需审批后限时查看（24小时），全程留痕', example: { original: '[完整病历内容]', desensitized: '[需审批后查看]' }, storageMode: '加密存储', queryMode: '审批后解密查看', exportMode: '禁止导出', auditRequired: true }
  ],
  encryption: {
    transport: { protocol: 'TLS 1.3', cipherSuite: 'TLS_AES_256_GCM_SHA384', certificate: '国密SM2证书', status: '已启用' },
    storage: { algorithm: 'AES-256', keyManagement: 'KMS（密钥管理服务）', keyRotation: '每90天自动轮换', databaseEncryption: 'TDE（透明数据加密）', status: '已启用' },
    backup: { algorithm: 'AES-256', status: '已启用' }
  },
  effect: { totalFields: 28, desensitizedFields: 18, encryptedFields: 12, coverageRate: 0.643, lastAuditTime: '2026-08-15 10:00:00', auditResult: '合规' }
}

export const AUDIT_STATS = {
  todayLogs: 12580, totalLogs: '约1.2亿条', sensitiveAccess: 86, exportOperations: 12,
  riskEvents: 3, chainStatus: '有效', coverageModules: 6,
  byType: [
    { type: '数据查询', count: 8560 }, { type: '数据修改', count: 1250 }, { type: '登录登出', count: 680 },
    { type: '审批操作', count: 420 }, { type: '配置变更', count: 86 }, { type: '数据导出', count: 12 }
  ]
}

export const AUDIT_LOGS = [
  {
    auditLogId: 'AUDIT-20260829-0001234', operationTime: '2026-08-29 10:30:15',
    operator: { userName: '李明', role: '稽核员', org: '基金监管处稽核一组' }, ip: '10.1.2.56',
    operationType: '数据修改', operationModule: '违规处置智能体', operationAction: '提交处置建议',
    operationObject: { objectType: '违规案件', objectId: 'CASE202608300001', objectName: '芜湖XX药店串换药品案' },
    before: { status: '核查完成', disposalSuggestion: null, penaltyAmount: null },
    after: { status: '待初审', disposalSuggestion: '退回基金5.6万元+罚款16.8万元+解除协议', penaltyAmount: 168000.0 },
    operationResult: '成功', riskLevel: '中', riskReason: '涉及处置决定提交，金额>5万，触发双人复核',
    integrity: { chainStatus: '有效', blockchainEvidence: 'BC-20260829-001234' }
  },
  {
    auditLogId: 'AUDIT-20260829-0001235', operationTime: '2026-08-29 11:05:22',
    operator: { userName: '赵敏', role: '规则管理员', org: '信息中心' }, ip: '10.1.3.18',
    operationType: '配置变更', operationModule: '系统管理与支撑模块', operationAction: '提交参数变更申请',
    operationObject: { objectType: '规则参数', objectId: 'PARAM-DRUG-003-001', objectName: '慢性病开药日量上限' },
    before: { pendingChange: null },
    after: { pendingChange: '增加代取药场景识别' },
    operationResult: '成功', riskLevel: '中', riskReason: '关键规则参数变更，需审批生效',
    integrity: { chainStatus: '有效', blockchainEvidence: 'BC-20260829-001235' }
  },
  {
    auditLogId: 'AUDIT-20260829-0001236', operationTime: '2026-08-29 13:42:08',
    operator: { userName: '张立军', role: '稽核组长', org: '基金监管处稽核一组' }, ip: '10.1.2.41',
    operationType: '数据查询', operationModule: '疑点线索管理智能体', operationAction: '审批后查看病历内容',
    operationObject: { objectType: '病历', objectId: 'MR-2026081500056', objectName: '张**住院病历' },
    before: null, after: null,
    operationResult: '成功', riskLevel: '高', riskReason: '极高敏感级数据访问（审批ID：APPR-20260828-0005），限时24小时',
    integrity: { chainStatus: '有效', blockchainEvidence: 'BC-20260829-001236' }
  },
  {
    auditLogId: 'AUDIT-20260829-0001237', operationTime: '2026-08-29 14:12:45',
    operator: { userName: '刘文静', role: '法制审核', org: '法制科' }, ip: '10.1.4.22',
    operationType: '数据导出', operationModule: '成果宣教智能体', operationAction: '导出复盘报告附件',
    operationObject: { objectType: '报告附件', objectId: 'RR202610250001', objectName: '质量评分表.xlsx' },
    before: null, after: null,
    operationResult: '成功', riskLevel: '低', riskReason: '常规导出，内容已脱敏',
    integrity: { chainStatus: '有效', blockchainEvidence: 'BC-20260829-001237' }
  },
  {
    auditLogId: 'AUDIT-20260829-0001238', operationTime: '2026-08-29 14:20:31',
    operator: { userName: '系统', role: '系统', org: '—' }, ip: '—',
    operationType: '登录登出', operationModule: '全平台', operationAction: '异常登录拦截',
    operationObject: { objectType: '用户账号', objectId: 'USER-0006', objectName: '陈志强（停用账号）' },
    before: { status: '停用' }, after: { status: '停用（登录拒绝）' },
    operationResult: '拦截', riskLevel: '高', riskReason: '停用账号尝试登录，IP 113.68.25.96（外部网络），已告警',
    integrity: { chainStatus: '有效', blockchainEvidence: 'BC-20260829-001238' }
  }
]

export const XINCHUANG = {
  configName: '智行合医系统信创适配配置', status: '已适配', adaptationRate: 0.95,
  categories: [
    {
      name: '操作系统', items: [
        { name: '银河麒麟高级服务器操作系统V10', version: 'V10 SP3', status: '已适配', performance: '达到原系统98%' },
        { name: '统信UOS服务器版', version: 'V20 1060e', status: '已适配', performance: '达到原系统96%' },
        { name: 'CentOS 7（兼容）', version: '7.9', status: '兼容支持', performance: '基准' }
      ]
    },
    {
      name: '数据库', items: [
        { name: '达梦数据库', version: 'DM8', status: '已适配', performance: '达到Oracle 95%' },
        { name: '人大金仓', version: 'KingbaseES V8R6', status: '已适配', performance: '达到Oracle 97%' },
        { name: '华为高斯DB', version: 'GaussDB 2.0', status: '适配中', performance: '测试中' },
        { name: 'Oracle 19c（兼容）', version: '19c', status: '兼容支持', performance: '基准' }
      ]
    },
    {
      name: '中间件', items: [
        { name: '东方通应用服务器', version: 'TongWeb 7.0', status: '已适配' },
        { name: '宝兰德应用服务器', version: 'BES 9.5', status: '已适配' }
      ]
    },
    {
      name: '浏览器', items: [
        { name: '奇安信安全浏览器', version: '最新版', status: '已适配' },
        { name: '360安全浏览器（信创版）', version: '最新版', status: '已适配' }
      ]
    }
  ],
  cryptography: { signatureAlgorithm: 'SM2（国密非对称加密）', hashAlgorithm: 'SM3（国密哈希）', symmetricAlgorithm: 'SM4（国密对称加密）', sslCertificate: '国密SSL证书（SM2）', status: '已适配' },
  currentDeployment: { os: '银河麒麟V10 SP3（ARM64）', database: '人大金仓KingbaseES V8R6', middleware: '东方通TongWeb 7.0', browser: '奇安信安全浏览器', domesticRate: 0.95, status: '运行稳定' },
  testReports: [
    { reportId: 'XCTEST-001', name: '银河麒麟+达梦适配测试报告', date: '2026-03-25', result: '通过' },
    { reportId: 'XCTEST-002', name: '统信UOS+人大金仓适配测试报告', date: '2026-04-25', result: '通过' },
    { reportId: 'XCTEST-003', name: '国密算法适配测试报告', date: '2026-05-25', result: '通过' }
  ],
  knownIssues: [
    { issueId: 'XCI-001', description: '达梦数据库部分复杂窗口函数性能略低', severity: '低', status: '优化中', workaround: '增加索引+SQL改写' }
  ]
}

/* ================= 3.7 消息与时限督办 ================= */

export const MSG_STATS = {
  totalToday: 156, unread: 23, todoCount: 12, warnCount: 5, noticeCount: 6,
  arrivalRate: 0.998,
  byType: [
    { type: '待办消息', count: 12 }, { type: '预警消息', count: 5 },
    { type: '通知消息', count: 4 }, { type: '公告消息', count: 2 }
  ],
  byChannel: [
    { channel: '系统站内消息', rate: 1.0 }, { channel: '短信', rate: 0.996 },
    { channel: '企业微信', rate: 0.998 }, { channel: '邮件', rate: 0.985 }
  ]
}

export const MESSAGES = [
  {
    messageId: 'MSG20260829000123', messageType: '待办消息', messageCategory: '复核审批',
    title: '【待初审】芜湖XX药店串换药品案处置建议',
    content: '稽核员李明于2026-08-29 10:30提交了芜湖XX药店串换药品案（CASE202608300001）的处置建议：退回基金5.6万元+罚款16.8万元+解除协议。请您在24小时内完成初审。',
    priority: '高', status: '未读', sender: '系统', receiver: '张组长（稽核一组）',
    sendTime: '2026-08-29 10:30:16', deadline: '2026-08-30 10:30:16', remainHours: 20, overdue: false,
    channels: ['系统站内消息', '短信', '企业微信'], actionType: '跳转处理'
  },
  {
    messageId: 'MSG20260829000119', messageType: '预警消息', messageCategory: '数据异常',
    title: '【数据延迟】芜湖XX医院HIS系统同步延迟3小时',
    content: '数据通道监控发现芜湖XX医院HIS系统数据延迟3小时，超过2小时阈值，请及时排查处理。',
    priority: '中', status: '未读', sender: '系统', receiver: '数据管理员 孙XX',
    sendTime: '2026-08-29 13:30:00', deadline: '2026-08-30 13:30:00', remainHours: 23, overdue: false,
    channels: ['系统站内消息', '短信'], actionType: '跳转处理'
  },
  {
    messageId: 'MSG20260829000115', messageType: '待办消息', messageCategory: '参数审核',
    title: '【待审核】慢性病开药规则参数变更申请',
    content: '规则管理员赵敏提交了慢性病开药日量上限参数的变更申请（增加代取药场景识别），预计误报率从6.7%降至3%以下，请审核。',
    priority: '中', status: '未读', sender: '系统', receiver: '基金监管处 王处长',
    sendTime: '2026-08-29 09:00:00', deadline: '2026-08-31 09:00:00', remainHours: 42, overdue: false,
    channels: ['系统站内消息', '企业微信'], actionType: '跳转处理'
  },
  {
    messageId: 'MSG20260829000108', messageType: '通知消息', messageCategory: '灰度发布',
    title: '【灰度启动】慢性病开药规则v2.2灰度发布已启动',
    content: 'v2.2已于2026-09-01 00:00在镜湖区、弋江区灰度启动，双版本并行运行2周，灰度期间请关注对比指标。',
    priority: '低', status: '已读', sender: '系统', receiver: '规则管理员、模型运营组',
    sendTime: '2026-09-01 00:00:00', deadline: null, remainHours: null, overdue: false,
    channels: ['系统站内消息'], actionType: '查看详情'
  },
  {
    messageId: 'MSG20260829000098', messageType: '公告消息', messageCategory: '培训通知',
    title: '【培训通知】过度诊疗认定指引专题培训（9月5日）',
    content: '定于9月5日14:30在局三楼会议室开展《过度诊疗认定指引》专题培训，请各稽核组全体人员、法制科相关人员参加。',
    priority: '低', status: '已读', sender: '人事处', receiver: '全体稽核人员',
    sendTime: '2026-08-28 16:00:00', deadline: null, remainHours: null, overdue: false,
    channels: ['系统站内消息', '企业微信'], actionType: '查看详情'
  },
  {
    messageId: 'MSG20260829000085', messageType: '预警消息', messageCategory: '超期督办',
    title: '【超期15天】芜湖XX医院过度诊疗案整改验收',
    content: '芜湖XX医院过度诊疗案整改验收已超期15天，已升级至分管局长并发送督办单，请稽核二组立即处理。',
    priority: '高', status: '未读', sender: '系统', receiver: '稽核二组全体',
    sendTime: '2026-08-29 08:00:00', deadline: '2026-08-14 14:00:00', remainHours: -360, overdue: true,
    channels: ['系统站内消息', '短信', '企业微信'], actionType: '跳转处理'
  }
]

export const SUPERVISION = {
  supervisionTime: '2026-08-29 14:30:00',
  overallStats: { totalItems: 156, pending: 45, inProgress: 38, completed: 68, overdue: 5, overdueRate: 0.032, onTimeRate: 0.968, avgDuration: '2.1天', upcoming24h: 8 },
  items: [
    {
      itemId: 'ITEM-0001', itemName: '芜湖XX药店串换药品案-初审', itemType: '复核审批', module: '违规处置智能体',
      assignee: '张组长（稽核一组）', deadline: '2026-08-30 10:30:16', remainHours: 20,
      status: '进行中', overdue: false, priority: '高', supervisionLevel: '正常监控',
      escalationRule: '超期24小时自动升级至基金监管处处长'
    },
    {
      itemId: 'ITEM-0002', itemName: '芜湖XX医院过度诊疗案-整改验收', itemType: '整改验收', module: '违规处置智能体',
      assignee: '王稽核（稽核二组）', deadline: '2026-08-14 14:00:00', overdueDays: 15,
      status: '已超期', overdue: true, priority: '高', supervisionLevel: '重点督办',
      overdueReason: '机构整改材料提交延迟，验收人员出差',
      escalationHistory: [
        { time: '2026-08-15 14:00:00', level: '升级至处长', action: '发送督办单', result: '处长已批示，要求尽快完成' },
        { time: '2026-08-21 14:00:00', level: '升级至分管局长', action: '发送超期通报', result: '局长已关注' }
      ],
      supervisionOrder: { orderId: 'SO-202608160001', creator: '基金监管处 王处长', content: '请稽核二组于8月25日前完成芜湖XX医院整改验收，如机构仍未提交整改材料，按协议规定处理。', status: '处理中' }
    },
    {
      itemId: 'ITEM-0003', itemName: '慢性病开药规则参数变更-审核', itemType: '规则发布', module: '系统管理与支撑模块',
      assignee: '基金监管处 王处长', deadline: '2026-08-31 09:00:00', remainHours: 42,
      status: '进行中', overdue: false, priority: '中', supervisionLevel: '正常监控',
      escalationRule: '超期48小时短信提醒'
    },
    {
      itemId: 'ITEM-0004', itemName: 'TASK202608290003专项任务-结果提交', itemType: '专项任务', module: '专项任务管理智能体',
      assignee: '稽核三组', deadline: '2026-08-30 18:00:00', remainHours: 27,
      status: '进行中', overdue: false, priority: '中', supervisionLevel: '正常监控',
      escalationRule: '超期24小时自动升级至处长'
    },
    {
      itemId: 'ITEM-0005', itemName: '行政处罚决定书（2026〕028号）-用印', itemType: '文书处理', module: '文书生成智能体',
      assignee: '法制科 刘科长', deadline: '2026-08-29 18:00:00', remainHours: 3,
      status: '临期', overdue: false, priority: '高', supervisionLevel: '正常监控',
      escalationRule: '超期即时告警'
    }
  ],
  byType: [
    { type: '专项任务', total: 32, overdue: 1, onTimeRate: 0.969, avgDuration: '15天' },
    { type: '复核审批', total: 45, overdue: 1, onTimeRate: 0.978, avgDuration: '1.2天' },
    { type: '违规处置', total: 28, overdue: 2, onTimeRate: 0.929, avgDuration: '8天' },
    { type: '整改验收', total: 25, overdue: 1, onTimeRate: 0.96, avgDuration: '5天' },
    { type: '文书处理', total: 18, overdue: 0, onTimeRate: 1.0, avgDuration: '0.5天' },
    { type: '其他', total: 8, overdue: 0, onTimeRate: 1.0, avgDuration: '1天' }
  ],
  byOrg: [
    { org: '稽核一组', total: 42, overdue: 1, onTimeRate: 0.976, avgDuration: '2.0天' },
    { org: '稽核二组', total: 38, overdue: 2, onTimeRate: 0.947, avgDuration: '2.5天' },
    { org: '稽核三组', total: 40, overdue: 1, onTimeRate: 0.975, avgDuration: '2.1天' },
    { org: '法制科', total: 20, overdue: 1, onTimeRate: 0.95, avgDuration: '1.8天' },
    { org: '基金监管处', total: 16, overdue: 0, onTimeRate: 1.0, avgDuration: '1.5天' }
  ],
  trend: {
    xAxis: ['3月', '4月', '5月', '6月', '7月', '8月'],
    onTimeRate: [0.92, 0.935, 0.95, 0.96, 0.965, 0.968],
    overdueCount: [12, 10, 8, 6, 5, 5]
  },
  rules: [
    { ruleId: 'SR-001', name: '到期前24小时提醒', trigger: '距截止24小时', action: '系统消息+企业微信', enabled: true },
    { ruleId: 'SR-002', name: '到期前2小时提醒', trigger: '距截止2小时', action: '系统消息+短信', enabled: true },
    { ruleId: 'SR-003', name: '超期即时告警', trigger: '超过截止时间', action: '系统消息+短信+上级通知', enabled: true },
    { ruleId: 'SR-004', name: '超期24小时升级', trigger: '超期24小时', action: '升级至直接上级+发送督办单', enabled: true },
    { ruleId: 'SR-005', name: '超期7天再升级', trigger: '超期7天', action: '升级至分管领导+全局通报', enabled: true }
  ]
}

/* ================= 3.8 运行监控 ================= */

export const AGENT_MONITOR = {
  monitorTime: '2026-08-29 14:30:00', overallStatus: '正常',
  agentCount: 6, normalCount: 6, abnormalCount: 0,
  agents: [
    { agentId: 'AGENT-001', agentName: '疑点线索管理智能体', status: '运行中', version: 'v2.3.1', uptime: '45天12小时', todayProcessed: 2881, successRate: 0.999, avgResponseTime: '1.2秒', queueBacklog: 0, cpu: 35, memory: 42, aiModel: 'clue-analysis-v2.1', todayTokens: 1250000, alerts: [] },
    { agentId: 'AGENT-002', agentName: '专项任务管理智能体', status: '运行中', version: 'v1.6.2', uptime: '38天6小时', todayProcessed: 76, successRate: 1.0, avgResponseTime: '0.8秒', queueBacklog: 0, cpu: 22, memory: 30, aiModel: 'task-cluster-v1.4', todayTokens: 186000, alerts: [] },
    { agentId: 'AGENT-003', agentName: '违规处置智能体', status: '运行中', version: 'v1.9.0', uptime: '32天4小时', todayProcessed: 45, successRate: 1.0, avgResponseTime: '1.5秒', queueBacklog: 0, cpu: 28, memory: 36, aiModel: 'violation-classify-v2.3', todayTokens: 850000, alerts: [] },
    { agentId: 'AGENT-004', agentName: '文书生成智能体', status: '运行中', version: 'v1.8.0', uptime: '30天8小时', todayProcessed: 28, successRate: 1.0, avgResponseTime: '15秒', queueBacklog: 2, cpu: 55, memory: 68, aiModel: 'document-generation-v3.2', todayTokens: 560000, alerts: [{ level: '低', type: '队列积压', message: '文书生成队列积压2个任务', status: '处理中' }] },
    { agentId: 'AGENT-005', agentName: '成果宣教智能体', status: '运行中', version: 'v1.3.0', uptime: '25天10小时', todayProcessed: 156, successRate: 0.998, avgResponseTime: '2.1秒', queueBacklog: 0, cpu: 30, memory: 40, aiModel: 'education-generate-v1.2', todayTokens: 320000, alerts: [] },
    { agentId: 'AGENT-006', agentName: '系统管理与支撑模块', status: '运行中', version: 'v1.5.0', uptime: '45天12小时', todayProcessed: 5860, successRate: 1.0, avgResponseTime: '0.4秒', queueBacklog: 0, cpu: 18, memory: 26, aiModel: 'legal-reference-v2.1', todayTokens: 280000, alerts: [] }
  ],
  aiServiceOverview: {
    totalModels: 8, todayTotalCalls: 12560, todayTotalTokens: 8560000, avgSuccessRate: 0.998, avgResponseTime: '2.5秒',
    models: [
      { name: 'clue-analysis-v2.1', calls: 2881, tokens: 1250000, status: '正常' },
      { name: 'document-generation-v3.2', calls: 28, tokens: 560000, status: '正常' },
      { name: 'legal-reference-v2.1', calls: 156, tokens: 280000, status: '正常' },
      { name: 'violation-classify-v2.3', calls: 2881, tokens: 850000, status: '正常' },
      { name: 'knowledge-graph-query-v1.5', calls: 5620, tokens: 420000, status: '正常' },
      { name: 'education-generate-v1.2', calls: 15, tokens: 320000, status: '正常' },
      { name: 'ocr-recognition-v2.0', calls: 856, tokens: 1200000, status: '正常' },
      { name: 'nlp-extract-v1.8', calls: 123, tokens: 680000, status: '正常' }
    ]
  },
  resourceOverview: { totalNodes: 12, healthyNodes: 12, avgCpu: 38, avgMemory: 52, avgGpu: 25, storageUsage: 42.5 },
  trend: {
    xAxis: ['00:00', '04:00', '08:00', '12:00', '14:30'],
    totalProcessed: [120, 85, 560, 890, 1256],
    successRate: [0.999, 1.0, 0.998, 0.997, 0.998]
  }
}

export const OPS_MONITOR = {
  monitorTime: '2026-08-29 14:30:00', overallHealth: '健康', healthScore: 96,
  components: [
    { name: '服务器', total: 12, healthy: 12, warning: 0 },
    { name: '数据库', total: 4, healthy: 4, warning: 0 },
    { name: '中间件', total: 6, healthy: 6, warning: 0 },
    { name: '网络', total: 8, healthy: 8, warning: 0 },
    { name: '存储', total: 4, healthy: 4, warning: 0 },
    { name: '应用', total: 15, healthy: 14, warning: 1 }
  ],
  servers: [
    { serverName: 'app-server-01', ip: '10.1.1.11', os: '银河麒麟V10 SP3', role: '应用服务器', status: '正常', cpu: 35, memory: 43.8, disk: 42.5, uptime: '45天12小时' },
    { serverName: 'app-server-02', ip: '10.1.1.12', os: '银河麒麟V10 SP3', role: '应用服务器', status: '正常', cpu: 42, memory: 51.2, disk: 45.8, uptime: '45天12小时' },
    { serverName: 'db-server-01', ip: '10.1.1.21', os: '银河麒麟V10 SP3', role: '数据库服务器', status: '正常', cpu: 28, memory: 62.5, disk: 68.2, uptime: '60天3小时' },
    { serverName: 'gpu-server-01', ip: '10.1.1.31', os: '银河麒麟V10 SP3', role: 'AI算力服务器', status: '正常', cpu: 45, memory: 58.6, disk: 38.5, uptime: '30天8小时' }
  ],
  databases: [
    { dbName: 'kingbase-primary', type: '人大金仓KingbaseES V8R6', role: '主库', status: '正常', connections: 128, connectionUsage: 25.6, qps: 2560, slowQueries: 3, cacheHitRate: 0.992, replicationLag: '0秒' },
    { dbName: 'dm-readonly-01', type: '达梦数据库DM8', role: '只读库', status: '正常', connections: 86, connectionUsage: 17.2, qps: 1280, slowQueries: 1, cacheHitRate: 0.988, replicationLag: '2秒' }
  ],
  applications: [
    { appName: '智行合医监管平台', version: 'v2.3.1', status: '警告', instances: 4, healthyInstances: 3, avgResponseTime: '120ms', errorRate: 0.008, qps: 560, alerts: [{ alertId: 'OPS-001', level: '中', type: '实例异常', message: '应用实例app-04健康检查失败', status: '处理中', assignee: '运维工程师 陈XX' }] },
    { appName: '规则引擎服务', version: 'v1.5.0', status: '正常', instances: 2, healthyInstances: 2, avgResponseTime: '45ms', errorRate: 0.001, qps: 320, alerts: [] },
    { appName: '知识图谱服务', version: 'v1.5.0', status: '正常', instances: 2, healthyInstances: 2, avgResponseTime: '80ms', errorRate: 0.002, qps: 280, alerts: [] }
  ],
  alertRules: [
    { ruleId: 'OR-001', name: 'CPU使用率告警', condition: 'CPU>85%持续5分钟', level: '中', notify: ['系统消息', '短信'], enabled: true },
    { ruleId: 'OR-003', name: '磁盘空间告警', condition: '磁盘剩余<10%', level: '高', notify: ['系统消息', '短信', '电话'], enabled: true },
    { ruleId: 'OR-005', name: '慢查询告警', condition: '慢查询>10秒', level: '低', notify: ['系统消息'], enabled: true },
    { ruleId: 'OR-006', name: '接口错误率告警', condition: '错误率>5%', level: '高', notify: ['系统消息', '短信'], enabled: true },
    { ruleId: 'OR-007', name: '服务不可用告警', condition: '健康检查失败', level: '高', notify: ['系统消息', '短信', '电话'], enabled: true }
  ],
  trend: {
    xAxis: ['00:00', '04:00', '08:00', '12:00', '14:30'],
    avgCpu: [15, 12, 35, 42, 38],
    avgMemory: [45, 44, 50, 55, 52],
    qps: [85, 60, 420, 680, 560]
  },
  inspection: { lastInspection: '2026-08-29 08:00:00', inspectionResult: '正常（1项警告）', nextInspection: '2026-08-30 08:00:00' }
}
