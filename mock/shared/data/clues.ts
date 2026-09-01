/**
 * 疑点线索数据集 —— 全平台线索口径唯一来源
 * 内含 3 条全链路数据完整的典型案例，另生成 797 条批量线索
 */
import {
  ORGS,
  HOSPITALS,
  PHARMACIES,
  DOCTORS,
  PATIENTS,
  ITEMS,
  DRUG_ITEMS,
  EXAM_LIST,
  TREAT_LIST,
  RULES,
  AUDITORS,
  COMPARE_VIOLATION_MAP,
  COMPARE_TYPES,
  categoryOf,
  resetSeed,
  rnd,
  rndInt,
  pick,
  pad,
  dt
} from './base'

export interface Clue {
  clueId: string
  clueSource: string
  compareType: string
  violationCategory: string
  violationType: string
  riskLevel: '高' | '中' | '低'
  riskScore: number
  confidence: number
  suspectedAmount: number
  patientId: string
  patientName: string
  patientAge: number
  patientGender: string
  insuranceType: string
  orgCode: string
  orgName: string
  orgType: string
  district: string
  deptName: string
  doctorName: string
  doctorTitle: string
  itemCode: string
  itemName: string
  detectTime: string
  status: string
  assignee: string | null
  assignGroup: string | null
  pendingHours: number
  overdue: boolean
  deadline: string
  description: string
  ruleId: string
  ruleHit: string
  settleNo: string
  visitDate: string
  visitType: '门诊' | '住院' | '购药'
  totalFee: number
  fundPay: number
  isTypical?: boolean
}

/** 风险等级判定（严格遵循需求 §5.4） */
export function judgeRisk(amount: number, confidence: number, violationType: string): '高' | '中' | '低' {
  const severe = ['虚假诊疗', '串换药品', '串换项目收费', '分解住院', '冒名就医', '虚假购药', '药品回流']
  if (amount >= 5000 || confidence >= 90 || severe.includes(violationType)) return '高'
  if (amount >= 1000 || confidence >= 70) return '中'
  return '低'
}

/* ================= 标杆案例 1：超量开药（全链路） ================= */
export const TYPICAL_CLUE_1: Clue = {
  clueId: 'CL20260829000001',
  clueSource: '处方结算比对',
  compareType: '处方结算比对',
  violationCategory: '用药类',
  violationType: '超量开药',
  riskLevel: '高',
  riskScore: 92,
  confidence: 95,
  suspectedAmount: 180.0,
  patientId: 'P340200198001011234',
  patientName: '张伟民',
  patientAge: 46,
  patientGender: '男',
  insuranceType: '职工医保',
  orgCode: 'H340200001',
  orgName: '芜湖市第一人民医院',
  orgType: '三级医院',
  district: '镜湖区',
  deptName: '内分泌科',
  doctorName: '李建国',
  doctorTitle: '主任医师',
  itemCode: 'YP300000',
  itemName: '格列美脲片',
  detectTime: '2026-08-29 08:15:32',
  status: '已结案',
  assignee: '稽核员·王振华',
  assignGroup: '稽核一组',
  pendingHours: 0,
  overdue: false,
  deadline: '2026-09-05 18:00:00',
  description:
    '处方开具格列美脲片 2 盒（14 日用量），医保结算记录为 6 盒（42 日用量），超出医保限定「慢性病开药不超过 7 日量」标准，差异 4 盒，涉及疑似违规金额 180.00 元。',
  ruleId: 'RULE-DRUG-003',
  ruleHit: '慢性病开药不超过7日量',
  settleNo: 'ST20260828000512',
  visitDate: '2026-08-28',
  visitType: '门诊',
  totalFee: 386.5,
  fundPay: 289.88,
  isTypical: true
}

/* ================= 标杆案例 2：重症用药（合理驳回） ================= */
export const TYPICAL_CLUE_2: Clue = {
  clueId: 'CL20260829000002',
  clueSource: '处方结算比对',
  compareType: '处方结算比对',
  violationCategory: '用药类',
  violationType: '超量开药',
  riskLevel: '中',
  riskScore: 68,
  confidence: 72,
  suspectedAmount: 1080.0,
  patientId: 'P340200195204088765',
  patientName: '李长海',
  patientAge: 74,
  patientGender: '男',
  insuranceType: '离退休职工',
  orgCode: 'H340200001',
  orgName: '芜湖市第一人民医院',
  orgType: '三级医院',
  district: '镜湖区',
  deptName: '肿瘤科',
  doctorName: '刘振华',
  doctorTitle: '主任医师',
  itemCode: 'YP300020',
  itemName: '盐酸羟考酮缓释片',
  detectTime: '2026-08-29 08:16:04',
  status: '已驳回',
  assignee: '稽核员·李明华',
  assignGroup: '稽核一组',
  pendingHours: 0,
  overdue: false,
  deadline: '2026-09-05 18:00:00',
  description:
    '处方开具盐酸羟考酮缓释片 10 盒，结算 10 盒，超出常规限量 2 盒。患者诊断为「肺癌晚期（骨转移）」，属癌痛三阶梯规范用药，AI 临床合理性判定为「合理·重症用药」。',
  ruleId: 'RULE-DRUG-003',
  ruleHit: '慢性病开药不超过7日量',
  settleNo: 'ST20260828000618',
  visitDate: '2026-08-28',
  visitType: '门诊',
  totalFee: 1286.0,
  fundPay: 1029.0,
  isTypical: true
}

/* ================= 标杆案例 3：频繁就医（多机构聚集） ================= */
export const TYPICAL_CLUE_3: Clue = {
  clueId: 'CL20260829000003',
  clueSource: '就医行为比对',
  compareType: '就医行为比对',
  violationCategory: '就医行为类',
  violationType: '频繁就医',
  riskLevel: '高',
  riskScore: 88,
  confidence: 91,
  suspectedAmount: 3500.0,
  patientId: 'P340200195506103344',
  patientName: '陈国清',
  patientAge: 71,
  patientGender: '男',
  insuranceType: '职工医保',
  orgCode: 'H340200002',
  orgName: '皖南医学院弋矶山医院',
  orgType: '三级医院',
  district: '镜湖区',
  deptName: '全科医疗科',
  doctorName: '徐丽娟',
  doctorTitle: '副主任医师',
  itemCode: 'ZL001',
  itemName: '静脉输液（每组）',
  detectTime: '2026-08-29 08:22:17',
  status: '线下核查中',
  assignee: '稽核员·陈晓东',
  assignGroup: '稽核二组',
  pendingHours: 26,
  overdue: false,
  deadline: '2026-09-06 18:00:00',
  description:
    '参保人近 30 日内在 6 家定点机构就诊 23 次，累计报销 3,500.00 元，就诊频次显著高于同类人群（P99 分位），存在重复开药、囤药倒卖嫌疑。',
  ruleId: 'RULE-BHV-002',
  ruleHit: '月门诊次数>15次',
  settleNo: 'ST20260827000233',
  visitDate: '2026-08-27',
  visitType: '门诊',
  totalFee: 4210.0,
  fundPay: 3500.0,
  isTypical: true
}

/* ================= 批量生成线索 ================= */
const STATUS_POOL: Array<[string, number]> = [
  ['待研判', 0.26],
  ['研判中', 0.13],
  ['线上筛查中', 0.11],
  ['线下核查中', 0.09],
  ['申诉中', 0.05],
  ['已驳回', 0.1],
  ['已流转', 0.11],
  ['已结案', 0.15]
]

function pickStatus(): string {
  const r = rnd()
  let acc = 0
  for (const [s, w] of STATUS_POOL) {
    acc += w
    if (r <= acc) return s
  }
  return '待研判'
}

function buildDesc(vt: string, itemName: string, qty: number, amount: number, orgName: string): string {
  const map: Record<string, string> = {
    超量开药: `处方开具${itemName}${qty}盒，超出医保限定日用量标准，差异折算疑似金额 ${amount.toFixed(2)} 元。`,
    重复开药: `参保人 15 日内在多家机构重复开具${itemName}共 ${qty} 次，存在重复用药、囤药嫌疑，疑似金额 ${amount.toFixed(2)} 元。`,
    串换药品: `结算目录为${itemName}，但实际发药记录与处方不符，疑似将非医保药品串换为医保药品结算，涉及 ${amount.toFixed(2)} 元。`,
    超适应症用药: `${itemName}的医保支付限定适应症与本次诊断不符，属超适应症使用，涉及 ${amount.toFixed(2)} 元。`,
    虚假购药: `${orgName}存在无实际购药行为的刷卡结算记录 ${qty} 笔，疑似虚假购药，涉及 ${amount.toFixed(2)} 元。`,
    药品回流: `${itemName}短期内在同一参保人处高频购入，且进销存台账缺失出库凭证，疑似药品回流，涉及 ${amount.toFixed(2)} 元。`,
    重复收费: `同一就诊内${itemName}被重复计费 ${qty} 次，属重复收费，涉及 ${amount.toFixed(2)} 元。`,
    超标准收费: `${itemName}实际收费单价高于医保规定支付标准，超收金额 ${amount.toFixed(2)} 元。`,
    分解收费: `${itemName}被拆分为多个子项目分别计费，规避打包付费规则，涉及 ${amount.toFixed(2)} 元。`,
    虚记费用: `病历及护理记录中无${itemName}执行记录，但结算清单已计费 ${qty} 次，涉及 ${amount.toFixed(2)} 元。`,
    无指征收费: `患者诊断不支持${itemName}的使用指征，属无指征收费，涉及 ${amount.toFixed(2)} 元。`,
    串换项目收费: `实际执行项目与结算项目${itemName}不一致，疑似低价项目按高价项目结算，涉及 ${amount.toFixed(2)} 元。`,
    虚假诊疗: `${orgName}住院期间无${itemName}相应医嘱、执行及耗材领用记录，疑似虚假诊疗，涉及 ${amount.toFixed(2)} 元。`,
    过度诊疗: `单次就诊${itemName}等检查治疗项目达 ${qty} 项，明显超出临床路径需要，涉及 ${amount.toFixed(2)} 元。`,
    套餐式检查: `不同诊断患者${itemName}检查组合高度一致（相似度 >92%），疑似套餐式检查，涉及 ${amount.toFixed(2)} 元。`,
    做少收多: `${itemName}实际执行 ${Math.max(1, qty - 2)} 次，结算 ${qty} 次，疑似做少收多，涉及 ${amount.toFixed(2)} 元。`,
    分解住院: `患者出院后 ${rndInt(2, 6)} 日内以同一诊断再次入院，疑似分解住院规避总额控制，涉及 ${amount.toFixed(2)} 元。`,
    挂床住院: `住院 ${qty} 日内无查房、医嘱执行及护理记录，疑似挂床住院，涉及 ${amount.toFixed(2)} 元。`,
    频繁就医: `参保人近 30 日就诊 ${qty} 次，显著高于同类人群水平，累计报销 ${amount.toFixed(2)} 元。`,
    重复住院: `参保人 90 日内在多家机构住院 ${qty} 次且诊断相同，涉及 ${amount.toFixed(2)} 元。`,
    冒名就医: `就医记录性别/年龄与参保人信息存在逻辑冲突，疑似冒名就医，涉及 ${amount.toFixed(2)} 元。`,
    超量购药: `参保人单月购入${itemName}${qty}盒，远超个人合理用量，涉及 ${amount.toFixed(2)} 元。`,
    聚集性就医: `${orgName}同日出现 ${qty} 名同诊断参保人集中就医，疑似组织性骗保，涉及 ${amount.toFixed(2)} 元。`,
    进销存不符: `${itemName}医保结算出库量与进销存台账差异 ${qty} 盒，差异率超阈值，涉及 ${amount.toFixed(2)} 元。`,
    账实不符: `${orgName}${itemName}库存实盘数与系统账面数不符，差异 ${qty} 单位，涉及 ${amount.toFixed(2)} 元。`,
    违规结算: `结算记录与就诊、处方、发药三方数据无法匹配，疑似违规结算，涉及 ${amount.toFixed(2)} 元。`
  }
  return map[vt] ?? `${itemName}存在${vt}情形，涉及疑似违规金额 ${amount.toFixed(2)} 元。`
}

function genClues(count: number): Clue[] {
  resetSeed(88008)
  const out: Clue[] = []
  for (let i = 0; i < count; i++) {
    const compareType = pick(COMPARE_TYPES)
    const violationType = pick(COMPARE_VIOLATION_MAP[compareType])
    const category = categoryOf(violationType)
    const isPharmacyCase = compareType === '药品进销存比对' || violationType === '虚假购药' || violationType === '超量购药'
    const org = isPharmacyCase ? (rnd() > 0.35 ? pick(PHARMACIES) : pick(HOSPITALS)) : pick(HOSPITALS)
    const doctor = pick(DOCTORS)
    const patient = pick(PATIENTS)

    let item
    if (category === '用药类' || compareType === '药品进销存比对') item = pick(DRUG_ITEMS)
    else if (compareType === '检查检验比对') item = pick(EXAM_LIST)
    else item = pick(rnd() > 0.5 ? TREAT_LIST : EXAM_LIST)

    // 金额分布：大部分小额，少量大额（贴近真实长尾）
    const r = rnd()
    let amount: number
    if (r < 0.5) amount = Math.round((rnd() * 900 + 60) * 100) / 100
    else if (r < 0.82) amount = Math.round((rnd() * 4000 + 1000) * 100) / 100
    else if (r < 0.96) amount = Math.round((rnd() * 20000 + 5000) * 100) / 100
    else amount = Math.round((rnd() * 90000 + 25000) * 100) / 100

    const confidence = rndInt(52, 99)
    const riskLevel = judgeRisk(amount, confidence, violationType)
    const riskScore =
      riskLevel === '高' ? rndInt(85, 99) : riskLevel === '中' ? rndInt(65, 84) : rndInt(38, 64)

    const dayOffset = -rndInt(0, 45)
    const detectTime = dt(dayOffset, rndInt(0, 23), rndInt(0, 59), rndInt(0, 59))
    const status = pickStatus()
    const needAssign = status !== '待研判'
    const pendingHours = ['待研判', '研判中'].includes(status) ? rndInt(1, 96) : 0
    const rule = pick(RULES.filter((x) => x.category === category)) ?? pick(RULES)
    const qty = rndInt(2, 26)
    const visitType: '门诊' | '住院' | '购药' =
      org.orgCode.startsWith('Y') ? '购药' : ['分解住院', '挂床住院', '重复住院', '虚假诊疗'].includes(violationType) ? '住院' : rnd() > 0.75 ? '住院' : '门诊'
    const totalFee = Math.round((amount * (rnd() * 1.6 + 1.15)) * 100) / 100

    out.push({
      clueId: `CL2026${pad(rndInt(7, 8), 2)}${pad(rndInt(10, 29), 2)}${pad(i + 100, 6)}`,
      clueSource: compareType,
      compareType,
      violationCategory: category,
      violationType,
      riskLevel,
      riskScore,
      confidence,
      suspectedAmount: amount,
      patientId: patient.patientId,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      insuranceType: patient.insuranceType,
      orgCode: org.orgCode,
      orgName: org.orgName,
      orgType: org.orgType,
      district: org.district,
      deptName: org.orgCode.startsWith('Y') ? '—' : doctor.dept,
      doctorName: org.orgCode.startsWith('Y') ? '—' : doctor.name,
      doctorTitle: org.orgCode.startsWith('Y') ? '—' : doctor.title,
      itemCode: item.itemCode,
      itemName: item.itemName,
      detectTime,
      status,
      assignee: needAssign ? pick(AUDITORS) : rnd() > 0.55 ? pick(AUDITORS) : null,
      assignGroup: needAssign ? pick(['稽核一组', '稽核二组', '稽核三组']) : null,
      pendingHours,
      overdue: pendingHours > 72,
      deadline: dt(dayOffset + 7, 18, 0, 0),
      description: buildDesc(violationType, item.itemName, qty, amount, org.orgName),
      ruleId: rule.ruleId,
      ruleHit: rule.ruleName,
      settleNo: `ST2026${pad(rndInt(7, 8), 2)}${pad(rndInt(10, 28), 2)}${pad(rndInt(1, 999999), 6)}`,
      visitDate: dt(dayOffset - 1).slice(0, 10),
      visitType,
      totalFee,
      fundPay: Math.round(totalFee * (rnd() * 0.22 + 0.68) * 100) / 100
    })
  }
  return out
}

export const CLUES: Clue[] = [TYPICAL_CLUE_1, TYPICAL_CLUE_2, TYPICAL_CLUE_3, ...genClues(797)]

export const CLUE_MAP = new Map(CLUES.map((c) => [c.clueId, c]))

/** 我的待办（工作台口径） */
export const MY_NAME = '稽核员·王振华'
