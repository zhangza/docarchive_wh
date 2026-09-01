/**
 * 标杆案例 CL20260829000001 全链路数据
 * 覆盖：AI 研判 → 线上自查 → 线下核查 → 机构申诉 → 全周期 → 误判反馈 → 知识图谱
 */

/* ============ AI 研判建议 ============ */
export const AI_JUDGMENT: Record<string, any> = {
  CL20260829000001: {
    clueId: 'CL20260829000001',
    suggestion: '建议确认为违规（超量开药）',
    suggestLevel: '高',
    confidence: 95,
    modelVersion: 'v2.3.1',
    analyzeTime: '2026-08-29 08:15:48',
    costMs: 1240,
    reasons: [
      { title: '规则强命中', desc: '命中「慢性病开药不超过7日量」（RULE-DRUG-003），处方 14 日量 vs 结算 42 日量，超出 3 倍。', weight: 38 },
      { title: '处方-结算数据背离', desc: '处方开具 2 盒，医保结算 6 盒，数量差异 4 盒，差异率 200%，远超 5% 容差阈值。', weight: 27 },
      { title: '历史行为异常', desc: '该参保人近 90 日格列美脲片累计购入 18 盒（合理约 12 盒），存在囤药倾向。', weight: 18 },
      { title: '机构同类线索聚集', desc: '芜湖市第一人民医院内分泌科近 30 日同类超量开药线索 7 条，高于同级机构均值（2.3 条）。', weight: 12 },
      { title: '医师处方行为画像', desc: '李建国医师近 30 日长处方占比 22.6%，位于同科室 P90 分位。', weight: 5 }
    ],
    similarCases: [
      { caseId: 'CASE20250612008', title: '某三甲医院内分泌科降糖药超量开药案', result: '确认违规', amount: 2360, sim: 94 },
      { caseId: 'CASE20250908021', title: '慢病长处方超量结算典型案例', result: '确认违规', amount: 1580, sim: 89 },
      { caseId: 'CASE20251120014', title: '家属代取药合并结算争议案', result: '部分合理', amount: 420, sim: 81 }
    ],
    policyRefs: [
      { code: '皖医保发〔2024〕18号', title: '安徽省基本医疗保险门诊慢特病用药管理办法', clause: '第十二条：门诊慢特病一次处方量原则上不超过 7 日，长处方需备案。' },
      { code: '医保发〔2020〕45号', title: '医疗保障基金使用监督管理条例配套细则', clause: '第二十条：超量开药造成基金损失的，应追回并按规定处理。' }
    ],
    riskFactors: { 金额: 42, 置信度: 95, 违规严重度: 78, 历史累犯: 65, 机构信用: 34, 数据完整度: 92 },
    conclusionOptions: ['确认违规', '合理驳回', '转线上筛查', '转线下核查', '专家会诊']
  },
  CL20260829000002: {
    clueId: 'CL20260829000002',
    suggestion: '建议驳回（临床合理·重症用药）',
    suggestLevel: '低',
    confidence: 88,
    modelVersion: 'v2.3.1',
    analyzeTime: '2026-08-29 08:16:22',
    costMs: 1580,
    reasons: [
      { title: '临床合理性豁免', desc: '患者主诊断「肺癌晚期（骨转移）」，符合《癌症疼痛诊疗规范》三阶梯镇痛长期用药指征。', weight: 45 },
      { title: '处方结算一致', desc: '处方 10 盒、结算 10 盒完全一致，不存在数据背离。', weight: 30 },
      { title: '麻精药品台账完整', desc: '麻醉药品专用处方、红处方登记、回收空安瓿记录齐全。', weight: 15 },
      { title: '规则阈值不适用', desc: 'RULE-DRUG-003 未对晚期癌痛患者设置豁免白名单，属规则覆盖缺口。', weight: 10 }
    ],
    similarCases: [
      { caseId: 'CASE20250420003', title: '晚期癌痛患者阿片类药物长处方案', result: '合理驳回', amount: 0, sim: 96 }
    ],
    policyRefs: [
      { code: '国卫办医函〔2018〕1177号', title: '癌症疼痛诊疗规范（2018年版）', clause: '晚期癌痛患者可按需长期使用强阿片类药物，处方量可适当放宽。' }
    ],
    riskFactors: { 金额: 22, 置信度: 72, 违规严重度: 18, 历史累犯: 12, 机构信用: 34, 数据完整度: 96 },
    conclusionOptions: ['确认违规', '合理驳回', '转线上筛查', '转线下核查', '专家会诊']
  }
}

/* ============ 数据比对明细（处方 vs 结算） ============ */
export const DIFF_DETAIL: Record<string, any> = {
  CL20260829000001: {
    left: { title: '处方数据（HIS处方流转平台）', source: '芜湖市第一人民医院 HIS', time: '2026-08-28 10:12:33', no: 'RX20260828001233' },
    right: { title: '医保结算数据（结算清单）', source: '芜湖市医保结算中心', time: '2026-08-28 10:26:07', no: 'ST20260828000512' },
    rows: [
      { field: '药品名称', left: '格列美脲片 2mg*30片', right: '格列美脲片 2mg*30片', diff: false },
      { field: '开药数量', left: '2 盒', right: '6 盒', diff: true, gap: '+4 盒' },
      { field: '折算天数', left: '14 日', right: '42 日', diff: true, gap: '+28 日' },
      { field: '医保限量', left: '7 日/次', right: '7 日/次', diff: false },
      { field: '单价', left: '45.00 元', right: '45.00 元', diff: false },
      { field: '金额', left: '90.00 元', right: '270.00 元', diff: true, gap: '+180.00 元' },
      { field: '基金支付', left: '67.50 元', right: '202.50 元', diff: true, gap: '+135.00 元' },
      { field: '开方医师', left: '李建国（主任医师）', right: '李建国（主任医师）', diff: false },
      { field: '诊断', left: '2型糖尿病', right: '2型糖尿病', diff: false },
      { field: '结算日期', left: '2026-08-28', right: '2026-08-28', diff: false }
    ]
  }
}

/* ============ 线上自查任务 ============ */
export const SELF_CHECKS: any[] = [
  {
    taskId: 'SC202608290001',
    clueId: 'CL20260829000001',
    orgCode: 'H340200001',
    orgName: '芜湖市第一人民医院',
    violationType: '超量开药',
    riskLevel: '高',
    suspectedAmount: 180.0,
    issueTime: '2026-08-29 09:30:00',
    deadline: '2026-09-05 18:00:00',
    submitTime: '2026-09-01 15:42:18',
    status: '已初筛',
    screenResult: '存疑线索',
    orgReply:
      '经查，患者张伟民为长期糖尿病随访患者，因家属外出务工需集中代取药物，本次由家属一次代取 3 个月用量，其中 2 盒当日发出、4 盒为前次处方结余合并结算，属结算操作时点差异，并非实际超量开药。',
    materials: [
      { name: '门诊处方（复印件）', type: 'PDF', size: '286 KB', uploadTime: '2026-09-01 15:20:11', verify: '通过', ocrConfidence: 96 },
      { name: '发药记录截图', type: 'PNG', size: '512 KB', uploadTime: '2026-09-01 15:24:35', verify: '通过', ocrConfidence: 93 },
      { name: '家属代取委托书', type: 'JPG', size: '748 KB', uploadTime: '2026-09-01 15:31:02', verify: '通过', ocrConfidence: 88 },
      { name: '患者病情说明', type: '—', size: '—', uploadTime: '—', verify: '需补正', ocrConfidence: 0 }
    ],
    selfReport: [
      { itemName: '格列美脲片', selfQty: 4, insuranceQty: 6, diff: -2, unitPrice: 45, diffAmount: 90, match: false },
      { itemName: '糖化血红蛋白检测', selfQty: 0, insuranceQty: 1, diff: -1, unitPrice: 62, diffAmount: 62, match: false },
      { itemName: '空腹血糖', selfQty: 1, insuranceQty: 1, diff: 0, unitPrice: 8, diffAmount: 0, match: true },
      { itemName: '诊查费（主任医师）', selfQty: 1, insuranceQty: 1, diff: 0, unitPrice: 15, diffAmount: 0, match: true }
    ],
    aiScreen: {
      conclusion: '存疑线索',
      confidence: 76,
      analysis:
        '机构说明"家属代取合并结算"具备一定合理性，但自报数据（4盒）与医保结算数据（6盒）仍存在 2 盒差异，且"糖化血红蛋白检测"自报未执行而医保已结算，存在虚记费用嫌疑；关键材料「患者病情说明」缺失，无法完成闭环认定，建议转线下核查。',
      points: ['自报与结算仍差 2 盒（90.00 元）', '糖化血红蛋白检测自报 0 次 / 结算 1 次（62.00 元）', '缺失患者病情说明材料', '代取委托书签署日期晚于结算日期 3 天']
    }
  }
]

/* ============ 线下核查任务 ============ */
export const INSPECTIONS: any[] = [
  {
    taskId: 'INS202608300001',
    clueId: 'CL20260829000001',
    orgCode: 'H340200001',
    orgName: '芜湖市第一人民医院',
    inspectDate: '2026-08-30',
    inspectType: '现场核查',
    status: '已完成',
    inspectors: ['稽核员·王振华', '稽核员·李明华'],
    leader: '稽核组长·张建国',
    checklist: [
      { seq: 1, name: '处方核验', desc: '核对门诊处方原件与 HIS 电子处方一致性', status: '已完成', result: '一致', evidence: 2 },
      { seq: 2, name: '发药记录核验', desc: '核查药房发药明细及库存流水', status: '已完成', result: '存在差异', evidence: 3 },
      { seq: 3, name: '病历核验', desc: '核查门诊病历中糖化血红蛋白检测记录', status: '已完成', result: '无记录', evidence: 1 },
      { seq: 4, name: '问询笔录', desc: '对开方医师李建国进行问询并制作笔录', status: '已完成', result: '已签认', evidence: 1 }
    ],
    ocrRecords: [
      { ocrId: 'OCR202608300001', type: '处方', fileName: '门诊处方_20260828.jpg', confidence: 96, fields: { 处方号: 'RX20260828001233', 患者: '张伟民', 药品: '格列美脲片', 数量: '2盒', 医师: '李建国' } },
      { ocrId: 'OCR202608300002', type: '发药单', fileName: '药房发药明细_20260828.jpg', confidence: 94, fields: { 发药单号: 'FY20260828000871', 药品: '格列美脲片', 发出数量: '4盒', 发药人: '刘丽娟' } },
      { ocrId: 'OCR202608300003', type: '库存台账', fileName: '西药库出库台账_202608.pdf', confidence: 91, fields: { 期初: '186盒', 入库: '120盒', 出库: '242盒', 期末: '64盒' } }
    ],
    interviews: [
      {
        recordId: 'REC202608300001',
        interviewee: '李建国',
        role: '开方医师·主任医师',
        time: '2026-08-30 14:20:00',
        duration: '32分钟',
        signed: true,
        summary:
          '承认因患者家属反复请求，为方便患者将 3 次处方量合并在一次处方中开具，并由药房分次发出；对糖化血红蛋白检测项目表示"系统模板带出未及时删除"，承认未实际执行。',
        keyPoints: ['承认合并开具超量处方', '承认糖化血红蛋白检测未实际执行', '表示系统模板存在带出缺陷']
      }
    ],
    evidences: [
      { evidenceId: 'EV202608300001', name: '门诊处方原件扫描', type: '书证', collectTime: '2026-08-30 10:15:00', collector: '稽核员·王振华', hash: 'a3f9c2...8e41', chainStatus: '已固化' },
      { evidenceId: 'EV202608300002', name: '药房发药明细流水', type: '电子数据', collectTime: '2026-08-30 10:48:00', collector: '稽核员·王振华', hash: 'b7d1e5...2c93', chainStatus: '已固化' },
      { evidenceId: 'EV202608300003', name: '门诊病历（无检测记录）', type: '书证', collectTime: '2026-08-30 11:20:00', collector: '稽核员·李明华', hash: 'c1a8f3...6b72', chainStatus: '已固化' },
      { evidenceId: 'EV202608300004', name: '西药库出库台账', type: '书证', collectTime: '2026-08-30 13:35:00', collector: '稽核员·李明华', hash: 'd9e2b6...4f18', chainStatus: '已固化' },
      { evidenceId: 'EV202608300005', name: '医师问询笔录（签认）', type: '言词证据', collectTime: '2026-08-30 14:52:00', collector: '稽核员·王振华', hash: 'e5c7a1...9d36', chainStatus: '已固化' },
      { evidenceId: 'EV202608300006', name: '现场核查照片（药房）', type: '视听资料', collectTime: '2026-08-30 15:10:00', collector: '稽核员·李明华', hash: 'f2b4d8...7a25', chainStatus: '已固化' }
    ],
    conclusion: {
      result: '确认违规',
      violationTypes: ['超量开药', '虚记费用'],
      confirmAmount: 242.0,
      detail: '超量开药 180.00 元 + 虚记糖化血红蛋白检测费用 62.00 元，合计 242.00 元。',
      submitTime: '2026-08-30 16:45:00',
      submitter: '稽核员·王振华'
    }
  }
]

/* ============ 机构申诉 ============ */
export const APPEALS: any[] = [
  {
    appealId: 'AP202608310001',
    clueId: 'CL20260829000001',
    orgCode: 'H340200001',
    orgName: '芜湖市第一人民医院',
    applicant: '医保办·张桂芳主任',
    phone: '0553-3812366',
    submitTime: '2026-08-31 14:30:00',
    appealType: '事实认定异议',
    originalResult: '确认违规 · 242.00 元',
    appealAmount: 62.0,
    status: '已复核',
    reason:
      '对"虚记糖化血红蛋白检测费用 62.00 元"的认定存在异议。经复查 LIS 系统，该患者于 2026-08-28 09:47 确有糖化血红蛋白检测样本接收与结果记录（报告号 LIS20260828004512），仅因门诊病历模板未自动回写导致病历中无记载，属病历书写瑕疵而非虚记费用。对超量开药 180.00 元的认定无异议，已完成整改。',
    materials: [
      { name: 'LIS检验报告（HbA1c 8.2%）', type: 'PDF', size: '196 KB', verify: '通过' },
      { name: '检验科样本接收记录', type: 'PNG', size: '328 KB', verify: '通过' },
      { name: '病历模板缺陷说明及整改方案', type: 'PDF', size: '412 KB', verify: '通过' },
      { name: '超量开药整改报告', type: 'PDF', size: '286 KB', verify: '通过' }
    ],
    aiPreReview: {
      conclusion: '申诉部分成立',
      confidence: 92,
      time: '2026-08-31 14:52:36',
      analysis:
        '申诉方提供的 LIS 报告与样本接收记录时间戳（09:47 / 09:31）早于结算时间（10:26），链路自洽且可交叉验证，可证明糖化血红蛋白检测实际执行。原认定「虚记费用 62.00 元」依据不足，建议撤销该部分；超量开药 180.00 元部分申诉方无异议，建议维持。',
      points: [
        'LIS 报告号 LIS20260828004512 可在检验系统独立验证',
        '样本接收时间 09:31 < 结算时间 10:26，时序合理',
        '检验结果 HbA1c 8.2% 与糖尿病诊断相符',
        '病历未回写属书写规范问题，建议同步下发整改通知'
      ]
    },
    review: {
      reviewer: '稽核员·陈晓东',
      approver: '稽核组长·张建国',
      time: '2026-09-01 10:00:00',
      result: '部分撤销原结论',
      finalAmount: 180.0,
      opinion:
        '同意 AI 初核意见。撤销「虚记费用 62.00 元」认定，维持「超量开药 180.00 元」认定，追回基金 135.00 元；同时就病历书写不规范问题向该院下发《整改通知书》，要求 15 日内完成 HIS/LIS 回写打通整改。'
    }
  }
]

/* ============ 全周期跟踪 ============ */
export const LIFECYCLES: Record<string, any> = {
  CL20260829000001: {
    clueId: 'CL20260829000001',
    totalDuration: '3天2小时15分钟',
    stageCount: 9,
    currentStage: '已结案',
    slaStatus: '按时完成',
    nodes: [
      { stage: '智能预警', title: '系统自动生成线索', time: '2026-08-29 08:15:32', operator: '智能比对引擎 v2.3.1', status: 'done', desc: '处方结算比对命中 RULE-DRUG-003，风险分 92，自动定级「高风险」', duration: '—' },
      { stage: '线索研判', title: 'AI 研判 + 人工确认', time: '2026-08-29 09:12:40', operator: '稽核员·王振华', status: 'done', desc: 'AI 建议确认违规（置信度 95%），稽核员采纳并转线上筛查', duration: '57分钟' },
      { stage: '线上筛查', title: '下发机构自查任务 SC202608290001', time: '2026-08-29 09:30:00', operator: '稽核员·王振华', status: 'done', desc: '自查期限 7 日，机构须上传处方、发药、病情说明等材料', duration: '18分钟' },
      { stage: '线上筛查', title: '机构提交自查说明', time: '2026-09-01 15:42:18', operator: '芜湖市第一人民医院', status: 'done', desc: '提交 3 份材料，1 份需补正；自报数据仍存在 2 盒差异', duration: '3天6小时' },
      { stage: '线上筛查', title: 'AI 初筛：存疑线索', time: '2026-09-01 15:58:22', operator: 'AI 初筛引擎', status: 'done', desc: '自报与结算差异未消除，材料缺失，判定存疑 → 转线下核查', duration: '16分钟' },
      { stage: '线下核查', title: '现场核查 INS202608300001', time: '2026-08-30 09:00:00', operator: '稽核员·王振华 / 李明华', status: 'done', desc: '4 项核查清单全部完成，采集 6 项证据、3 份 OCR、1 份问询笔录', duration: '7小时45分' },
      { stage: '线下核查', title: '核查结论：确认违规 242.00 元', time: '2026-08-30 16:45:00', operator: '稽核员·王振华', status: 'done', desc: '超量开药 180.00 元 + 虚记费用 62.00 元', duration: '—' },
      { stage: '机构申诉', title: '机构提出申诉 AP202608310001', time: '2026-08-31 14:30:00', operator: '芜湖市第一人民医院', status: 'done', desc: '对虚记费用 62.00 元提出异议，提交 LIS 报告等 4 份材料', duration: '21小时45分' },
      { stage: '申诉复核', title: '复核决定：部分撤销', time: '2026-09-01 10:00:00', operator: '稽核员·陈晓东 / 稽核组长·张建国', status: 'done', desc: '撤销虚记费用认定，维持超量开药 180.00 元，追回基金 135.00 元', duration: '19小时30分' },
      { stage: '结案归档', title: '推送违规处置智能体 + 反馈机构', time: '2026-09-01 16:20:00', operator: '系统自动', status: 'done', desc: '生成《整改通知书》，机构已于 16:20 阅读确认（反馈单号 FK202609010001）', duration: '6小时20分' }
    ],
    feedback: {
      feedbackId: 'FK202609010001',
      sendTime: '2026-09-01 11:05:00',
      readTime: '2026-09-01 16:20:00',
      channel: '机构工作台 + 短信',
      content: '经复核，撤销「虚记检验费用」认定，维持「超量开药」认定，追回医保基金 135.00 元；请就病历书写不规范问题于 15 日内完成整改并回传报告。',
      confirmed: true
    }
  }
}

/* ============ 误判反馈 ============ */
export const MISJUDGE_FEEDBACKS: any[] = [
  {
    feedbackId: 'FB202609010001',
    clueId: 'CL20260829000001',
    feedbackType: '规则误判',
    ruleId: 'RULE-DRUG-003',
    ruleName: '慢性病开药不超过7日量',
    submitter: '稽核员·陈晓东',
    submitTime: '2026-09-01 10:20:00',
    reason: '规则未考虑「同一就诊内多项目组合结算」场景，将 LIS 已执行但病历未回写的检验项目误判为虚记费用，需增加 LIS 系统交叉校验环节。',
    hitCount: 1280,
    misjudgeCount: 86,
    misjudgeRate: 6.7,
    handleStatus: '已优化',
    handler: '模型运营·郭明华',
    handleTime: '2026-09-03 14:30:00',
    optimizeAction: '新增 LIS/PACS 执行记录交叉校验前置条件；将本案例纳入 v2.3.2 负样本集（负样本累计 342 条）。',
    modelVersion: 'v2.3.1 → v2.3.2',
    effectAfter: { misjudgeRate: 2.1, accuracy: 94.8, improve: 4.6 }
  },
  {
    feedbackId: 'FB202609010002',
    clueId: 'CL20260829000002',
    feedbackType: '规则覆盖缺口',
    ruleId: 'RULE-DRUG-003',
    ruleName: '慢性病开药不超过7日量',
    submitter: '稽核员·李明华',
    submitTime: '2026-08-29 11:40:00',
    reason: '晚期癌痛患者按《癌症疼痛诊疗规范》可长期使用强阿片类药物，规则缺少重症/临终关怀豁免白名单，导致大量合理处方被误报。',
    hitCount: 1280,
    misjudgeCount: 86,
    misjudgeRate: 6.7,
    handleStatus: '已优化',
    handler: '模型运营·郭明华',
    handleTime: '2026-09-02 09:15:00',
    optimizeAction: '增加「晚期恶性肿瘤 + 麻醉镇痛药」豁免白名单（ICD-10: C00-C97 且药品分类=麻醉镇痛）。',
    modelVersion: 'v2.3.1 → v2.3.2',
    effectAfter: { misjudgeRate: 2.1, accuracy: 94.8, improve: 4.6 }
  }
]

/* ============ 知识图谱 ============ */
export const GRAPH_DATA: Record<string, any> = {
  CL20260829000001: {
    center: 'CL20260829000001',
    nodes: [
      { id: 'CL20260829000001', name: '线索\nCL...000001', type: '线索', level: 0, risk: '高', value: 92, detail: '超量开药 · 180.00元' },
      { id: 'P340200198001011234', name: '张伟民', type: '参保人', level: 1, risk: '中', value: 68, detail: '46岁·职工医保·2型糖尿病' },
      { id: 'H340200001', name: '芜湖市第一人民医院', type: '机构', level: 1, risk: '中', value: 72, detail: '三级甲等·信用分 78' },
      { id: 'D_LJG', name: '李建国', type: '医师', level: 1, risk: '高', value: 85, detail: '内分泌科·主任医师·长处方占比22.6%' },
      { id: 'YP300000', name: '格列美脲片', type: '药品', level: 1, risk: '中', value: 64, detail: '2mg*30片·45.00元/盒·限7日量' },
      { id: 'ST20260828000512', name: '结算单\nST...000512', type: '结算', level: 1, risk: '高', value: 88, detail: '2026-08-28·386.50元' },
      { id: 'RULE-DRUG-003', name: '规则\n7日量限制', type: '规则', level: 1, risk: '高', value: 90, detail: '命中1280次·误判率6.7%' },
      { id: 'CL20260812000445', name: '关联线索\nCL...000445', type: '线索', level: 2, risk: '中', value: 71, detail: '同医师·超量开药·420元' },
      { id: 'CL20260805000212', name: '关联线索\nCL...000212', type: '线索', level: 2, risk: '中', value: 66, detail: '同患者·重复开药·260元' },
      { id: 'P340200197503155678', name: '王秀兰', type: '参保人', level: 2, risk: '中', value: 62, detail: '51岁·2型糖尿病·同医师就诊' },
      { id: 'Y340200023', name: '芜湖益丰大药房(中山路店)', type: '机构', level: 2, risk: '高', value: 81, detail: '零售药店·同药品高频销售' },
      { id: 'YP300001', name: '二甲双胍片', type: '药品', level: 2, risk: '低', value: 42, detail: '同处方联用药品' },
      { id: 'JC006', name: '糖化血红蛋白检测', type: '项目', level: 2, risk: '高', value: 86, detail: '病历无记录·疑似虚记 62.00元' }
    ],
    links: [
      { source: 'CL20260829000001', target: 'P340200198001011234', label: '涉及参保人' },
      { source: 'CL20260829000001', target: 'H340200001', label: '发生机构' },
      { source: 'CL20260829000001', target: 'D_LJG', label: '开方医师' },
      { source: 'CL20260829000001', target: 'YP300000', label: '涉及药品' },
      { source: 'CL20260829000001', target: 'ST20260828000512', label: '关联结算' },
      { source: 'CL20260829000001', target: 'RULE-DRUG-003', label: '命中规则' },
      { source: 'CL20260829000001', target: 'JC006', label: '疑似虚记' },
      { source: 'D_LJG', target: 'H340200001', label: '执业机构' },
      { source: 'D_LJG', target: 'CL20260812000445', label: '历史线索' },
      { source: 'P340200198001011234', target: 'CL20260805000212', label: '历史线索' },
      { source: 'P340200198001011234', target: 'Y340200023', label: '购药记录' },
      { source: 'D_LJG', target: 'P340200197503155678', label: '同期就诊' },
      { source: 'P340200197503155678', target: 'YP300000', label: '同药品' },
      { source: 'ST20260828000512', target: 'YP300001', label: '联用药品' },
      { source: 'ST20260828000512', target: 'JC006', label: '结算项目' },
      { source: 'Y340200023', target: 'YP300000', label: '高频销售' }
    ],
    categories: ['线索', '参保人', '机构', '医师', '药品', '结算', '规则', '项目'],
    insights: [
      { icon: 'warn', text: '医师「李建国」近 90 日关联 3 条超量开药线索，存在系统性处方行为异常，建议纳入重点监控名单。' },
      { icon: 'info', text: '参保人「张伟民」同时在医院与药店高频获取格列美脲片，累计 90 日用量 18 盒（合理约 12 盒），存在囤药倾向。' },
      { icon: 'danger', text: '结算单 ST20260828000512 中「糖化血红蛋白检测」在病历中无对应记录，需重点核查虚记费用。' },
      { icon: 'info', text: '发现 1 个二级关联团伙特征：医师-药店-参保人构成三角高频路径，建议提级为专项任务线索。' }
    ]
  }
}
