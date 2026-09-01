import { get, post } from '../request'

const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

/* ===== 3.1 动态规则引擎 ===== */
export const getRuleStats = () => get<any>('/system/rule/stats')
export const getRuleList = (params?: any) => get<any>('/system/rule/list', params)
export const getRuleDetail = (ruleId: any) => get<any>('/system/rule/detail', p(ruleId, 'ruleId'))
export const toggleRule = (data: any) => post<any>('/system/rule/toggle', data)
export const getParamList = (params?: any) => get<any>('/system/param/list', params)
export const getParamDetail = (paramId: any) => get<any>('/system/param/detail', p(paramId, 'paramId'))
export const submitParamChange = (data: any) => post<any>('/system/param/change', data)
export const approveParamChange = (data: any) => post<any>('/system/param/approve', data)
export const getTrialList = (params?: any) => get<any>('/system/trial/list', params)
export const getTrialDetail = (trialId: any) => get<any>('/system/trial/detail', p(trialId, 'trialId'))
export const runTrial = (data: any) => post<any>('/system/trial/run', data)
export const getReleaseList = (params?: any) => get<any>('/system/release/list', params)
export const getReleaseDetail = (releaseId: any) => get<any>('/system/release/detail', p(releaseId, 'releaseId'))
export const releaseAction = (data: any) => post<any>('/system/release/action', data)

/* ===== 3.2 知识图谱 ===== */
export const getGraphStats = () => get<any>('/system/graph/stats')
export const getEntityList = (params?: any) => get<any>('/system/graph/entity/list', params)
export const getEntityDetail = (entityId: any) => get<any>('/system/graph/entity/detail', p(entityId, 'entityId'))
export const getGraphView = () => get<any>('/system/graph/view')

/* ===== 3.3 政策法规案例库 ===== */
export const getLegalStats = () => get<any>('/system/legal/stats')
export const getLegalList = (params?: any) => get<any>('/system/legal/list', params)
export const getLegalDetail = (docId: any) => get<any>('/system/legal/detail', p(docId, 'docId'))
export const requestLegalReference = (data: any) => post<any>('/system/legal/reference', data)

/* ===== 3.4 数据源与接口 ===== */
export const getDsList = (params?: any) => get<any>('/system/ds/list', params)
export const getDsDetail = (datasourceId: any) => get<any>('/system/ds/detail', p(datasourceId, 'datasourceId'))
export const testDatasource = (data: any) => post<any>('/system/ds/test', data)
export const getIfList = (params?: any) => get<any>('/system/if/list', params)
export const testInterface = (data: any) => post<any>('/system/if/test', data)
export const getDsMonitor = () => get<any>('/system/ds/monitor')

/* ===== 3.5 组织与权限 ===== */
export const getOrgTree = () => get<any[]>('/system/org/tree')
export const getOrgUsers = (params?: any) => get<any>('/system/org/users', params)
export const getRoleList = (params?: any) => get<any>('/system/role/list', params)
export const getRoleDetail = (roleId: any) => get<any>('/system/role/detail', p(roleId, 'roleId'))
export const getReviewConfigs = () => get<any[]>('/system/review-config/list')
export const toggleReviewConfig = (data: any) => post<any>('/system/review-config/toggle', data)

/* ===== 3.6 数据安全与审计 ===== */
export const getDesensitize = () => get<any>('/system/security/desensitize')
export const getAuditStats = () => get<any>('/system/audit/stats')
export const getAuditList = (params?: any) => get<any>('/system/audit/list', params)
export const getXinchuang = () => get<any>('/system/security/xinchuang')

/* ===== 3.7 消息与时限督办 ===== */
export const getMessageStats = () => get<any>('/system/message/stats')
export const getMessageList = (params?: any) => get<any>('/system/message/list', params)
export const markMessageRead = (data: any) => post<any>('/system/message/read', data)
export const getSupervision = () => get<any>('/system/supervision/overview')
export const urgeSupervisionItem = (data: any) => post<any>('/system/supervision/urge', data)

/* ===== 3.8 运行监控 ===== */
export const getAgentMonitor = () => get<any>('/system/monitor/agents')
export const getOpsMonitor = () => get<any>('/system/monitor/ops')

/* ===== 配置维护（保存 / 启停 / 订阅） ===== */
export const saveRule = (data: any) => post<any>('/system/rule/save', data)
export const saveEntity = (data: any) => post<any>('/system/graph/entity/save', data)
export const addRelation = (data: any) => post<any>('/system/graph/relation/add', data)
export const saveLegalDoc = (data: any) => post<any>('/system/legal/save', data)
export const setLegalDocStatus = (data: any) => post<any>('/system/legal/status', data)
export const saveDatasource = (data: any) => post<any>('/system/ds/save', data)
export const saveInterface = (data: any) => post<any>('/system/if/save', data)
export const toggleAlertRule = (data: any) => post<any>('/system/alert-rule/toggle', data)
export const saveOrgUser = (data: any) => post<any>('/system/org/user/save', data)
export const saveRole = (data: any) => post<any>('/system/role/save', data)
export const saveReviewConfig = (data: any) => post<any>('/system/review-config/save', data)
export const saveSecurityRule = (data: any) => post<any>('/system/security/rule/save', data)
export const toggleSupervisionRule = (data: any) => post<any>('/system/supervision/rule/toggle', data)
export const saveSupervisionRule = (data: any) => post<any>('/system/supervision/rule/save', data)
export const saveMessageSubscribe = (data: any) => post<any>('/system/message/subscribe', data)
