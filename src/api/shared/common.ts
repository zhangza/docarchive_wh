import { get, post } from '../request'

export const getUserInfo = () => get<any>('/user/info')
export const getOrgs = (params?: any) => get<any>('/common/orgs', params)
export const getDoctors = (params?: any) => get<any>('/common/doctors', params)
export const getPatients = (params?: any) => get<any>('/common/patients', params)
export const getItems = (params?: any) => get<any>('/common/items', params)
export const getRules = () => get<any[]>('/common/rules')
export const getAuditors = () => get<any>('/common/auditors')
export const getExpertList = () => get<any[]>('/common/experts')
export const getDicts = () => get<any>('/common/dicts')
export const exportData = (data: any) => post<any>('/common/export', data)
export const getNotices = () => get<any[]>('/common/notices')
