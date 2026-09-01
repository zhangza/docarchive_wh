import { get } from '../request'

/** 获取七大智能体导航卡片 */
export const getPortalAgents = () => get<any[]>('/portal/agents')

/** 获取平台总览（统计、成效、主链路、今日动态、趋势） */
export const getPortalOverview = () => get<any>('/portal/overview')
