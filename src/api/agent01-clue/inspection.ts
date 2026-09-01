import { get, post } from '../request'
import type { PageResult } from '@/types/business'

export const getInspectionStats = () => get<any>('/inspection/stats')
export const getInspectionTasks = (params?: any) => get<PageResult<any>>('/inspection/tasks', params)
export const getInspectionDetail = (taskId: any) =>
  get<any>('/inspection/detail', taskId && typeof taskId === 'object' ? taskId : { taskId })
export const createInspection = (data: any) => post<any>('/inspection/create', data)
export const runOcr = (data: any) => post<any>('/inspection/ocr', data)
export const uploadEvidence = (data: any) => post<any>('/inspection/evidence', data)
export const saveInterview = (data: any) => post<any>('/inspection/interview', data)
export const submitConclusion = (data: any) => post<any>('/inspection/conclusion', data)
