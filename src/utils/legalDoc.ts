/**
 * 执法文书模板引擎 —— 违规处置智能体
 * 需求依据：doc/子功能/03_违规处置智能体_详细功能设计.md（3.1.3 / 3.1.4 / 3.2 / 3.5 / 3.6 / 3.4）
 *
 * 设计要点：
 *   1) 一份文书 = 文头（机关+文种+文号）+ 主送 + 正文段落 + 落款（机关+印章+日期）
 *   2) 段落分四种呈现类型：paragraph（正文段）/ list（列举）/ table（表格）/ kv（要素对照）
 *   3) 页面按公文版式渲染（2号小标宋标题、3号仿宋正文、首行缩进2字符）
 *   4) 支持导出 Word（.doc, MHTML）/ PDF（打印）/ 台账 Excel（CSV）
 *
 * ⚠️ 编号规范：
 *   - 系统内部业务 ID（CONF/HAND/PEN/TRANS/RECT/CA/ARC…）仅用于检索与关联，不印在文头
 *   - 正式文书文头一律使用〔〕文号
 */

/* ============ 发文机关与通用常量 ============ */

/** 发文机关全称（正式文书必须用全称） */
export const ISSUER = '芜湖市医疗保障局'

/** 机关联系方式 */
export const ISSUER_CONTACT = {
  dept: '芜湖市医疗保障局基金监管处',
  phone: '0553-3901234',
  address: '安徽省芜湖市镜湖区北京中路 66 号',
  account: '芜湖市医疗保障局基金收入专户 3200012345678901234'
}

/** 文号「字」映射：文书类型 → 文号字 */
export const DOC_WORD: Record<string, string> = {
  report: '检报',        // 检查报告
  confirm: '确',         // 违规确认书
  notice: '告',          // 处理意见告知书
  amount: '认',          // 违规金额认定表
  talk: '约',            // 约谈通知书
  refuse: '拒',          // 拒付通知书
  recover: '追',         // 违规费用追回通知书
  rectify: '整',         // 整改意见书
  accept: '验',          // 整改验收意见书
  suspendSettle: '停结', // 暂停医保结算通知书
  suspendPact: '停协',   // 暂停医保服务协议通知书
  terminatePact: '解协', // 解除医保服务协议通知书
  penalty: '罚',         // 行政处罚决定书
  transfer: '移',        // 案件移送函
  archive: '档',         // 案卷
  close: '结',           // 结案（销号）
  analysis: '分'         // 监管分析报告
}

/** 生成规范文号：芜医保罚〔2026〕012号 */
export function makeDocNo(type: string, seq: number | string, year = 2026): string {
  const w = DOC_WORD[type] || '文'
  const n = typeof seq === 'number' ? String(seq).padStart(3, '0') : seq
  return `芜医保${w}〔${year}〕${n}号`
}

/** ISO 日期 → 中文式：2026-09-20 → 2026年9月20日 */
export function cnDate(v?: string): string {
  if (!v) return ''
  const m = String(v).slice(0, 10).split('-')
  if (m.length !== 3) return String(v)
  return `${m[0]}年${Number(m[1])}月${Number(m[2])}日`
}

/** 金额转中文大写（文书金额需大写） */
export function cnMoney(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '零元'
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const units = ['', '拾', '佰', '仟']
  const bigUnits = ['', '万', '亿']
  const int = Math.floor(Math.abs(n))
  const dec = Math.round((Math.abs(n) - int) * 100)
  if (int === 0 && dec === 0) return '零元整'

  let s = ''
  let str = String(int)
  const groups: string[] = []
  while (str.length > 0) {
    groups.unshift(str.slice(Math.max(0, str.length - 4)))
    str = str.slice(0, Math.max(0, str.length - 4))
  }
  groups.forEach((g, gi) => {
    let gs = ''
    const len = g.length
    for (let i = 0; i < len; i++) {
      const d = Number(g[i])
      const u = units[len - 1 - i]
      if (d === 0) {
        if (gs && !gs.endsWith('零')) gs += '零'
      } else {
        gs += digits[d] + u
      }
    }
    gs = gs.replace(/零$/, '')
    if (gs) s += gs + bigUnits[groups.length - 1 - gi]
  })
  s = s.replace(/零+/g, '零').replace(/零$/, '')
  let out = s + '元'
  if (dec === 0) out += '整'
  else {
    const jiao = Math.floor(dec / 10)
    const fen = dec % 10
    out += (jiao ? digits[jiao] + '角' : '') + (fen ? digits[fen] + '分' : '')
  }
  return out
}

/** 千分位金额 */
function money(n?: number): string {
  if (n === undefined || n === null) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ============ 文书结构类型 ============ */

export interface DocSection {
  /** 章节序号，如「一」「二」，为空则不显示序号 */
  no?: string
  /** 章节标题 */
  title?: string
  /** 呈现类型 */
  type: 'paragraph' | 'list' | 'table' | 'kv' | 'signature' | 'note'
  /** paragraph：段落文本（数组=多段） */
  text?: string | string[]
  /** list：列举项 */
  items?: string[]
  /** table：表头与数据行 */
  head?: string[]
  rows?: (string | number)[][]
  /** kv：要素对照 */
  kv?: { k: string; v: string }[]
  /** note：提示语气（灰底小字） */
  note?: string
}

export interface LegalDoc {
  /** 文书唯一键 */
  docKey: string
  /** 文书类型（对应 DOC_WORD） */
  docType: string
  /** 发文机关 */
  issuer: string
  /** 文种（标题第二行） */
  docName: string
  /** 完整标题（封面式文书用，如检查报告） */
  fullTitle?: string
  /** 规范文号 */
  docNo: string
  /** 关联系统业务 ID（不印在文头，仅页脚标注） */
  bizId?: string
  /** 主送机关/当事人（顶格 + 冒号） */
  recipient?: string
  /** 是否为报告体（报告体不写主送，用封面 + 章节） */
  isReport?: boolean
  /** 正文段落 */
  sections: DocSection[]
  /** 落款日期 */
  signDate: string
  /** 落款附注（如签发人、检查人员） */
  signExtra?: { k: string; v: string }[]
  /** 是否加盖印章 */
  sealed?: boolean
  /** 印章文案 */
  sealText?: string
}

/* ============ 通用救济告知表述 ============ */

/** 行政处罚类救济告知（《行政复议法》《行政诉讼法》通用表述） */
const RELIEF_PENALTY = [
  `如不服本处罚决定，可自收到本决定书之日起 60 日内向芜湖市人民政府或安徽省医疗保障局申请行政复议；或自收到本决定书之日起 6 个月内依法向人民法院提起行政诉讼。`,
  `申请行政复议或提起行政诉讼期间，本处罚决定不停止执行，法律另有规定的除外。`
]

/** 协议处理类救济告知 */
const RELIEF_AGREEMENT = [
  `你单位如对本决定不服，可自收到本通知之日起 60 日内向芜湖市人民政府或安徽省医疗保障局申请行政复议，或自收到本通知之日起 6 个月内依法向人民法院提起行政诉讼；亦可依据医保服务协议约定申请协议争议处理。`
]

/** 陈述申辩与听证告知（文档 3.1.4 明确口径） */
const RIGHTS_NOTICE = (fineAmount?: number) => {
  const arr = [
    `你单位自收到本告知之日起 5 个工作日内，有权就上述认定的违规事实、金额及拟处理意见进行陈述和申辩。`
  ]
  if (fineAmount && fineAmount > 0) {
    arr.push(`本机关拟对你单位罚款 ${money(fineAmount)} 元，你单位有权自收到本告知之日起 3 个工作日内申请听证。`)
  }
  arr.push(`申诉渠道：${ISSUER_CONTACT.dept}，联系电话 ${ISSUER_CONTACT.phone}。`)
  arr.push(`本告知采用电子送达方式，未签收的自送达之日起 5 个工作日后视为送达；必要时另行邮寄送达。`)
  return arr
}

/* ============ 一、医保基金使用情况检查报告 ============ */

export function buildInspectReport(c: any, seq = 89): LegalDoc {
  const vts = c.violationTypes || []
  const resp = c.responsibility || {}
  return {
    docKey: `report-${c.confirmationId}`,
    docType: 'report',
    issuer: ISSUER,
    docName: '医保基金使用情况检查报告',
    fullTitle: `${c.orgName}医保基金使用情况检查报告`,
    docNo: makeDocNo('report', seq),
    bizId: c.confirmationId,
    isReport: true,
    sections: [
      {
        type: 'kv',
        title: '封面信息',
        kv: [
          { k: '被检机构', v: c.orgName },
          { k: '机构编码', v: c.orgCode },
          { k: '机构类型', v: c.orgType },
          { k: '所属辖区', v: c.district },
          { k: '检查类型', v: '日常稽核' },
          { k: '检查期间', v: '2026-08-01 至 2026-08-31' },
          { k: '检查人员', v: `${c.review?.firstReviewer?.name || ''}、${c.review?.secondReviewer?.name || '稽核员·李明华'}` },
          { k: '报告日期', v: cnDate(c.confirmTime) }
        ]
      },
      {
        no: '一',
        title: '检查基本情况',
        type: 'paragraph',
        text: [
          `依据《医疗保障基金使用监督管理条例》《芜湖市基本医疗保险定点医药机构服务协议》及本年度医保基金监管工作计划，本机关于 2026 年 8 月对${c.orgName}医保基金使用情况开展检查。`,
          `检查范围：${c.orgName} 2026 年 8 月 1 日至 2026 年 8 月 31 日期间医保结算业务，涉及科室 ${(resp.deptResponsibility || []).map((d: any) => d.dept).join('、') || '相关科室'}。`,
          `检查方式：线上数据筛查 + 现场核查 + 问询笔录 + 病历与费用明细核对。`
        ]
      },
      {
        no: '二',
        title: '检查发现问题',
        type: 'table',
        head: ['序号', '违规类型', '涉及科室', '涉及人次', '涉及金额（元）', '主要证据'],
        rows: vts.map((v: any, i: number) => [
          i + 1,
          v.type,
          (resp.deptResponsibility || [])[i % Math.max(1, (resp.deptResponsibility || []).length)]?.dept || '相关科室',
          v.count,
          money(v.amount),
          '医保结算明细、病历记录、现场检查笔录'
        ])
      },
      {
        no: '三',
        title: '违规金额认定',
        type: 'kv',
        kv: [
          { k: '违规本金合计', v: `${money(c.amount.totalViolationAmount)} 元（${cnMoney(c.amount.totalViolationAmount)}）` },
          { k: '涉及医保基金', v: `${money(c.amount.insuranceFundAmount)} 元` },
          { k: '其中·职工医保统筹基金', v: `${money(c.amount.byInsurance['职工医保'])} 元` },
          { k: '其中·居民医保统筹基金', v: `${money(c.amount.byInsurance['居民医保'])} 元` },
          { k: '涉及个人账户', v: `${money(c.amount.personalAccountAmount)} 元` },
          { k: '个人自付部分', v: `${money(c.amount.selfPayAmount)} 元` },
          { k: '拟处罚金额', v: c.amount.penaltyAmount ? `${money(c.amount.penaltyAmount)} 元（按 ${c.amount.penaltyMultiple} 倍计算）` : '不予罚款' },
          { k: '应追缴合计', v: `${money(c.amount.totalRecoverable)} 元` }
        ]
      },
      {
        no: '四',
        title: '问题性质认定',
        type: 'paragraph',
        text: [
          `经审核认定，${c.orgName}上述行为属【${c.problemNature}】。`,
          `认定理由：${c.natureReason}。`,
          `认定依据：${(c.legalBasis || []).map((l: any) => `${l.law}${l.article}`).join('；')}。`
        ]
      },
      {
        no: '五',
        title: '责任界定',
        type: 'table',
        head: ['责任层级', '责任主体', '责任类型', '责任程度', '责任说明'],
        rows: [
          ['机构责任', resp.orgResponsibility?.org || c.orgName, resp.orgResponsibility?.type || '主体责任', resp.orgResponsibility?.degree || '主要责任', resp.orgResponsibility?.description || ''],
          ...(resp.deptResponsibility || []).map((d: any) => ['科室责任', d.dept, d.type, d.degree, d.description]),
          ...(resp.personalResponsibility || []).map((p: any) => ['个人责任', `${p.name}（${p.dept}）`, p.type, p.degree, p.description])
        ]
      },
      {
        no: '六',
        title: '处理建议',
        type: 'paragraph',
        text: [
          `建议处置路径：${c.aiSuggestion?.suggestedHandling || '协议处理'}。`,
          `建议采取措施：${(c.aiSuggestion?.suggestedMeasures || []).join('、')}。`,
          `法律依据：${(c.legalBasis || []).map((l: any) => `${l.law}${l.article}`).join('；')}。`
        ]
      },
      {
        no: '七',
        title: '附件清单',
        type: 'list',
        items: [
          '附件1：违规费用明细表（医保结算数据导出）',
          '附件2：病历与处方复印件',
          '附件3：现场检查笔录',
          '附件4：问询笔录',
          '附件5：现场检查照片',
          '附件6：违规金额认定表'
        ]
      }
    ],
    signDate: cnDate(c.confirmTime),
    signExtra: [
      { k: '检查机关', v: ISSUER },
      { k: '承办人', v: c.review?.firstReviewer?.name || '' },
      { k: '复核人', v: c.review?.secondReviewer?.name || '' }
    ],
    sealed: true
  }
}

/* ============ 二、违规确认书 ============ */

export function buildConfirmDoc(c: any, seq = 12): LegalDoc {
  const resp = c.responsibility || {}
  return {
    docKey: `confirm-${c.confirmationId}`,
    docType: 'confirm',
    issuer: ISSUER,
    docName: '医保基金使用违规行为确认书',
    docNo: makeDocNo('confirm', seq),
    bizId: c.confirmationId,
    recipient: c.orgName,
    sections: [
      {
        type: 'paragraph',
        text: `依据《医疗保障基金使用监督管理条例》及医保服务协议约定，本机关对你单位 2026 年 8 月医保基金使用情况开展检查，现将违规行为认定情况确认如下：`
      },
      {
        no: '一',
        title: '违规行为定性',
        type: 'table',
        head: ['序号', '违规类型', '分类层级', '涉及人次', '涉及金额（元）'],
        rows: (c.violationTypes || []).map((v: any, i: number) => [i + 1, v.type, v.level, v.count, money(v.amount)])
      },
      {
        no: '二',
        title: '问题性质与认定依据',
        type: 'paragraph',
        text: [
          `问题性质：${c.problemNature}。`,
          `认定理由：${c.natureReason}。`,
          ...(c.legalBasis || []).map((l: any, i: number) => `依据 ${i + 1}：${l.law}${l.article} —— ${l.content}`)
        ]
      },
      {
        no: '三',
        title: '违规金额核算',
        type: 'kv',
        kv: [
          { k: '违规本金', v: `${money(c.amount.totalViolationAmount)} 元` },
          { k: '涉及医保基金', v: `${money(c.amount.insuranceFundAmount)} 元` },
          { k: '职工医保 / 居民医保', v: `${money(c.amount.byInsurance['职工医保'])} 元 / ${money(c.amount.byInsurance['居民医保'])} 元` },
          { k: '个人账户 / 个人自付', v: `${money(c.amount.personalAccountAmount)} 元 / ${money(c.amount.selfPayAmount)} 元` },
          { k: '拟处罚金额', v: c.amount.penaltyAmount ? `${money(c.amount.penaltyAmount)} 元` : '不予罚款' },
          { k: '罚款依据', v: c.amount.penaltyBasis },
          { k: '应追缴合计', v: `${money(c.amount.totalRecoverable)} 元（${cnMoney(c.amount.totalRecoverable)}）` }
        ]
      },
      {
        no: '四',
        title: '责任界定',
        type: 'table',
        head: ['责任主体', '责任类型', '责任程度', '责任说明'],
        rows: [
          [resp.orgResponsibility?.org || c.orgName, resp.orgResponsibility?.type || '主体责任', resp.orgResponsibility?.degree || '主要责任', resp.orgResponsibility?.description || ''],
          ...(resp.deptResponsibility || []).map((d: any) => [d.dept, d.type, d.degree, d.description]),
          ...(resp.personalResponsibility || []).map((p: any) => [`${p.name}（${p.dept}）`, p.type, p.degree, p.description])
        ]
      },
      {
        no: '五',
        title: '处置建议',
        type: 'paragraph',
        text: [
          `拟采取处置路径：${c.aiSuggestion?.suggestedHandling || '协议处理'}。`,
          `拟采取措施：${(c.aiSuggestion?.suggestedMeasures || []).join('、')}。`
        ]
      },
      {
        no: '六',
        title: '双人复核情况',
        type: 'kv',
        kv: [
          { k: '承办人意见', v: c.review?.firstReviewer?.opinion || '' },
          { k: '承办人 / 签署时间', v: `${c.review?.firstReviewer?.name || ''} / ${c.review?.firstReviewer?.signTime || ''}` },
          { k: '复核人意见', v: c.review?.secondReviewer?.opinion || '待复核' },
          { k: '复核结论', v: c.review?.secondReviewer?.result || '待复核' },
          { k: '复核人 / 签署时间', v: `${c.review?.secondReviewer?.name || ''} / ${c.review?.secondReviewer?.signTime || ''}` },
          { k: '复核触发情形', v: (c.dualReviewReasons || []).join('、') || '未触发双人复核' }
        ]
      },
      {
        no: '七',
        title: '权利告知',
        type: 'list',
        items: RIGHTS_NOTICE(c.amount.penaltyAmount)
      }
    ],
    signDate: cnDate(c.confirmTime),
    sealed: true
  }
}

/* ============ 三、处理意见告知书 ============ */

export function buildNoticeDoc(c: any, seq = 34): LegalDoc {
  return {
    docKey: `notice-${c.confirmationId}`,
    docType: 'notice',
    issuer: ISSUER,
    docName: '医保基金监管处理意见告知书',
    docNo: makeDocNo('notice', seq),
    bizId: c.confirmationId,
    recipient: c.orgName,
    sections: [
      {
        type: 'paragraph',
        text: `本机关对你单位医保基金使用情况的检查已经结束。经查，你单位存在${(c.violationTypes || []).map((v: any) => v.type).join('、')}等违规行为，涉及违规金额 ${money(c.amount.totalViolationAmount)} 元，其中涉及医保基金 ${money(c.amount.insuranceFundAmount)} 元，问题性质认定为【${c.problemNature}】。现将拟处理意见告知如下：`
      },
      {
        no: '一',
        title: '拟处理措施',
        type: 'list',
        items: (c.aiSuggestion?.suggestedMeasures || []).map((m: string, i: number) => `${i + 1}. ${m}`)
      },
      {
        no: '二',
        title: '拟追缴金额',
        type: 'kv',
        kv: [
          { k: '责令退回医保基金', v: `${money(c.amount.insuranceFundAmount)} 元` },
          { k: '拟处罚款', v: c.amount.penaltyAmount ? `${money(c.amount.penaltyAmount)} 元（${c.amount.penaltyMultiple} 倍）` : '不予罚款' },
          { k: '应追缴合计', v: `${money(c.amount.totalRecoverable)} 元（${cnMoney(c.amount.totalRecoverable)}）` }
        ]
      },
      {
        no: '三',
        title: '法律依据',
        type: 'list',
        items: (c.legalBasis || []).map((l: any) => `${l.law}${l.article}：${l.content}`)
      },
      {
        no: '四',
        title: '你单位依法享有的权利',
        type: 'list',
        items: RIGHTS_NOTICE(c.amount.penaltyAmount)
      },
      {
        type: 'note',
        note: '随本告知书一并送达：①医保基金使用情况检查报告 ②医保基金使用违规行为确认书 ③违规金额认定表'
      }
    ],
    signDate: cnDate(c.delivery?.pushTime || c.confirmTime),
    sealed: true
  }
}

/* ============ 四、协议处理文书（按措施类型分派） ============ */

const MEASURE_DOC_META: Record<string, { name: string; type: string }> = {
  约谈: { name: '约谈通知书', type: 'talk' },
  拒付: { name: '医保费用拒付通知书', type: 'refuse' },
  基金追回: { name: '违规费用追回通知书', type: 'recover' },
  责令整改: { name: '整改意见书', type: 'rectify' },
  暂停结算: { name: '暂停医保费用结算通知书', type: 'suspendSettle' },
  暂停服务协议: { name: '暂停医保服务协议通知书', type: 'suspendPact' },
  解除服务协议: { name: '解除医保服务协议通知书', type: 'terminatePact' }
}

export function buildAgreementDoc(h: any, measure: any, seq = 23): LegalDoc {
  const meta = MEASURE_DOC_META[measure.measureType] || { name: '协议处理通知书', type: 'notice' }
  const sections: DocSection[] = [
    {
      no: '一',
      title: '事实与依据',
      type: 'paragraph',
      text: [
        `经本机关检查认定，你单位在医保基金使用过程中存在违规行为，问题性质为【${h.problemNature}】，涉及违规金额 ${money(h.totalAmount)} 元。`,
        `依据《医疗保障基金使用监督管理条例》及《芜湖市基本医疗保险定点医药机构服务协议》有关约定，本机关决定对你单位采取以下处理措施。`
      ]
    },
    {
      no: '二',
      title: '处理决定',
      type: 'paragraph',
      text: measure.content
    }
  ]

  // 各文种独有要素
  if (measure.measureType === '约谈') {
    sections.push({
      no: '三',
      title: '约谈安排',
      type: 'kv',
      kv: [
        { k: '约谈时间', v: cnDate(measure.deadline) + ' 上午 9:30' },
        { k: '约谈地点', v: `${ISSUER}三楼会议室` },
        { k: '约谈对象', v: '机构法定代表人、医保办负责人' },
        { k: '需携带材料', v: '营业执照、医保服务协议、内控制度文件、自查整改报告' },
        { k: '医保局方参加人员', v: `${ISSUER_CONTACT.dept}负责人及承办人` }
      ]
    })
  } else if (measure.measureType === '基金追回') {
    sections.push({
      no: '三',
      title: '退回方式与期限',
      type: 'kv',
      kv: [
        { k: '应退回金额', v: `${money(measure.amount)} 元（${cnMoney(measure.amount)}）` },
        { k: '退回期限', v: `自收到本通知之日起 15 日内，最迟不超过 ${cnDate(measure.deadline)}` },
        { k: '退回账户', v: ISSUER_CONTACT.account },
        { k: '退回方式', v: '银行转账 / 医保结算扣缴' },
        { k: '逾期后果', v: '逾期未退回的，本机关将暂停医保费用结算，并可依法申请人民法院强制执行' }
      ]
    })
  } else if (measure.measureType === '拒付') {
    sections.push({
      no: '三',
      title: '拒付说明',
      type: 'kv',
      kv: [
        { k: '拒付金额', v: `${money(h.totalAmount)} 元` },
        { k: '拒付范围', v: '本次检查认定的违规费用中尚未结算部分' },
        { k: '处理方式', v: '本机关对上述费用不予拨付，已申报的予以核减' },
        { k: '生效时间', v: '自本通知送达之日起生效' }
      ]
    })
  } else if (measure.measureType === '暂停结算') {
    sections.push({
      no: '三',
      title: '暂停范围与期限',
      type: 'kv',
      kv: [
        { k: '暂停范围', v: '你单位全部医保费用结算业务' },
        { k: '暂停期限', v: `1 个月，自 ${cnDate(measure.deadline)} 起至期满之日` },
        { k: '期间要求', v: '暂停期间参保人就医发生的费用由你单位先行垫付，不得拒诊、不得推诿参保人' },
        { k: '恢复条件', v: '整改验收通过且违规费用全额退回后，经本机关审核恢复结算' }
      ]
    })
  } else if (measure.measureType === '暂停服务协议' || measure.measureType === '解除服务协议') {
    const isSuspend = measure.measureType === '暂停服务协议'
    sections.push({
      no: '三',
      title: isSuspend ? '暂停范围与期限' : '解除生效与后续安排',
      type: 'kv',
      kv: isSuspend
        ? [
            { k: '暂停内容', v: '暂停你单位医保服务协议，期间不得开展医保结算业务' },
            { k: '暂停期限', v: `3 个月（法定区间 1—6 个月），自 ${cnDate(measure.deadline)} 起` },
            { k: '参保人安排', v: '你单位应在门诊显著位置公告，并引导参保人至就近定点机构就医' },
            { k: '恢复条件', v: '期满且整改验收通过后，方可申请恢复医保服务协议' }
          ]
        : [
            { k: '解除内容', v: '解除你单位医保服务协议，自生效之日起不再具有医保定点资格' },
            { k: '生效日期', v: `自本通知送达之日起生效（${cnDate(measure.deadline)}）` },
            { k: '参保人安排', v: '你单位应妥善做好在院参保人转诊转院衔接，不得损害参保人合法权益' },
            { k: '重新申请限制', v: '自解除之日起 3 年内不得重新申请医保定点' },
            { k: '信用后果', v: '本处理结果将联动机构信用记录并按规定向社会公示' }
          ]
    })
  } else if (measure.measureType === '责令整改') {
    sections.push({
      no: '三',
      title: '整改要求',
      type: 'kv',
      kv: [
        { k: '整改内容', v: measure.content },
        { k: '整改期限', v: cnDate(measure.deadline) },
        { k: '反馈要求', v: '整改完成后须在线提交整改情况报告及佐证材料，经本机关复查验收' }
      ]
    })
  }

  sections.push({
    no: '四',
    title: '救济途径告知',
    type: 'list',
    items: RELIEF_AGREEMENT
  })

  return {
    docKey: `agreement-${measure.measureId}`,
    docType: meta.type,
    issuer: ISSUER,
    docName: meta.name,
    // 按文种规范生成文号（Mock 中的兜底文号可能未区分文种字）
    docNo: makeDocNo(meta.type, seq),
    bizId: h.handlingId,
    recipient: h.orgName,
    sections,
    signDate: cnDate(h.approval?.approveTime || h.createTime),
    signExtra: [
      { k: '审批层级', v: h.approval?.approvalLevel || '科长审批' },
      { k: '审批人', v: h.approval?.approver || '' }
    ],
    sealed: true
  }
}

/* ============ 五、行政处罚决定书 ============ */

export function buildPenaltyDoc(p: any): LegalDoc {
  const pr = p.procedureRecords || []
  const done = (name: string) => pr.find((r: any) => r.step === name && r.done)
  const fine = (p.penaltyDecision?.measures || []).find((m: any) => m.type === '罚款')

  return {
    docKey: `penalty-${p.penaltyId}`,
    docType: 'penalty',
    issuer: ISSUER,
    docName: '行政处罚决定书',
    docNo: p.caseNo,
    bizId: p.penaltyId,
    recipient: '',
    sections: [
      {
        no: '',
        title: '当事人基本情况',
        type: 'kv',
        kv: [
          { k: '当事人名称', v: p.orgName },
          { k: '医保机构编码', v: 'H340200001' },
          { k: '住　　所', v: ISSUER_CONTACT.address },
          { k: '法定代表人', v: '（详见案卷当事人信息表）' }
        ]
      },
      {
        no: '一',
        title: '案件来源与调查经过',
        type: 'paragraph',
        text: [
          `本机关于 ${cnDate(p.caseInfo?.filingDate || p.createTime)} 对你单位涉嫌${p.violationFacts?.type}行为立案调查。`,
          `立案审批：${p.caseInfo?.filingApproval?.approver || ISSUER + '负责人'}批准立案。`,
          `调查终结：${cnDate(p.caseInfo?.investigationEndDate || '')}，本机关完成调查并制作《案件调查终结报告》。`
        ]
      },
      {
        no: '二',
        title: '违法事实',
        type: 'paragraph',
        text: [
          `经查，${p.violationFacts?.description}。`,
          `上述行为造成医保基金损失（骗取医保基金）共计 ${money(p.violationFacts?.fraudAmount)} 元，其中涉及医保基金 ${money(p.violationFacts?.insuranceFundAmount)} 元。`
        ]
      },
      {
        no: '三',
        title: '证据',
        type: 'list',
        items: [
          '上述事实，有以下证据证明：',
          '1. 医保结算数据明细（电子数据）',
          '2. 病历、处方及诊疗记录复印件（书证）',
          '3. 药品进销存台账（书证）',
          '4. 现场检查笔录（笔录）',
          '5. 当事人及相关人员问询笔录（笔录）',
          '6. 参保人陈述材料（言词证据）',
          '7. 现场检查照片（视听资料）'
        ]
      },
      {
        no: '四',
        title: '法律依据与程序履行',
        type: 'paragraph',
        text: [
          `你单位的上述行为违反了${p.legalBasis?.law}${(p.legalBasis?.articles || []).map((a: any) => a.article).join('、')}的规定。`,
          ...(p.legalBasis?.articles || []).map((a: any) => `${p.legalBasis?.law}${a.article}规定：${a.content}`),
          `本机关已依法履行以下程序：${done('事先告知') ? '已于 ' + cnDate(done('事先告知').time) + ' 送达《行政处罚事先告知书》，告知拟处罚的事实、理由、依据及依法享有的陈述申辩权；' : ''}${done('听证告知') ? '已送达《听证告知书》；' : ''}${done('陈述申辩/听证') ? '当事人在规定期限内提交书面陈述申辩，本机关已予充分考虑；' : ''}${done('法制审核') ? '本案已经法制机构审核；' : ''}${done('集体讨论') ? '本案经本机关负责人集体讨论决定。' : ''}`
        ]
      },
      {
        no: '五',
        title: '处罚决定',
        type: 'table',
        head: ['序号', '处罚种类', '处罚内容', '倍数', '金额（元）'],
        rows: (p.penaltyDecision?.measures || []).map((m: any, i: number) => [
          i + 1, m.type, m.content, m.multiple ? `${m.multiple} 倍` : '—', m.amount ? money(m.amount) : '—'
        ])
      },
      {
        type: 'paragraph',
        text: `以上责令退回及罚款金额合计 ${money(p.penaltyDecision?.totalAmount)} 元（${cnMoney(p.penaltyDecision?.totalAmount)}）。`
      },
      {
        no: '六',
        title: '履行方式与期限',
        type: 'kv',
        kv: [
          { k: '缴款期限', v: `自收到本决定书之日起 15 日内（最迟 ${cnDate(p.execution?.refundDeadline)}）` },
          { k: '缴款账户', v: ISSUER_CONTACT.account },
          { k: '逾期加处罚款', v: '到期不缴纳罚款的，每日按罚款数额的百分之三加处罚款，加处罚款数额不超出罚款数额' },
          { k: '强制执行', v: '逾期不履行本决定的，本机关将依法申请人民法院强制执行' },
          { k: '信用公示', v: '本行政处罚信息将按规定推送至芜湖市公共信用信息平台公示，公示期 1 年' }
        ]
      },
      {
        no: '七',
        title: '救济途径告知',
        type: 'list',
        items: RELIEF_PENALTY
      }
    ],
    signDate: cnDate(p.penaltyDecision?.decisionDate || p.createTime),
    signExtra: [{ k: '案件承办人', v: pr.find((r: any) => r.done)?.operator || '' }],
    sealed: true,
    sealText: '芜湖市医疗保障局行政处罚专用章'
  }
}

/* ============ 六、案件移送函 ============ */

export function buildTransferDoc(t: any): LegalDoc {
  return {
    docKey: `transfer-${t.transferId}`,
    docType: 'transfer',
    issuer: ISSUER,
    docName: `关于移送${t.orgName}涉嫌${t.transferType.includes('公安') ? '诈骗' : '违纪违法'}案件的函`,
    docNo: t.documents?.[0]?.no || makeDocNo('transfer', 3),
    bizId: t.transferId,
    recipient: t.targetOrg,
    sections: [
      {
        no: '一',
        title: '案件基本情况与违法事实',
        type: 'paragraph',
        text: [
          `本机关在医保基金监管检查中发现，${t.reason}`,
          `涉案金额共计 ${money(t.fraudAmount)} 元（${cnMoney(t.fraudAmount)}）。`
        ]
      },
      {
        no: '二',
        title: '涉案人员',
        type: 'table',
        head: ['姓名', '职务', '法律地位'],
        rows: (t.suspects || []).map((s: any) => [s.name, s.role, s.type])
      },
      {
        no: '三',
        title: '移送理由与法律依据',
        type: 'list',
        items: t.legalBasis || []
      },
      {
        no: '四',
        title: '审批情况',
        type: 'kv',
        kv: [
          { k: '承办人', v: t.approval?.proposer || '' },
          { k: '法制审核', v: `${t.approval?.legalReviewer || ''}：${t.approval?.legalOpinion || ''}` },
          { k: '批准移送', v: `${t.approval?.approver || ''}（${cnDate(t.approval?.approveTime)}）` }
        ]
      },
      {
        no: '五',
        title: '随函移送材料',
        type: 'table',
        head: ['序号', '材料名称', '证据类型', '页数'],
        rows: (t.evidenceMaterials || []).map((e: any, i: number) => [i + 1, e.name, e.type, e.pages])
      },
      {
        no: '六',
        title: '移送文书清单',
        type: 'list',
        items: (t.documents || []).map((d: any, i: number) => `${i + 1}. ${d.name}${d.no ? `（${d.no}）` : ''}`)
      },
      {
        type: 'paragraph',
        text: `本案已通过「行政执法与刑事司法衔接信息共享平台」线上移送。请贵单位依法受理并及时将办理结果书面反馈本机关。`
      },
      {
        type: 'note',
        note: `联系人：${t.approval?.proposer || ''}　联系电话：${ISSUER_CONTACT.phone}`
      }
    ],
    signDate: cnDate(t.approval?.approveTime || t.createTime),
    sealed: true
  }
}

/* ============ 七、整改意见书 / 整改验收意见书 ============ */

export function buildRectifyDoc(r: any, seq = 67): LegalDoc {
  return {
    docKey: `rectify-${r.rectifyId}`,
    docType: 'rectify',
    issuer: ISSUER,
    docName: '整改意见书',
    docNo: makeDocNo('rectify', seq),
    bizId: r.rectifyId,
    recipient: r.orgName,
    sections: [
      {
        type: 'paragraph',
        text: `经本机关检查，你单位在医保基金使用及内部管理方面存在下列问题。依据《医疗保障基金使用监督管理条例》第三十八条及医保服务协议约定，现向你单位下达整改意见，请逐项落实整改。`
      },
      {
        no: '一',
        title: '存在问题与整改要求',
        type: 'table',
        head: ['序号', '违规类型', '存在问题', '整改要求', '完成时限'],
        rows: (r.items || []).map((it: any, i: number) => [
          i + 1, it.violationType, it.problem, it.requirement, cnDate(it.deadline)
        ])
      },
      {
        no: '二',
        title: '整改总体要求',
        type: 'list',
        items: [
          `1. 你单位应于 ${cnDate(r.deadline)} 前完成全部整改事项。`,
          '2. 整改应做到问题见底、责任到人、制度落地，不得敷衍整改、虚假整改。',
          '3. 整改完成后须在线提交《整改情况报告》并上传佐证材料（制度文件、系统改造截图、培训记录、退款凭证等）。',
          '4. 本机关将组织复查验收，验收不通过的退回重新整改。',
          '5. 整改期满未完成的，本机关将予以督办并纳入机构信用记录；屡查屡犯的从重处置。'
        ]
      },
      {
        no: '三',
        title: '救济途径告知',
        type: 'list',
        items: RELIEF_AGREEMENT
      }
    ],
    signDate: cnDate(r.issueTime),
    signExtra: [{ k: '复查责任人', v: r.reviewer || '' }],
    sealed: true
  }
}

export function buildAcceptDoc(r: any, seq = 34): LegalDoc {
  const items = r.items || []
  const passed = items.filter((i: any) => i.status === '已完成')
  return {
    docKey: `accept-${r.rectifyId}`,
    docType: 'accept',
    issuer: ISSUER,
    docName: '整改验收意见书',
    docNo: makeDocNo('accept', seq),
    bizId: r.rectifyId,
    recipient: r.orgName,
    sections: [
      {
        type: 'paragraph',
        text: `依据本机关下达的《整改意见书》，你单位已提交整改情况报告及佐证材料。本机关组织复查，现将验收意见告知如下：`
      },
      {
        no: '一',
        title: '逐项验收结论',
        type: 'table',
        head: ['序号', '整改事项', '机构反馈', '复查结论', '复查意见'],
        rows: items.map((it: any, i: number) => [
          i + 1,
          it.problem,
          it.feedback ? '已反馈' : '未反馈',
          it.review?.result || '待复查',
          it.review?.opinion || '—'
        ])
      },
      {
        no: '二',
        title: '验收总体结论',
        type: 'kv',
        kv: [
          { k: '整改事项总数', v: `${items.length} 项` },
          { k: '验收通过', v: `${passed.length} 项` },
          { k: '整改完成率', v: `${r.progress}%` },
          { k: '验收结论', v: r.status === '已完成' ? '整改到位，验收通过' : '尚未全部整改到位，继续整改' },
          { k: '验收人', v: r.reviewer || '' },
          { k: '验收日期', v: cnDate(r.deadline) }
        ]
      },
      {
        no: '三',
        title: '后续要求',
        type: 'list',
        items: [
          '1. 你单位应持续巩固整改成果，将整改措施长效化、制度化。',
          '2. 本机关将在后续日常稽核中开展"回头看"，防止问题反弹。',
          '3. 验收通过不免除你单位已认定违规行为的其他法律责任。'
        ]
      }
    ],
    signDate: cnDate(r.deadline),
    sealed: true
  }
}

/* ============ 八、销号审批表 ============ */

export function buildCancelApprovalDoc(c: any): LegalDoc {
  return {
    docKey: `cancel-${c.cancelId}`,
    docType: 'close',
    issuer: ISSUER,
    docName: '案件销号（结案）审批表',
    docNo: c.approval?.cancelNo || makeDocNo('close', 89),
    bizId: c.cancelId,
    isReport: true,
    sections: [
      {
        type: 'kv',
        title: '案件基本信息',
        kv: [
          { k: '案件名称', v: c.caseName },
          { k: '被检机构', v: c.orgName },
          { k: '机构编码', v: c.orgCode },
          { k: '所属辖区', v: c.district },
          { k: '关联确认书', v: c.confirmationId },
          { k: '关联任务', v: c.taskId },
          { k: '申请销号日期', v: cnDate(c.applyTime) }
        ]
      },
      {
        no: '一',
        title: '销号条件核验',
        type: 'table',
        head: ['序号', '核验项', '结论', '核验说明'],
        rows: (c.conditions || []).map((cd: any, i: number) => [
          i + 1, cd.name, cd.passed ? '已满足' : '未满足', cd.detail
        ])
      },
      {
        no: '二',
        title: '资金处理情况',
        type: 'kv',
        kv: [
          { k: '应追缴合计', v: `${money(c.totalAmount)} 元` },
          { k: '已追回', v: `${money(c.recoveredAmount)} 元` },
          { k: '未追回', v: `${money(c.totalAmount - c.recoveredAmount)} 元` },
          { k: '追回率', v: `${c.totalAmount ? ((c.recoveredAmount / c.totalAmount) * 100).toFixed(1) : 0}%` }
        ]
      },
      {
        no: '三',
        title: '审批流转',
        type: 'table',
        head: ['审批环节', '审批人', '结论', '意见', '时间'],
        rows: (c.approval?.nodes || []).map((n: any) => [
          n.role, n.name, n.result, n.opinion || '—', n.time || '—'
        ])
      },
      ...(c.credit
        ? [
            {
              no: '四',
              title: '信用联动情况',
              type: 'kv' as const,
              kv: [
                { k: '机构信用分', v: `${c.credit.orgScoreBefore} → ${c.credit.orgScoreAfter}（扣 ${c.credit.deduction} 分）` },
                { k: '信用等级', v: `${c.credit.orgLevelBefore} 级 → ${c.credit.orgLevelAfter} 级` },
                { k: '扣分理由', v: c.credit.reason },
                { k: '个人信用记录', v: (c.credit.personalRecords || []).map((p: any) => `${p.name}（${p.dept}）扣 ${p.deduction} 分，${p.measure}`).join('；') || '无' },
                { k: '是否公示', v: c.credit.publicity ? '向社会公示' : '不予公示' },
                { k: '有效期至', v: cnDate(c.credit.validUntil) }
              ]
            }
          ]
        : []),
      {
        no: c.credit ? '五' : '四',
        title: '销号结论',
        type: 'kv',
        kv: [
          { k: '审批层级', v: c.approval?.level || '' },
          { k: '最终结论', v: c.approval?.finalResult || '审批中' },
          { k: '销号文号', v: c.approval?.cancelNo || '—' },
          { k: '销号日期', v: c.approval?.cancelTime ? cnDate(c.approval.cancelTime) : '—' }
        ]
      }
    ],
    signDate: cnDate(c.approval?.cancelTime || c.applyTime),
    sealed: !!c.approval?.cancelNo
  }
}

/* ============ 九、案件复盘报告 ============ */

export function buildReviewReportDoc(r: any): LegalDoc {
  return {
    docKey: `review-${r.scoreId}`,
    docType: 'analysis',
    issuer: ISSUER,
    docName: '案件质量复盘报告',
    fullTitle: `${r.caseName}办案质量复盘报告`,
    docNo: makeDocNo('analysis', 12),
    bizId: r.scoreId,
    isReport: true,
    sections: [
      {
        type: 'kv',
        title: '复盘基本信息',
        kv: [
          { k: '案件名称', v: r.caseName },
          { k: '被检机构', v: r.orgName },
          { k: '复盘编号', v: r.scoreId },
          { k: '综合得分', v: `${r.totalScore} 分（${r.grade}）` },
          { k: '是否重点复盘', v: r.isKeyReview ? `是 —— ${r.keyReason}` : '否' },
          { k: '复盘人', v: r.reviewer },
          { k: '复盘时间', v: r.scoreTime }
        ]
      },
      {
        no: '一',
        title: '五维质量评分',
        type: 'table',
        head: ['评价维度', '权重', '得分', '评价意见'],
        rows: (r.dimensions || []).map((d: any) => [d.name, `${d.weight}%`, d.score, d.comment])
      },
      {
        no: '二',
        title: '发现问题',
        type: 'list',
        items: (r.problems || []).length ? r.problems.map((p: string, i: number) => `${i + 1}. ${p}`) : ['本案办理规范，未发现明显问题。']
      },
      {
        no: '三',
        title: '优化建议',
        type: 'list',
        items: (r.suggestions || []).length ? r.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`) : ['继续保持现有办案规范。']
      },
      ...(r.modelFeedback
        ? [
            {
              no: '四',
              title: '模型与规则迭代反馈',
              type: 'kv' as const,
              kv: [
                { k: '关联规则', v: `${r.modelFeedback.ruleName}（${r.modelFeedback.ruleId}）` },
                { k: '调整建议', v: r.modelFeedback.adjustSuggestion },
                { k: '采纳状态', v: r.modelFeedback.adopted ? '已采纳，规则阈值调整待生效' : '待采纳' }
              ]
            }
          ]
        : []),
      {
        type: 'note',
        note: '历史案件、核查数据、处置结果与误判反馈将全量回流模型库与规则库，实现"一次处置、一次优化、持续进化"。'
      }
    ],
    signDate: cnDate(r.scoreTime),
    signExtra: [{ k: '复盘机构', v: ISSUER_CONTACT.dept }],
    sealed: false
  }
}

/* ============ 十、监管分析报告 ============ */

export function buildAnalysisReportDoc(st: any, type: 'analysis' | 'summary' = 'analysis'): LegalDoc {
  const ach = st?.achievement || {}
  const isSummary = type === 'summary'
  return {
    docKey: `analysis-${type}`,
    docType: 'analysis',
    issuer: ISSUER,
    docName: isSummary ? '专项检查总结报告' : '医保基金监管分析报告',
    fullTitle: isSummary
      ? '芜湖市 2026 年度医保基金专项检查工作总结报告'
      : '芜湖市 2026 年度医保基金监管情况分析报告',
    docNo: makeDocNo('analysis', isSummary ? 15 : 12),
    isReport: true,
    sections: [
      {
        no: '一',
        title: '监管工作总体情况',
        type: 'paragraph',
        text: [
          `2026 年度，本机关依托「智行合医」医保基金智能监管平台，累计出动检查人次 ${ach.inspectPersonTimes} 人次，覆盖定点医疗机构 ${ach.coveredHospitals} 家、定点零售药店 ${ach.coveredPharmacies} 家。`,
          `平台累计生成疑点线索 ${(ach.clueCount || 0).toLocaleString('zh-CN')} 条，线索阳性率 ${ach.positiveRate}%，实现监管从"人工抽查"向"数据驱动、智能迭代"转型。`
        ]
      },
      {
        no: '二',
        title: '核心监管战果',
        type: 'kv',
        kv: [
          { k: '检查人次', v: `${ach.inspectPersonTimes} 人次` },
          { k: '覆盖机构', v: `医院 ${ach.coveredHospitals} 家 / 药店 ${ach.coveredPharmacies} 家` },
          { k: '疑点线索', v: `${(ach.clueCount || 0).toLocaleString('zh-CN')} 条` },
          { k: '线索阳性率', v: `${ach.positiveRate}%` },
          { k: '认定违规金额', v: `${money(ach.violationAmount)} 元` },
          { k: '行政处罚金额', v: `${money(ach.penaltyAmount)} 元` },
          { k: '基金追回金额', v: `${money(ach.recoveredAmount)} 元` },
          { k: '整改完成率', v: `${ach.rectifyCompleteRate}%` },
          { k: '移送案件', v: `${ach.transferCount} 件` },
          { k: '信用联动', v: `${ach.creditLinkCount} 条` }
        ]
      },
      {
        no: '三',
        title: '问题性质分布',
        type: 'table',
        head: ['问题性质', '案件数（件）'],
        rows: (st?.natureDist || []).map((n: any) => [n.name, n.value])
      },
      {
        no: '四',
        title: '违规类型分布',
        type: 'table',
        head: ['违规类型', '案件数（件）', '涉及金额（元）'],
        rows: (st?.byViolationType || []).map((v: any) => [v.name, v.count, money(v.amount)])
      },
      {
        no: '五',
        title: '辖区监管情况',
        type: 'table',
        head: ['辖区', '案件数（件）', '违规金额（元）', '处罚金额（元）'],
        rows: (st?.byDistrict || []).map((d: any) => [d.name, d.count, money(d.amount), money(d.penalty)])
      },
      {
        no: '六',
        title: '月度趋势',
        type: 'table',
        head: ['月份', '违规确认（件）', '已处置（件）', '违规金额（元）', '追回金额（元）'],
        rows: (st?.monthTrend || []).map((m: any) => [
          m.month, m.confirmed, m.handled, money(m.violationAmount), money(m.recoveredAmount)
        ])
      },
      {
        no: '七',
        title: '办案质量与模型迭代',
        type: 'kv',
        kv: [
          { k: '复盘案件数', v: `${st?.reviewScoreTotal || 0} 件` },
          { k: '平均质量得分', v: `${st?.avgScore || 0} 分` },
          { k: '重点复盘案件', v: `${st?.keyReviewCount || 0} 件` },
          { k: '优化建议采纳', v: `${st?.adoptedFeedback || 0} 条` },
          ...(st?.scoreDimAvg || []).map((d: any) => ({ k: d.name, v: `${d.value} 分` }))
        ]
      },
      {
        no: '八',
        title: isSummary ? '下阶段工作安排' : '监管建议',
        type: 'list',
        items: isSummary
          ? [
              '1. 深化多源数据融合，扩大跨源比对场景覆盖面。',
              '2. 持续优化 AI 研判模型，降低误判率、提升阳性率。',
              '3. 强化基金追回刚性约束，压降逾期未追回案件比例。',
              '4. 严格整改验收标准，建立整改"回头看"长效机制。',
              '5. 加大典型案例宣教力度，实现查处一案、警示一片。'
            ]
          : [
              '1. 重复收费、过度诊疗仍为高发违规类型，建议在规则引擎中提高相关规则命中灵敏度。',
              '2. 部分机构屡查屡犯，建议对信用等级 D、E 级机构提高检查频次并纳入重点监管。',
              '3. 建议完善内控制度类问题的整改验收标准，避免"制度上墙不落地"。',
              '4. 建议将复盘发现的证据链薄弱环节固化为系统必填校验项。'
            ]
      }
    ],
    signDate: cnDate('2026-08-31'),
    signExtra: [{ k: '编制机构', v: ISSUER_CONTACT.dept }],
    sealed: true
  }
}

/* ============ 导出能力 ============ */

/** 文书 → HTML（用于 Word 导出与打印） */
export function docToHtml(doc: LegalDoc): string {
  const secHtml = doc.sections
    .map((s) => {
      const title = s.title
        ? `<h3 style="font-size:15pt;font-weight:700;margin:16px 0 8px;font-family:'SimHei',黑体;">${s.no ? s.no + '、' : ''}${s.title}</h3>`
        : ''
      let body = ''
      if (s.type === 'paragraph') {
        const arr = Array.isArray(s.text) ? s.text : [s.text || '']
        body = arr.map((t) => `<p style="font-size:14pt;line-height:2;text-indent:2em;margin:6px 0;font-family:'FangSong',仿宋;">${t}</p>`).join('')
      } else if (s.type === 'list') {
        body = (s.items || []).map((t) => `<p style="font-size:14pt;line-height:2;text-indent:2em;margin:4px 0;font-family:'FangSong',仿宋;">${t}</p>`).join('')
      } else if (s.type === 'table') {
        body =
          `<table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:11pt;font-family:'FangSong',仿宋;">` +
          `<thead><tr>${(s.head || []).map((h) => `<th style="background:#f0f4fa;font-weight:700;">${h}</th>`).join('')}</tr></thead>` +
          `<tbody>${(s.rows || []).map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      } else if (s.type === 'kv') {
        body =
          `<table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:12pt;font-family:'FangSong',仿宋;">` +
          (s.kv || []).map((i) => `<tr><td style="width:170px;background:#f0f4fa;font-weight:700;">${i.k}</td><td>${i.v}</td></tr>`).join('') +
          `</table>`
      } else if (s.type === 'note') {
        body = `<p style="font-size:11pt;color:#666;margin:10px 0;padding:8px;background:#f5f7fa;font-family:'FangSong',仿宋;">${s.note}</p>`
      }
      return title + body
    })
    .join('')

  const head = doc.isReport
    ? `<h1 style="text-align:center;font-size:22pt;font-weight:700;font-family:'SimSun',宋体;margin:26px 0 10px;">${doc.fullTitle || doc.docName}</h1>
       <p style="text-align:center;font-size:12pt;margin:0 0 22px;font-family:'FangSong',仿宋;">${doc.docNo}</p>`
    : `<p style="text-align:center;font-size:20pt;font-weight:700;color:#c00;font-family:'SimSun',宋体;margin:20px 0 4px;letter-spacing:4px;">${doc.issuer}</p>
       <h1 style="text-align:center;font-size:22pt;font-weight:700;font-family:'SimSun',宋体;margin:4px 0 8px;">${doc.docName}</h1>
       <p style="text-align:center;font-size:12pt;margin:0 0 6px;font-family:'FangSong',仿宋;">${doc.docNo}</p>
       <hr style="border:none;border-top:2px solid #c00;margin:0 0 20px;" />
       ${doc.recipient ? `<p style="font-size:14pt;font-weight:700;margin:0 0 10px;font-family:'FangSong',仿宋;">${doc.recipient}：</p>` : ''}`

  const signExtra = (doc.signExtra || []).map((s) => `<p style="font-size:12pt;margin:2px 0;font-family:'FangSong',仿宋;">${s.k}：${s.v}</p>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.docName} ${doc.docNo}</title></head>
<body style="margin:0;padding:36px 48px;background:#fff;">
${head}
${secHtml}
<div style="margin-top:34px;text-align:right;">
  ${signExtra}
  <p style="font-size:15pt;font-weight:700;margin:14px 0 2px;font-family:'FangSong',仿宋;">${doc.issuer}</p>
  ${doc.sealed ? `<p style="font-size:11pt;color:#c00;margin:2px 0;">（${doc.sealText || doc.issuer + '印'}）</p>` : ''}
  <p style="font-size:14pt;margin:2px 0;font-family:'FangSong',仿宋;">${doc.signDate}</p>
</div>
${doc.bizId ? `<p style="margin-top:26px;font-size:9pt;color:#999;border-top:1px solid #ddd;padding-top:6px;">系统业务编号：${doc.bizId}　｜　本文书由「智行合医」医保基金智能监管平台生成</p>` : ''}
</body></html>`
}

/** 导出 Word（.doc，MHTML 兼容格式） */
export function exportWord(doc: LegalDoc) {
  const html = docToHtml(doc)
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
  triggerDownload(blob, `${doc.docName}_${doc.docNo.replace(/[〔〕]/g, '')}.doc`)
}

/** 导出 PDF（调起浏览器打印，可选「另存为 PDF」） */
export function exportPdf(doc: LegalDoc) {
  const html = docToHtml(doc)
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  setTimeout(() => {
    w.focus()
    w.print()
  }, 320)
  return true
}

/** 导出台账 CSV（Excel 可直接打开） */
export function exportCsv(fileName: string, head: string[], rows: (string | number)[][]) {
  const esc = (v: any) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [head.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `${fileName}.csv`)
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

/* ============ 成套案卷 / 材料清单（文档明确） ============ */

/** 行政处罚成套案卷 12 份文书 */
export const PENALTY_CASE_DOCS = [
  '立案审批表', '案件调查终结报告', '行政处罚事先告知书', '听证告知书',
  '陈述申辩笔录', '听证笔录', '法制审核意见', '集体讨论记录',
  '行政处罚决定书', '送达回证', '执行凭证', '结案报告'
]

/** 移送材料清单 */
export const TRANSFER_MATERIALS = [
  '案件移送函', '案件调查报告', '证据材料（复印件）',
  '涉案物品清单', '当事人信息', '其他相关材料'
]

/** 档案九类归档材料 */
export const ARCHIVE_CATEGORIES_9 = [
  '线索材料', '任务材料', '核查记录', '证据材料', '违规确认书',
  '处置决定文书', '申诉材料', '整改材料', '销号材料'
]
