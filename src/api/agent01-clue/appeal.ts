import { get, post } from '../request'
import type { PageResult } from '@/types/business'

export const getAppealStats = () => get<any>('/appeal/stats')
export const getAppealList = (params?: any) => get<PageResult<any>>('/appeal/list', params)
export const getAppealDetail = (appealId: any) =>
  get<any>('/appeal/detail', appealId && typeof appealId === 'object' ? appealId : { appealId })
export const submitAppeal = (data: any) => post<any>('/appeal/submit', data)
export const aiReviewAppeal = (data: any) => post<any>('/appeal/ai-review', data)
export const acceptAppeal = (data: any) => post<any>('/appeal/accept', data)
export const reviewAppeal = (data: any) => post<any>('/appeal/review', data)

export const getMyAppeals = (params?: any) => get<PageResult<any>>('/org/appeal/mine', params)
export const getAppealableClues = (params?: any) => get<PageResult<any>>('/org/appeal/appealable', params)
