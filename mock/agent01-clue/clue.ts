import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import { ALERT_OVERVIEW, ALERT_STREAM, WORKBENCH_STATS } from '../shared/data/stats'
import { CLUES, CLUE_MAP, MY_NAME } from '../shared/data/clues'
import { AI_JUDGMENT, DIFF_DETAIL, GRAPH_DATA } from '../shared/data/detail'
import { EXPERTS, PATIENTS, DOCTORS, ORGS, rndInt, pad } from '../shared/data/base'

function sortClues(list: any[], sortBy?: string) {
  const arr = [...list]
  switch (sortBy) {
    case 'amountDesc':
      return arr.sort((a, b) => b.suspectedAmount - a.suspectedAmount)
    case 'riskDesc':
      return arr.sort((a, b) => b.riskScore - a.riskScore)
    case 'pendingDesc':
      return arr.sort((a, b) => b.pendingHours - a.pendingHours)
    default:
      return arr.sort((a, b) => (a.detectTime < b.detectTime ? 1 : -1))
  }
}

function queryClues(query: any) {
  let list = filterBy(CLUES, query, {
    eq: ['riskLevel', 'status', 'compareType', 'violationCategory', 'violationType', 'district', 'orgType', 'assignee', 'visitType'],
    like: ['orgName', 'patientName', 'doctorName', 'itemName', 'clueId', 'ruleHit'],
    range: [
      { key: 'suspectedAmount', min: 'amountMin', max: 'amountMax' },
      { key: 'confidence', min: 'confidenceMin', max: 'confidenceMax' }
    ],
    dateRange: [{ key: 'detectTime', start: 'startTime', end: 'endTime' }]
  })
  if (query.overdue === 'true') list = list.filter((x) => x.overdue)
  if (query.mine === 'true') list = list.filter((x) => x.assignee === MY_NAME)
  if (query.riskLevels) {
    const arr = String(query.riskLevels).split(',').filter(Boolean)
    if (arr.length) list = list.filter((x) => arr.includes(x.riskLevel))
  }
  if (query.statusList) {
    const arr = String(query.statusList).split(',').filter(Boolean)
    if (arr.length) list = list.filter((x) => arr.includes(x.status))
  }
  list = keywordSearch(list, query.keyword, ['clueId', 'orgName', 'patientName', 'doctorName', 'itemName', 'description', 'violationType'])
  return sortClues(list, query.sortBy)
}

export default [
  /* ===== M03 实时预警 ===== */
  { url: '/api/alert/overview', method: 'get', timeout: delay(), response: () => ok(ALERT_OVERVIEW) },
  {
    url: '/api/alert/stream',
    method: 'get',
    timeout: delay(200, 450),
    response: ({ query }: any) => ok(ALERT_STREAM.slice(0, Number(query.limit) || 20))
  },

  /* ===== M04 线索库 ===== */
  {
    url: '/api/clue/list',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => ok(paginate(queryClues(query), query.page, query.pageSize))
  },
  {
    url: '/api/clue/stat',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      const list = queryClues(query)
      const sum = (f: (x: any) => boolean) => list.filter(f).length
      return ok({
        total: list.length,
        high: sum((x) => x.riskLevel === '高'),
        mid: sum((x) => x.riskLevel === '中'),
        low: sum((x) => x.riskLevel === '低'),
        overdue: sum((x) => x.overdue),
        pending: sum((x) => x.status === '待研判'),
        closed: sum((x) => x.status === '已结案' || x.status === '已驳回'),
        totalAmount: Math.round(list.reduce((s, x) => s + x.suspectedAmount, 0) * 100) / 100,
        avgConfidence: list.length ? Math.round((list.reduce((s, x) => s + x.confidence, 0) / list.length) * 10) / 10 : 0
      })
    }
  },
  {
    url: '/api/clue/detail',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      const clue = CLUE_MAP.get(query.clueId) ?? CLUES[0]
      const patient = PATIENTS.find((p) => p.patientId === clue.patientId)
      const doctor = DOCTORS.find((d) => d.name === clue.doctorName)
      const org = ORGS.find((o) => o.orgCode === clue.orgCode)
      return ok({
        clue,
        patient: patient ?? {
          patientId: clue.patientId,
          name: clue.patientName,
          gender: clue.patientGender,
          age: clue.patientAge,
          insuranceType: clue.insuranceType,
          district: clue.district,
          chronicDisease: clue.clueId === 'CL20260829000001' ? ['2型糖尿病', '高脂血症'] : clue.clueId === 'CL20260829000002' ? ['肺癌晚期（骨转移）'] : [],
          clueCount: rndInt(1, 5)
        },
        doctor: doctor ?? { doctorId: 'D0001', name: clue.doctorName, title: clue.doctorTitle, dept: clue.deptName, orgName: clue.orgName, multiOrg: [clue.orgName], clueCount: rndInt(1, 8), practiceYears: rndInt(8, 30) },
        org: org ?? { orgCode: clue.orgCode, orgName: clue.orgName, orgType: clue.orgType, level: '三级甲等', district: clue.district, creditScore: 78, clueCount: 186, contact: '张主任', phone: '0553-3812366' },
        settleDetail: [
          { itemName: clue.itemName, qty: rndInt(1, 8), unitPrice: 45, amount: clue.suspectedAmount, fundPay: Math.round(clue.suspectedAmount * 0.75 * 100) / 100, flag: true },
          { itemName: '空腹血糖', qty: 1, unitPrice: 8, amount: 8, fundPay: 6, flag: false },
          { itemName: '诊查费（主任医师）', qty: 1, unitPrice: 15, amount: 15, fundPay: 11.25, flag: false },
          { itemName: '糖化血红蛋白检测', qty: 1, unitPrice: 62, amount: 62, fundPay: 46.5, flag: clue.clueId === 'CL20260829000001' }
        ],
        diff: DIFF_DETAIL[clue.clueId] ?? null
      })
    }
  },

  /* ===== M05 研判工作台 ===== */
  { url: '/api/clue/workbench/stats', method: 'get', timeout: delay(), response: () => ok(WORKBENCH_STATS) },
  {
    url: '/api/clue/workbench/queue',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = CLUES.filter((c) => ['待研判', '研判中'].includes(c.status))
      if (query.mine === 'true') list = list.filter((c) => c.assignee === MY_NAME || c.assignee === null)
      if (query.riskLevel) list = list.filter((c) => c.riskLevel === query.riskLevel)
      if (query.overdue === 'true') list = list.filter((c) => c.overdue)
      list = keywordSearch(list, query.keyword, ['clueId', 'orgName', 'patientName', 'violationType'])
      const order = { 高: 0, 中: 1, 低: 2 } as Record<string, number>
      list = [...list].sort((a, b) => (a.overdue === b.overdue ? order[a.riskLevel] - order[b.riskLevel] || b.riskScore - a.riskScore : a.overdue ? -1 : 1))
      return ok(paginate(list, query.page, query.pageSize ?? 50))
    }
  },

  /* ===== AI 研判 ===== */
  {
    url: '/api/clue/ai-judgment',
    method: 'get',
    timeout: delay(900, 1600),
    response: ({ query }: any) => {
      const id = query.clueId
      if (AI_JUDGMENT[id]) return ok(AI_JUDGMENT[id])
      const clue = CLUE_MAP.get(id) ?? CLUES[0]
      const suggest = clue.confidence >= 85 ? '建议确认为违规' : clue.confidence >= 70 ? '建议转线上筛查核实' : '建议补充数据后再研判'
      return ok({
        clueId: clue.clueId,
        suggestion: `${suggest}（${clue.violationType}）`,
        suggestLevel: clue.riskLevel,
        confidence: clue.confidence,
        modelVersion: 'v2.3.2',
        analyzeTime: clue.detectTime,
        costMs: rndInt(680, 2200),
        reasons: [
          { title: '规则命中', desc: `命中「${clue.ruleHit}」（${clue.ruleId}），阈值突破明显。`, weight: 36 },
          { title: '金额显著性', desc: `疑似违规金额 ${clue.suspectedAmount.toFixed(2)} 元，位于同类线索 P${rndInt(60, 98)} 分位。`, weight: 26 },
          { title: '机构历史表现', desc: `${clue.orgName}近 30 日同类线索 ${rndInt(2, 14)} 条，确认率 ${rndInt(48, 92)}%。`, weight: 20 },
          { title: '数据完整性', desc: `处方/病历/结算三方数据齐全度 ${rndInt(78, 99)}%，可支撑认定。`, weight: 12 },
          { title: '参保人行为画像', desc: `该参保人近 90 日就诊 ${rndInt(4, 26)} 次，异常度 ${rndInt(20, 88)}。`, weight: 6 }
        ],
        similarCases: [
          { caseId: `CASE2025${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 99), 3)}`, title: `${clue.orgType}${clue.violationType}典型案例`, result: '确认违规', amount: Math.round(clue.suspectedAmount * 1.4), sim: rndInt(82, 96) },
          { caseId: `CASE2025${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 99), 3)}`, title: `${clue.violationType}争议复核案例`, result: '部分合理', amount: Math.round(clue.suspectedAmount * 0.6), sim: rndInt(74, 88) }
        ],
        policyRefs: [
          { code: '医保发〔2020〕45号', title: '医疗保障基金使用监督管理条例配套细则', clause: '第二十条：造成基金损失的应予追回并按规定处理。' },
          { code: '皖医保发〔2024〕18号', title: '安徽省医保基金监管实施细则', clause: `关于${clue.violationCategory}违规行为的认定与处理标准。` }
        ],
        riskFactors: { 金额: rndInt(20, 95), 置信度: clue.confidence, 违规严重度: clue.riskScore, 历史累犯: rndInt(15, 88), 机构信用: rndInt(30, 90), 数据完整度: rndInt(75, 99) },
        conclusionOptions: ['确认违规', '合理驳回', '转线上筛查', '转线下核查', '专家会诊']
      })
    }
  },
  {
    url: '/api/clue/judge',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) =>
      ok({
        clueId: body?.clueId,
        conclusion: body?.conclusion,
        nextStatus:
          body?.conclusion === '确认违规' ? '已流转' : body?.conclusion === '合理驳回' ? '已驳回' : body?.conclusion === '转线上筛查' ? '线上筛查中' : body?.conclusion === '转线下核查' ? '线下核查中' : '研判中',
        message: `研判结论已提交：${body?.conclusion}`,
        operateTime: '2026-08-29 09:12:40'
      })
  },
  {
    url: '/api/clue/batch-judge',
    method: 'post',
    timeout: delay(800, 1500),
    response: ({ body }: any) => ok({ successCount: (body?.ids ?? []).length, message: `已批量处理 ${(body?.ids ?? []).length} 条线索` })
  },
  {
    url: '/api/clue/assign',
    method: 'post',
    timeout: delay(),
    response: ({ body }: any) => ok({ successCount: (body?.ids ?? []).length, assignee: body?.assignee, message: `已分派给 ${body?.assignee}` })
  },

  /* ===== M07 知识图谱 ===== */
  {
    url: '/api/clue/graph',
    method: 'get',
    timeout: delay(700, 1300),
    response: ({ query }: any) => {
      if (GRAPH_DATA[query.clueId]) return ok(GRAPH_DATA[query.clueId])
      const clue = CLUE_MAP.get(query.clueId) ?? CLUES[0]
      const nodes = [
        { id: clue.clueId, name: `线索\n${clue.clueId.slice(-6)}`, type: '线索', level: 0, risk: clue.riskLevel, value: clue.riskScore, detail: `${clue.violationType} · ${clue.suspectedAmount.toFixed(2)}元` },
        { id: clue.patientId, name: clue.patientName, type: '参保人', level: 1, risk: '中', value: rndInt(40, 80), detail: `${clue.patientAge}岁·${clue.insuranceType}` },
        { id: clue.orgCode, name: clue.orgName, type: '机构', level: 1, risk: '中', value: rndInt(45, 88), detail: clue.orgType },
        { id: `D_${clue.doctorName}`, name: clue.doctorName, type: '医师', level: 1, risk: clue.riskLevel, value: rndInt(40, 90), detail: `${clue.deptName}·${clue.doctorTitle}` },
        { id: clue.itemCode, name: clue.itemName, type: '药品', level: 1, risk: '中', value: rndInt(35, 78), detail: '涉及项目' },
        { id: clue.settleNo, name: `结算单\n${clue.settleNo.slice(-6)}`, type: '结算', level: 1, risk: clue.riskLevel, value: rndInt(50, 92), detail: `${clue.visitDate}·${clue.totalFee.toFixed(2)}元` },
        { id: clue.ruleId, name: `规则\n${clue.ruleHit.slice(0, 8)}`, type: '规则', level: 1, risk: '高', value: rndInt(70, 95), detail: clue.ruleId }
      ]
      const related = CLUES.filter((c) => c.clueId !== clue.clueId && (c.orgCode === clue.orgCode || c.patientId === clue.patientId)).slice(0, 4)
      related.forEach((r) => nodes.push({ id: r.clueId, name: `关联线索\n${r.clueId.slice(-6)}`, type: '线索', level: 2, risk: r.riskLevel, value: r.riskScore, detail: `${r.violationType}·${r.suspectedAmount.toFixed(2)}元` }))
      const links = [
        { source: clue.clueId, target: clue.patientId, label: '涉及参保人' },
        { source: clue.clueId, target: clue.orgCode, label: '发生机构' },
        { source: clue.clueId, target: `D_${clue.doctorName}`, label: '开方医师' },
        { source: clue.clueId, target: clue.itemCode, label: '涉及项目' },
        { source: clue.clueId, target: clue.settleNo, label: '关联结算' },
        { source: clue.clueId, target: clue.ruleId, label: '命中规则' },
        { source: `D_${clue.doctorName}`, target: clue.orgCode, label: '执业机构' },
        ...related.map((r) => ({ source: r.orgCode === clue.orgCode ? clue.orgCode : clue.patientId, target: r.clueId, label: '关联线索' }))
      ]
      return ok({
        center: clue.clueId,
        nodes,
        links,
        categories: ['线索', '参保人', '机构', '医师', '药品', '结算', '规则', '项目'],
        insights: [
          { icon: 'warn', text: `${clue.orgName}近 30 日同类线索 ${rndInt(3, 16)} 条，建议关注机构系统性风险。` },
          { icon: 'info', text: `医师 ${clue.doctorName} 关联线索 ${rndInt(1, 8)} 条，处方行为异常度 ${rndInt(30, 88)}。` },
          { icon: 'info', text: `参保人 ${clue.patientName} 近 90 日跨 ${rndInt(2, 7)} 家机构就医，需核实合理性。` }
        ]
      })
    }
  },

  /* ===== 专家会诊 ===== */
  {
    url: '/api/clue/experts',
    method: 'get',
    timeout: delay(),
    response: () => ok(EXPERTS)
  },
  {
    url: '/api/clue/consult',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) =>
      ok({ consultId: `CS20260829${pad(rndInt(1, 999), 4)}`, experts: body?.expertIds ?? [], message: '专家会诊申请已提交，专家将在 24 小时内响应' })
  }
] as MockMethod[]
