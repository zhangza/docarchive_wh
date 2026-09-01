/**
 * 七大智能体门户元数据
 * 需求依据：doc/07_六大智能体功能设计_初稿_v1.2_20260829.md
 *
 * 说明：文档标题为「六大智能体」，其中第六项为「系统管理与支撑模块」。
 * 平台侧按 6 个模块组织，第一智能体（疑点线索管理）含 7 个子域共 15 个页面。
 */

export interface AgentFeature {
  /** 功能组编号，对应设计文档章节号 */
  no: string
  /** 功能组名称 */
  name: string
  /** 一句话价值说明 */
  desc: string
  /** 该功能组已实现的页面路由（未实现为空） */
  path?: string
}

export interface AgentCard {
  /** 目录 key，与 features / api / mock / router 一致 */
  key: string
  /** 序号 */
  no: number
  /** 智能体全称 */
  name: string
  /** 简称（用于徽标） */
  shortName: string
  /** 英文名（装饰用） */
  enName: string
  /** 主色调（门户卡片配色，取自 Design Token 色系） */
  tone: 'primary' | 'accent' | 'purple' | 'warning' | 'success' | 'info'
  /** Element Plus 图标名 */
  icon: string
  /** 定位：解决什么问题（源自设计文档「解决什么问题」段） */
  positioning: string
  /** 核心能力标签 */
  tags: string[]
  /** 功能组清单 */
  features: AgentFeature[]
  /** 是否已实现 */
  ready: boolean
  /** 已实现页面数 */
  pageCount: number
  /** 入口路由（ready 时有效） */
  entry?: string
  /** 需求文档文件名 */
  doc: string
}

export const AGENT_CARDS: AgentCard[] = [
  {
    key: 'agent01-clue',
    no: 1,
    name: '疑点线索管理智能体',
    shortName: '疑点线索',
    enName: 'Clue Management',
    tone: 'primary',
    icon: 'Aim',
    positioning:
      '打通医保结算与诊疗、进销存等多源数据壁垒，基于数据关联关系自动比对发现疑点，变“人工事后翻数据”为“系统实时主动发现”，实现线索发现、研判、核实、申诉、全周期闭环管理。',
    tags: ['多源数据融合', '五类比对场景', 'AI 研判建议', '知识图谱溯源', '全周期闭环'],
    features: [
      { no: '1.0', name: '全量数据比对', desc: '多源数据融合 + 智能比对引擎，自动发现跨源疑点', path: '/compare/dashboard' },
      { no: '1.1', name: '智能预警', desc: '7×24 实时监测，风险自动分级并生成标准化线索', path: '/alert/dashboard' },
      { no: '1.2', name: '线索研判', desc: 'AI 给出结论、依据与置信度，人工确认后分流', path: '/judgment/workbench' },
      { no: '1.3', name: '线上筛查', desc: '机构在线自查，自查数据自动比对并输出初筛结论', path: '/screening/review' },
      { no: '1.4', name: '线下核查', desc: 'OCR 智能采集、移动化取证、证据实时回传固化', path: '/inspection/manage' },
      { no: '1.5', name: '机构申诉', desc: 'AI 初核辅助研判申诉合理性，保障程序公正', path: '/appeal/review' },
      { no: '1.6', name: '线索全周期管理', desc: '状态全程可视留痕，误判反馈反哺模型优化', path: '/lifecycle/track' }
    ],
    ready: true,
    pageCount: 15,
    entry: '/compare/dashboard',
    doc: '01_疑点线索管理智能体_详细功能设计.md'
  },
  {
    key: 'agent02-task',
    no: 2,
    name: '专项任务管理智能体',
    shortName: '专项任务',
    enName: 'Task Management',
    tone: 'accent',
    icon: 'Files',
    positioning:
      '解决人工归并线索、立项标准不一、派单慢、进度不透明的问题，实现线索智能聚类立项、任务精准直达、全程可视督办与结果规范输出。',
    tags: ['线索智能聚类', '合并去重', '要素自动预填', '限时签收', '泳道进度图', '超期督办', '结果自动整合'],
    features: [
      { no: '2.1+2.2', name: '任务生成与派发', desc: '聚类去重、要素预填、确认立项、批量/定向/分级派发', path: '/task/generate' },
      { no: '2.3', name: '任务进度管控', desc: '泳道与看板双视图，临期预警超期标红一键傅办', path: '/task/progress' },
      { no: '2.4', name: '任务结果管理', desc: '多源结果自动整合，AI 生成初步结论供复核推送', path: '/task/result' }
    ],
    ready: true,
    pageCount: 3,
    entry: '/task/generate',
    doc: '02_专项任务管理智能体_详细功能设计.md'
  },
  {
    key: 'agent03-punish',
    no: 3,
    name: '违规处置智能体',
    shortName: '违规处置',
    enName: 'Violation Disposal',
    tone: 'warning',
    icon: 'Stamp',
    positioning:
      '解决定性靠经验、金额核算繁、处置路径不清、追回进度不明的问题，辅助精准合规认定违规，分类规范办理协议处理、行政处罚与移送处理，确保处置追回整改到位方可销号。',
    tags: ['AI 辅助定性', '双人复核', '三条处置路径', '追回台账核销', '整改逐项复查', '闭环销号', '信用联动', '经验沉淀'],
    features: [
      { no: '3.1', name: '违规确认与复核', desc: 'AI 定性、金额核算、责任界定、双人复核、报告送达', path: '/punish/confirm' },
      { no: '3.2', name: '分类处置', desc: '协议处理、行政处罚、移送司法三条路径 + 依据推荐', path: '/punish/handle' },
      { no: '3.3', name: '基金追回', desc: '应追已追未追登记，到账凭证双人核销', path: '/recovery/fund' },
      { no: '3.5', name: '整改跟踪', desc: '整改清单逐项下达，机构反馈后复查验收', path: '/recovery/rectify' },
      { no: '3.6', name: '闭环销号', desc: '五项销号条件校验、分级审批、信用联动', path: '/closure/cancel' },
      { no: '3.4', name: '台账与经验沉淀', desc: '全流程归档、战果统计、标准案例库、复盘迭代', path: '/closure/ledger' }
    ],
    ready: true,
    pageCount: 6,
    entry: '/punish/confirm',
    doc: '03_违规处置智能体_详细功能设计.md'
  },
  {
    key: 'agent04-doc',
    no: 4,
    name: '文书生成智能体',
    shortName: '文书生成',
    enName: 'Document Generation',
    tone: 'purple',
    icon: 'Notebook',
    positioning:
      '解决文书格式不统一、信息重复录入、法条引用易错、线下签章跑腿、案卷装订繁琐的问题，实现制式文书一键规范生成、智能校对、在线签章送达与电子案卷自动归档。',
    tags: ['22 类制式模板', 'AI 五段撰写', '法条引用校对', '四级电子签章', '多渠道送达', '证据链可视化', '防篡改上链', '案卷自动组装'],
    features: [
      { no: '3.1', name: '文书模板库', desc: '六大类 22 种制式模板，固定/可变要素分离，维护审批与版本回滚', path: '/docgen/template' },
      { no: '3.2', name: '文书智能生成', desc: '五源数据自动填充、AI 五段撰写、文号自动编制、批量生成', path: '/docgen/generate' },
      { no: '3.3', name: '智能校对', desc: '法条引用比对法规库，要素完整性、一致性、文字规范四重校对', path: '/docgen/proofread' },
      { no: '3.4', name: '签章与送达', desc: '四级电子签章防篡改上链，多渠道送达回证，PDF/Word/OFD 导出', path: '/docsign/delivery' },
      { no: '3.5', name: '证据全链管理', desc: '八类法定证据归集固化，证据链关系图与完整性评分，防篡改导出', path: '/docsign/evidence' },
      { no: '3.6', name: '案卷归档', desc: '按档案规范自动组装目录编页，检索借阅审批，纸质扫码 OCR 入档', path: '/docarchive/casefile' }
    ],
    ready: true,
    pageCount: 6,
    entry: '/docgen/template',
    doc: '04_文书生成智能体_详细功能设计.md'
  },
  {
    key: 'agent05-promote',
    no: 5,
    name: '成果宣教智能体',
    shortName: '成果宣教',
    enName: 'Achievement & Education',
    tone: 'success',
    icon: 'TrendCharts',
    positioning:
      '解决“重处置、轻复盘”、战果说不清、模型能力停滞、合规引导缺位的问题，通过案件复盘评分、监管可视化大屏、模型自学习迭代与多端宣教推送，实现查处一案、警示一片。',
    tags: ['深空数据大屏', '五维质量评分', '因果鱼骨图', '五级数据钻取', '模型灰度回滚', '混淆矩阵/ROC', '三端精准推送', 'H5 素材预览'],
    features: [
      { no: '3.2.1', name: '监管可视化大屏', desc: '八大指标 + 地理热力气泊 + 智能体脉冲 + 实时动态，支持全屏', path: '/insight/dashboard' },
      { no: '3.1.1', name: '案件质量评分', desc: '五维等权 20 分花瓣评分盘，AI 初评 + 人工复核，<70 分自动转复盘', path: '/review/score' },
      { no: '3.1.2', name: '重点案件复盘', desc: '复盘五步法 + 因果鱼骨图归因 + 措施看板 + 经验教训墙', path: '/review/case' },
      { no: '3.1.3', name: '复盘报告管理', desc: '七章标准结构书本式阅读，分发阅读与反馈闭环', path: '/review/report' },
      { no: '3.2.2', name: '多维对比分析', desc: '八维度交叉分析，汇总→区域→机构→类型→单笔五级钻取', path: '/insight/analysis' },
      { no: '3.2.3', name: '成果效能评估', desc: '效率/人力/基量/震恾/覆盖五维雷达 + 目标达成环', path: '/insight/evaluation' },
      { no: '3.2.4', name: '一键分析报告', desc: '五步生成流水线动画，AI 撰写七章正文 + 6 图 3 表', path: '/insight/report' },
      { no: '3.3', name: '模型自学习迭代', desc: '样本桑基图回流 + AI 优化建议人工确认 + 灰度发布与回滚', path: '/model/iteration' },
      { no: '3.3.3', name: '准确率监控', desc: '混淆矩阵 + ROC/PR 曲线 + 置信度分档 + 阈值预警', path: '/model/monitor' },
      { no: '3.4', name: '宣教素材与推送', desc: 'AI 生成脱敏素材 + H5 手机预览 + 三端设备推送模拟 + 效果统计', path: '/education/promotion' }
    ],
    ready: true,
    pageCount: 10,
    entry: '/insight/dashboard',
    doc: '05_成果宣教智能体_详细功能设计.md'
  },
  {
    key: 'agent06-system',
    no: 6,
    name: '系统管理与支撑模块',
    shortName: '系统支撑',
    enName: 'System Support',
    tone: 'info',
    icon: 'SetUp',
    positioning:
      '为六大智能体提供统一底座支撑：规则零代码快速迭代、知识图谱全维关联、政策法规有据可依、多源数据高质量接入、按岗授权数据隔离、安全审计合规可信、时限督办与运行监控保障 7×24 稳定运行。',
    tags: ['零代码规则引擎', '规则灰度回滚', '知识图谱', '六库管理', '按岗最小授权', '信创适配', '运行监控'],
    features: [
      { no: '6.1', name: '动态规则引擎', desc: '可视化规则配置、参数审批变更、历史试跑验证、灰度发布与一键回滚', path: '/sysrule/engine' },
      { no: '6.2', name: '知识图谱管理', desc: '实体关系维护、可视化图谱浏览、路径分析与异常社区识别', path: '/sysrule/graph' },
      { no: '6.3', name: '政策法规案例库', desc: '法规/案例/文书三库维护，文书处置时 AI 智能引用一键插入', path: '/sysdata/legal' },
      { no: '6.4', name: '数据源与接口', desc: '多源数据接入、平台系统对接、通道健康度与延迟监控', path: '/sysdata/datasource' },
      { no: '6.5', name: '组织与权限', desc: '组织人员管理、RBAC 角色权限、关键操作双人复核配置', path: '/sysorg/permission' },
      { no: '6.6', name: '数据安全与审计', desc: '敏感脱敏加密、哈希链存证审计、信创全栈适配', path: '/sysorg/security' },
      { no: '6.7', name: '消息与时限督办', desc: '统一消息中心、全环节时限监控、超期自动升级督办', path: '/sysops/message' },
      { no: '6.8', name: '运行监控', desc: '六大智能体运行状态与 AI 服务监控、系统级运维健康度', path: '/sysops/monitor' }
    ],
    ready: true,
    pageCount: 8,
    entry: '/sysrule/engine',
    doc: '06_系统管理与支撑模块_详细功能设计.md'
  }
]

/** 平台级统计指标（门户展示用） */
export const PLATFORM_STATS = {
  agentTotal: 6,
  agentReady: 6,
  pageTotal: 48,
  featureGroupTotal: AGENT_CARDS.reduce((s, a) => s + a.features.length, 0),
  /** 业务量级指标，与 mock/shared/data 口径保持一致 */
  orgCovered: 60,
  clueTotal: 6842,
  clueClosed: 4128,
  closeRate: 60.3,
  suspectedAmount: 3860000,
  confirmedAmount: 1284000,
  recoveredAmount: 986400,
  modelAccuracy: 94.8,
  ruleTotal: 17,
  avgDurationHours: 68.4,
  slaOnTime: 92.6
}

/** 平台建设成效（门户价值区展示） */
export const PLATFORM_EFFECTS = [
  { name: '线索发现效率', before: '人工月度抽查', after: '7×24 实时预警', improve: '+320%', icon: 'Timer' },
  { name: '研判准确率', before: '经验判断 78%', after: 'AI 辅助 94.8%', improve: '+16.8pp', icon: 'Aim' },
  { name: '单案办理时长', before: '平均 15 天', after: '平均 68.4 小时', improve: '-81%', icon: 'Odometer' },
  { name: '基金挽回', before: '追回率 42%', after: '追回率 76.8%', improve: '+34.8pp', icon: 'Coin' }
]

/** 业务主链路（门户流程图展示） */
export const PLATFORM_FLOW = [
  { no: 1, name: '数据比对', agent: 1, desc: '多源融合自动发现疑点' },
  { no: 2, name: '智能预警', agent: 1, desc: '风险分级生成线索' },
  { no: 3, name: '线索研判', agent: 1, desc: 'AI 建议人工确认' },
  { no: 4, name: '筛查核实', agent: 1, desc: '线上自查线下取证' },
  { no: 5, name: '专项立项', agent: 2, desc: '聚类归并任务派发' },
  { no: 6, name: '违规处置', agent: 3, desc: '定性追回整改销号' },
  { no: 7, name: '文书归档', agent: 4, desc: '生成签章案卷归档' },
  { no: 8, name: '复盘宣教', agent: 5, desc: '复盘迭代成果宣教' }
]
