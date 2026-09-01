import { get, post } from '../request'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

/* ===== M16 任务智能生成与派发 ===== */

/** 聚类分组列表 */
export const getClusterGroups = () => get<any[]>('/task/cluster-groups')

/** 任务草稿详情 */
export const getTaskDraft = (draftId: any) => get<any>('/task/draft', p(draftId, 'draftId'))

/** 确认立项 */
export const confirmTask = (data: any) => post<any>('/task/confirm', data)

/** 任务类型配置 */
export const getTaskTypes = () => get<any[]>('/task/types')

/** 派发任务 */
export const dispatchTask = (data: any) => post<any>('/task/dispatch', data)

/** 派发记录 */
export const getDispatchRecords = () => get<any[]>('/task/dispatch-records')

/* ===== M17 任务进度管控 ===== */

/** 任务列表 */
export const getTaskList = (params?: any) => get<any>('/task/list', params)

/** 任务统计 */
export const getTaskStats = () => get<any>('/task/stats')

/** 催办 */
export const urgeTask = (data: any) => post<any>('/task/urge', data)

/* ===== M18 任务结果管理 ===== */

/** 任务结果列表 */
export const getTaskResults = () => get<any[]>('/task/results')

/** 任务结果详情 */
export const getTaskResult = (resultId: any) => get<any>('/task/result', p(resultId, 'resultId'))

/** 复核结果 */
export const reviewTaskResult = (data: any) => post<any>('/task/review-result', data)

/** 推送结果 */
export const pushTaskResult = (data: any) => post<any>('/task/push-result', data)