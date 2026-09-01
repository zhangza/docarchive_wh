import { get, post } from '../request'
import type { PageResult } from '@/types/business'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

export const getLifecycleStats = () => get<any>('/lifecycle/stats')
export const getLifecycleList = (params?: any) => get<PageResult<any>>('/lifecycle/list', params)
export const getLifecycleDetail = (clueId: any) => get<any>('/lifecycle/detail', p(clueId, 'clueId'))
export const urgeLifecycle = (data: any) => post<any>('/lifecycle/urge', data)
export const sendFeedbackResult = (data: any) => post<any>('/lifecycle/feedback-send', data)

export const getFeedbackStats = () => get<any>('/feedback/stats')
export const getFeedbackList = (params?: any) => get<PageResult<any>>('/feedback/list', params)
export const getFeedbackDetail = (feedbackId: any) =>
  get<any>('/feedback/detail', p(feedbackId, 'feedbackId'))
export const submitFeedback = (data: any) => post<any>('/feedback/submit', data)
export const handleFeedback = (data: any) => post<any>('/feedback/handle', data)
export const getFeedbackRules = (params?: any) => get<PageResult<any>>('/feedback/rules', params)
export const optimizeRule = (data: any) => post<any>('/feedback/optimize', data)
