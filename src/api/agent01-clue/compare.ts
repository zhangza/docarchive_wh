import { get, post } from '../request'
import type { PageResult } from '@/types/business'

export const getCompareOverview = () => get<any>('/compare/overview')
export const getCompareTasks = (params?: any) => get<PageResult<any>>('/compare/tasks', params)
export const createCompareTask = (data: any) => post<any>('/compare/task/create', data)
export const getAnomalies = (params?: any) => get<PageResult<any>>('/compare/anomalies', params)
export const transferAnomalies = (data: any) => post<any>('/compare/anomalies/transfer', data)
export const getCommonDict = () => get<any>('/common/dict')
