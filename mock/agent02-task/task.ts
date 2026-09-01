import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay } from '../shared/utils'
import { TASK_DRAFTS, TASKS, TASK_STATS, TASK_TYPE_CONFIGS, DISPATCH_RECORDS, TASK_RESULTS } from '../shared/data/tasks'
import { rndInt, pad, dt } from '../shared/data/base'

export default [
  /* ===== 聚类分组列表（任务智能生成入口） ===== */
  {
    url: '/api/task/cluster-groups',
    method: 'get',
    timeout: delay(200, 450),
    response: () => ok(TASK_DRAFTS)
  },

  /* ===== 任务草稿详情 ===== */
  {
    url: '/api/task/draft',
    method: 'get',
    timeout: delay(150, 350),
    response: ({ query }: any) => {
      const draft = TASK_DRAFTS.find((d) => d.draftId === query.draftId)
      return ok(draft || null)
    }
  },

  /* ===== 确认立项（草稿→任务） ===== */
  {
    url: '/api/task/confirm',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => {
      const draftId = body?.draftId || ''
      return ok({ success: true, taskId: `TASK202608${pad(rndInt(1, 999), 3)}`, draftId })
    }
  },

  /* ===== 任务列表 ===== */
  {
    url: '/api/task/list',
    method: 'get',
    timeout: delay(150, 350),
    response: ({ query }: any) => {
      const { status, riskLevel, taskType, district, keyword, page = 1, pageSize = 15 } = query
      let list = [...TASKS]
      if (status) list = list.filter((t) => t.status === status)
      if (riskLevel) list = list.filter((t) => t.riskLevel === riskLevel)
      if (taskType) list = list.filter((t) => t.taskType === taskType)
      if (district) list = list.filter((t) => t.district === district)
      if (keyword) list = list.filter((t) => t.taskName.includes(keyword) || t.taskId.includes(keyword) || t.inspectOrg.includes(keyword))
      const p = Number(page) || 1
      const ps = Number(pageSize) || 15
      return ok({
        list: list.slice((p - 1) * ps, p * ps),
        total: list.length,
        page: p,
        pageSize: ps
      })
    }
  },

  /* ===== 任务统计 ===== */
  {
    url: '/api/task/stats',
    method: 'get',
    timeout: delay(200, 400),
    response: () => ok(TASK_STATS)
  },

  /* ===== 任务类型配置 ===== */
  {
    url: '/api/task/types',
    method: 'get',
    timeout: delay(100, 200),
    response: () => ok(TASK_TYPE_CONFIGS)
  },

  /* ===== 派发任务 ===== */
  {
    url: '/api/task/dispatch',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => {
      return ok({ success: true, dispatchId: `DIS20260830${pad(rndInt(1, 99), 2)}`, taskIds: body?.taskIds || [], dispatchType: body?.dispatchType || '批量派发' })
    }
  },

  /* ===== 派发记录 ===== */
  {
    url: '/api/task/dispatch-records',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(DISPATCH_RECORDS)
  },

  /* ===== 催办 ===== */
  {
    url: '/api/task/urge',
    method: 'post',
    timeout: delay(200, 400),
    response: ({ body }: any) => {
      return ok({ success: true, urged: body?.taskIds || [], message: '催办通知已发送' })
    }
  },

  /* ===== 任务结果列表 ===== */
  {
    url: '/api/task/results',
    method: 'get',
    timeout: delay(150, 350),
    response: () => ok(TASK_RESULTS)
  },

  /* ===== 任务结果详情 ===== */
  {
    url: '/api/task/result',
    method: 'get',
    timeout: delay(150, 300),
    response: ({ query }: any) => {
      const result = TASK_RESULTS.find((r) => r.resultId === query.resultId || r.taskId === query.taskId)
      return ok(result || null)
    }
  },

  /* ===== 复核任务结果 ===== */
  {
    url: '/api/task/review-result',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => {
      return ok({ success: true, resultId: body?.resultId, status: '已复核', reviewer: '王组长', reviewTime: dt(0, 16, 0) })
    }
  },

  /* ===== 推送结果 ===== */
  {
    url: '/api/task/push-result',
    method: 'post',
    timeout: delay(200, 400),
    response: ({ body }: any) => {
      return ok({ success: true, resultId: body?.resultId, pushTime: dt(0, 17, 0), message: '检查结果已推送至被检机构并流转至违规处置智能体' })
    }
  }
] as MockMethod[]