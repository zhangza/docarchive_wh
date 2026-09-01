import { get, post } from '../request'
import type { PageResult } from '@/types/business'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

export const getScreeningStats = () => get<any>('/screening/stats')
export const getScreeningTasks = (params?: any) => get<PageResult<any>>('/screening/tasks', params)
export const getScreeningDetail = (taskId: any) => get<any>('/screening/detail', p(taskId, 'taskId'))
export const issueScreening = (data: any) => post<any>('/screening/issue', data)
export const submitScreening = (data: any) => post<any>('/screening/submit', data)
export const aiScreen = (data: any) => post<any>('/screening/ai-screen', data)
export const reviewScreening = (data: any) => post<any>('/screening/review', data)
export const urgeScreening = (data: any) => post<any>('/screening/urge', data)

export const getMySelfCheck = (params?: any) => get<PageResult<any>>('/org/self-check/mine', params)
export const getSelfCheckSummary = (orgCode?: any) =>
  get<any>('/org/self-check/summary', p(orgCode, 'orgCode'))
