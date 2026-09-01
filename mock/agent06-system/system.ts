import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import {
  RULE_STATS, RULES, RULE_PARAMS, RULE_TRIALS, RULE_RELEASES,
  GRAPH_STATS, GRAPH_ENTITIES, GRAPH_VIEW,
  LEGAL_STATS, LEGAL_DOCS, LEGAL_REFERENCE_RESULT,
  DS_LIST, DS_DETAIL, IF_LIST, DS_MONITOR,
  ORG_TREE, ORG_USERS, ROLE_LIST, REVIEW_CONFIGS,
  SECURITY_DESENSITIZE, AUDIT_STATS, AUDIT_LOGS, XINCHUANG,
  MSG_STATS, MESSAGES, SUPERVISION,
  AGENT_MONITOR, OPS_MONITOR
} from '../shared/data/system'

export default [
  /* ================= 3.1 动态规则引擎 ================= */
  {
    url: '/api/system/rule/stats',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(RULE_STATS)
  },
  {
    url: '/api/system/rule/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...RULES]
      list = filterBy(list, query, { eq: ['ruleType', 'violationType', 'status', 'riskLevel'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['ruleName', 'ruleId', 'ruleCode', 'description'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/rule/detail',
    method: 'get',
    timeout: delay(150, 350),
    response: ({ query }: any) => ok(RULES.find((r) => r.ruleId === query.ruleId) || null)
  },
  {
    url: '/api/system/rule/toggle',
    method: 'post',
    timeout: delay(300, 500),
    response: ({ body }: any) => ok({ success: true, message: `规则 ${body?.ruleId} 已${body?.enabled ? '启用' : '停用'}` })
  },
  {
    url: '/api/system/param/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...RULE_PARAMS]
      list = filterBy(list, query, { eq: ['paramType', 'ruleId'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['paramName', 'paramCode', 'ruleName'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/param/detail',
    method: 'get',
    timeout: delay(150, 350),
    response: ({ query }: any) => ok(RULE_PARAMS.find((p) => p.paramId === query.paramId) || null)
  },
  {
    url: '/api/system/param/change',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, requestId: 'PARAM-CHG-20260901' + String(Date.now()).slice(-4), message: `参数变更申请已提交，待 ${body?.approver || '业务负责人'} 审核` })
  },
  {
    url: '/api/system/param/approve',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => ok({ success: true, message: `参数变更已${body?.result === '驳回' ? '驳回' : '审核通过并生效'}` })
  },
  {
    url: '/api/system/trial/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => ok(paginate(filterBy([...RULE_TRIALS], query, { eq: ['status', 'trialType'] }), query.page, query.pageSize))
  },
  {
    url: '/api/system/trial/detail',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => ok(RULE_TRIALS.find((t) => t.trialId === query.trialId) || null)
  },
  {
    url: '/api/system/trial/run',
    method: 'post',
    timeout: delay(2500, 4000),
    response: ({ body }: any) => ok({ success: true, trialId: 'TRIAL202609010001', message: `试跑任务已提交（${body?.trialMode || '全量历史数据试跑'}），预计 15 分钟完成` })
  },
  {
    url: '/api/system/release/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => ok(paginate(filterBy([...RULE_RELEASES], query, { eq: ['status', 'releaseType'] }), query.page, query.pageSize))
  },
  {
    url: '/api/system/release/detail',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => ok(RULE_RELEASES.find((r) => r.releaseId === query.releaseId) || null)
  },
  {
    url: '/api/system/release/action',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => {
      const act = body?.action
      const msg = act === 'rollback' ? '已一键回滚至上一稳定版本，灰度版本已停用' : act === 'full' ? '已通过灰度评估，进入全量发布流程' : '操作已执行'
      return ok({ success: true, message: msg })
    }
  },

  /* ================= 3.2 知识图谱 ================= */
  {
    url: '/api/system/graph/stats',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(GRAPH_STATS)
  },
  {
    url: '/api/system/graph/entity/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...GRAPH_ENTITIES]
      list = filterBy(list, query, { eq: ['entityType', 'status', 'area'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['entityName', 'entityCode', 'entityId'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/graph/entity/detail',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      const e = GRAPH_ENTITIES.find((x) => x.entityId === query.entityId)
      if (!e) return ok(null)
      return ok({
        ...e,
        relations: [
          { relationId: 'REL-0001', relationType: '就诊', targetEntityName: '张**（参保人）', properties: '就诊15次 · 总额2.85万元', status: '有效' },
          { relationId: 'REL-0002', relationType: '处方', targetEntityName: '李医生（心内科）', properties: '处方156张 · 总额4.56万元', status: '有效' },
          { relationId: 'REL-0004', relationType: '关联', targetEntityName: 'CL202608150001', properties: '重复收费 · 5600元 · 已确认违规', status: '有效' },
          { relationId: 'REL-0005', relationType: '违规', targetEntityName: '重复收费', properties: '违规5次 · 累计2.8万元', status: '有效' }
        ],
        dataSource: '医保结算系统+机构准入系统+监管系统', lastSyncTime: '2026-08-29 02:00:00'
      })
    }
  },
  {
    url: '/api/system/graph/view',
    method: 'get',
    timeout: delay(400, 700),
    response: () => ok(GRAPH_VIEW)
  },

  /* ================= 3.3 政策法规案例库 ================= */
  {
    url: '/api/system/legal/stats',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(LEGAL_STATS)
  },
  {
    url: '/api/system/legal/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...LEGAL_DOCS]
      list = filterBy(list, query, { eq: ['library', 'status', 'level', 'category'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['title', 'docNo', 'summary'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/legal/detail',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => ok(LEGAL_DOCS.find((d) => d.docId === query.docId) || null)
  },
  {
    url: '/api/system/legal/reference',
    method: 'post',
    timeout: delay(2200, 3500),
    response: () => ok(LEGAL_REFERENCE_RESULT)
  },

  /* ================= 3.4 数据源与接口 ================= */
  {
    url: '/api/system/ds/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...DS_LIST]
      list = filterBy(list, query, { eq: ['datasourceType', 'status', 'connectionType'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['datasourceName', 'description'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/ds/detail',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      const ds = DS_LIST.find((d) => d.datasourceId === query.datasourceId)
      if (!ds) return ok(null)
      return ok({ ...ds, ...(DS_DETAIL[ds.datasourceId] || DS_DETAIL['DS-SETTLE-001']) })
    }
  },
  {
    url: '/api/system/ds/test',
    method: 'post',
    timeout: delay(1200, 2000),
    response: () => ok({ success: true, message: '连通性测试通过，数据格式校验正确' })
  },
  {
    url: '/api/system/if/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...IF_LIST]
      list = filterBy(list, query, { eq: ['direction', 'status', 'systemName'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['interfaceName', 'systemName'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/if/test',
    method: 'post',
    timeout: delay(1000, 1800),
    response: () => ok({ success: true, message: '接口连通正常，返回格式正确' })
  },
  {
    url: '/api/system/ds/monitor',
    method: 'get',
    timeout: delay(250, 450),
    response: () => ok(DS_MONITOR)
  },

  /* ================= 3.5 组织与权限 ================= */
  {
    url: '/api/system/org/tree',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(ORG_TREE)
  },
  {
    url: '/api/system/org/users',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...ORG_USERS]
      list = filterBy(list, query, { eq: ['status', 'orgName'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['userName', 'account', 'employeeNo', 'orgName'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/role/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...ROLE_LIST]
      list = filterBy(list, query, { eq: ['roleType', 'status'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['roleName', 'roleCode', 'description'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/role/detail',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => ok(ROLE_LIST.find((r) => r.roleId === query.roleId) || null)
  },
  {
    url: '/api/system/review-config/list',
    method: 'get',
    timeout: delay(200, 400),
    response: () => ok(REVIEW_CONFIGS)
  },
  {
    url: '/api/system/review-config/toggle',
    method: 'post',
    timeout: delay(300, 500),
    response: ({ body }: any) => ok({ success: true, message: `复核场景「${body?.sceneName || ''}」已${body?.enabled ? '启用' : '停用'}` })
  },

  /* ================= 3.6 数据安全与审计 ================= */
  {
    url: '/api/system/security/desensitize',
    method: 'get',
    timeout: delay(200, 400),
    response: () => ok(SECURITY_DESENSITIZE)
  },
  {
    url: '/api/system/audit/stats',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(AUDIT_STATS)
  },
  {
    url: '/api/system/audit/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...AUDIT_LOGS]
      list = filterBy(list, query, { eq: ['operationType', 'operationModule', 'riskLevel', 'operationResult'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['auditLogId', 'operationAction', 'operationObject.objectName', 'operator.userName'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/security/xinchuang',
    method: 'get',
    timeout: delay(200, 400),
    response: () => ok(XINCHUANG)
  },

  /* ================= 3.7 消息与时限督办 ================= */
  {
    url: '/api/system/message/stats',
    method: 'get',
    timeout: delay(150, 300),
    response: () => ok(MSG_STATS)
  },
  {
    url: '/api/system/message/list',
    method: 'get',
    timeout: delay(200, 400),
    response: ({ query }: any) => {
      let list = [...MESSAGES]
      list = filterBy(list, query, { eq: ['messageType', 'status', 'priority'] })
      if (query.keyword) list = keywordSearch(list, query.keyword, ['title', 'content'])
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/system/message/read',
    method: 'post',
    timeout: delay(200, 400),
    response: () => ok({ success: true, message: '已标记为已读' })
  },
  {
    url: '/api/system/supervision/overview',
    method: 'get',
    timeout: delay(250, 450),
    response: () => ok(SUPERVISION)
  },
  {
    url: '/api/system/supervision/urge',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => ok({ success: true, message: `督办单已发送至 ${body?.assignee || '承办人'}，并同步通知上级` })
  },

  /* ================= 3.8 运行监控 ================= */
  {
    url: '/api/system/monitor/agents',
    method: 'get',
    timeout: delay(250, 450),
    response: () => ok(AGENT_MONITOR)
  },
  {
    url: '/api/system/monitor/ops',
    method: 'get',
    timeout: delay(250, 450),
    response: () => ok(OPS_MONITOR)
  },

  /* ================= 配置维护类（保存 / 启停 / 订阅） ================= */
  {
    url: '/api/system/rule/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, ruleId: body?.ruleId || 'RULE-NEW-' + String(Date.now()).slice(-4), message: body?.ruleId ? '规则已更新并生成新版本' : '规则已创建，经审批后生效' })
  },
  {
    url: '/api/system/graph/entity/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, entityId: body?.entityId || 'ENT-NEW-' + String(Date.now()).slice(-4), message: body?.entityId ? '实体已更新' : '实体已创建并同步至图谱' })
  },
  {
    url: '/api/system/graph/relation/add',
    method: 'post',
    timeout: delay(300, 600),
    response: () => ok({ success: true, relationId: 'REL-' + String(Date.now()).slice(-4), message: '关系已建立' })
  },
  {
    url: '/api/system/legal/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, docId: body?.docId || 'DOC-NEW-' + String(Date.now()).slice(-4), message: body?.docId ? '内容已更新，待法制科审核后发布' : '内容已提交法制科审核' })
  },
  {
    url: '/api/system/legal/status',
    method: 'post',
    timeout: delay(300, 500),
    response: ({ body }: any) => ok({ success: true, message: body?.status === '已失效' ? '已标记失效，不再被智能引用推荐' : '已恢复有效' })
  },
  {
    url: '/api/system/ds/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, datasourceId: body?.datasourceId || 'DS-NEW-' + String(Date.now()).slice(-3), message: body?.datasourceId ? '数据源配置已更新' : '数据源已创建，待连通性测试通过后启用' })
  },
  {
    url: '/api/system/if/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, interfaceId: body?.interfaceId || 'IF-NEW-' + String(Date.now()).slice(-3), message: body?.interfaceId ? '接口配置已更新并生成新版本' : '接口已创建' })
  },
  {
    url: '/api/system/alert-rule/toggle',
    method: 'post',
    timeout: delay(200, 400),
    response: ({ body }: any) => ok({ success: true, message: `告警规则「${body?.name || body?.ruleId}」已${body?.enabled ? '启用' : '停用'}` })
  },
  {
    url: '/api/system/org/user/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, userId: body?.userId || 'USER-' + String(Date.now()).slice(-4), message: body?.userId ? '人员信息已更新（权限变更需 RC-004 双人复核）' : '账号已创建并发送初始密码短信' })
  },
  {
    url: '/api/system/role/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, roleId: body?.roleId || 'ROLE-' + String(Date.now()).slice(-3), message: body?.roleId ? '角色权限已更新，变更已留痕' : '角色已创建' })
  },
  {
    url: '/api/system/review-config/save',
    method: 'post',
    timeout: delay(400, 700),
    response: () => ok({ success: true, message: '复核配置已更新并生成新版本' })
  },
  {
    url: '/api/system/security/rule/save',
    method: 'post',
    timeout: delay(400, 700),
    response: ({ body }: any) => ok({ success: true, fieldId: body?.fieldId || 'DF-' + String(Date.now()).slice(-3), message: body?.fieldId ? '脱敏规则已更新' : '脱敏规则已创建并生效' })
  },
  {
    url: '/api/system/supervision/rule/toggle',
    method: 'post',
    timeout: delay(200, 400),
    response: ({ body }: any) => ok({ success: true, message: `督办规则「${body?.name || ''}」已${body?.enabled ? '启用' : '停用'}` })
  },
  {
    url: '/api/system/supervision/rule/save',
    method: 'post',
    timeout: delay(300, 600),
    response: () => ok({ success: true, message: '督办规则已更新' })
  },
  {
    url: '/api/system/message/subscribe',
    method: 'post',
    timeout: delay(300, 500),
    response: () => ok({ success: true, message: '消息订阅设置已保存' })
  }
] as MockMethod[]
