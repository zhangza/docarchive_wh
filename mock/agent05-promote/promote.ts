import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate } from '../shared/utils'
import {
  GRADE_STANDARD, SCORE_DIMENSIONS, REVIEW_TRIGGERS, PROBLEM_CATEGORIES, SEVERITIES,
  ROOT_CAUSE_TYPES, PRIORITIES, MEASURE_DEPTS, REVIEW_REPORT_TYPES, REPORT_STATUS, CONFIDENTIALITY,
  QUALITY_SCORES, QUALITY_SCORE_MAP, SCORE_HISTOGRAM, DIMENSION_AVG, SCORE_TREND,
  CASE_REVIEWS, CASE_REVIEW_MAP, ALL_MEASURES, ALL_LESSONS, CAUSE_STAT, PROBLEM_MATRIX,
  REVIEW_REPORTS, REVIEW_REPORT_MAP,
  DASHBOARD, MULTI_DIM, ANALYSIS_DIMENSIONS, ANALYSIS_METHODS, EVALUATION,
  ANALYSIS_REPORTS, ANALYSIS_REPORT_MAP, ANALYSIS_REPORT_TYPES, REPORT_PIPELINE,
  REVIEW_STATS
} from '../shared/data/promote'
import {
  SAMPLE_TYPES, FEATURE_TYPES, FEEDBACK_STATUS, FEEDBACK_BATCHES, FEEDBACK_BATCH_MAP, SAMPLE_FLOW,
  SUGGESTION_TYPES, OPT_BATCHES, OPT_BATCH_MAP, VERSION_MANAGEMENT, MODEL_LIST, RULE_LIST,
  METRIC_STATUS, MONITOR,
  MATERIAL_TYPES, MATERIAL_STATUS, AUDIENCES, MATERIAL_FORMATS, MATERIAL_TYPE_META,
  EDU_MATERIALS, EDU_MATERIAL_MAP, PUSH_ENDS, PUSH_RECORDS, PUSH_RECORD_MAP, SCHEDULED_PUSHES,
  EDU_STATS, PROMOTE_STATS
} from '../shared/data/promoteEdu'
import { pad, rndInt, dt, pick } from '../shared/data/base'

export default [
  /* ============ 3.1.1 案件质量评分（M31） ============ */
  {
    url: '/api/promote/score/stats',
    method: 'get',
    timeout: delay(180, 380),
    response: () =>
      ok({
        scoreTotal: REVIEW_STATS.scoreTotal,
        avgScore: REVIEW_STATS.avgScore,
        gradeDist: REVIEW_STATS.gradeDist,
        excellentCount: REVIEW_STATS.excellentCount,
        failCount: REVIEW_STATS.failCount,
        autoFlaggedCount: REVIEW_STATS.autoFlaggedCount,
        appealChangedCount: REVIEW_STATS.appealChangedCount,
        dimensionAvg: DIMENSION_AVG,
        histogram: SCORE_HISTOGRAM,
        scoreTrend: SCORE_TREND,
        byDistrict: REVIEW_STATS.byDistrict,
        gradeStandard: GRADE_STANDARD,
        dimensions: SCORE_DIMENSIONS
      })
  },
  {
    url: '/api/promote/score/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, grade, district, violationType, flaggedOnly, page = 1, pageSize = 15 } = query
      let list = [...QUALITY_SCORES]
      if (grade) list = list.filter((s) => s.grade === grade)
      if (district) list = list.filter((s) => s.district === district)
      if (violationType) list = list.filter((s) => s.violationType === violationType)
      if (flaggedOnly === 'true') list = list.filter((s) => s.autoFlagged)
      if (keyword) {
        list = list.filter((s) =>
          s.scoreId.includes(keyword) || s.caseId.includes(keyword) ||
          s.caseName.includes(keyword) || s.orgName.includes(keyword)
        )
      }
      list.sort((a, b) => a.rank - b.rank)
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/score/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const s = QUALITY_SCORE_MAP[query.scoreId] || QUALITY_SCORES[0]
      // 附带同期分布定位信息
      const better = QUALITY_SCORES.filter((x) => x.totalScore > s.totalScore).length
      return ok({
        ...s,
        percentile: Number((((QUALITY_SCORES.length - better) / QUALITY_SCORES.length) * 100).toFixed(1)),
        avgScore: REVIEW_STATS.avgScore,
        dimensionAvg: DIMENSION_AVG,
        gradeStandard: GRADE_STANDARD,
        handling: GRADE_STANDARD.find((g) => g.grade === s.grade)?.handling,
        relatedReviewId: CASE_REVIEWS.find((r) => r.scoreId === s.scoreId)?.reviewId || null
      })
    }
  },
  {
    url: '/api/promote/score/ai-rate',
    method: 'post',
    timeout: delay(900, 1700),
    response: ({ body }: any) => {
      const s = QUALITY_SCORE_MAP[body?.scoreId] || QUALITY_SCORES[0]
      return ok({
        success: true,
        scoreId: s.scoreId,
        aiScore: s.aiScore,
        dimensions: s.dimensions,
        grade: s.grade,
        message: `AI 初评完成，总分 ${s.aiScore} 分（${s.grade}），请质控员人工复核确认`
      })
    }
  },
  {
    url: '/api/promote/score/confirm',
    method: 'post',
    timeout: delay(320, 640),
    response: ({ body }: any) => {
      const total: number = (body?.dimensions || []).reduce((sum: number, x: any) => sum + Number(x.score || 0), 0)
      const grade = GRADE_STANDARD.find((g) => total >= g.min && total <= g.max)?.grade || '合格'
      return ok({
        success: true,
        scoreId: body?.scoreId,
        manualScore: total,
        grade,
        autoFlagged: total < 70,
        reviewer: '质控员 郑蕴',
        reviewTime: dt(0, 0, 0),
        message: total < 70
          ? `复核确认 ${total} 分（不合格），已自动推送至重点案件复盘`
          : total >= 90
            ? `复核确认 ${total} 分（优秀），已纳入优秀案例库`
            : `复核确认 ${total} 分（${grade}），已正常归档`
      })
    }
  },

  /* ============ 3.1.2 重点案件复盘（M32） ============ */
  {
    url: '/api/promote/review/stats',
    method: 'get',
    timeout: delay(180, 380),
    response: () =>
      ok({
        reviewTotal: REVIEW_STATS.reviewTotal,
        reviewClosed: REVIEW_STATS.reviewClosed,
        reviewOngoing: REVIEW_STATS.reviewOngoing,
        measureTotal: REVIEW_STATS.measureTotal,
        measureCompleted: REVIEW_STATS.measureCompleted,
        measureInProgress: REVIEW_STATS.measureInProgress,
        measureNotStarted: REVIEW_STATS.measureNotStarted,
        lessonTotal: REVIEW_STATS.lessonTotal,
        lessonInTrainingLib: REVIEW_STATS.lessonInTrainingLib,
        causeStat: CAUSE_STAT,
        problemMatrix: PROBLEM_MATRIX,
        triggerDist: REVIEW_STATS.triggerDist,
        triggers: REVIEW_TRIGGERS
      })
  },
  {
    url: '/api/promote/review/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, trigger, grade, page = 1, pageSize = 12 } = query
      let list = [...CASE_REVIEWS]
      if (status) list = list.filter((r) => r.status === status)
      if (grade) list = list.filter((r) => r.grade === grade)
      if (trigger) list = list.filter((r) => r.triggers.includes(trigger))
      if (keyword) {
        list = list.filter((r) =>
          r.reviewId.includes(keyword) || r.caseId.includes(keyword) || r.caseName.includes(keyword)
        )
      }
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/review/detail',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const r = CASE_REVIEW_MAP[query.reviewId] || CASE_REVIEWS[0]
      return ok({ ...r, scoreDetail: QUALITY_SCORE_MAP[r.scoreId] || null })
    }
  },
  {
    url: '/api/promote/review/create',
    method: 'post',
    timeout: delay(800, 1600),
    response: ({ body }: any) =>
      ok({
        success: true,
        reviewId: `REVIEW2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        caseId: body?.caseId,
        reviewType: body?.reviewType || '重点复盘（指定复盘）',
        reviewTime: dt(0, 0, 0),
        problemCount: rndInt(3, 5),
        measureCount: rndInt(5, 7),
        lessonCount: rndInt(2, 3),
        message: '复盘已发起，AI 已按五步法生成问题清单、改进措施与经验教训草稿，请复盘小组确认'
      })
  },
  {
    url: '/api/promote/review/measure/update',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) => {
      const prog = Number(body?.progress ?? 0)
      return ok({
        success: true,
        reviewId: body?.reviewId,
        measureId: body?.measureId,
        progress: prog,
        status: prog >= 100 ? '已完成' : prog > 0 ? '进行中' : '未开始',
        updateTime: dt(0, 0, 0),
        message: prog >= 100 ? '措施已标记完成，纳入闭环统计' : `措施进度已更新至 ${prog}%`
      })
    }
  },
  {
    url: '/api/promote/review/measures',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, dept, priority, page = 1, pageSize = 15 } = query
      let list = [...ALL_MEASURES]
      if (status) list = list.filter((m) => m.status === status)
      if (dept) list = list.filter((m) => m.dept === dept)
      if (priority) list = list.filter((m) => m.priority === priority)
      if (keyword) list = list.filter((m) => m.measure.includes(keyword) || m.caseName.includes(keyword))
      return ok({
        ...paginate(list, Number(page), Number(pageSize)),
        depts: MEASURE_DEPTS,
        deptStat: MEASURE_DEPTS.map((dp) => {
          const arr = ALL_MEASURES.filter((m) => m.dept === dp)
          return {
            dept: dp,
            total: arr.length,
            completed: arr.filter((m) => m.status === '已完成').length,
            avgProgress: arr.length ? Number((arr.reduce((s, m) => s + m.progress, 0) / arr.length).toFixed(1)) : 0
          }
        })
      })
    }
  },
  {
    url: '/api/promote/review/lessons',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, tag, inLibOnly, page = 1, pageSize = 12 } = query
      let list = [...ALL_LESSONS]
      if (tag) list = list.filter((l) => l.tags.includes(tag))
      if (inLibOnly === 'true') list = list.filter((l) => l.inTrainingLib)
      if (keyword) list = list.filter((l) => l.title.includes(keyword) || l.content.includes(keyword))
      list.sort((a, b) => b.citedCount - a.citedCount)
      const allTags = [...new Set(ALL_LESSONS.flatMap((l) => l.tags))].map((t) => ({
        tag: t,
        count: ALL_LESSONS.filter((l) => l.tags.includes(t)).length
      })).sort((a, b) => b.count - a.count)
      return ok({ ...paginate(list, Number(page), Number(pageSize)), tags: allTags })
    }
  },

  /* ============ 3.1.3 复盘报告（M33） ============ */
  {
    url: '/api/promote/review-report/stats',
    method: 'get',
    timeout: delay(170, 350),
    response: () =>
      ok({
        reportTotal: REVIEW_STATS.reportTotal,
        reportPublished: REVIEW_STATS.reportPublished,
        reportPending: REVIEW_STATS.reportPending,
        avgReadRate: REVIEW_STATS.avgReadRate,
        reportTypeDist: REVIEW_STATS.reportTypeDist,
        reportTypes: REVIEW_REPORT_TYPES,
        statusList: REPORT_STATUS,
        confidentiality: CONFIDENTIALITY
      })
  },
  {
    url: '/api/promote/review-report/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, reportType, status, page = 1, pageSize = 12 } = query
      let list = [...REVIEW_REPORTS]
      if (reportType) list = list.filter((r) => r.reportType === reportType)
      if (status) list = list.filter((r) => r.status === status)
      if (keyword) list = list.filter((r) => r.reportId.includes(keyword) || r.reportName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/review-report/detail',
    method: 'get',
    timeout: delay(170, 350),
    response: ({ query }: any) => ok(REVIEW_REPORT_MAP[query.reportId] || REVIEW_REPORTS[0])
  },
  {
    url: '/api/promote/review-report/generate',
    method: 'post',
    timeout: delay(1200, 2200),
    response: ({ body }: any) =>
      ok({
        success: true,
        reportId: `RR2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        reportType: body?.reportType || '个案复盘报告',
        generateMode: 'AI生成+人工修改',
        generateTime: dt(0, 0, 0),
        sectionCount: 7,
        totalWordCount: rndInt(1200, 2400),
        status: '待审核',
        message: '复盘报告已按标准化七章结构生成，请人工审核后发布'
      })
  },
  {
    url: '/api/promote/review-report/publish',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) =>
      ok({
        success: true,
        reportId: body?.reportId,
        status: '已发布',
        approver: '基金监管处 王承志',
        approvalTime: dt(0, 0, 0),
        distribution: body?.distribution || ['局领导', '基金监管处全体', '法制科', '各稽核组（学习参考）'],
        message: '报告已发布并分发，已纳入复盘库供检索调阅'
      })
  },

  /* ============ 3.2.1 监管可视化大屏（M34） ============ */
  {
    url: '/api/promote/dashboard',
    method: 'get',
    timeout: delay(260, 520),
    response: ({ query }: any) => {
      const { area, timeRange, orgType } = query
      // 区域筛选时按比例缩放核心指标
      let d0: any = { ...DASHBOARD, updateTime: dt(0, new Date().getHours(), new Date().getMinutes()) }
      if (area && area !== '芜湖市') {
        const a = DASHBOARD.areaHeatmap.find((x) => x.area === area)
        const ratio = a ? a.clueCount / 28810 : 1
        d0 = {
          ...d0,
          area,
          coreIndicators: DASHBOARD.coreIndicators.map((c) =>
            c.unit === '%' ? c : { ...c, value: Number((c.value * ratio * 3.6).toFixed(c.unit === '万元' ? 1 : 0)) }
          ),
          areaHeatmap: a ? [a] : DASHBOARD.areaHeatmap
        }
      }
      if (timeRange) d0.timeRange = timeRange
      if (orgType) {
        d0.orgRankingTOP10 = DASHBOARD.orgRankingTOP10.filter((o) => o.type === orgType)
      }
      return ok(d0)
    }
  },
  {
    url: '/api/promote/dashboard/pulse',
    method: 'get',
    timeout: delay(90, 200),
    response: () => {
      // 模拟实时刷新：动态活动流 + 智能体处理量微增
      const types = ['线索', '任务', '处置'] as const
      const levels = ['高', '中', '低'] as const
      const now = new Date()
      const acts = Array.from({ length: 3 }, (_, i) => {
        const t = new Date(now.getTime() - i * 47000)
        return {
          time: `${pad(t.getHours(), 2)}:${pad(t.getMinutes(), 2)}:${pad(t.getSeconds(), 2)}`,
          type: pick(types),
          level: pick(levels),
          content: pick([
            '新增高风险线索：芜湖广济医院虚假诊疗，疑似金额 5600 元',
            '任务完成线下核查，进入结果生成环节',
            '行政处罚决定书已送达并签收',
            '基金追回款项已到账核销',
            '药品回流疑点新增 6 条，涉及跨机构结算',
            '模型拦截误报 3 条（家属代取药场景）',
            '整改验收通过，机构信用分恢复 2 分',
            '自查任务超期预警，已自动督办'
          ])
        }
      })
      return ok({
        updateTime: dt(0, now.getHours(), now.getMinutes(), now.getSeconds()),
        activities: acts,
        agentPulse: DASHBOARD.agentPulse.map((a) => ({ ...a, today: a.today + rndInt(0, 3) })),
        todayNew: 285 + rndInt(0, 12),
        onlineUsers: rndInt(42, 96)
      })
    }
  },

  /* ============ 3.2.2 多维对比分析（M35） ============ */
  {
    url: '/api/promote/analysis/multi-dim',
    method: 'get',
    timeout: delay(300, 620),
    response: ({ query }: any) => {
      const { timeRange } = query
      return ok({
        ...MULTI_DIM,
        timeRange: timeRange || MULTI_DIM.timeRange,
        dimensionList: ANALYSIS_DIMENSIONS,
        methods: ANALYSIS_METHODS
      })
    }
  },
  {
    url: '/api/promote/analysis/drill',
    method: 'get',
    timeout: delay(400, 800),
    response: ({ query }: any) => {
      const level = Number(query.level || 1)
      const dd: any = MULTI_DIM.drillDown
      return ok({
        level,
        path: dd.path.slice(0, level),
        current: dd[`level${level}`] || dd.level1,
        next: level < 5 ? dd[`level${level + 1}`] : null,
        details: level >= 5 ? dd.level5.details : [],
        message: level >= 5 ? '已钻取至单笔违规明细' : `已钻取至第 ${level} 层：${dd.path[level - 1]}`
      })
    }
  },

  /* ============ 3.2.3 成果效能评估（M36） ============ */
  {
    url: '/api/promote/evaluation',
    method: 'get',
    timeout: delay(260, 540),
    response: () => ok(EVALUATION)
  },
  {
    url: '/api/promote/evaluation/export',
    method: 'post',
    timeout: delay(600, 1200),
    response: () =>
      ok({
        success: true,
        evaluationId: EVALUATION.evaluationId,
        reportUrl: EVALUATION.reportUrl,
        format: 'PDF',
        exportTime: dt(0, 0, 0),
        message: '效能评估报告已生成，正在下载'
      })
  },

  /* ============ 3.2.4 一键分析报告（M37） ============ */
  {
    url: '/api/promote/analysis-report/stats',
    method: 'get',
    timeout: delay(170, 350),
    response: () =>
      ok({
        total: REVIEW_STATS.analysisReportTotal,
        typeDist: REVIEW_STATS.analysisReportTypeDist,
        reportTypes: ANALYSIS_REPORT_TYPES,
        pipeline: REPORT_PIPELINE,
        charts: ANALYSIS_REPORTS[0].charts,
        tables: ANALYSIS_REPORTS[0].tables
      })
  },
  {
    url: '/api/promote/analysis-report/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, reportType, status, page = 1, pageSize = 10 } = query
      let list = [...ANALYSIS_REPORTS]
      if (reportType) list = list.filter((r) => r.reportType === reportType)
      if (status) list = list.filter((r) => r.status === status)
      if (keyword) list = list.filter((r) => r.reportId.includes(keyword) || r.reportName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/analysis-report/detail',
    method: 'get',
    timeout: delay(180, 380),
    response: ({ query }: any) => ok(ANALYSIS_REPORT_MAP[query.reportId] || ANALYSIS_REPORTS[0])
  },
  {
    url: '/api/promote/analysis-report/generate',
    method: 'post',
    timeout: delay(1600, 2600),
    response: ({ body }: any) => {
      const type = body?.reportType || '月度监管分析报告'
      return ok({
        success: true,
        reportId: `RPT-ANA2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        reportType: type,
        reportName: `${body?.period || '2026年8月'}芜湖市医保基金监管分析报告`,
        generateMode: 'AI自动生成+人工审核',
        generateTime: dt(0, 0, 0),
        sectionCount: 7,
        chartCount: 6,
        tableCount: 3,
        totalWordCount: rndInt(2600, 3600),
        status: '已生成',
        exportFormats: ['Word', 'PDF'],
        message: `${type}已生成：七章正文 3200 字、6 张图表、3 张统计表，可导出 Word / PDF`
      })
    }
  },
  {
    url: '/api/promote/analysis-report/export',
    method: 'post',
    timeout: delay(500, 1000),
    response: ({ body }: any) =>
      ok({
        success: true,
        reportId: body?.reportId,
        format: body?.format || 'PDF',
        exportTime: dt(0, 0, 0),
        message: `报告已导出 ${body?.format || 'PDF'} 格式，正在下载`
      })
  },

  /* ============ 3.3.1 案例数据回流（M38） ============ */
  {
    url: '/api/promote/feedback/stats',
    method: 'get',
    timeout: delay(180, 380),
    response: () =>
      ok({
        feedbackTotal: PROMOTE_STATS.feedbackTotal,
        feedbackSuccess: PROMOTE_STATS.feedbackSuccess,
        sampleTotal: PROMOTE_STATS.sampleTotal,
        positiveTotal: PROMOTE_STATS.positiveTotal,
        negativeTotal: PROMOTE_STATS.negativeTotal,
        misjudgmentTotal: PROMOTE_STATS.misjudgmentTotal,
        sampleFlow: SAMPLE_FLOW,
        sampleTypes: SAMPLE_TYPES,
        featureTypes: FEATURE_TYPES,
        statusList: FEEDBACK_STATUS,
        monthTrend: FEEDBACK_BATCHES.slice(0, 8).reverse().map((b) => ({
          batchNo: b.batchNo,
          total: b.dataSummary.totalClues,
          positive: b.dataSummary.positiveSamples,
          negative: b.dataSummary.negativeSamples,
          misjudgment: b.dataSummary.misjudgmentSamples
        }))
      })
  },
  {
    url: '/api/promote/feedback/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, page = 1, pageSize = 10 } = query
      let list = [...FEEDBACK_BATCHES]
      if (status) list = list.filter((b) => b.status === status)
      if (keyword) list = list.filter((b) => b.feedbackId.includes(keyword) || b.batchNo.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/feedback/detail',
    method: 'get',
    timeout: delay(170, 350),
    response: ({ query }: any) => ok(FEEDBACK_BATCH_MAP[query.feedbackId] || FEEDBACK_BATCHES[0])
  },
  {
    url: '/api/promote/feedback/run',
    method: 'post',
    timeout: delay(1400, 2400),
    response: ({ body }: any) => {
      const clues = rndInt(2400, 3100)
      const pos = Math.round(clues * 0.51)
      const dedup = clues - rndInt(18, 36)
      return ok({
        success: true,
        feedbackId: `FB2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        batchNo: body?.batchNo || 'BATCH-2026-09',
        mode: body?.mode || '定期批量回流（月度全量）',
        totalClues: clues,
        positiveSamples: pos,
        negativeSamples: clues - pos,
        removed: clues - dedup,
        trainingSetVersion: 'v2.5',
        feedbackTime: dt(0, 0, 0),
        status: '回流完成',
        message: `回流完成：${clues} 条线索去重后 ${dedup} 条，自动标注全量、人工复核误判样本，已构建训练集 v2.5`
      })
    }
  },

  /* ============ 3.3.2 模型优化（M39） ============ */
  {
    url: '/api/promote/optimize/stats',
    method: 'get',
    timeout: delay(180, 380),
    response: () =>
      ok({
        optBatchTotal: PROMOTE_STATS.optBatchTotal,
        suggestionTotal: PROMOTE_STATS.suggestionTotal,
        pendingSuggestions: PROMOTE_STATS.pendingSuggestions,
        adoptedSuggestions: PROMOTE_STATS.adoptedSuggestions,
        modelTotal: PROMOTE_STATS.modelTotal,
        ruleTotal: PROMOTE_STATS.ruleTotal,
        ruleToOptimize: PROMOTE_STATS.ruleToOptimize,
        suggestionTypes: SUGGESTION_TYPES,
        typeDist: SUGGESTION_TYPES.map((t) => ({
          name: t,
          value: OPT_BATCHES.flatMap((b) => b.suggestions).filter((s) => s.type === t).length
        })),
        models: MODEL_LIST,
        rules: RULE_LIST,
        versionManagement: VERSION_MANAGEMENT
      })
  },
  {
    url: '/api/promote/optimize/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, page = 1, pageSize = 10 } = query
      let list = [...OPT_BATCHES]
      if (status) list = list.filter((b) => b.status === status)
      if (keyword) list = list.filter((b) => b.optimizationId.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/optimize/detail',
    method: 'get',
    timeout: delay(170, 350),
    response: ({ query }: any) => ok(OPT_BATCH_MAP[query.optimizationId] || OPT_BATCHES[0])
  },
  {
    url: '/api/promote/optimize/decide',
    method: 'post',
    timeout: delay(380, 760),
    response: ({ body }: any) => {
      const dec = body?.decision || '已采纳'
      return ok({
        success: true,
        optimizationId: body?.optimizationId,
        suggestionId: body?.suggestionId,
        decision: dec,
        decisionBy: '算法工程师 李知远',
        decisionTime: dt(0, 0, 0),
        nextStep: dec === '已采纳' ? '业务专家确认' : dec === '需修改' ? '退回 AI 重新生成建议' : '本期不实施',
        message: dec === '已采纳'
          ? '建议已采纳，流转至业务专家确认环节'
          : dec === '已驳回' ? '建议已驳回并记录理由，不纳入本期优化' : '已标记需修改，退回重新生成'
      })
    }
  },
  {
    url: '/api/promote/optimize/gray-release',
    method: 'post',
    timeout: delay(900, 1700),
    response: ({ body }: any) =>
      ok({
        success: true,
        optimizationId: body?.optimizationId,
        version: body?.version || 'v2.4.0-gray',
        trafficRatio: body?.trafficRatio || 20,
        startTime: dt(0, 0, 0),
        observeDays: 7,
        rollbackSupported: true,
        message: `已按 ${body?.trafficRatio || 20}% 流量灰度发布，观察期 7 天，指标异常可一键回滚`
      })
  },
  {
    url: '/api/promote/optimize/full-release',
    method: 'post',
    timeout: delay(900, 1700),
    response: ({ body }: any) =>
      ok({
        success: true,
        version: body?.version || 'v2.4.0',
        releaseTime: dt(0, 0, 0),
        previousVersion: 'v2.3.1',
        message: `${body?.version || 'v2.4.0'} 已全量生效，历史版本保留可回滚`
      })
  },
  {
    url: '/api/promote/optimize/rollback',
    method: 'post',
    timeout: delay(700, 1400),
    response: ({ body }: any) =>
      ok({
        success: true,
        rollbackTo: body?.version || 'v2.3.0',
        rollbackTime: dt(0, 0, 0),
        message: `已回滚至 ${body?.version || 'v2.3.0'}，规则与模型参数同步还原`
      })
  },

  /* ============ 3.3.3 准确率监控（M40） ============ */
  {
    url: '/api/promote/monitor',
    method: 'get',
    timeout: delay(240, 500),
    response: ({ query }: any) => {
      const { modelVersion } = query
      if (modelVersion && modelVersion !== MONITOR.modelVersion) {
        const cmp = MONITOR.modelComparison.find((c) => c.version === modelVersion)
        if (cmp) {
          return ok({
            ...MONITOR,
            modelVersion,
            overallMetrics: {
              ...MONITOR.overallMetrics,
              accuracy: cmp.accuracy,
              f1Score: cmp.f1,
              falsePositiveRate: cmp.fpr
            }
          })
        }
      }
      return ok({ ...MONITOR, monitorTime: dt(0, 4, 0), metricStatus: METRIC_STATUS })
    }
  },
  {
    url: '/api/promote/monitor/alert/handle',
    method: 'post',
    timeout: delay(320, 640),
    response: ({ body }: any) =>
      ok({
        success: true,
        alertId: body?.alertId,
        handled: true,
        handler: '模型运营组',
        handleTime: dt(0, 0, 0),
        action: body?.action || '已生成优化建议并纳入下一轮迭代',
        message: '预警已处置，已关联至模型优化建议流程'
      })
  },
  {
    url: '/api/promote/monitor/evaluate',
    method: 'post',
    timeout: delay(1400, 2400),
    response: () =>
      ok({
        success: true,
        monitorId: `MON2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        monitorTime: dt(0, 0, 0),
        accuracy: MONITOR.overallMetrics.accuracy,
        falsePositiveRate: MONITOR.overallMetrics.falsePositiveRate,
        alertCount: MONITOR.alerts.filter((a) => !a.handled).length,
        message: '月度全量评估完成，指标已刷新，共 2 项预警待处置'
      })
  },

  /* ============ 3.4.1 宣教素材生成（M41） ============ */
  {
    url: '/api/promote/material/stats',
    method: 'get',
    timeout: delay(180, 380),
    response: () =>
      ok({
        materialTotal: PROMOTE_STATS.materialTotal,
        materialPublished: PROMOTE_STATS.materialPublished,
        materialPending: PROMOTE_STATS.materialPending,
        typeDist: PROMOTE_STATS.materialTypeDist,
        materialTypes: MATERIAL_TYPES,
        typeMeta: MATERIAL_TYPE_META,
        statusList: MATERIAL_STATUS,
        audiences: AUDIENCES,
        formats: MATERIAL_FORMATS,
        formatDist: MATERIAL_FORMATS.map((f) => ({
          name: f,
          value: EDU_MATERIALS.filter((m) => m.format.type === f).length
        })).filter((x) => x.value > 0),
        totalRead: EDU_MATERIALS.reduce((s, m) => s + m.stats.read, 0),
        avgScore: Number(
          (
            EDU_MATERIALS.filter((m) => m.stats.score > 0).reduce((s, m) => s + m.stats.score, 0) /
            (EDU_MATERIALS.filter((m) => m.stats.score > 0).length || 1)
          ).toFixed(2)
        )
      })
  },
  {
    url: '/api/promote/material/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, materialType, status, audience, format, page = 1, pageSize = 12 } = query
      let list = [...EDU_MATERIALS]
      if (materialType) list = list.filter((m) => m.materialType === materialType)
      if (status) list = list.filter((m) => m.status === status)
      if (audience) list = list.filter((m) => m.audience.includes(audience))
      if (format) list = list.filter((m) => m.format.type === format)
      if (keyword) {
        list = list.filter((m) =>
          m.materialId.includes(keyword) || m.materialName.includes(keyword) || m.content.title.includes(keyword)
        )
      }
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/material/detail',
    method: 'get',
    timeout: delay(170, 350),
    response: ({ query }: any) => ok(EDU_MATERIAL_MAP[query.materialId] || EDU_MATERIALS[0])
  },
  {
    url: '/api/promote/material/generate',
    method: 'post',
    timeout: delay(1500, 2600),
    response: ({ body }: any) => {
      const type = body?.materialType || '典型案例'
      const meta = MATERIAL_TYPE_META[type] || MATERIAL_TYPE_META['典型案例']
      return ok({
        success: true,
        materialId: `MAT2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        materialType: type,
        title: meta.prefix + (body?.topic || '医保基金合规要点提示'),
        generateMode: 'AI生成+人工审核',
        aiVersion: 'education-v1.2',
        generateTime: dt(0, 0, 0),
        status: '待审核',
        audience: meta.audience,
        wordCount: rndInt(680, 1800),
        desensitized: true,
        desensitizedFields: ['机构名称', '人员姓名', '详细地址', '联系方式', '身份证号'],
        message: 'AI 素材已生成并完成脱敏（机构名称、人员姓名、敏感信息），请宣传科审核后发布'
      })
    }
  },
  {
    url: '/api/promote/material/review',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) => {
      const r = body?.result || '通过'
      return ok({
        success: true,
        materialId: body?.materialId,
        result: r,
        status: r === '通过' ? '已发布' : '已驳回',
        reviewer: '宣传科 张岚',
        reviewTime: dt(0, 0, 0),
        publishTime: r === '通过' ? dt(0, 0, 0) : null,
        message: r === '通过' ? '素材审核通过并已发布，可发起多端推送' : '素材已驳回，请修改后重新提交'
      })
    }
  },

  /* ============ 3.4.2 多端分类推送（M42） ============ */
  {
    url: '/api/promote/push/stats',
    method: 'get',
    timeout: delay(180, 380),
    response: () =>
      ok({
        pushTotal: PROMOTE_STATS.pushTotal,
        pushDone: PROMOTE_STATS.pushDone,
        scheduledTotal: PROMOTE_STATS.scheduledTotal,
        scheduledEnabled: PROMOTE_STATS.scheduledEnabled,
        ends: PUSH_ENDS,
        scheduledPushes: SCHEDULED_PUSHES,
        endStat: PUSH_ENDS.map((pe) => {
          const arr = PUSH_RECORDS.flatMap((p) => p.targets).filter((t) => t.end === pe.end && t.readCount > 0)
          return {
            end: pe.end,
            tone: pe.tone,
            icon: pe.icon,
            pushCount: arr.length,
            totalSuccess: arr.reduce((s, t) => s + t.successCount, 0),
            totalRead: arr.reduce((s, t) => s + t.readCount, 0),
            avgReadRate: arr.length ? Number((arr.reduce((s, t) => s + t.readRate, 0) / arr.length).toFixed(3)) : 0
          }
        }),
        channelStat: EDU_STATS.byChannel
      })
  },
  {
    url: '/api/promote/push/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, end, page = 1, pageSize = 10 } = query
      let list = [...PUSH_RECORDS]
      if (status) list = list.filter((p) => p.status === status)
      if (end) list = list.filter((p) => p.targets.some((t) => t.end === end && t.successCount > 0))
      if (keyword) list = list.filter((p) => p.pushId.includes(keyword) || p.pushName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/promote/push/detail',
    method: 'get',
    timeout: delay(170, 350),
    response: ({ query }: any) => ok(PUSH_RECORD_MAP[query.pushId] || PUSH_RECORDS[0])
  },
  {
    url: '/api/promote/push/send',
    method: 'post',
    timeout: delay(1200, 2200),
    response: ({ body }: any) => {
      const ends: string[] = body?.ends || ['医院端', '医保端', '公众端']
      const results = ends.map((e) => {
        const pe = PUSH_ENDS.find((x) => x.end === e) || PUSH_ENDS[0]
        const succ = pe.end === '公众端' ? 520000 - rndInt(600, 1600) : pe.targetCount
        return { end: e, targetCount: pe.targetCount, successCount: succ, failCount: pe.end === '公众端' ? rndInt(800, 1600) : 0, channels: [...pe.channels] }
      })
      const totalSuccess = results.reduce((s, r) => s + r.successCount, 0)
      return ok({
        success: true,
        pushId: `PUSH2026${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(rndInt(1, 9999), 4)}`,
        pushTime: dt(0, 0, 0),
        status: '推送完成',
        results,
        totalSuccess,
        totalFail: results.reduce((s, r) => s + r.failCount, 0),
        message: `多端推送完成：共触达 ${totalSuccess.toLocaleString()} 个对象，已按端分类投放对应内容`
      })
    }
  },
  {
    url: '/api/promote/push/schedule/toggle',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        id: body?.id,
        status: body?.enabled ? '已启用' : '已停用',
        nextRun: body?.enabled ? dt(3, 10, 0) : null,
        message: body?.enabled ? '定时推送已启用，将按计划自动执行' : '定时推送已停用'
      })
  },
  {
    url: '/api/promote/push/schedule/save',
    method: 'post',
    timeout: delay(340, 680),
    response: ({ body }: any) =>
      ok({
        success: true,
        id: body?.id || `SCH${pad(rndInt(1, 999), 3)}`,
        name: body?.name,
        schedule: body?.schedule,
        target: body?.target,
        status: '已启用',
        nextRun: dt(2, 10, 0),
        message: '定时推送任务已保存并启用'
      })
  },

  /* ============ 3.4.3 宣教效果统计（M43） ============ */
  {
    url: '/api/promote/edu-stats',
    method: 'get',
    timeout: delay(240, 500),
    response: ({ query }: any) => {
      const { statsPeriod } = query
      return ok({ ...EDU_STATS, statsPeriod: statsPeriod || EDU_STATS.statsPeriod })
    }
  },
  {
    url: '/api/promote/edu-stats/export',
    method: 'post',
    timeout: delay(600, 1200),
    response: () =>
      ok({
        success: true,
        statsId: EDU_STATS.statsId,
        reportUrl: EDU_STATS.reportUrl,
        format: 'PDF',
        exportTime: dt(0, 0, 0),
        message: '宣教效果统计报表已生成，正在下载'
      })
  },

  /* ============ 字典 ============ */
  {
    url: '/api/promote/dicts',
    method: 'get',
    timeout: delay(100, 220),
    response: () =>
      ok({
        gradeStandard: GRADE_STANDARD,
        scoreDimensions: SCORE_DIMENSIONS,
        reviewTriggers: REVIEW_TRIGGERS,
        problemCategories: PROBLEM_CATEGORIES,
        severities: SEVERITIES,
        rootCauseTypes: ROOT_CAUSE_TYPES,
        priorities: PRIORITIES,
        measureDepts: MEASURE_DEPTS,
        reviewReportTypes: REVIEW_REPORT_TYPES,
        reportStatus: REPORT_STATUS,
        confidentiality: CONFIDENTIALITY,
        analysisDimensions: ANALYSIS_DIMENSIONS,
        analysisMethods: ANALYSIS_METHODS,
        analysisReportTypes: ANALYSIS_REPORT_TYPES,
        sampleTypes: SAMPLE_TYPES,
        featureTypes: FEATURE_TYPES,
        feedbackStatus: FEEDBACK_STATUS,
        suggestionTypes: SUGGESTION_TYPES,
        metricStatus: METRIC_STATUS,
        materialTypes: MATERIAL_TYPES,
        materialStatus: MATERIAL_STATUS,
        audiences: AUDIENCES,
        materialFormats: MATERIAL_FORMATS,
        pushEnds: PUSH_ENDS
      })
  }
] as MockMethod[]
