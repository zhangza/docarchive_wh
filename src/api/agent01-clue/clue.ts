import { get, post } from '../request'
import type { PageResult, ClueItem } from '@/types/business'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

export const getAlertOverview = () => get<any>('/alert/overview')
export const getAlertStream = (limit: any = 20) =>
  get<any[]>('/alert/stream', p(limit, 'limit'))

export const getClueList = (params?: any) => get<PageResult<ClueItem>>('/clue/list', params)
export const getClueStat = (params?: any) => get<any>('/clue/stat', params)
export const getClueDetail = (clueId: any) => get<any>('/clue/detail', p(clueId, 'clueId'))

export const getWorkbenchStats = () => get<any>('/clue/workbench/stats')
export const getWorkbenchQueue = (params?: any) => get<PageResult<ClueItem>>('/clue/workbench/queue', params)

export const getAiJudgment = (clueId: any) => get<any>('/clue/ai-judgment', p(clueId, 'clueId'))
export const submitJudge = (data: any) => post<any>('/clue/judge', data)
export const batchJudge = (data: any) => post<any>('/clue/batch-judge', data)
export const assignClue = (data: any) => post<any>('/clue/assign', data)

export const getClueGraph = (clueId: any) => get<any>('/clue/graph', p(clueId, 'clueId'))
export const getExperts = () => get<any[]>('/clue/experts')
export const submitConsult = (data: any) => post<any>('/clue/consult', data)
