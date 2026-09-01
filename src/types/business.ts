/** 风险等级 */
export type RiskLevel = '高' | '中' | '低'

/** 线索状态 */
export type ClueStatus =
  | '待研判'
  | '研判中'
  | '已驳回'
  | '线上筛查中'
  | '线下核查中'
  | '申诉中'
  | '已流转'
  | '已结案'

/** 违规一级分类 */
export type ViolationCategory = '收费类' | '用药类' | '诊疗类' | '就医行为类' | '其他'

/** 比对类型 */
export type CompareType =
  | '药品进销存比对'
  | '病历结算比对'
  | '处方结算比对'
  | '检查检验比对'
  | '就医行为比对'

/** 统一响应体 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页体 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 机构 */
export interface OrgInfo {
  orgCode: string
  orgName: string
  orgType: '三级医院' | '二级医院' | '一级医院' | '社区卫生服务中心' | '零售药店' | '基层诊所'
  level: string
  district: string
  creditScore: number
  clueCount: number
}

/** 医生 */
export interface DoctorInfo {
  doctorId: string
  name: string
  title: string
  dept: string
  orgCode: string
  orgName: string
  multiOrg: string[]
  clueCount: number
}

/** 参保人 */
export interface PatientInfo {
  patientId: string
  name: string
  gender: '男' | '女'
  age: number
  insuranceType: '职工医保' | '居民医保' | '离退休职工' | '特殊病种'
  district: string
  chronicDisease: string[]
  clueCount: number
}

/** 药品/项目 */
export interface ItemInfo {
  itemCode: string
  itemName: string
  itemType: '药品' | '诊疗项目' | '检查检验' | '耗材'
  spec: string
  unitPrice: number
  category: string
  limitDays: number
  relatedClueCount: number
}

/** 疑点线索 */
export interface ClueItem {
  clueId: string
  clueSource: string
  compareType: CompareType
  violationCategory: ViolationCategory
  violationType: string
  riskLevel: RiskLevel
  riskScore: number
  confidence: number
  suspectedAmount: number
  patientId: string
  patientName: string
  orgCode: string
  orgName: string
  orgType: string
  deptName: string
  doctorName: string
  itemName: string
  detectTime: string
  status: ClueStatus
  assignee: string | null
  pendingHours: number
  overdue: boolean
  description: string
  ruleHit: string
  district: string
}

/** 比对疑点 */
export interface AnomalyItem {
  anomalyId: string
  compareTaskId: string
  compareType: CompareType
  orgCode: string
  orgName: string
  itemCode: string
  itemName: string
  anomalyType: string
  anomalyDesc: string
  diffQty: number
  diffAmount: number
  diffRatio: number
  riskLevel: RiskLevel
  compareTime: string
  transferred: boolean
  clueId: string | null
}
