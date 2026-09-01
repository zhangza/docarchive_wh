import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay } from './utils'
import { AGENT_CARDS, PLATFORM_STATS, PLATFORM_EFFECTS, PLATFORM_FLOW } from './data/agents'
import { ALERT_OVERVIEW, LIFECYCLE_STATS } from './data/stats'

/**
 * 平台统一入口（门户）Mock 接口
 * 提供七大智能体导航卡片、平台级统计与业务主链路数据
 */
export default [
  {
    url: '/api/portal/agents',
    method: 'get',
    timeout: delay(200, 420),
    response: () => ok(AGENT_CARDS)
  },
  {
    url: '/api/portal/overview',
    method: 'get',
    timeout: delay(260, 520),
    response: () =>
      ok({
        stats: PLATFORM_STATS,
        effects: PLATFORM_EFFECTS,
        flow: PLATFORM_FLOW,
        /** 今日动态，与实时预警看板口径一致 */
        today: {
          newClue: ALERT_OVERVIEW.today.newClueCount,
          high: ALERT_OVERVIEW.today.high,
          handled: ALERT_OVERVIEW.today.handled,
          handleRate: ALERT_OVERVIEW.today.handleRate,
          amount: ALERT_OVERVIEW.today.totalSuspectedAmount
        },
        /** 近 6 月趋势，与全周期看板口径一致 */
        monthTrend: LIFECYCLE_STATS.monthTrend
      })
  }
] as MockMethod[]
