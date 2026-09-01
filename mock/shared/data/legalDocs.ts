/**
 * 文书生成智能体数据集 —— 全平台文书口径唯一来源
 * 需求依据：doc/子功能/04_文书生成智能体_详细功能设计.md
 *
 * 说明：与 mock/shared/data/punish.ts、base.ts 共享机构/人员/案件口径
 */
import {
  ORGS, AUDITORS, DEPTS, DOCTORS, DISTRICTS,
  resetSeed, rnd, rndInt, pick, pickMany, pad, dt, d
} from './base'

/* ============ 全局枚举（文档 5.3 / 5.4） ============ */

/** 机关代字 */
export const ORG_CODE = '芜医保'

/** 文书类型与代字对照表（5.3 原文 12 项 + 模板库补全） */
export const DOC_TYPE_CODES = [
  { docType: '检查通知书', code: '检', templateId: 'TPL001', approval: '科长' },
  { docType: '任务派工单', code: '派', templateId: 'TPL002', approval: '无需审批' },
  { docType: '检查记录单', code: '记', templateId: 'TPL003', approval: '无需审批' },
  { docType: '询问笔录', code: '询', templateId: 'TPL004', approval: '无需审批' },
  { docType: '证据清单', code: '证', templateId: 'TPL005', approval: '科长' },
  { docType: '调取证据通知书', code: '调证', templateId: 'TPL006', approval: '科长' },
  { docType: '结果告知书', code: '告', templateId: 'TPL007', approval: '科长' },
  { docType: '陈述申辩告知书', code: '申辩', templateId: 'TPL008', approval: '科长' },
  { docType: '听证告知书', code: '听', templateId: 'TPL009', approval: '处长' },
  { docType: '整改意见书', code: '整', templateId: 'TPL010', approval: '处长' },
  { docType: '约谈通知书', code: '约', templateId: 'TPL011', approval: '科长' },
  { docType: '追回通知书', code: '追', templateId: 'TPL012', approval: '科长' },
  { docType: '暂停结算通知书', code: '暂停结', templateId: 'TPL013', approval: '处长' },
  { docType: '暂停协议通知书', code: '暂停协', templateId: 'TPL014', approval: '局长' },
  { docType: '解除协议通知书', code: '解', templateId: 'TPL015', approval: '局长' },
  { docType: '处罚决定书', code: '罚', templateId: 'TPL016', approval: '局长+法制审核' },
  { docType: '移送函', code: '移', templateId: 'TPL017', approval: '局长+法制审核' },
  { docType: '送达回证', code: '送回', templateId: 'TPL018', approval: '无需审批' },
  { docType: '强制执行申请书', code: '执', templateId: 'TPL019', approval: '局长+法制审核' },
  { docType: '案卷目录', code: '卷', templateId: 'TPL020', approval: '无需审批' },
  { docType: '结案报告', code: '结', templateId: 'TPL021', approval: '处长' },
  { docType: '备考表', code: '备', templateId: 'TPL022', approval: '无需审批' }
]

/** 证据法定种类（5.4 原文 8 种） */
export const EVIDENCE_KINDS = [
  { no: 1, kind: '书证', sample: '合同、票据、病历、处方、账簿、报表', fixMethod: '原件/复印件+核对章' },
  { no: 2, kind: '物证', sample: '涉案药品、医疗器械', fixMethod: '拍照+封存' },
  { no: 3, kind: '视听资料', sample: '录音、录像、监控视频', fixMethod: '光盘封存+文字说明' },
  { no: 4, kind: '电子数据', sample: '结算数据、系统日志、电子病历、聊天记录', fixMethod: '导出+哈希固化+司法鉴定' },
  { no: 5, kind: '证人证言', sample: '证人询问笔录', fixMethod: '笔录+签名' },
  { no: 6, kind: '当事人陈述', sample: '当事人询问笔录、陈述申辩材料', fixMethod: '笔录+签名' },
  { no: 7, kind: '鉴定意见', sample: '司法鉴定、医学专家评估意见', fixMethod: '鉴定意见书' },
  { no: 8, kind: '勘验笔录', sample: '现场检查笔录、盘点记录', fixMethod: '笔录+双方签名' }
]

/** 模板分类（3.1.1 六大类） */
export const TEMPLATE_CATEGORIES = [
  { categoryId: 'CAT01', categoryName: '任务派发类', tpls: ['TPL001', 'TPL002'] },
  { categoryId: 'CAT02', categoryName: '现场核查类', tpls: ['TPL003', 'TPL004', 'TPL005', 'TPL006'] },
  { categoryId: 'CAT03', categoryName: '结果告知类', tpls: ['TPL007', 'TPL008', 'TPL009'] },
  { categoryId: 'CAT04', categoryName: '处置决定类', tpls: ['TPL010', 'TPL011', 'TPL012', 'TPL013', 'TPL014', 'TPL015', 'TPL016', 'TPL017'] },
  { categoryId: 'CAT05', categoryName: '送达执行类', tpls: ['TPL018', 'TPL019'] },
  { categoryId: 'CAT06', categoryName: '归档类', tpls: ['TPL020', 'TPL021', 'TPL022'] }
]

/** 文书状态 */
export const DOC_STATUS = ['草稿', '待校对', '校对完成', '待签章', '签章中', '已签章', '待送达', '已送达', '已签收', '已归档', '已作废'] as const

/** 校对问题级别 */
export const ISSUE_LEVELS = [
  { level: '错误', tone: 'danger', color: '#e5484d', desc: '引用失效法规、条款不存在、要素缺失、金额不一致、错别字' },
  { level: '警告', tone: 'warning', color: '#e8a30c', desc: '法规简称不规范、条款引用不完整、适用性存疑、表述不规范' },
  { level: '提示', tone: 'primary', color: '#1668dc', desc: '建议补充引用程序法条款、建议引用最新修订版本、建议优化表述' }
]

/** 签章类型 */
export const SEAL_TYPES = ['公章', '合同专用章', '财务专用章', '证据专用章'] as const
export const SIGN_ROLES = ['经办人', '审核人', '部门负责人', '法定代表人'] as const

/** 送达方式（3.4.2） */
export const DELIVERY_METHODS = ['电子送达', '短信通知', '邮件送达', '邮寄送达', '直接送达', '留置送达', '公告送达'] as const

/** 送达状态 */
export const DELIVERY_STATUS = ['待送达', '已发送', '已送达', '已读', '已签收', '送达失败', '视为送达'] as const

/** 导出格式（3.4.3） */
export const EXPORT_FORMATS = ['PDF', 'Word', 'OFD', 'ZIP打包(PDF)'] as const

/** 案卷归档状态（3.6） */
export const ARCHIVE_STATUS = ['组装中', '待归档', '已归档', '已移交', '借出中'] as const

/** 借阅状态（3.6.2） */
export const BORROW_STATUS = ['审批中', '已批准', '借阅中', '已归还', '已驳回', '逾期未还'] as const

/* ============ 一、文书模板库（3.1） ============ */
resetSeed(80001)

export interface DocTemplate {
  templateId: string
  templateName: string
  docType: string
  docTypeCode: string
  categoryId: string
  categoryName: string
  version: string
  effectiveDate: string
  status: string
  applicableScope: string
  approvalLevel: string
  fixedElements: string[]
  variableElements: string[]
  pageCount: number
  useCount: number
  maintainer: string
  lastMaintainTime: string
  versionHistory: { version: string; date: string; change: string; approver: string; status: string }[]
}

/** 22 个模板的可变要素（文档 3.1.1 原文） */
const TPL_VARIABLES: Record<string, string[]> = {
  TPL001: ['被检机构名称', '检查依据', '检查范围', '检查时间', '检查人员', '联系人及电话', '机构需配合事项'],
  TPL002: ['任务编号', '任务名称', '承办组', '承办人', '任务要求', '完成时限'],
  TPL003: ['检查时间', '检查地点', '检查人员', '被检机构', '检查内容', '检查情况记录', '被检机构意见', '双方签名'],
  TPL004: ['询问时间', '询问地点', '询问人', '记录人', '被询问人基本信息', '问答内容', '被询问人意见', '签名'],
  TPL005: ['序号', '证据名称', '证据类型', '数量', '页数', '来源', '证明事项', '提供人', '接收人'],
  TPL006: ['被调取单位', '调取证据范围', '调取依据', '提交期限', '联系方式'],
  TPL007: ['被检机构', '检查结论', '违规事实', '违规金额', '拟处理意见', '告知事项'],
  TPL008: ['当事人名称', '拟处罚内容', '事实理由依据', '陈述申辩期限', '受理方式'],
  TPL009: ['当事人名称', '拟处罚内容', '听证申请期限', '听证机构', '联系方式'],
  TPL010: ['被检机构', '存在问题', '整改要求', '整改时限', '反馈方式'],
  TPL011: ['被约谈机构', '约谈事由', '约谈时间', '约谈地点', '参加人员', '需带材料'],
  TPL012: ['被追回机构', '追回事由', '追回金额', '金额大写', '退回期限', '退回账户'],
  TPL013: ['被暂停机构', '暂停事由', '暂停范围', '暂停期限', '恢复条件'],
  TPL014: ['被暂停机构', '暂停事由', '暂停期限', '参保人安排', '恢复条件'],
  TPL015: ['被解除机构', '解除事由', '生效日期', '参保人转接安排', '重新申请限制'],
  TPL016: ['当事人信息', '违法事实', '证据清单', '法律依据', '处罚决定', '履行方式期限', '救济途径', '落款日期'],
  TPL017: ['接收单位', '移送事由', '违法事实', '涉案金额', '涉案人员', '法律依据', '随附材料清单'],
  TPL018: ['受送达人', '送达文书名称及文号', '送达方式', '送达时间', '送达地点', '签收人', '备注'],
  TPL019: ['被执行人', '执行依据', '执行内容', '执行金额', '申请理由'],
  TPL020: ['案卷号', '案件名称', '材料序号', '材料名称', '页码', '备注'],
  TPL021: ['案件名称', '办理经过', '处理结果', '执行情况', '结案意见', '承办人'],
  TPL022: ['案卷号', '立卷人', '检查人', '归档日期', '保管期限', '备注']
}

/** 模板版本号（文档原文） */
const TPL_VERSIONS: Record<string, string> = {
  TPL001: 'v2.1', TPL002: 'v1.2', TPL003: 'v2.0', TPL004: 'v2.1', TPL005: 'v1.5',
  TPL006: 'v1.3', TPL007: 'v1.4', TPL008: 'v1.2', TPL009: 'v1.3', TPL010: 'v2.0',
  TPL011: 'v1.2', TPL012: 'v1.5', TPL013: 'v1.3', TPL014: 'v1.4', TPL015: 'v1.3',
  TPL016: 'v3.0', TPL017: 'v1.4', TPL018: 'v1.5', TPL019: 'v1.2', TPL020: 'v1.3',
  TPL021: 'v1.5', TPL022: 'v1.1'
}

const TPL_NAMES: Record<string, string> = {
  TPL001: '检查通知书', TPL002: '任务派工单', TPL003: '现场检查记录单', TPL004: '询问笔录',
  TPL005: '证据清单', TPL006: '调取证据通知书', TPL007: '检查结果告知书', TPL008: '陈述申辩告知书',
  TPL009: '听证告知书', TPL010: '整改意见书', TPL011: '约谈通知书', TPL012: '追回基金通知书',
  TPL013: '暂停结算通知书', TPL014: '暂停服务协议通知书', TPL015: '解除服务协议通知书',
  TPL016: '行政处罚决定书', TPL017: '案件移送函', TPL018: '送达回证', TPL019: '强制执行申请书',
  TPL020: '案卷目录', TPL021: '结案报告', TPL022: '备考表'
}

export const DOC_TEMPLATES: DocTemplate[] = DOC_TYPE_CODES.map((t, i) => {
  const cat = TEMPLATE_CATEGORIES.find((c) => c.tpls.includes(t.templateId))!
  const ver = TPL_VERSIONS[t.templateId] || 'v1.0'
  const major = Number(ver.replace('v', '').split('.')[0])
  const history: any[] = []
  for (let v = 1; v <= major; v++) {
    const isLast = v === major
    history.unshift({
      version: isLast ? ver : `v${v}.0`,
      date: isLast ? '2026-08-15' : `202${3 + v}-0${rndInt(1, 9)}-${pad(rndInt(1, 28), 2)}`,
      change: isLast
        ? '按《医疗保障基金使用监督管理条例》最新口径调整法律依据与救济告知表述'
        : v === 1 ? '模板初始建立' : `第 ${v} 次修订：优化文头格式与要素占位符`,
      approver: pick(['法规科 · 陈科长', '基金监管处 · 王处长']),
      status: isLast ? '现行有效' : '已废止'
    })
  }
  return {
    templateId: t.templateId,
    templateName: TPL_NAMES[t.templateId],
    docType: t.docType,
    docTypeCode: t.code,
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    version: ver,
    effectiveDate: '2026-08-15',
    status: '现行有效',
    applicableScope: pick([
      '全部定点医药机构 · 全部任务类型',
      '定点医疗机构 · 日常稽核/专项检查',
      '定点零售药店 · 专项检查/飞行检查',
      '全部定点医药机构 · 行政处罚程序'
    ]),
    approvalLevel: t.approval,
    fixedElements: [`芜湖市医疗保障局${TPL_NAMES[t.templateId]}`, '文号', '落款', '日期', '印章位置'],
    variableElements: TPL_VARIABLES[t.templateId] || ['当事人信息', '事实与依据', '决定内容'],
    pageCount: rndInt(1, 4),
    useCount: rndInt(8, 320),
    maintainer: pick(['模板管理员·孙志强', '法制人员·陈立']),
    lastMaintainTime: dt(-rndInt(5, 90), rndInt(9, 17), 0),
    versionHistory: history
  }
})

/** 模板可编辑要素（3.1.2） */
export const TEMPLATE_EDITABLE = {
  header: { orgName: '芜湖市医疗保障局', docName: '行政处罚决定书', font: '宋体', fontSize: '二号', alignment: '居中', bold: true },
  docNoFormat: { prefix: '芜医保罚', yearFormat: '〔YYYY〕', serialNo: 'NNN号', example: '芜医保罚〔2026〕012号' },
  footer: { orgName: '芜湖市医疗保障局', dateFormat: 'YYYY年MM月DD日', signaturePosition: '右下角', sealPosition: '落款日期处（公章居中下压日期）' },
  pageSetup: { paperSize: 'A4', marginTop: '3.7cm', marginBottom: '3.5cm', marginLeft: '2.8cm', marginRight: '2.6cm', header: '无', footer: '第X页 共Y页' }
}

/* ============ 二、生成文书（3.2） ============ */
resetSeed(80002)

export interface GenDoc {
  documentId: string
  docNo: string
  documentName: string
  docType: string
  docTypeCode: string
  templateId: string
  templateName: string
  caseId: string
  taskId: string
  orgName: string
  orgCode: string
  district: string
  generateTime: string
  generateMode: string
  creator: string
  status: string
  /** 填充校验 */
  fillValidation: { totalFields: number; filledFields: number; missingFields: string[]; status: string }
  /** 关键金额 */
  amount: { violationAmount: number; fundAmount: number; penaltyAmount: number; totalAmount: number; totalAmountInWords: string }
  aiGenerated: boolean
  /** AI 质量五维 */
  qualityScore: { completeness: number; standardization: number; logic: number; legalAccuracy: number; overall: number } | null
  /** 校对汇总 */
  proofread: { done: boolean; errors: number; warnings: number; tips: number; status: string } | null
  /** 签章 */
  signed: boolean
  signId: string
  /** 送达 */
  deliveryId: string
  deliveryStatus: string
  archived: boolean
  pageCount: number
  fileSize: string
}

/** 金额中文大写 */
function toCn(n: number): string {
  const dg = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const u = ['', '拾', '佰', '仟']
  const bu = ['', '万', '亿']
  const int = Math.floor(n)
  if (int === 0) return '零元整'
  let str = String(int)
  const groups: string[] = []
  while (str.length) { groups.unshift(str.slice(Math.max(0, str.length - 4))); str = str.slice(0, Math.max(0, str.length - 4)) }
  let s = ''
  groups.forEach((g, gi) => {
    let gs = ''
    for (let i = 0; i < g.length; i++) {
      const dgt = Number(g[i])
      if (dgt === 0) { if (gs && !gs.endsWith('零')) gs += '零' }
      else gs += dg[dgt] + u[g.length - 1 - i]
    }
    gs = gs.replace(/零$/, '')
    if (gs) s += gs + bu[groups.length - 1 - gi]
  })
  return s.replace(/零+/g, '零').replace(/零$/, '') + '元整'
}

/** 文号流水池：按「类型+年度」独立编号 */
const serialPool: Record<string, number> = {}
function nextSerial(code: string): number {
  serialPool[code] = (serialPool[code] || 0) + 1
  return serialPool[code]
}

function genDocs(count: number): GenDoc[] {
  const out: GenDoc[] = []
  for (let i = 0; i < count; i++) {
    const t = pick(DOC_TYPE_CODES)
    const org = pick(ORGS)
    const status = pick(DOC_STATUS.filter((s) => s !== '已作废'))
    const violation = rndInt(2000, 260000)
    const fund = Math.round(violation * (0.7 + rnd() * 0.2))
    const multiple = t.docType === '处罚决定书' ? rndInt(20, 50) / 10 : 0
    const penalty = multiple ? Math.round(violation * multiple) : 0
    const total = violation + penalty
    const missing = rnd() < 0.14 ? pickMany(['联系方式', '法定代表人', '违规时间', '证明事项'], rndInt(1, 2)) : []
    const totalFields = rndInt(18, 32)
    const ai = rnd() > 0.25
    const proofDone = ['校对完成', '待签章', '签章中', '已签章', '待送达', '已送达', '已签收', '已归档'].includes(status)
    const signed = ['已签章', '待送达', '已送达', '已签收', '已归档'].includes(status)
    const delivered = ['已送达', '已签收', '已归档'].includes(status)
    const serial = nextSerial(t.code)

    out.push({
      documentId: `DOC20260920${pad(i + 1, 4)}`,
      docNo: `${ORG_CODE}${t.code}〔2026〕${pad(serial, 3)}号`,
      documentName: `${org.orgName}${TPL_NAMES[t.templateId]}`,
      docType: t.docType,
      docTypeCode: t.code,
      templateId: t.templateId,
      templateName: TPL_NAMES[t.templateId],
      caseId: `CASE20260815${pad(rndInt(1, 60), 4)}`,
      taskId: `TASK202608${pad(rndInt(1, 30), 3)}`,
      orgName: org.orgName,
      orgCode: org.orgCode,
      district: org.district,
      generateTime: dt(-rndInt(0, 30), rndInt(8, 18), rndInt(0, 59)),
      generateMode: ai ? '自动填充+AI撰写' : '自动填充',
      creator: pick(AUDITORS),
      status,
      fillValidation: {
        totalFields,
        filledFields: totalFields - missing.length,
        missingFields: missing,
        status: missing.length ? '存在缺失项' : '填充完整'
      },
      amount: {
        violationAmount: violation,
        fundAmount: fund,
        penaltyAmount: penalty,
        totalAmount: total,
        totalAmountInWords: toCn(total)
      },
      aiGenerated: ai,
      qualityScore: ai
        ? {
            completeness: rndInt(86, 99), standardization: rndInt(84, 98),
            logic: rndInt(85, 98), legalAccuracy: rndInt(88, 99), overall: rndInt(86, 97)
          }
        : null,
      proofread: proofDone
        ? {
            done: true,
            errors: rnd() < 0.25 ? rndInt(1, 3) : 0,
            warnings: rndInt(0, 4),
            tips: rndInt(0, 3),
            status: '校对完成'
          }
        : null,
      signed,
      signId: signed ? `SIGN20260920${pad(i + 1, 4)}` : '',
      deliveryId: delivered ? `DEL20260920${pad(i + 1, 4)}` : '',
      deliveryStatus: delivered ? (status === '已签收' || status === '已归档' ? '已签收' : '已送达') : '待送达',
      archived: status === '已归档',
      pageCount: rndInt(1, 8),
      fileSize: `${(rnd() * 2.4 + 0.3).toFixed(2)} MB`
    })
  }
  return out
}

export const GEN_DOCS = genDocs(240)
export const GEN_DOC_MAP: Record<string, GenDoc> = {}
GEN_DOCS.forEach((g) => (GEN_DOC_MAP[g.documentId] = g))

/** AI 撰写五段正文（3.2.2） */
export function buildAiWriting(doc: GenDoc) {
  const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return {
    documentId: doc.documentId,
    documentType: doc.docType,
    generateTime: doc.generateTime,
    modelVersion: 'legal-writing-v2.1',
    generatedContent: {
      violationFactsParagraph: `经查，${doc.orgName}于 2026 年 5 月至 8 月期间，在为参保人提供医药服务过程中，存在串换药品、虚构购药记录等违规行为。具体表现为：将非医保目录药品串换为医保目录药品进行结算，涉及金额 ${money(doc.amount.violationAmount * 0.57)} 元；虚构参保人购药记录并申报医保结算，涉及金额 ${money(doc.amount.violationAmount * 0.43)} 元。上述行为共造成医保基金损失 ${money(doc.amount.fundAmount)} 元。`,
      evidenceParagraph: `上述事实，有以下证据证明：一、书证：${doc.orgName}药品进销存台账、医保结算费用明细单、处方复印件共 ${rndInt(30, 120)} 页；二、电子数据：医保信息系统结算数据导出文件（含 SHA-256 哈希固化）、药店销售系统日志；三、当事人陈述：对该机构负责人的询问笔录 ${rndInt(1, 3)} 份；四、证人证言：参保人证人询问笔录 ${rndInt(2, 6)} 份；五、勘验笔录：现场检查笔录及药品盘点记录各 1 份。以上证据相互印证，形成完整证据链。`,
      legalBasisParagraph: `${doc.orgName}的上述行为违反了《医疗保障基金使用监督管理条例》第十五条、第四十条的规定。该条例第四十条规定：定点医药机构以骗取医疗保障基金为目的，实施虚构医药服务项目等行为，由医疗保障行政部门责令退回，处骗取金额 2 倍以上 5 倍以下的罚款。本案违规行为性质明确、事实清楚、证据充分，应当依照上述规定予以处理。`,
      decisionParagraph: `依据《医疗保障基金使用监督管理条例》第四十条规定，并综合考虑当事人违规金额、主观故意程度及配合调查情况，本机关决定：一、责令退回骗取的医疗保障基金 ${money(doc.amount.fundAmount)} 元；二、处骗取金额 ${doc.amount.penaltyAmount ? (doc.amount.penaltyAmount / doc.amount.violationAmount).toFixed(1) : '0'} 倍罚款计 ${money(doc.amount.penaltyAmount)} 元。以上合计 ${money(doc.amount.totalAmount)} 元（${doc.amount.totalAmountInWords}）。`,
      rightsParagraph: `当事人如不服本处罚决定，可自收到本决定书之日起 60 日内向芜湖市人民政府申请行政复议，或自收到本决定书之日起 6 个月内依法向芜湖市镜湖区人民法院提起行政诉讼。申请行政复议或提起行政诉讼期间，本决定不停止执行。当事人应自收到本决定书之日起 15 日内履行本决定；逾期不履行的，本机关将依法申请人民法院强制执行。`
    },
    qualityScore: doc.qualityScore || { completeness: 92, standardization: 90, logic: 93, legalAccuracy: 95, overall: 92 },
    manualReview: doc.aiGenerated
      ? {
          reviewer: pick(AUDITORS),
          reviewTime: dt(-rndInt(0, 20), rndInt(9, 18), 0),
          result: pick(['通过', '通过（有修改）']),
          modifications: [
            { location: '违规事实描述第 2 句', original: '该药店把非医保药换成医保药报销', modified: '将非医保目录药品串换为医保目录药品进行结算', reason: '规范法言法语，避免口语化表述' },
            { location: '法律适用段', original: '违反了医保条例', modified: '违反了《医疗保障基金使用监督管理条例》第十五条、第四十条的规定', reason: '补充完整法规名称与条款号' }
          ],
          comment: 'AI 初稿事实要素齐全、逻辑清晰，经修改口语化表述与法条引用后可用。'
        }
      : null
  }
}

/** 文号号段统计（3.2.3） */
export const DOC_NO_STATS = DOC_TYPE_CODES.map((t) => {
  const list = GEN_DOCS.filter((g) => g.docTypeCode === t.code)
  const voidCount = Math.floor(list.length * 0.06)
  return {
    docType: t.docType,
    docTypeCode: t.code,
    year: 2026,
    totalGenerated: list.length,
    effective: list.length - voidCount,
    void: voidCount,
    currentMaxSerialNo: pad(list.length, 3),
    nextSerialNo: pad(list.length + 1, 3),
    format: `${ORG_CODE}${t.code}〔2026〕NNN号`
  }
})

/** 作废文号记录 */
export const VOID_DOC_NOS = Array.from({ length: 16 }, (_, i) => {
  const t = pick(DOC_TYPE_CODES)
  return {
    docNo: `${ORG_CODE}${t.code}〔2026〕${pad(rndInt(1, 60), 3)}号`,
    docType: t.docType,
    voidTime: dt(-rndInt(3, 60), rndInt(9, 18), 0),
    reason: pick(['案件撤销，文书不再出具', '当事人信息填写错误，重新生成', '审核未通过，文号释放后作废', '违规事实认定调整，重新起草']),
    operator: pick(AUDITORS)
  }
})

/* ============ 三、批量生成（3.2.4） ============ */
resetSeed(80003)

export interface BatchTask {
  batchId: string
  batchName: string
  documentType: string
  templateId: string
  createTime: string
  creator: string
  status: string
  totalSelected: number
  successCount: number
  failCount: number
  reviewedCount: number
  selectedTasks: { taskId: string; orgName: string; status: string }[]
  failDetails: { taskId: string; orgName: string; reason: string; suggestion: string }[]
  generatedDocuments: { documentId: string; docNo: string; orgName: string }[]
  exportFormat: string
}

export const BATCH_TASKS: BatchTask[] = Array.from({ length: 14 }, (_, i) => {
  const t = pick([
    { docType: '检查通知书', code: '检', tpl: 'TPL001', scene: '专项检查批量派发' },
    { docType: '整改意见书', code: '整', tpl: 'TPL010', scene: '同类违规批量整改' },
    { docType: '结果告知书', code: '告', tpl: 'TPL007', scene: '多线索结果批量告知' },
    { docType: '约谈通知书', code: '约', tpl: 'TPL011', scene: '批量约谈通知' }
  ])
  const total = rndInt(4, 18)
  const fail = rnd() < 0.55 ? rndInt(1, 2) : 0
  const success = total - fail
  const orgs = pickMany(ORGS, total)
  return {
    batchId: `BATCH20260915${pad(i + 1, 4)}`,
    batchName: `${t.scene}（${t.docType}）`,
    documentType: t.docType,
    templateId: t.tpl,
    createTime: dt(-rndInt(0, 25), rndInt(8, 18), 0),
    creator: pick(AUDITORS),
    status: pick(['已完成', '生成中', '部分失败']),
    totalSelected: total,
    successCount: success,
    failCount: fail,
    reviewedCount: rndInt(0, success),
    selectedTasks: orgs.map((o: any, k: number) => ({
      taskId: `TASK202608${pad(rndInt(1, 30), 3)}`,
      orgName: o.orgName,
      status: k < success ? '生成成功' : '生成失败'
    })),
    failDetails: orgs.slice(success).map((o: any) => ({
      taskId: `TASK202608${pad(rndInt(1, 30), 3)}`,
      orgName: o.orgName,
      reason: pick(['关联案件缺少违规金额认定数据', '机构法定代表人信息缺失', '违规确认书尚未复核通过']),
      suggestion: pick(['请先在违规确认环节补齐金额认定', '请在机构档案中补充法定代表人信息', '请等待违规确认书复核通过后重新生成'])
    })),
    generatedDocuments: orgs.slice(0, success).map((o: any, k: number) => ({
      documentId: `DOC20260915${pad(i * 20 + k + 1, 4)}`,
      docNo: `${ORG_CODE}${t.code}〔2026〕${pad(60 + i * 4 + k, 3)}号`,
      orgName: o.orgName
    })),
    exportFormat: 'ZIP打包(PDF)'
  }
})

/* ============ 四、智能校对（3.3） ============ */

/** 法条引用校对（3.3.1） */
export function buildLegalProofread(doc: GenDoc) {
  const cited = [
    {
      lawName: '《医疗保障基金使用监督管理条例》',
      article: '第十五条',
      citedContent: '定点医药机构及其工作人员不得分解住院、挂床住院，不得违反诊疗规范过度诊疗、过度检查、分解处方、超量开药、重复开药。',
      checkResult: '正确',
      issues: [],
      lawLibraryMatch: { matched: true, effective: true, effectiveDate: '2021-05-01', latestVersion: '2021年版', actualContent: '与引用一致' }
    },
    {
      lawName: '《医疗保障基金使用监督管理条例》',
      article: '第四十条',
      citedContent: '定点医药机构以骗取医疗保障基金为目的，实施虚构医药服务项目等行为，由医疗保障行政部门责令退回，处骗取金额2倍以上5倍以下的罚款。',
      checkResult: '正确',
      issues: [],
      lawLibraryMatch: { matched: true, effective: true, effectiveDate: '2021-05-01', latestVersion: '2021年版', actualContent: '与引用一致' }
    },
    {
      lawName: '《医疗机构医疗保障定点管理暂行办法》',
      article: '第四十九条',
      citedContent: '定点医疗机构违反本办法规定，医疗保障经办机构可以中止或解除医保协议。',
      checkResult: '警告',
      issues: [
        {
          type: '条款已修订',
          level: '警告',
          description: '该条款于 2025 年修订，条文表述已调整，建议核对最新版本后引用',
          suggestion: '建议引用 2025 年修订版第五十一条',
          correctArticle: '第五十一条',
          correctContent: '定点医疗机构违反本办法规定的，医疗保障经办机构可以按照协议约定中止或解除医保协议，并向社会公告。'
        }
      ],
      lawLibraryMatch: { matched: true, effective: true, effectiveDate: '2025-03-01', latestVersion: '2025年修订版', actualContent: '条文表述已调整' }
    },
    {
      lawName: '《行政处罚法》',
      article: '第四十四条',
      citedContent: '行政机关在作出行政处罚决定之前，应当告知当事人拟作出的行政处罚内容及事实、理由、依据。',
      checkResult: '正确',
      issues: [
        {
          type: '建议补充程序法引用',
          level: '提示',
          description: '本文书涉及听证程序，建议同时引用《行政处罚法》第六十三条关于听证的规定',
          suggestion: '在法律依据段补充引用《中华人民共和国行政处罚法》第六十三条',
          correctArticle: '第六十三条',
          correctContent: '行政机关拟作出较大数额罚款等行政处罚决定，当事人要求听证的，行政机关应当组织听证。'
        }
      ],
      lawLibraryMatch: { matched: true, effective: true, effectiveDate: '2021-07-15', latestVersion: '2021年修订版', actualContent: '与引用一致' }
    }
  ]
  const warning = cited.filter((c) => c.checkResult === '警告').length
  const error = cited.filter((c) => c.checkResult === '错误').length
  return {
    documentId: doc.documentId,
    documentName: doc.documentName,
    proofreadTime: dt(0, rndInt(9, 18), 0),
    status: error ? '校对完成（有错误）' : warning ? '校对完成（有警告）' : '校对完成',
    citedLaws: cited,
    summary: {
      totalCitations: cited.length,
      correct: cited.filter((c) => c.checkResult === '正确').length,
      warning,
      error,
      criticalIssues: error
    },
    aiSuggestion: '本文书法律依据引用总体准确、实体法与程序法搭配合理。建议：①核对《医疗机构医疗保障定点管理暂行办法》最新修订版条款序号；②涉及听证程序的文书补充引用《行政处罚法》第六十三条，使程序法依据更为完整。',
    manualConfirmation: {
      confirmed: rnd() > 0.4,
      confirmer: pick(AUDITORS),
      confirmTime: dt(0, rndInt(10, 18), 0),
      adoptedSuggestions: ['建议引用 2025 年修订版第五十一条', '在法律依据段补充引用《行政处罚法》第六十三条'],
      comment: '已采纳法条时效性与程序法补充建议，文书法律依据部分已同步修正。'
    }
  }
}

/** 要素与文字校对（3.3.2） */
export function buildTextProofread(doc: GenDoc) {
  const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hasAmountIssue = rnd() < 0.4
  const elementCheck = {
    partyInfo: { complete: !doc.fillValidation.missingFields.length, missing: doc.fillValidation.missingFields },
    violationFacts: {
      complete: true,
      missing: [],
      fiveElements: [
        '时间：2026年5月至8月',
        `地点：${doc.orgName}`,
        '人物：机构负责人及涉事药师',
        '行为：串换药品、虚构购药记录',
        `金额：${money(doc.amount.violationAmount)}元`
      ]
    },
    legalBasis: { complete: true, missing: [] },
    decision: { complete: true, missing: [] },
    rightsNotice: { complete: true, missing: [] },
    signature: { complete: true, missing: [] }
  }
  const typos = [
    { type: '错别字', level: '错误', location: '违规事实第 3 行', original: '虚构购药纪录', correction: '虚构购药记录', wrongWord: '纪录', correctWord: '记录' },
    { type: '错别字', level: '错误', location: '处理决定第 2 行', original: '责令退还', correction: '责令退回', wrongWord: '退还', correctWord: '退回' }
  ].slice(0, rndInt(0, 2))
  const punctuation = [
    { type: '标点不规范', level: '警告', location: '证据列举段', original: '票据,处方,病历', correction: '票据、处方、病历', issue: '并列词语之间应使用顿号「、」而非逗号' }
  ].slice(0, rndInt(0, 1))
  const colloquialism = [
    { type: '口语化表述', level: '提示', location: '违规事实第 1 行', original: '这家药店把药换了报销', suggestion: '该定点零售药店将非医保目录药品串换为医保目录药品进行结算', reason: '执法文书应使用法言法语，避免口语化表述' }
  ].slice(0, rndInt(0, 1))
  const amountIssues = hasAmountIssue
    ? [{ type: '金额不一致', level: '错误', location: '处理决定段与金额大写', description: '正文金额与中文大写金额不一致', actualIssue: `正文为 ${money(doc.amount.totalAmount)} 元，大写为「${doc.amount.totalAmountInWords}」，需核对` }]
    : []
  const errors = typos.length + amountIssues.length
  const warnings = punctuation.length
  const tips = colloquialism.length
  return {
    documentId: doc.documentId,
    documentName: doc.documentName,
    proofreadTime: dt(0, rndInt(9, 18), 0),
    status: errors ? '校对完成（有错误）' : warnings ? '校对完成（有警告）' : '校对完成',
    elementCheck,
    consistencyCheck: {
      amountConsistency: { result: hasAmountIssue ? '不一致' : '一致', issues: amountIssues },
      partyNameConsistency: { result: '一致', issues: [] },
      dateConsistency: { result: '一致', issues: [] },
      docNoConsistency: { result: '一致', issues: [] }
    },
    textCheck: { typos, punctuation, colloquialism },
    summary: { totalIssues: errors + warnings + tips, errors, warnings, tips },
    oneClickFix: {
      available: errors > 0 || warnings > 0,
      fixableCount: typos.length + punctuation.length,
      fixedItems: []
    },
    manualConfirmation: {
      confirmed: rnd() > 0.5,
      confirmer: pick(AUDITORS),
      confirmTime: dt(0, rndInt(10, 18), 0),
      adoptedAll: true,
      comment: '已逐项核对校对结果，错别字与标点问题已一键修正，口语化表述已按建议改写。'
    }
  }
}

/* ============ 五、签章与送达（3.4） ============ */
resetSeed(80004)

export interface SignRecord {
  signId: string
  documentId: string
  documentName: string
  docNo: string
  applyTime: string
  applicant: string
  status: string
  signFlow: {
    step: number; signType: string; signer: string; signerRole: string
    signTime: string; authMethod: string; signPosition: string; ipAddress: string
    status: string; sealName?: string; sealType?: string
  }[]
  signedDocument: { fileName: string; fileSize: string; fileHash: string; generateTime: string }
  antiTamper: { enabled: boolean; hashAlgorithm: string; timestamp: string; blockchainNotarization: boolean; notarizationId: string }
}

export const SIGN_RECORDS: SignRecord[] = GEN_DOCS.filter((g) => g.signed).slice(0, 210).map((g, i) => {
  const needSeal = ['处罚决定书', '移送函', '暂停协议通知书', '解除协议通知书'].includes(g.docType)
  const steps: any[] = [
    { step: 1, signType: '个人电子签名', signer: g.creator, signerRole: '经办人', signTime: dt(-rndInt(1, 20), rndInt(9, 12), 0), authMethod: '密码+短信验证码', signPosition: '文书末页经办人栏', ipAddress: `10.32.${rndInt(1, 60)}.${rndInt(1, 250)}`, status: '已签章' },
    { step: 2, signType: '个人电子签名', signer: pick(AUDITORS), signerRole: '审核人', signTime: dt(-rndInt(1, 18), rndInt(12, 15), 0), authMethod: '密码+短信验证码', signPosition: '文书末页审核人栏', ipAddress: `10.32.${rndInt(1, 60)}.${rndInt(1, 250)}`, status: '已签章' }
  ]
  if (needSeal) {
    steps.push(
      { step: 3, signType: '个人电子签名', signer: '基金监管处 · 王处长', signerRole: '部门负责人', signTime: dt(-rndInt(1, 15), rndInt(14, 17), 0), authMethod: '密码+短信验证码', signPosition: '文书末页部门负责人栏', ipAddress: `10.32.${rndInt(1, 60)}.${rndInt(1, 250)}`, status: '已签章' },
      { step: 4, signType: '单位电子印章', signer: '芜湖市医疗保障局 · 李局长', signerRole: '法定代表人', signTime: dt(-rndInt(0, 12), rndInt(15, 18), 0), authMethod: '密码+短信验证码+人脸识别', signPosition: '文书末页落款日期处（公章居中下压日期）', ipAddress: `10.32.${rndInt(1, 60)}.${rndInt(1, 250)}`, status: '已签章', sealName: '芜湖市医疗保障局', sealType: '公章' }
    )
  } else {
    steps.push({ step: 3, signType: '单位电子印章', signer: '基金监管处 · 张科长', signerRole: '部门负责人', signTime: dt(-rndInt(0, 12), rndInt(14, 18), 0), authMethod: '密码+短信验证码+人脸识别', signPosition: '文书末页落款日期处（公章居中下压日期）', ipAddress: `10.32.${rndInt(1, 60)}.${rndInt(1, 250)}`, status: '已签章', sealName: '芜湖市医疗保障局', sealType: '公章' })
  }
  const hash = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')
  return {
    signId: g.signId,
    documentId: g.documentId,
    documentName: g.documentName,
    docNo: g.docNo,
    applyTime: dt(-rndInt(2, 22), rndInt(8, 11), 0),
    applicant: g.creator,
    status: '签章完成',
    signFlow: steps,
    signedDocument: {
      fileName: `${g.documentName}_${g.docNo.replace(/[〔〕]/g, '')}.pdf`,
      fileSize: g.fileSize,
      fileHash: hash,
      generateTime: steps[steps.length - 1].signTime
    },
    antiTamper: {
      enabled: true,
      hashAlgorithm: 'SHA-256',
      timestamp: steps[steps.length - 1].signTime,
      blockchainNotarization: true,
      notarizationId: `BC20260920${pad(rndInt(1, 999999), 6)}`
    }
  }
})

/** 印章使用日志 */
export const SEAL_LOGS = [
  { sealName: '芜湖市医疗保障局', sealType: '公章', usageCount: 486, lastUsage: dt(0, 16, 30), monthlyUsage: 62, status: '正常', keeper: '办公室 · 刘主任' },
  { sealName: '芜湖市医疗保障局行政处罚专用章', sealType: '公章', usageCount: 124, lastUsage: dt(-1, 15, 20), monthlyUsage: 18, status: '正常', keeper: '法规科 · 陈科长' },
  { sealName: '芜湖市医疗保障局证据专用章', sealType: '证据专用章', usageCount: 862, lastUsage: dt(0, 11, 45), monthlyUsage: 148, status: '正常', keeper: '基金监管处 · 王处长' },
  { sealName: '芜湖市医疗保障局合同专用章', sealType: '合同专用章', usageCount: 96, lastUsage: dt(-6, 14, 10), monthlyUsage: 8, status: '正常', keeper: '办公室 · 刘主任' }
]

export interface DeliveryRecord {
  deliveryId: string
  documentId: string
  documentName: string
  docNo: string
  orgName: string
  recipient: { name: string; contact: string; phone: string; email: string; address: string }
  deliveryMethods: string[]
  sendTime: string
  status: string
  channels: { method: string; sendTime: string; status: string; logId: string; detail: string }[]
  readTime: string
  reader: string
  signed: boolean
  signTime: string
  signer: string
  receiptId: string
  deemedDelivered: boolean
  deemedTime: string
  retryCount: number
}

export const DELIVERY_RECORDS: DeliveryRecord[] = GEN_DOCS.filter((g) => g.deliveryId).slice(0, 220).map((g, i) => {
  const st = pick(DELIVERY_STATUS.filter((s) => s !== '待送达'))
  const signed = ['已签收'].includes(st)
  const failed = st === '送达失败'
  const deemed = st === '视为送达'
  return {
    deliveryId: g.deliveryId,
    documentId: g.documentId,
    documentName: g.documentName,
    docNo: g.docNo,
    orgName: g.orgName,
    recipient: {
      name: `${g.orgName} 医保办`,
      contact: pick(['张主任', '李主任', '王主任', '陈主任']),
      phone: `0553-${rndInt(2000000, 8999999)}`,
      email: `yb${rndInt(100, 999)}@wuhu-med.cn`,
      address: `芜湖市${g.district}${pick(['北京中路', '中山北路', '银湖南路', '九华中路'])}${rndInt(1, 288)}号`
    },
    deliveryMethods: failed ? ['电子送达', '短信通知', '邮寄送达'] : ['电子送达', '短信通知', '邮件送达'],
    sendTime: dt(-rndInt(0, 18), rndInt(9, 17), 0),
    status: st,
    channels: [
      { method: '电子送达', sendTime: dt(-rndInt(0, 18), rndInt(9, 17), 0), status: failed ? '失败' : '成功', logId: `SYS20260920${pad(rndInt(1, 999999), 6)}`, detail: failed ? '机构端账号未激活，推送失败' : '已推送至机构端消息中心' },
      { method: '短信通知', sendTime: dt(-rndInt(0, 18), rndInt(9, 17), 0), status: '成功', logId: `SMS20260920${pad(rndInt(1, 999999), 6)}`, detail: '短信已送达机构预留手机号' },
      { method: failed ? '邮寄送达' : '邮件送达', sendTime: dt(-rndInt(0, 17), rndInt(9, 17), 0), status: '成功', logId: failed ? `EMS${pad(rndInt(1, 99999999), 8)}` : `EMAIL20260920${pad(rndInt(1, 999999), 6)}`, detail: failed ? '已通过 EMS 邮寄，运单号可查' : '邮件已投递至机构邮箱' }
    ],
    readTime: ['已读', '已签收'].includes(st) ? dt(-rndInt(0, 15), rndInt(10, 18), 0) : '',
    reader: ['已读', '已签收'].includes(st) ? `${g.orgName} 医保办` : '',
    signed,
    signTime: signed ? dt(-rndInt(0, 14), rndInt(10, 18), 0) : '',
    signer: signed ? pick(['张主任（电子签名）', '李主任（电子签名）', '王主任（电子签名）']) : '',
    receiptId: signed ? `REC20260920${pad(i + 1, 4)}` : '',
    deemedDelivered: deemed,
    deemedTime: deemed ? dt(-rndInt(0, 8), 18, 0) : '',
    retryCount: failed ? rndInt(1, 3) : 0
  }
})

/** 导出记录（3.4.3） */
export const EXPORT_RECORDS = Array.from({ length: 46 }, (_, i) => {
  const g = pick(GEN_DOCS)
  const fmt = pick(EXPORT_FORMATS)
  return {
    exportId: `EXP20260920${pad(i + 1, 4)}`,
    documentId: g.documentId,
    documentName: g.documentName,
    docNo: g.docNo,
    format: fmt,
    withSeal: g.signed,
    watermark: pick(['无', '仅供内部使用', '副本']),
    fileSize: `${(rnd() * 3 + 0.4).toFixed(2)} MB`,
    exportTime: dt(-rndInt(0, 25), rndInt(9, 18), 0),
    operator: pick(AUDITORS),
    downloadCount: rndInt(1, 12)
  }
})

/* ============ 六、证据全链管理（3.5） ============ */
resetSeed(80005)

export interface EvidenceItem {
  evidenceId: string
  evidenceNo: string
  evidenceName: string
  evidenceKind: string
  caseId: string
  orgName: string
  source: string
  collectTime: string
  collector: string
  fixMethod: string
  proveMatter: string
  pageCount: number
  fileSize: string
  fileHash: string
  blockchainId: string
  sealed: boolean
  relatedFacts: string[]
  relatedDocs: string[]
  status: string
}

const PROVE_MATTERS = [
  '证明机构存在串换药品行为', '证明虚构购药记录事实', '证明违规金额认定依据',
  '证明机构负责人主观明知', '证明违规行为持续时间', '证明医保基金实际损失',
  '证明现场药品实物与账目不符', '证明参保人未实际购药'
]

export const EVIDENCES: EvidenceItem[] = Array.from({ length: 640 }, (_, i) => {
  const k = EVIDENCE_KINDS[i % EVIDENCE_KINDS.length]
  const org = pick(ORGS)
  const hash = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')
  return {
    evidenceId: `EV2026090${pad(i + 1, 5)}`,
    evidenceNo: `证${pad((i % 60) + 1, 3)}号`,
    evidenceName: pick([
      `${org.orgName}药品进销存台账`, `${org.orgName}医保结算费用明细`, '门诊处方复印件',
      '现场检查照片', '药品盘点记录', '机构负责人询问笔录', '参保人证人证言',
      '医保信息系统结算数据导出', '监控视频录像', '涉案药品实物封存照片',
      '司法鉴定意见书', '电子病历导出文件', '陈述申辩书'
    ]),
    evidenceKind: k.kind,
    caseId: `CASE20260815${pad(rndInt(1, 60), 4)}`,
    orgName: org.orgName,
    source: pick(['现场检查取证', '机构提交', '医保信息系统导出', '第三方机构出具', '参保人提供']),
    collectTime: dt(-rndInt(1, 60), rndInt(9, 18), rndInt(0, 59)),
    collector: pick(AUDITORS),
    fixMethod: k.fixMethod,
    proveMatter: pick(PROVE_MATTERS),
    pageCount: k.kind === '视听资料' || k.kind === '物证' ? 0 : rndInt(1, 46),
    fileSize: `${(rnd() * 18 + 0.2).toFixed(2)} MB`,
    fileHash: hash,
    blockchainId: `BC20260920${pad(rndInt(1, 999999), 6)}`,
    sealed: rnd() > 0.18,
    relatedFacts: pickMany(['F001', 'F002', 'F003'], rndInt(1, 2)),
    relatedDocs: pickMany(GEN_DOCS.slice(0, 40).map((g) => g.docNo), rndInt(1, 2)),
    status: pick(['已归集', '已固化', '已上链', '已归档'])
  }
})

/** 证据链可视化数据（3.5.2） */
export function buildEvidenceChain(caseId: string) {
  const list = EVIDENCES.filter((e) => e.caseId === caseId).slice(0, 12)
  const evs = list.length ? list : EVIDENCES.slice(0, 10)
  const facts = [
    { factId: 'F001', factName: '串换药品骗取基金', amount: 32000, evidenceCount: 0 },
    { factId: 'F002', factName: '虚构购药记录申报结算', amount: 24000, evidenceCount: 0 }
  ]
  const nodes: any[] = [
    { id: 'CASE', name: '案件', type: '案件', category: 0, value: 100 },
    ...facts.map((f, i) => ({ id: f.factId, name: f.factName, type: '违规事实', category: 1, value: 70, amount: f.amount }))
  ]
  const links: any[] = facts.map((f) => ({ source: 'CASE', target: f.factId, relation: '包含' }))
  evs.forEach((e, i) => {
    const nid = `E${pad(i + 1, 3)}`
    nodes.push({ id: nid, name: e.evidenceName, type: e.evidenceKind, category: 2 + (EVIDENCE_KINDS.findIndex((k) => k.kind === e.evidenceKind) % 6), value: 40, evidenceId: e.evidenceId, kind: e.evidenceKind, proveMatter: e.proveMatter })
    const f = facts[i % facts.length]
    f.evidenceCount++
    links.push({ source: f.factId, target: nid, relation: '证明' })
    if (i > 0 && rnd() < 0.35) {
      links.push({ source: `E${pad(i, 3)}`, target: nid, relation: '相互印证' })
    }
  })
  const kindStat = EVIDENCE_KINDS.map((k) => ({ name: k.kind, value: evs.filter((e) => e.evidenceKind === k.kind).length })).filter((x) => x.value > 0)
  return {
    caseId,
    caseName: `${evs[0]?.orgName || ''}违规案`,
    nodes,
    links,
    categories: [
      { name: '案件' }, { name: '违规事实' },
      ...EVIDENCE_KINDS.slice(0, 6).map((k) => ({ name: k.kind }))
    ],
    facts,
    kindStat,
    chainIntegrity: {
      score: rndInt(82, 98),
      complete: true,
      crossVerified: links.filter((l) => l.relation === '相互印证').length,
      weakPoints: rnd() < 0.4 ? ['部分书证仅有复印件，建议补充原件核对章'] : [],
      conclusion: '证据种类覆盖完整，事实与证据对应关系清晰，多份证据相互印证，可形成完整证据链。'
    }
  }
}

/** 防篡改导出记录（3.5.3） */
export const TAMPER_PROOF_EXPORTS = Array.from({ length: 32 }, (_, i) => {
  const e = pick(EVIDENCES)
  return {
    exportId: `TPE20260915${pad(i + 1, 4)}`,
    caseId: e.caseId,
    evidenceCount: rndInt(8, 42),
    totalPages: rndInt(60, 480),
    format: pick(['PDF（带证据专用章）', 'ZIP打包（含哈希校验文件）', 'OFD（版式固化）']),
    sealed: true,
    sealName: '芜湖市医疗保障局证据专用章',
    packageHash: Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join(''),
    hashAlgorithm: 'SHA-256',
    blockchainId: `BC20260920${pad(rndInt(1, 999999), 6)}`,
    queryUrl: 'https://blockchain.wuhu.gov.cn/verify',
    verifyReportId: `VR20260915${pad(i + 1, 4)}`,
    exportTime: dt(-rndInt(0, 40), rndInt(9, 18), 0),
    operator: pick(AUDITORS),
    verifyStatus: pick(['校验通过', '校验通过', '校验通过', '待校验'])
  }
})

/* ============ 七、案卷归档（3.6） ============ */
resetSeed(80006)

export interface CaseFile {
  caseFileId: string
  caseFileNo: string
  archiveNo: string
  caseName: string
  orgName: string
  district: string
  assembleTime: string
  assembler: string
  status: string
  volumeCount: number
  totalPages: number
  retentionYears: number
  paperBoxNo: string
  storageLocation: string
  /** 案卷目录（按档案规范排列） */
  catalog: { seq: number; materialName: string; docNo: string; pageFrom: number; pageTo: number; remark: string }[]
  /** 组装校验 */
  assembleCheck: { requiredCount: number; actualCount: number; missing: string[]; passed: boolean }
  paperScanned: boolean
  ocrRecognized: boolean
  archiveTime: string
  archiver: string
}

const CATALOG_TPL = [
  '案卷目录', '立案审批表', '检查通知书', '现场检查记录单', '询问笔录',
  '证据清单', '违规确认书', '检查报告', '陈述申辩告知书', '陈述申辩笔录',
  '法制审核意见', '集体讨论记录', '行政处罚决定书', '送达回证', '执行凭证',
  '整改意见书', '整改验收意见书', '结案报告', '备考表'
]

export const CASE_FILES: CaseFile[] = Array.from({ length: 68 }, (_, i) => {
  const org = pick(ORGS)
  const st = pick(ARCHIVE_STATUS)
  let page = 1
  const catalog = CATALOG_TPL.map((m, k) => {
    const pages = rndInt(1, 12)
    const from = page
    page += pages
    return {
      seq: k + 1,
      materialName: m,
      docNo: ['案卷目录', '备考表'].includes(m) ? '' : `${ORG_CODE}${pick(DOC_TYPE_CODES).code}〔2026〕${pad(rndInt(1, 99), 3)}号`,
      pageFrom: from,
      pageTo: page - 1,
      remark: k === 0 ? '卷内材料目录' : k === CATALOG_TPL.length - 1 ? '立卷说明' : ''
    }
  })
  const missing = rnd() < 0.18 ? pickMany(['听证笔录', '强制执行申请书'], 1) : []
  return {
    caseFileId: `CF20260925${pad(i + 1, 4)}`,
    caseFileNo: `${ORG_CODE}档〔2026〕${pad(i + 1, 3)}号`,
    archiveNo: `YJ-ZF-2026-${pad(i + 1, 3)}`,
    caseName: `${org.orgName}${pick(['串换药品', '虚假诊疗', '重复收费', '超量开药', '过度诊疗'])}违规案`,
    orgName: org.orgName,
    district: org.district,
    assembleTime: dt(-rndInt(2, 60), rndInt(9, 18), 0),
    assembler: pick(['档案员·周敏', '档案员·吴刚', ...AUDITORS.slice(0, 3)]),
    status: st,
    volumeCount: rndInt(1, 3),
    totalPages: page - 1,
    retentionYears: pick([10, 30, 30, 30]),
    paperBoxNo: `2026-A-${pad(i + 1, 3)}`,
    storageLocation: `档案室 ${pick(['A', 'B', 'C'])} 区 ${rndInt(1, 12)} 排 ${rndInt(1, 40)} 号`,
    catalog,
    assembleCheck: {
      requiredCount: CATALOG_TPL.length,
      actualCount: CATALOG_TPL.length - missing.length,
      missing,
      passed: !missing.length
    },
    paperScanned: rnd() > 0.3,
    ocrRecognized: rnd() > 0.36,
    archiveTime: ['已归档', '已移交', '借出中'].includes(st) ? dt(-rndInt(0, 40), rndInt(9, 18), 0) : '',
    archiver: pick(['档案员·周敏', '档案员·吴刚'])
  }
})

/** 档案借阅记录（3.6.2） */
export const BORROW_RECORDS = Array.from({ length: 42 }, (_, i) => {
  const cf = pick(CASE_FILES)
  const st = pick(BORROW_STATUS)
  return {
    borrowId: `BOR20261101${pad(i + 1, 4)}`,
    caseFileId: cf.caseFileId,
    caseFileNo: cf.caseFileNo,
    caseName: cf.caseName,
    borrower: pick([...AUDITORS, '法规科 · 陈科长', '基金监管处 · 王处长']),
    borrowerDept: pick(['基金监管处', '法规科', '办公室', '稽核一组', '稽核二组']),
    purpose: pick(['行政复议应诉材料准备', '同类案件办理参考', '案卷质量检查', '上级机关调阅', '行政诉讼举证']),
    applyTime: dt(-rndInt(1, 50), rndInt(9, 18), 0),
    status: st,
    approver: st === '审批中' ? '' : pick(['档案员·周敏', '办公室 · 刘主任']),
    approveTime: st === '审批中' ? '' : dt(-rndInt(0, 45), rndInt(9, 18), 0),
    borrowType: pick(['原件借阅', '电子调阅', '复印件借阅']),
    dueDate: d(rndInt(-10, 25)),
    returnTime: st === '已归还' ? dt(-rndInt(0, 20), rndInt(9, 18), 0) : '',
    overdue: st === '逾期未还',
    remark: st === '已驳回' ? '借阅事由不充分，请补充说明后重新申请' : ''
  }
})

/** 纸质扫描入档任务（3.6.3） */
export const SCAN_TASKS = Array.from({ length: 34 }, (_, i) => {
  const cf = pick(CASE_FILES)
  const total = rndInt(20, 180)
  const done = rndInt(0, total)
  return {
    scanId: `SCAN20261025${pad(i + 1, 4)}`,
    caseFileId: cf.caseFileId,
    caseFileNo: cf.caseFileNo,
    caseName: cf.caseName,
    paperBoxNo: cf.paperBoxNo,
    barcodeNo: `BC${pad(rndInt(1, 99999999), 8)}`,
    totalPages: total,
    scannedPages: done,
    progress: Math.round((done / total) * 100),
    status: done >= total ? '已完成' : done > 0 ? '扫描中' : '待扫描',
    ocrStatus: done >= total ? pick(['识别完成', '识别完成', '部分识别失败']) : '未开始',
    ocrAccuracy: done >= total ? rndInt(88, 99) : 0,
    recognizedCategories: done >= total ? pickMany(CATALOG_TPL, rndInt(4, 10)) : [],
    linkedElectronic: done >= total && rnd() > 0.2,
    operator: pick(['档案员·周敏', '档案员·吴刚']),
    startTime: dt(-rndInt(1, 30), rndInt(9, 14), 0),
    finishTime: done >= total ? dt(-rndInt(0, 25), rndInt(14, 18), 0) : ''
  }
})

/* ============ 统计数据 ============ */
export const DOC_STATS = {
  /* 模板 */
  templateTotal: DOC_TEMPLATES.length,
  templateEffective: DOC_TEMPLATES.filter((t) => t.status === '现行有效').length,
  categoryDist: TEMPLATE_CATEGORIES.map((c) => ({ name: c.categoryName, value: c.tpls.length })),
  templateUseTop: [...DOC_TEMPLATES].sort((a, b) => b.useCount - a.useCount).slice(0, 8).map((t) => ({ name: t.templateName, value: t.useCount })),

  /* 文书 */
  docTotal: GEN_DOCS.length,
  docByStatus: DOC_STATUS.map((s) => ({ name: s, value: GEN_DOCS.filter((g) => g.status === s).length })).filter((x) => x.value > 0),
  docByType: DOC_TYPE_CODES.map((t) => ({ name: t.docType, value: GEN_DOCS.filter((g) => g.docType === t.docType).length })).filter((x) => x.value > 0),
  aiGeneratedCount: GEN_DOCS.filter((g) => g.aiGenerated).length,
  aiRate: Math.round((GEN_DOCS.filter((g) => g.aiGenerated).length / GEN_DOCS.length) * 1000) / 10,
  avgQuality: Math.round(
    (GEN_DOCS.filter((g) => g.qualityScore).reduce((a, b) => a + (b.qualityScore?.overall || 0), 0) /
      Math.max(1, GEN_DOCS.filter((g) => g.qualityScore).length)) * 10
  ) / 10,
  fillCompleteRate: Math.round((GEN_DOCS.filter((g) => g.fillValidation.status === '填充完整').length / GEN_DOCS.length) * 1000) / 10,

  /* 校对 */
  proofreadTotal: GEN_DOCS.filter((g) => g.proofread).length,
  totalErrors: GEN_DOCS.reduce((a, b) => a + (b.proofread?.errors || 0), 0),
  totalWarnings: GEN_DOCS.reduce((a, b) => a + (b.proofread?.warnings || 0), 0),
  totalTips: GEN_DOCS.reduce((a, b) => a + (b.proofread?.tips || 0), 0),
  issueTypeDist: [
    { name: '法条时效性', value: 42 }, { name: '错别字', value: 68 },
    { name: '金额不一致', value: 24 }, { name: '标点不规范', value: 56 },
    { name: '口语化表述', value: 38 }, { name: '要素缺失', value: 18 }
  ],

  /* 签章送达 */
  signTotal: SIGN_RECORDS.length,
  deliveryTotal: DELIVERY_RECORDS.length,
  deliveryByStatus: DELIVERY_STATUS.map((s) => ({ name: s, value: DELIVERY_RECORDS.filter((r) => r.status === s).length })).filter((x) => x.value > 0),
  signedRate: Math.round((DELIVERY_RECORDS.filter((r) => r.signed).length / Math.max(1, DELIVERY_RECORDS.length)) * 1000) / 10,
  exportTotal: EXPORT_RECORDS.length,
  exportFormatDist: EXPORT_FORMATS.map((f) => ({ name: f, value: EXPORT_RECORDS.filter((r) => r.format === f).length })).filter((x) => x.value > 0),

  /* 证据 */
  evidenceTotal: EVIDENCES.length,
  evidenceByKind: EVIDENCE_KINDS.map((k) => ({ name: k.kind, value: EVIDENCES.filter((e) => e.evidenceKind === k.kind).length })),
  sealedCount: EVIDENCES.filter((e) => e.sealed).length,
  chainCount: EVIDENCES.filter((e) => e.status === '已上链').length,
  tamperExportTotal: TAMPER_PROOF_EXPORTS.length,

  /* 案卷 */
  caseFileTotal: CASE_FILES.length,
  archivedCount: CASE_FILES.filter((c) => c.status === '已归档').length,
  totalPages: CASE_FILES.reduce((a, b) => a + b.totalPages, 0),
  scannedCount: CASE_FILES.filter((c) => c.paperScanned).length,
  borrowTotal: BORROW_RECORDS.length,
  borrowing: BORROW_RECORDS.filter((b) => b.status === '借阅中').length,
  borrowOverdue: BORROW_RECORDS.filter((b) => b.overdue).length,
  scanTaskTotal: SCAN_TASKS.length,
  scanDone: SCAN_TASKS.filter((s) => s.status === '已完成').length,

  /* 趋势 */
  monthTrend: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((m, i) => ({
    month: m,
    generated: [28, 36, 42, 52, 46, 36][i],
    signed: [24, 32, 38, 48, 42, 32][i],
    delivered: [22, 30, 36, 45, 40, 30][i],
    archived: [12, 18, 22, 28, 24, 18][i]
  }))
}
