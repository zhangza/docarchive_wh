import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate, filterBy, keywordSearch } from '../shared/utils'
import { INSPECTION_STATS } from '../shared/data/stats'
import { INSPECTIONS } from '../shared/data/detail'
import { CLUES } from '../shared/data/clues'
import { AUDITORS, AUDIT_GROUPS, resetSeed, rnd, rndInt, pick, pickMany, pad, dt, d } from '../shared/data/base'

resetSeed(51515)
const INS_TYPES = ['现场核查', '延伸核查', '飞行检查', '专家会诊核查', '复查']
const INS_STATUS = ['待安排', '待出发', '核查中', '待提交结论', '已完成', '已挂起']
const INS_RESULT = ['确认违规', '部分违规', '未发现违规', '证据不足']

const GEN_INS = CLUES.filter((c) => ['线下核查中', '申诉中', '已流转', '已结案', '已驳回'].includes(c.status))
  .slice(0, 200)
  .map((c, i) => {
    const status = pick(INS_STATUS)
    const done = ['已完成', '待提交结论'].includes(status)
    const off = -rndInt(0, 28)
    return {
      taskId: `INS2026${pad(rndInt(7, 8), 2)}${pad(rndInt(10, 30), 2)}${pad(i + 10, 4)}`,
      clueId: c.clueId,
      orgCode: c.orgCode,
      orgName: c.orgName,
      orgType: c.orgType,
      district: c.district,
      address: `芜湖市${c.district}${pick(['长江中路', '北京东路', '弋江南路', '银湖北路', '中山北路', '九华中路'])}${rndInt(1, 899)}号`,
      violationType: c.violationType,
      violationCategory: c.violationCategory,
      riskLevel: c.riskLevel,
      suspectedAmount: c.suspectedAmount,
      inspectType: pick(INS_TYPES),
      inspectDate: d(off),
      planTime: `${d(off)} ${pick(['09:00', '09:30', '14:00', '14:30', '15:00'])}`,
      status,
      inspectors: pickMany(AUDITORS, rndInt(2, 3)),
      leader: pick(['稽核组长·张建国', '稽核组长·赵桂芳']),
      group: pick(AUDIT_GROUPS),
      evidenceCount: done ? rndInt(3, 12) : rndInt(0, 4),
      ocrCount: done ? rndInt(1, 6) : 0,
      result: done ? pick(INS_RESULT) : '',
      confirmAmount: done ? Math.round(c.suspectedAmount * (0.4 + rnd() * 0.6) * 100) / 100 : 0,
      durationHours: done ? Math.round((2 + rnd() * 9) * 10) / 10 : 0,
      progress: status === '已完成' ? 100 : status === '待提交结论' ? 88 : status === '核查中' ? rndInt(20, 80) : 0
    }
  })

const TYPICAL_INS_LIST = INSPECTIONS.map((s) => ({
  taskId: s.taskId,
  clueId: s.clueId,
  orgCode: s.orgCode,
  orgName: s.orgName,
  orgType: '三级医院',
  district: '镜湖区',
  address: '芜湖市镜湖区长江中路 263 号',
  violationType: s.violationType,
  violationCategory: '用药类',
  riskLevel: '高',
  suspectedAmount: s.suspectedAmount,
  inspectType: s.inspectType,
  inspectDate: s.inspectDate,
  planTime: `${s.inspectDate} 09:00`,
  status: s.status,
  inspectors: s.inspectors,
  leader: s.leader,
  group: '稽核一组',
  evidenceCount: s.evidences.length,
  ocrCount: s.ocrRecords.length,
  result: s.conclusion.result,
  confirmAmount: s.conclusion.confirmAmount,
  durationHours: 5.5,
  progress: 100,
  isTypical: true
}))

const ALL_INS = [...TYPICAL_INS_LIST, ...GEN_INS]
const INS_MAP = new Map<string, any>(INSPECTIONS.map((s) => [s.taskId, s]))

export default [
  { url: '/api/inspection/stats', method: 'get', timeout: delay(), response: () => ok(INSPECTION_STATS) },
  {
    url: '/api/inspection/tasks',
    method: 'get',
    timeout: delay(),
    response: ({ query }: any) => {
      let list = filterBy(ALL_INS, query, {
        eq: ['status', 'riskLevel', 'district', 'inspectType', 'result', 'group', 'orgType', 'orgCode'],
        like: ['orgName', 'taskId', 'clueId', 'violationType', 'leader'],
        range: [{ key: 'suspectedAmount', min: 'amountMin', max: 'amountMax' }],
        dateRange: [{ key: 'inspectDate', start: 'startDate', end: 'endDate' }]
      })
      if (query.mine === 'true') list = list.filter((x) => x.inspectors.includes('稽核员·王振华'))
      list = keywordSearch(list, query.keyword, ['taskId', 'clueId', 'orgName', 'violationType', 'address'])
      list = [...list].sort((a, b) => (a.inspectDate < b.inspectDate ? 1 : -1))
      return ok(paginate(list, query.page, query.pageSize))
    }
  },
  {
    url: '/api/inspection/detail',
    method: 'get',
    timeout: delay(400, 800),
    response: ({ query }: any) => {
      if (INS_MAP.has(query.taskId)) return ok(INS_MAP.get(query.taskId))
      const t = ALL_INS.find((x) => x.taskId === query.taskId) ?? ALL_INS[0]
      const done = t.progress === 100
      return ok({
        ...t,
        checklist: [
          { item: '处方/医嘱核验', desc: '核对处方原件与结算明细数量、剂量一致性', result: done ? pick(['一致', '存在差异']) : '未开始', finding: done ? `抽查 ${rndInt(3, 12)} 份，${rndInt(0, 4)} 份存在差异` : '', status: done ? '已完成' : '待核查' },
          { item: '发药/执行记录核验', desc: '核对药房出库、护士执行记录', result: done ? pick(['一致', '存在差异']) : '未开始', finding: done ? `差异金额 ${(rnd() * 300).toFixed(2)} 元` : '', status: done ? '已完成' : '待核查' },
          { item: '病历文书核验', desc: '核对诊断、病程记录与收费项目对应关系', result: done ? pick(['一致', '无记录']) : '未开始', finding: done ? pick(['病程记录完整', '未见对应检查报告']) : '', status: done ? '已完成' : '待核查' },
          { item: '库存/台账核验', desc: '核对药品进销存台账与实物库存', result: done ? pick(['一致', '存在差异']) : '未开始', finding: done ? `盘点差异 ${rndInt(0, 26)} 盒` : '', status: done ? '已完成' : '待核查' },
          { item: '问询笔录', desc: '对相关医师/药师/参保人进行问询并签认', result: done ? '已签认' : '未开始', finding: done ? '当事人对主要事实无异议' : '', status: done ? '已完成' : '待核查' }
        ],
        ocrRecords: done
          ? Array.from({ length: rndInt(2, 5) }, (_, i) => ({
              ocrId: `OCR${t.inspectDate.replace(/-/g, '')}${pad(i + 1, 4)}`,
              docType: pick(['门诊处方', '发药单', '库存台账', '检查报告单', '住院病历首页']),
              fileName: `${pick(['处方', '发药单', '台账', '报告单'])}_${pad(i + 1, 2)}.jpg`,
              confidence: rndInt(86, 98),
              fields: rndInt(6, 18),
              status: '识别成功',
              time: `${t.inspectDate} ${pick(['09:42:18', '10:15:32', '11:08:44', '14:26:05'])}`
            }))
          : [],
        interviews: done
          ? [
              {
                recordId: `REC${t.inspectDate.replace(/-/g, '')}${pad(1, 4)}`,
                interviewee: pick(['李建国', '王小敏', '陈志强', '刘丽']),
                role: pick(['主治医师', '主任医师', '药房负责人', '医保办工作人员']),
                duration: `${rndInt(18, 52)}分钟`,
                signed: true,
                summary: '当事人对核查发现的主要事实予以确认，说明系操作习惯及系统模板原因所致。',
                time: `${t.inspectDate} ${pick(['11:20:00', '15:10:00'])}`
              }
            ]
          : [],
        evidences: Array.from({ length: t.evidenceCount }, (_, i) => ({
          evidenceId: `EV${t.inspectDate.replace(/-/g, '')}${pad(i + 1, 5)}`,
          name: pick(['门诊处方复印件', '发药记录截图', '库存台账照片', '问询笔录', '现场照片', '检查报告单', 'HIS 系统操作日志']),
          type: pick(['书证', '电子数据', '言词证据', '视听资料', '物证']),
          collectTime: `${t.inspectDate} ${pick(['09:50:12', '10:32:08', '11:15:40', '14:48:22', '15:36:10'])}`,
          collector: pick(t.inspectors),
          hash: `sha256:${Array.from({ length: 16 }, () => '0123456789abcdef'[rndInt(0, 15)]).join('')}`,
          chainStatus: '已固化',
          size: `${rndInt(120, 3200)} KB`
        })),
        conclusion: done
          ? {
              result: t.result,
              violationTypes: [t.violationType],
              confirmAmount: t.confirmAmount,
              detail: `经现场核查，${t.orgName}存在${t.violationType}行为，涉及医保基金 ${t.confirmAmount.toFixed(2)} 元，证据链完整，建议按规定予以追回并作出相应处理。`,
              submitTime: `${t.inspectDate} 16:45:00`,
              submitter: t.leader
            }
          : null
      })
    }
  },
  {
    url: '/api/inspection/create',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) =>
      ok({
        taskId: `INS20260829${pad(rndInt(100, 999), 4)}`,
        clueIds: body?.clueIds ?? [],
        inspectDate: body?.inspectDate ?? '2026-08-30',
        message: '线下核查任务已创建，已推送至核查人员移动端'
      })
  },
  {
    url: '/api/inspection/ocr',
    method: 'post',
    timeout: delay(1400, 2600),
    response: ({ body }: any) => {
      const docType = body?.docType ?? '门诊处方'
      const base: Record<string, Array<{ label: string; value: string }>> = {
        门诊处方: [
          { label: '处方编号', value: `RX2026082800${rndInt(1000, 9999)}` },
          { label: '患者姓名', value: '张伟民' },
          { label: '开方医师', value: '李建国' },
          { label: '科室', value: '内分泌科' },
          { label: '药品名称', value: '格列美脲片 2mg*30片' },
          { label: '数量', value: '2 盒' },
          { label: '用法用量', value: '每日1次，每次1片' },
          { label: '开方日期', value: '2026-08-28' }
        ],
        发药单: [
          { label: '发药单号', value: `FY2026082800${rndInt(100, 999)}` },
          { label: '药品名称', value: '格列美脲片 2mg*30片' },
          { label: '实发数量', value: '2 盒' },
          { label: '发药人', value: '王小敏' },
          { label: '发药时间', value: '2026-08-28 10:32:15' }
        ],
        库存台账: [
          { label: '药品编码', value: 'YP300000' },
          { label: '期初库存', value: `${rndInt(200, 800)} 盒` },
          { label: '本期入库', value: `${rndInt(50, 300)} 盒` },
          { label: '本期出库', value: `${rndInt(80, 400)} 盒` },
          { label: '期末库存', value: `${rndInt(150, 700)} 盒` },
          { label: '盘点差异', value: `${rndInt(0, 26)} 盒` }
        ]
      }
      const fields = base[docType] ?? base['门诊处方']
      return ok({
        ocrId: `OCR20260830${pad(rndInt(1, 9999), 4)}`,
        docType,
        confidence: rndInt(88, 98),
        costMs: rndInt(860, 2400),
        fields: fields.map((f) => ({ ...f, confidence: rndInt(85, 99) })),
        warnings: rnd() > 0.6 ? ['「数量」字段与医保结算数据不一致，请人工复核'] : [],
        status: '识别成功'
      })
    }
  },
  {
    url: '/api/inspection/evidence',
    method: 'post',
    timeout: delay(700, 1300),
    response: ({ body }: any) =>
      ok({
        evidenceId: `EV20260830${pad(rndInt(1, 99999), 5)}`,
        name: body?.name ?? '现场照片',
        hash: `sha256:${Array.from({ length: 16 }, () => '0123456789abcdef'[rndInt(0, 15)]).join('')}`,
        chainStatus: '已固化',
        collectTime: '2026-08-30 15:36:10',
        message: '证据已上传并完成哈希固化，不可篡改'
      })
  },
  {
    url: '/api/inspection/interview',
    method: 'post',
    timeout: delay(600, 1100),
    response: ({ body }: any) => ok({ recordId: `REC20260830${pad(rndInt(1, 9999), 4)}`, interviewee: body?.interviewee, signed: true, message: '问询笔录已保存并完成电子签认' })
  },
  {
    url: '/api/inspection/conclusion',
    method: 'post',
    timeout: delay(700, 1300),
    response: ({ body }: any) =>
      ok({
        taskId: body?.taskId,
        result: body?.result,
        confirmAmount: body?.confirmAmount ?? 0,
        nextStatus: body?.result === '确认违规' || body?.result === '部分违规' ? '已流转' : '已结案',
        message: `核查结论已提交：${body?.result}，线索状态已同步更新`
      })
  }
] as MockMethod[]
