import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate } from '../shared/utils'
import {
  CONFIRMATIONS, CONFIRMATION_MAP, HANDLINGS, PENALTIES, TRANSFERS,
  RECOVERIES, RECTIFIES, CANCEL_CASES, ARCHIVES, STANDARDS, TYPICAL_CASES,
  REVIEW_SCORES, PUNISH_STATS, HANDLE_MEASURES, PROBLEM_NATURES,
  RECOVERY_METHODS, RECOVERY_STATUS, PENALTY_STEPS, PENALTY_KINDS,
  TRANSFER_TYPES, RECTIFY_STATUS, CANCEL_CONDITIONS, CREDIT_LEVELS,
  PUNISH_VIOLATION_TYPES
} from '../shared/data/punish'
import { pad, rndInt, dt } from '../shared/data/base'

export default [
  /* ================= 违规确认与复核（M19） ================= */
  {
    url: '/api/punish/confirm/stats',
    method: 'get',
    timeout: delay(200, 400),
    response: () =>
      ok({
        confirmTotal: PUNISH_STATS.confirmTotal,
        pendingReview: PUNISH_STATS.pendingReview,
        reviewPassed: PUNISH_STATS.reviewPassed,
        returned: PUNISH_STATS.returned,
        natureDist: PUNISH_STATS.natureDist,
        violationAmount: PUNISH_STATS.achievement.violationAmount,
        penaltyAmount: PUNISH_STATS.achievement.penaltyAmount,
        byViolationType: PUNISH_STATS.byViolationType,
        monthTrend: PUNISH_STATS.monthTrend
      })
  },
  {
    url: '/api/punish/confirm/list',
    method: 'get',
    timeout: delay(180, 380),
    response: ({ query }: any) => {
      const { keyword, problemNature, status, district, orgType, needDual, page = 1, pageSize = 15 } = query
      let list = [...CONFIRMATIONS]
      if (problemNature) list = list.filter((c) => c.problemNature === problemNature)
      if (status) list = list.filter((c) => c.status === status)
      if (district) list = list.filter((c) => c.district === district)
      if (orgType) list = list.filter((c) => c.orgType.includes(orgType))
      if (needDual === 'true') list = list.filter((c) => c.needDualReview)
      if (keyword) {
        list = list.filter(
          (c) =>
            c.confirmationId.includes(keyword) ||
            c.orgName.includes(keyword) ||
            c.taskId.includes(keyword) ||
            c.violationTypes.some((v) => v.type.includes(keyword))
        )
      }
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/confirm/detail',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => ok(CONFIRMATION_MAP[query.confirmationId] || CONFIRMATIONS[0])
  },
  {
    url: '/api/punish/confirm/ai-qualify',
    method: 'post',
    timeout: delay(700, 1400),
    response: ({ body }: any) => {
      const c = CONFIRMATION_MAP[body?.confirmationId] || CONFIRMATIONS[0]
      return ok({
        confirmationId: c.confirmationId,
        problemNature: c.problemNature,
        natureReason: c.natureReason,
        violationTypes: c.violationTypes,
        legalBasis: c.legalBasis,
        amount: c.amount,
        responsibility: c.responsibility,
        aiSuggestion: c.aiSuggestion,
        analyzeTime: dt(0, 0, 0),
        costMs: rndInt(1200, 2800),
        modelVersion: 'v2.3.2'
      })
    }
  },
  {
    url: '/api/punish/confirm/submit',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, confirmationId: body?.confirmationId, status: '待复核', message: '违规确认已提交双人复核' })
  },
  {
    url: '/api/punish/confirm/review',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        confirmationId: body?.confirmationId,
        result: body?.result || '通过',
        reviewer: '稽核员·李明华',
        signTime: dt(0, 0, 0),
        message: body?.result === '通过' ? '复核通过，已生成检查报告' : `已${body?.result}，退回承办人处理`
      })
  },
  {
    url: '/api/punish/confirm/report',
    method: 'post',
    timeout: delay(600, 1200),
    response: ({ body }: any) => {
      const c = CONFIRMATION_MAP[body?.confirmationId] || CONFIRMATIONS[0]
      return ok({
        reportId: `RPT2026${pad(rndInt(1, 9999), 4)}`,
        reportNo: `芜医保检报〔2026〕${pad(rndInt(1, 999), 3)}号`,
        generateTime: dt(0, 0, 0),
        generateMode: 'AI自动生成+人工修改',
        status: '已生成',
        sections: [
          { no: '封面', title: `${c.orgName}医保基金使用检查报告` },
          { no: '一', title: '检查基本情况' },
          { no: '二', title: '检查发现问题' },
          { no: '三', title: '违规金额认定' },
          { no: '四', title: '问题性质认定' },
          { no: '五', title: '责任界定' },
          { no: '六', title: '处理建议' },
          { no: '七', title: '附件清单' }
        ],
        message: '检查报告已生成，可预览与导出'
      })
    }
  },
  {
    url: '/api/punish/confirm/push',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        pushId: `PUSH2026${pad(rndInt(1, 9999), 4)}`,
        pushTime: dt(0, 0, 0),
        pushMethod: body?.pushMethod || ['系统通知', '短信', '电子送达'],
        documents: ['检查报告', '违规确认书', '违规金额认定表', '处理意见告知书'],
        rightsNotice: {
          statementRight: '收到之日起 5 个工作日内可提出陈述申辩',
          hearingRight: '拟较大数额罚款等情形，收到之日起 3 个工作日内可申请听证',
          appealChannel: '芜湖市医疗保障局基金监管处 0553-3901234'
        },
        message: '结果已送达被检机构，并已告知申诉权利与时限'
      })
  },

  /* ================= 分类处置（M20） ================= */
  {
    url: '/api/punish/handle/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        handlingTotal: PUNISH_STATS.handlingTotal,
        penaltyTotal: PUNISH_STATS.penaltyTotal,
        transferTotal: PUNISH_STATS.transferTotal,
        handleTypeDist: PUNISH_STATS.handleTypeDist,
        measureDist: PUNISH_STATS.measureDist,
        natureDist: PUNISH_STATS.natureDist
      })
  },
  {
    url: '/api/punish/handle/agreement',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, problemNature, page = 1, pageSize = 10 } = query
      let list = [...HANDLINGS]
      if (status) list = list.filter((h) => h.status === status)
      if (problemNature) list = list.filter((h) => h.problemNature === problemNature)
      if (keyword) list = list.filter((h) => h.handlingId.includes(keyword) || h.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/handle/penalty',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, page = 1, pageSize = 10 } = query
      let list = [...PENALTIES]
      if (status) list = list.filter((p) => p.status === status)
      if (keyword) list = list.filter((p) => p.penaltyId.includes(keyword) || p.orgName.includes(keyword) || p.caseNo.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/handle/transfer',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, transferType, status, page = 1, pageSize = 10 } = query
      let list = [...TRANSFERS]
      if (transferType) list = list.filter((t) => t.transferType === transferType)
      if (status) list = list.filter((t) => t.status === status)
      if (keyword) list = list.filter((t) => t.transferId.includes(keyword) || t.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/handle/basis',
    method: 'get',
    timeout: delay(500, 1000),
    response: ({ query }: any) => {
      const c = CONFIRMATION_MAP[query.confirmationId] || CONFIRMATIONS[0]
      const isFraud = c.problemNature === '涉嫌欺诈骗保'
      return ok({
        recommendationId: `REC2026${pad(rndInt(1, 9999), 4)}`,
        confirmationId: c.confirmationId,
        violationTypes: c.violationTypes.map((v) => v.type),
        violationAmount: c.amount.totalViolationAmount,
        isFraud,
        qualitativeBasis: c.legalBasis.map((l) => ({
          type: l.law.includes('协议') ? '协议' : '法规',
          name: l.law,
          article: l.article,
          content: l.content,
          effective: '现行有效',
          effectiveDate: '2021-05-01'
        })),
        penaltyBasis: [
          {
            type: '法规',
            name: '《医疗保障基金使用监督管理条例》',
            article: isFraud ? '第四十条' : '第三十八条',
            content: isFraud
              ? '以骗取医疗保障基金为目的，实施虚构医药服务项目等行为，责令退回，处骗取金额2倍以上5倍以下的罚款'
              : '造成医疗保障基金损失的，责令退回，处造成损失金额1倍以上2倍以下的罚款',
            effective: '现行有效',
            penaltyRange: isFraud ? '2-5倍' : '1-2倍'
          }
        ],
        discretionStandard: {
          standardName: '芜湖市医保基金违规行为行政处罚裁量基准',
          violationType: c.violationTypes[0].type,
          amountRange: `${Math.floor(c.amount.totalViolationAmount / 10000)}万元档`,
          suggestedMultiple: c.amount.penaltyMultiple,
          factors: {
            从轻: ['首次违规', '主动整改', '积极配合检查'],
            从重: ['屡查屡犯', '拒不配合', '造成严重后果']
          },
          caseFactors: isFraud ? ['主观故意', '涉及金额巨大'] : ['首次违规', '积极配合检查'],
          suggestedResult: `建议按 ${c.amount.penaltyMultiple} 倍处以罚款 ${c.amount.penaltyAmount.toLocaleString('zh-CN')} 元`
        },
        referenceCases: TYPICAL_CASES.filter((t) => t.violationType === c.violationTypes[0].type)
          .slice(0, 4)
          .map((t) => ({
            caseId: t.caseId,
            caseName: t.caseName,
            orgType: t.orgType,
            violationType: t.violationType,
            amount: t.amount,
            result: t.result,
            decisionDate: t.decisionDate,
            similarity: rndInt(72, 96)
          })),
        expiredWarnings: []
      })
    }
  },
  {
    url: '/api/punish/handle/create',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        handlingId: `HAND2026${pad(rndInt(1, 9999), 4)}`,
        handlingType: body?.handlingType || '协议处理',
        approvalLevel:
          HANDLE_MEASURES.find((m) => (body?.measures || []).includes(m.measure) && m.approval !== '科长审批')?.approval ||
          '科长审批',
        message: '处置决定已提交审批'
      })
  },
  {
    url: '/api/punish/handle/approve',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, handlingId: body?.handlingId, status: '已审批', approveTime: dt(0, 0, 0), message: '审批通过，处置文书已生成待送达' })
  },
  {
    url: '/api/punish/handle/penalty-step',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => {
      const idx = Number(body?.stepIndex || 0)
      return ok({
        success: true,
        penaltyId: body?.penaltyId,
        currentStep: PENALTY_STEPS[Math.min(idx + 1, PENALTY_STEPS.length - 1)],
        stepIndex: Math.min(idx + 1, PENALTY_STEPS.length - 1),
        time: dt(0, 0, 0),
        message: `已完成「${PENALTY_STEPS[idx]}」，进入「${PENALTY_STEPS[Math.min(idx + 1, PENALTY_STEPS.length - 1)]}」`
      })
    }
  },
  {
    url: '/api/punish/handle/transfer-submit',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, transferId: body?.transferId, status: '已移送', transferDate: dt(0, 0, 0), message: '案件已通过两法衔接平台正式移送' })
  },

  /* ================= 基金追回台账（M21） ================= */
  {
    url: '/api/punish/recovery/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        shouldRecoverTotal: PUNISH_STATS.shouldRecoverTotal,
        recoveredTotal: PUNISH_STATS.recoveredTotal,
        unrecoveredTotal: PUNISH_STATS.unrecoveredTotal,
        recoveryRate:
          Math.round((PUNISH_STATS.recoveredTotal / PUNISH_STATS.shouldRecoverTotal) * 1000) / 10,
        overdueCount: PUNISH_STATS.overdueCount,
        total: RECOVERIES.length,
        statusDist: PUNISH_STATS.recoveryStatusDist,
        methodDist: PUNISH_STATS.recoveryMethodDist,
        monthTrend: PUNISH_STATS.monthTrend,
        byDistrict: PUNISH_STATS.byDistrict
      })
  },
  {
    url: '/api/punish/recovery/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, recoveryMethod, district, orgType, overdue, page = 1, pageSize = 15 } = query
      let list = [...RECOVERIES]
      if (status) list = list.filter((r) => r.status === status)
      if (recoveryMethod) list = list.filter((r) => r.recoveryMethod === recoveryMethod)
      if (district) list = list.filter((r) => r.district === district)
      if (orgType) list = list.filter((r) => r.orgType.includes(orgType))
      if (overdue === 'true') list = list.filter((r) => r.overdue)
      if (keyword) list = list.filter((r) => r.recoveryId.includes(keyword) || r.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/recovery/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(RECOVERIES.find((r) => r.recoveryId === query.recoveryId) || RECOVERIES[0])
  },
  {
    url: '/api/punish/recovery/write-off',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) => {
      const rec = RECOVERIES.find((r) => r.recoveryId === body?.recoveryId) || RECOVERIES[0]
      const pay = Number(body?.paymentAmount || 0)
      const should = rec.amount.unrecoveredTotal
      const type = pay >= should ? '全额核销' : pay > 0 ? '部分核销' : '异常'
      return ok({
        success: true,
        writeOffId: `WO2026${pad(rndInt(1, 9999), 4)}`,
        recoveryId: rec.recoveryId,
        writeOffType: pay > should ? '标记异常（多缴）' : type,
        writeOffAmount: Math.min(pay, should),
        remainingAmount: Math.max(0, should - pay),
        newStatus: pay >= should ? '已追回' : '部分追回',
        matching: { matchMethod: '自动匹配（机构+金额+时间）', matchConfidence: rndInt(88, 99) },
        message:
          pay > should
            ? '到账金额大于应追金额，已标记异常待人工核实'
            : pay >= should
              ? '已全额核销，追回状态更新为已追回'
              : `已部分核销，剩余 ${(should - pay).toLocaleString('zh-CN')} 元继续追缴`
      })
    }
  },
  {
    url: '/api/punish/recovery/urge',
    method: 'post',
    timeout: delay(250, 500),
    response: ({ body }: any) =>
      ok({
        success: true,
        urged: body?.recoveryIds || [],
        escalated: (body?.recoveryIds || []).length,
        message: '催缴通知已发送，逾期超 30 天将自动升级处置措施'
      })
  },

  /* ================= 整改跟踪（M22） ================= */
  {
    url: '/api/punish/rectify/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        total: PUNISH_STATS.rectifyTotal,
        done: PUNISH_STATS.rectifyDone,
        overdue: PUNISH_STATS.rectifyOverdue,
        completeRate: PUNISH_STATS.achievement.rectifyCompleteRate,
        statusDist: PUNISH_STATS.rectifyStatusDist,
        byDistrict: PUNISH_STATS.byDistrict
      })
  },
  {
    url: '/api/punish/rectify/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, district, overdue, page = 1, pageSize = 15 } = query
      let list = [...RECTIFIES]
      if (status) list = list.filter((r) => r.status === status)
      if (district) list = list.filter((r) => r.district === district)
      if (overdue === 'true') list = list.filter((r) => r.overdue)
      if (keyword) list = list.filter((r) => r.rectifyId.includes(keyword) || r.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/rectify/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(RECTIFIES.find((r) => r.rectifyId === query.rectifyId) || RECTIFIES[0])
  },
  {
    url: '/api/punish/rectify/issue',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        rectifyId: `RECT2026${pad(rndInt(1, 9999), 4)}`,
        itemCount: (body?.items || []).length,
        documentNo: `芜医保整〔2026〕${pad(rndInt(1, 999), 3)}号`,
        message: '整改意见书已下达并送达被检机构'
      })
  },
  {
    url: '/api/punish/rectify/review',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        rectifyId: body?.rectifyId,
        itemId: body?.itemId,
        result: body?.result || '通过',
        reviewTime: dt(0, 0, 0),
        message: body?.result === '通过' ? '复查通过，该整改事项已完成' : '复查不通过，已退回机构重新整改'
      })
  },
  {
    url: '/api/punish/rectify/accept',
    method: 'post',
    timeout: delay(350, 700),
    response: ({ body }: any) =>
      ok({
        success: true,
        rectifyId: body?.rectifyId,
        status: '已完成',
        acceptNo: `芜医保验〔2026〕${pad(rndInt(1, 999), 3)}号`,
        message: '整改验收通过，已出具整改验收意见书'
      })
  },

  /* ================= 闭环销号（M23） ================= */
  {
    url: '/api/punish/cancel/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        total: PUNISH_STATS.cancelTotal,
        canceled: PUNISH_STATS.canceled,
        pending: PUNISH_STATS.cancelPending,
        creditRecords: PUNISH_STATS.creditRecords,
        creditLevelDist: PUNISH_STATS.creditLevelDist,
        conditions: CANCEL_CONDITIONS
      })
  },
  {
    url: '/api/punish/cancel/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, district, page = 1, pageSize = 15 } = query
      let list = [...CANCEL_CASES]
      if (status) list = list.filter((c) => c.status === status)
      if (district) list = list.filter((c) => c.district === district)
      if (keyword) list = list.filter((c) => c.cancelId.includes(keyword) || c.caseName.includes(keyword) || c.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/cancel/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(CANCEL_CASES.find((c) => c.cancelId === query.cancelId) || CANCEL_CASES[0])
  },
  {
    url: '/api/punish/cancel/verify',
    method: 'post',
    timeout: delay(600, 1200),
    response: ({ body }: any) => {
      const c = CANCEL_CASES.find((x) => x.cancelId === body?.cancelId) || CANCEL_CASES[0]
      return ok({
        cancelId: c.cancelId,
        conditions: c.conditions,
        allPassed: c.allPassed,
        verifyTime: dt(0, 0, 0),
        message: c.allPassed ? '销号条件全部满足，可提交审批' : '存在未满足条件，暂不可销号'
      })
    }
  },
  {
    url: '/api/punish/cancel/submit',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, cancelId: body?.cancelId, status: '待审批', message: '销号申请已提交审批' })
  },
  {
    url: '/api/punish/cancel/approve',
    method: 'post',
    timeout: delay(350, 700),
    response: ({ body }: any) =>
      ok({
        success: true,
        cancelId: body?.cancelId,
        finalResult: body?.result || '核准销号',
        cancelNo: `芜医保结〔2026〕${pad(rndInt(1, 999), 3)}号`,
        cancelTime: dt(0, 0, 0),
        message: '已核准销号，案件闭环标识已生成'
      })
  },
  {
    url: '/api/punish/cancel/credit',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        creditId: `CREDIT2026${pad(rndInt(1, 9999), 4)}`,
        cancelId: body?.cancelId,
        linkTime: dt(0, 0, 0),
        message: '处置结果已联动机构与个人信用记录，并同步至信用监管平台'
      })
  },

  /* ================= 台账与经验沉淀（M24） ================= */
  {
    url: '/api/punish/ledger/stats',
    method: 'get',
    timeout: delay(200, 420),
    response: () =>
      ok({
        achievement: PUNISH_STATS.achievement,
        archiveTotal: PUNISH_STATS.archiveTotal,
        archivedCount: PUNISH_STATS.archivedCount,
        paperUploadedCount: PUNISH_STATS.paperUploadedCount,
        standardTotal: PUNISH_STATS.standardTotal,
        caseTotal: PUNISH_STATS.caseTotal,
        reviewScoreTotal: PUNISH_STATS.reviewScoreTotal,
        avgScore: PUNISH_STATS.avgScore,
        keyReviewCount: PUNISH_STATS.keyReviewCount,
        adoptedFeedback: PUNISH_STATS.adoptedFeedback,
        scoreDimAvg: PUNISH_STATS.scoreDimAvg,
        byDistrict: PUNISH_STATS.byDistrict,
        byViolationType: PUNISH_STATS.byViolationType,
        monthTrend: PUNISH_STATS.monthTrend,
        natureDist: PUNISH_STATS.natureDist,
        handleTypeDist: PUNISH_STATS.handleTypeDist
      })
  },
  {
    url: '/api/punish/ledger/archives',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, year, page = 1, pageSize = 10 } = query
      let list = [...ARCHIVES]
      if (status) list = list.filter((a) => a.status === status)
      if (year) list = list.filter((a) => a.year === year)
      if (keyword) list = list.filter((a) => a.archiveNo.includes(keyword) || a.caseName.includes(keyword) || a.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/ledger/standards',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, violationType, page = 1, pageSize = 10 } = query
      let list = [...STANDARDS]
      if (violationType) list = list.filter((s) => s.violationType === violationType)
      if (keyword) list = list.filter((s) => s.standardName.includes(keyword) || s.violationType.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/ledger/cases',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, violationType, problemNature, page = 1, pageSize = 10 } = query
      let list = [...TYPICAL_CASES]
      if (violationType) list = list.filter((c) => c.violationType === violationType)
      if (problemNature) list = list.filter((c) => c.problemNature === problemNature)
      if (keyword) list = list.filter((c) => c.caseName.includes(keyword) || c.violationType.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/ledger/review-scores',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, grade, keyOnly, page = 1, pageSize = 10 } = query
      let list = [...REVIEW_SCORES]
      if (grade) list = list.filter((r) => r.grade === grade)
      if (keyOnly === 'true') list = list.filter((r) => r.isKeyReview)
      if (keyword) list = list.filter((r) => r.caseName.includes(keyword) || r.scoreId.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/punish/ledger/archive-upload',
    method: 'post',
    timeout: delay(700, 1400),
    response: () =>
      ok({
        success: true,
        recognized: true,
        ocrResult: {
          category: '处置决定文书',
          docName: '行政处罚决定书',
          docNo: `芜医保罚〔2026〕${pad(rndInt(1, 999), 3)}号`,
          pages: rndInt(3, 12),
          confidence: rndInt(88, 98)
        },
        message: '纸质材料已上传，OCR 已识别分类并关联电子案卷'
      })
  },
  {
    url: '/api/punish/ledger/adopt-feedback',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, scoreId: body?.scoreId, adopted: true, message: '优化建议已采纳，规则阈值调整待生效' })
  },
  {
    url: '/api/punish/ledger/export-report',
    method: 'post',
    timeout: delay(500, 1000),
    response: ({ body }: any) =>
      ok({
        success: true,
        reportName: body?.reportType === 'summary' ? '专项检查总结报告' : '监管分析报告',
        generateTime: dt(0, 0, 0),
        message: '报告已生成，正在下载'
      })
  },

  /* ================= 字典 ================= */
  {
    url: '/api/punish/dicts',
    method: 'get',
    timeout: delay(100, 200),
    response: () =>
      ok({
        problemNatures: PROBLEM_NATURES,
        handleMeasures: HANDLE_MEASURES,
        violationTypes: PUNISH_VIOLATION_TYPES,
        recoveryMethods: RECOVERY_METHODS,
        recoveryStatus: RECOVERY_STATUS,
        penaltySteps: PENALTY_STEPS,
        penaltyKinds: PENALTY_KINDS,
        transferTypes: TRANSFER_TYPES,
        rectifyStatus: RECTIFY_STATUS,
        cancelConditions: CANCEL_CONDITIONS,
        creditLevels: CREDIT_LEVELS
      })
  }
] as MockMethod[]
