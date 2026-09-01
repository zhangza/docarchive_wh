import type { MockMethod } from 'vite-plugin-mock'
import { ok, delay, paginate } from '../shared/utils'
import {
  DOC_TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_EDITABLE, DOC_TYPE_CODES,
  GEN_DOCS, GEN_DOC_MAP, buildAiWriting, DOC_NO_STATS, VOID_DOC_NOS, BATCH_TASKS,
  buildLegalProofread, buildTextProofread,
  SIGN_RECORDS, SEAL_LOGS, DELIVERY_RECORDS, EXPORT_RECORDS,
  EVIDENCES, EVIDENCE_KINDS, buildEvidenceChain, TAMPER_PROOF_EXPORTS,
  CASE_FILES, BORROW_RECORDS, SCAN_TASKS,
  DOC_STATS, DOC_STATUS, DELIVERY_METHODS, DELIVERY_STATUS,
  EXPORT_FORMATS, ARCHIVE_STATUS, BORROW_STATUS, SEAL_TYPES, SIGN_ROLES, ISSUE_LEVELS
} from '../shared/data/legalDocs'
import { pad, rndInt, dt } from '../shared/data/base'

export default [
  /* ============ 3.1 文书模板库 ============ */
  {
    url: '/api/docgen/template/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        templateTotal: DOC_STATS.templateTotal,
        templateEffective: DOC_STATS.templateEffective,
        categoryDist: DOC_STATS.categoryDist,
        templateUseTop: DOC_STATS.templateUseTop,
        categories: TEMPLATE_CATEGORIES,
        lastUpdate: '2026-08-15'
      })
  },
  {
    url: '/api/docgen/template/list',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, categoryId, status, docType, page = 1, pageSize = 15 } = query
      let list = [...DOC_TEMPLATES]
      if (categoryId) list = list.filter((t) => t.categoryId === categoryId)
      if (status) list = list.filter((t) => t.status === status)
      if (docType) list = list.filter((t) => t.docType === docType)
      if (keyword) list = list.filter((t) => t.templateName.includes(keyword) || t.templateId.includes(keyword) || t.docType.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/template/detail',
    method: 'get',
    timeout: delay(140, 300),
    response: ({ query }: any) => ok(DOC_TEMPLATES.find((t) => t.templateId === query.templateId) || DOC_TEMPLATES[0])
  },
  {
    url: '/api/docgen/template/editable',
    method: 'get',
    timeout: delay(130, 280),
    response: ({ query }: any) => {
      const t = DOC_TEMPLATES.find((x) => x.templateId === query.templateId) || DOC_TEMPLATES[0]
      return ok({
        templateId: t.templateId,
        templateName: t.templateName,
        currentVersion: t.version,
        maintainer: t.maintainer,
        lastMaintainTime: t.lastMaintainTime,
        editableElements: {
          ...TEMPLATE_EDITABLE,
          header: { ...TEMPLATE_EDITABLE.header, docName: t.templateName },
          docNoFormat: {
            ...TEMPLATE_EDITABLE.docNoFormat,
            prefix: `芜医保${t.docTypeCode}`,
            example: `芜医保${t.docTypeCode}〔2026〕012号`
          }
        },
        versionHistory: t.versionHistory,
        pendingApproval: null
      })
    }
  },
  {
    url: '/api/docgen/template/save',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        templateId: body?.templateId,
        newVersion: body?.newVersion || 'v2.2',
        status: '审批中',
        approver: '法规科 · 陈科长',
        message: '模板修改已提交审批，审批通过后生效，生效前不影响在用文书'
      })
  },
  {
    url: '/api/docgen/template/rollback',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, templateId: body?.templateId, version: body?.version, message: `已回滚至版本 ${body?.version}` })
  },

  /* ============ 3.2 文书智能生成 ============ */
  {
    url: '/api/docgen/doc/stats',
    method: 'get',
    timeout: delay(200, 400),
    response: () =>
      ok({
        docTotal: DOC_STATS.docTotal,
        docByStatus: DOC_STATS.docByStatus,
        docByType: DOC_STATS.docByType,
        aiGeneratedCount: DOC_STATS.aiGeneratedCount,
        aiRate: DOC_STATS.aiRate,
        avgQuality: DOC_STATS.avgQuality,
        fillCompleteRate: DOC_STATS.fillCompleteRate,
        monthTrend: DOC_STATS.monthTrend
      })
  },
  {
    url: '/api/docgen/doc/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, docType, status, district, aiOnly, page = 1, pageSize = 15 } = query
      let list = [...GEN_DOCS]
      if (docType) list = list.filter((g) => g.docType === docType)
      if (status) list = list.filter((g) => g.status === status)
      if (district) list = list.filter((g) => g.district === district)
      if (aiOnly === 'true') list = list.filter((g) => g.aiGenerated)
      if (keyword) {
        list = list.filter((g) =>
          g.documentId.includes(keyword) || g.docNo.includes(keyword) ||
          g.documentName.includes(keyword) || g.orgName.includes(keyword) || g.caseId.includes(keyword)
        )
      }
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/doc/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(GEN_DOC_MAP[query.documentId] || GEN_DOCS[0])
  },
  {
    url: '/api/docgen/doc/generate',
    method: 'post',
    timeout: delay(600, 1200),
    response: ({ body }: any) => {
      const t = DOC_TYPE_CODES.find((x) => x.templateId === body?.templateId) || DOC_TYPE_CODES[0]
      return ok({
        success: true,
        documentId: `DOC2026${pad(rndInt(1, 9999), 4)}`,
        docNo: `芜医保${t.code}〔2026〕${pad(rndInt(1, 200), 3)}号`,
        docType: t.docType,
        generateMode: '自动填充+AI撰写',
        generateTime: dt(0, 0, 0),
        fillValidation: { totalFields: 28, filledFields: 28, missingFields: [], status: '填充完整' },
        message: '文书已生成，数据自动填充完成，可进入 AI 撰写与校对环节'
      })
    }
  },
  {
    url: '/api/docgen/doc/ai-write',
    method: 'post',
    timeout: delay(900, 1800),
    response: ({ body }: any) => {
      const g = GEN_DOC_MAP[body?.documentId] || GEN_DOCS[0]
      return ok(buildAiWriting(g))
    }
  },
  {
    url: '/api/docgen/doc/ai-writing',
    method: 'get',
    timeout: delay(200, 420),
    response: ({ query }: any) => {
      const g = GEN_DOC_MAP[query.documentId] || GEN_DOCS[0]
      return ok(buildAiWriting(g))
    }
  },
  {
    url: '/api/docgen/doc/review-ai',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        documentId: body?.documentId,
        result: body?.result || '通过（有修改）',
        reviewer: '稽核员·王振华',
        reviewTime: dt(0, 0, 0),
        message: body?.result === '退回修改' ? '已退回，请修改后重新提交审核' : 'AI 初稿已审核确认，可进入智能校对环节'
      })
  },

  /* ---- 文号管理 ---- */
  {
    url: '/api/docgen/docno/stats',
    method: 'get',
    timeout: delay(160, 340),
    response: () => ok({ stats: DOC_NO_STATS, voidRecords: VOID_DOC_NOS, orgCode: '芜医保', year: 2026, docTypeCodes: DOC_TYPE_CODES })
  },
  {
    url: '/api/docgen/docno/preoccupy',
    method: 'post',
    timeout: delay(250, 500),
    response: ({ body }: any) => {
      const t = DOC_TYPE_CODES.find((x) => x.docType === body?.docType) || DOC_TYPE_CODES[0]
      const s = DOC_NO_STATS.find((x) => x.docTypeCode === t.code)
      return ok({
        success: true,
        docNo: `芜医保${t.code}〔2026〕${s?.nextSerialNo || '001'}号`,
        status: '预占',
        preOccupyTime: dt(0, 0, 0),
        message: '文号已预占，审核通过后正式生效，审核不通过将释放'
      })
    }
  },
  {
    url: '/api/docgen/docno/void',
    method: 'post',
    timeout: delay(250, 500),
    response: ({ body }: any) =>
      ok({
        success: true,
        docNo: body?.docNo,
        status: '作废',
        voidTime: dt(0, 0, 0),
        message: '文号已作废并保留记录，该号段不回收以避免重号'
      })
  },

  /* ---- 批量生成 ---- */
  {
    url: '/api/docgen/batch/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, documentType, page = 1, pageSize = 10 } = query
      let list = [...BATCH_TASKS]
      if (status) list = list.filter((b) => b.status === status)
      if (documentType) list = list.filter((b) => b.documentType === documentType)
      if (keyword) list = list.filter((b) => b.batchId.includes(keyword) || b.batchName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/batch/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(BATCH_TASKS.find((b) => b.batchId === query.batchId) || BATCH_TASKS[0])
  },
  {
    url: '/api/docgen/batch/create',
    method: 'post',
    timeout: delay(900, 1800),
    response: ({ body }: any) => {
      const total = (body?.taskIds || []).length || rndInt(4, 12)
      const fail = Math.random() < 0.4 ? 1 : 0
      return ok({
        success: true,
        batchId: `BATCH2026${pad(rndInt(1, 9999), 4)}`,
        totalSelected: total,
        successCount: total - fail,
        failCount: fail,
        status: fail ? '部分失败' : '已完成',
        message: `批量生成完成：成功 ${total - fail} 份，失败 ${fail} 份${fail ? '（数据不完整的案件已跳过）' : ''}`
      })
    }
  },
  {
    url: '/api/docgen/batch/review',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, batchId: body?.batchId, reviewed: body?.documentIds?.length || 0, message: '批量审核通过，已进入签章环节' })
  },
  {
    url: '/api/docgen/batch/export',
    method: 'post',
    timeout: delay(500, 1000),
    response: ({ body }: any) =>
      ok({ success: true, batchId: body?.batchId, format: 'ZIP打包(PDF)', message: '批量导出包已生成，正在下载' })
  },

  /* ============ 3.3 智能校对 ============ */
  {
    url: '/api/docgen/proofread/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        proofreadTotal: DOC_STATS.proofreadTotal,
        totalErrors: DOC_STATS.totalErrors,
        totalWarnings: DOC_STATS.totalWarnings,
        totalTips: DOC_STATS.totalTips,
        issueTypeDist: DOC_STATS.issueTypeDist,
        issueLevels: ISSUE_LEVELS
      })
  },
  {
    url: '/api/docgen/proofread/legal',
    method: 'get',
    timeout: delay(700, 1400),
    response: ({ query }: any) => {
      const g = GEN_DOC_MAP[query.documentId] || GEN_DOCS[0]
      return ok(buildLegalProofread(g))
    }
  },
  {
    url: '/api/docgen/proofread/text',
    method: 'get',
    timeout: delay(700, 1400),
    response: ({ query }: any) => {
      const g = GEN_DOC_MAP[query.documentId] || GEN_DOCS[0]
      return ok(buildTextProofread(g))
    }
  },
  {
    url: '/api/docgen/proofread/run',
    method: 'post',
    timeout: delay(1000, 2000),
    response: ({ body }: any) => {
      const g = GEN_DOC_MAP[body?.documentId] || GEN_DOCS[0]
      const legal = buildLegalProofread(g)
      const text = buildTextProofread(g)
      return ok({
        documentId: g.documentId,
        legal,
        text,
        summary: {
          totalIssues: legal.summary.warning + legal.summary.error + text.summary.totalIssues,
          errors: legal.summary.error + text.summary.errors,
          warnings: legal.summary.warning + text.summary.warnings,
          tips: text.summary.tips
        },
        message: '智能校对完成（法条引用 + 要素与文字）'
      })
    }
  },
  {
    url: '/api/docgen/proofread/one-click-fix',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) =>
      ok({
        success: true,
        documentId: body?.documentId,
        fixedCount: body?.items?.length || rndInt(1, 4),
        message: '明显错误已一键修正，请复核修正结果'
      })
  },
  {
    url: '/api/docgen/proofread/confirm',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        documentId: body?.documentId,
        confirmer: '法制人员·陈立',
        confirmTime: dt(0, 0, 0),
        message: '校对结果已人工确认，文书可进入签章环节'
      })
  },

  /* ============ 3.4 签章与送达 ============ */
  {
    url: '/api/docgen/sign/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        signTotal: DOC_STATS.signTotal,
        deliveryTotal: DOC_STATS.deliveryTotal,
        deliveryByStatus: DOC_STATS.deliveryByStatus,
        signedRate: DOC_STATS.signedRate,
        exportTotal: DOC_STATS.exportTotal,
        exportFormatDist: DOC_STATS.exportFormatDist,
        sealLogs: SEAL_LOGS,
        sealTypes: SEAL_TYPES,
        signRoles: SIGN_ROLES,
        deliveryMethods: DELIVERY_METHODS
      })
  },
  {
    url: '/api/docgen/sign/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, page = 1, pageSize = 15 } = query
      let list = [...SIGN_RECORDS]
      if (status) list = list.filter((s) => s.status === status)
      if (keyword) list = list.filter((s) => s.signId.includes(keyword) || s.docNo.includes(keyword) || s.documentName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/sign/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) =>
      ok(SIGN_RECORDS.find((s) => s.signId === query.signId || s.documentId === query.documentId) || SIGN_RECORDS[0])
  },
  {
    url: '/api/docgen/sign/apply',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) =>
      ok({
        success: true,
        signId: `SIGN2026${pad(rndInt(1, 9999), 4)}`,
        documentId: body?.documentId,
        applyTime: dt(0, 0, 0),
        status: '待签章',
        message: '签章申请已发起，请按流程逐级签章'
      })
  },
  {
    url: '/api/docgen/sign/do-sign',
    method: 'post',
    timeout: delay(600, 1200),
    response: ({ body }: any) =>
      ok({
        success: true,
        signId: body?.signId,
        step: body?.step,
        signTime: dt(0, 0, 0),
        authMethod: body?.signType === '单位电子印章' ? '密码+短信验证码+人脸识别' : '密码+短信验证码',
        fileHash: Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
        blockchainId: `BC20260920${pad(rndInt(1, 999999), 6)}`,
        message: '签章成功，文书已固化并上链存证；后续任何修改都会使签章失效'
      })
  },

  /* ---- 电子送达 ---- */
  {
    url: '/api/docgen/delivery/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, method, page = 1, pageSize = 15 } = query
      let list = [...DELIVERY_RECORDS]
      if (status) list = list.filter((r) => r.status === status)
      if (method) list = list.filter((r) => r.deliveryMethods.includes(method))
      if (keyword) list = list.filter((r) => r.deliveryId.includes(keyword) || r.docNo.includes(keyword) || r.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/delivery/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) =>
      ok(DELIVERY_RECORDS.find((r) => r.deliveryId === query.deliveryId) || DELIVERY_RECORDS[0])
  },
  {
    url: '/api/docgen/delivery/send',
    method: 'post',
    timeout: delay(500, 1000),
    response: ({ body }: any) =>
      ok({
        success: true,
        deliveryId: `DEL2026${pad(rndInt(1, 9999), 4)}`,
        documentId: body?.documentId,
        deliveryMethods: body?.methods || ['电子送达', '短信通知', '邮件送达'],
        sendTime: dt(0, 0, 0),
        status: '已发送',
        message: '文书已送达，未签收的自送达之日起 5 个工作日后视为送达'
      })
  },
  {
    url: '/api/docgen/delivery/retry',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) =>
      ok({ success: true, deliveryId: body?.deliveryId, retryTime: dt(0, 0, 0), message: '已重新发起送达，并同步启动邮寄送达' })
  },
  {
    url: '/api/docgen/delivery/receipt',
    method: 'post',
    timeout: delay(400, 800),
    response: ({ body }: any) =>
      ok({
        success: true,
        deliveryId: body?.deliveryId,
        receiptId: `REC2026${pad(rndInt(1, 9999), 4)}`,
        generateTime: dt(0, 0, 0),
        message: '送达回证已生成，可导出归入案卷'
      })
  },

  /* ---- 多格式导出 ---- */
  {
    url: '/api/docgen/export/list',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, format, page = 1, pageSize = 10 } = query
      let list = [...EXPORT_RECORDS]
      if (format) list = list.filter((r) => r.format === format)
      if (keyword) list = list.filter((r) => r.exportId.includes(keyword) || r.documentName.includes(keyword) || r.docNo.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/export/do',
    method: 'post',
    timeout: delay(500, 1000),
    response: ({ body }: any) =>
      ok({
        success: true,
        exportId: `EXP2026${pad(rndInt(1, 9999), 4)}`,
        documentId: body?.documentId,
        format: body?.format || 'PDF',
        withSeal: !!body?.withSeal,
        watermark: body?.watermark || '无',
        exportTime: dt(0, 0, 0),
        message: `已导出 ${body?.format || 'PDF'} 格式文书`
      })
  },

  /* ============ 3.5 证据全链管理 ============ */
  {
    url: '/api/docgen/evidence/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        evidenceTotal: DOC_STATS.evidenceTotal,
        evidenceByKind: DOC_STATS.evidenceByKind,
        sealedCount: DOC_STATS.sealedCount,
        chainCount: DOC_STATS.chainCount,
        tamperExportTotal: DOC_STATS.tamperExportTotal,
        evidenceKinds: EVIDENCE_KINDS
      })
  },
  {
    url: '/api/docgen/evidence/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, evidenceKind, status, caseId, sealed, page = 1, pageSize = 15 } = query
      let list = [...EVIDENCES]
      if (evidenceKind) list = list.filter((e) => e.evidenceKind === evidenceKind)
      if (status) list = list.filter((e) => e.status === status)
      if (caseId) list = list.filter((e) => e.caseId === caseId)
      if (sealed === 'true') list = list.filter((e) => e.sealed)
      if (keyword) list = list.filter((e) => e.evidenceId.includes(keyword) || e.evidenceName.includes(keyword) || e.orgName.includes(keyword) || e.evidenceNo.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/evidence/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(EVIDENCES.find((e) => e.evidenceId === query.evidenceId) || EVIDENCES[0])
  },
  {
    url: '/api/docgen/evidence/collect',
    method: 'post',
    timeout: delay(700, 1400),
    response: ({ body }: any) =>
      ok({
        success: true,
        caseId: body?.caseId,
        collected: rndInt(12, 48),
        byKind: EVIDENCE_KINDS.map((k) => ({ kind: k.kind, count: rndInt(0, 12) })).filter((x) => x.count > 0),
        message: '证据已自动归集并按法定种类分类，哈希已固化'
      })
  },
  {
    url: '/api/docgen/evidence/chain',
    method: 'get',
    timeout: delay(600, 1200),
    response: ({ query }: any) => ok(buildEvidenceChain(query.caseId || EVIDENCES[0].caseId))
  },
  {
    url: '/api/docgen/evidence/tamper-export',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { page = 1, pageSize = 10 } = query
      return ok(paginate([...TAMPER_PROOF_EXPORTS], Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/evidence/tamper-export/do',
    method: 'post',
    timeout: delay(800, 1600),
    response: ({ body }: any) =>
      ok({
        success: true,
        exportId: `TPE2026${pad(rndInt(1, 9999), 4)}`,
        caseId: body?.caseId,
        evidenceCount: body?.evidenceIds?.length || rndInt(8, 42),
        format: body?.format || 'PDF（带证据专用章）',
        sealName: '芜湖市医疗保障局证据专用章',
        packageHash: Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
        hashAlgorithm: 'SHA-256',
        blockchainId: `BC20260920${pad(rndInt(1, 999999), 6)}`,
        queryUrl: 'https://blockchain.wuhu.gov.cn/verify',
        verifyReportId: `VR2026${pad(rndInt(1, 9999), 4)}`,
        exportTime: dt(0, 0, 0),
        message: '证据包已固化导出，已加盖证据专用章并上链存证，可凭存证号在线校验'
      })
  },
  {
    url: '/api/docgen/evidence/verify',
    method: 'post',
    timeout: delay(600, 1200),
    response: ({ body }: any) =>
      ok({
        success: true,
        exportId: body?.exportId,
        verifyStatus: '校验通过',
        verifyTime: dt(0, 0, 0),
        hashMatched: true,
        blockchainMatched: true,
        message: '哈希值与区块链存证一致，证据包未被篡改'
      })
  },

  /* ============ 3.6 案卷归档 ============ */
  {
    url: '/api/docgen/casefile/stats',
    method: 'get',
    timeout: delay(180, 360),
    response: () =>
      ok({
        caseFileTotal: DOC_STATS.caseFileTotal,
        archivedCount: DOC_STATS.archivedCount,
        totalPages: DOC_STATS.totalPages,
        scannedCount: DOC_STATS.scannedCount,
        borrowTotal: DOC_STATS.borrowTotal,
        borrowing: DOC_STATS.borrowing,
        borrowOverdue: DOC_STATS.borrowOverdue,
        scanTaskTotal: DOC_STATS.scanTaskTotal,
        scanDone: DOC_STATS.scanDone,
        statusDist: ARCHIVE_STATUS.map((s) => ({ name: s, value: CASE_FILES.filter((c) => c.status === s).length })).filter((x) => x.value > 0),
        borrowStatusDist: BORROW_STATUS.map((s) => ({ name: s, value: BORROW_RECORDS.filter((b) => b.status === s).length })).filter((x) => x.value > 0),
        monthTrend: DOC_STATS.monthTrend
      })
  },
  {
    url: '/api/docgen/casefile/list',
    method: 'get',
    timeout: delay(160, 340),
    response: ({ query }: any) => {
      const { keyword, status, district, page = 1, pageSize = 15 } = query
      let list = [...CASE_FILES]
      if (status) list = list.filter((c) => c.status === status)
      if (district) list = list.filter((c) => c.district === district)
      if (keyword) list = list.filter((c) => c.caseFileNo.includes(keyword) || c.archiveNo.includes(keyword) || c.caseName.includes(keyword) || c.orgName.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/casefile/detail',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => ok(CASE_FILES.find((c) => c.caseFileId === query.caseFileId) || CASE_FILES[0])
  },
  {
    url: '/api/docgen/casefile/assemble',
    method: 'post',
    timeout: delay(900, 1800),
    response: ({ body }: any) =>
      ok({
        success: true,
        caseFileId: `CF2026${pad(rndInt(1, 9999), 4)}`,
        caseFileNo: `芜医保档〔2026〕${pad(rndInt(1, 200), 3)}号`,
        archiveNo: `YJ-ZF-2026-${pad(rndInt(1, 200), 3)}`,
        materialCount: rndInt(14, 22),
        totalPages: rndInt(60, 260),
        assembleTime: dt(0, 0, 0),
        message: '案卷已按档案规范自动组装，目录与材料顺序已排列'
      })
  },
  {
    url: '/api/docgen/casefile/archive',
    method: 'post',
    timeout: delay(500, 1000),
    response: ({ body }: any) =>
      ok({
        success: true,
        caseFileId: body?.caseFileId,
        archiveTime: dt(0, 0, 0),
        archiver: '档案员·周敏',
        paperBoxNo: `2026-A-${pad(rndInt(1, 200), 3)}`,
        storageLocation: `档案室 A 区 ${rndInt(1, 12)} 排 ${rndInt(1, 40)} 号`,
        message: '案卷已归档，可按文号、机构、年度检索调阅'
      })
  },
  {
    url: '/api/docgen/borrow/list',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, status, page = 1, pageSize = 10 } = query
      let list = [...BORROW_RECORDS]
      if (status) list = list.filter((b) => b.status === status)
      if (keyword) list = list.filter((b) => b.borrowId.includes(keyword) || b.caseName.includes(keyword) || b.borrower.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/borrow/apply',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        borrowId: `BOR2026${pad(rndInt(1, 9999), 4)}`,
        caseFileId: body?.caseFileId,
        status: '审批中',
        applyTime: dt(0, 0, 0),
        message: '借阅申请已提交，等待档案员审批'
      })
  },
  {
    url: '/api/docgen/borrow/approve',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({
        success: true,
        borrowId: body?.borrowId,
        result: body?.result || '已批准',
        approver: '档案员·周敏',
        approveTime: dt(0, 0, 0),
        dueDate: dt(15, 18, 0).slice(0, 10),
        message: body?.result === '已驳回' ? '借阅申请已驳回' : '借阅申请已批准，请按期归还'
      })
  },
  {
    url: '/api/docgen/borrow/return',
    method: 'post',
    timeout: delay(300, 600),
    response: ({ body }: any) =>
      ok({ success: true, borrowId: body?.borrowId, returnTime: dt(0, 0, 0), message: '案卷已归还并核对完整性' })
  },
  {
    url: '/api/docgen/scan/list',
    method: 'get',
    timeout: delay(150, 320),
    response: ({ query }: any) => {
      const { keyword, status, page = 1, pageSize = 10 } = query
      let list = [...SCAN_TASKS]
      if (status) list = list.filter((s) => s.status === status)
      if (keyword) list = list.filter((s) => s.scanId.includes(keyword) || s.caseName.includes(keyword) || s.barcodeNo.includes(keyword))
      return ok(paginate(list, Number(page), Number(pageSize)))
    }
  },
  {
    url: '/api/docgen/scan/upload',
    method: 'post',
    timeout: delay(900, 1800),
    response: ({ body }: any) =>
      ok({
        success: true,
        scanId: body?.scanId || `SCAN2026${pad(rndInt(1, 9999), 4)}`,
        scannedPages: rndInt(10, 60),
        ocrStatus: '识别完成',
        ocrAccuracy: rndInt(88, 99),
        recognizedCategories: ['行政处罚决定书', '送达回证', '询问笔录', '证据清单'],
        linkedElectronic: true,
        message: '纸质材料已扫描上传，OCR 已识别分类并自动关联电子案卷'
      })
  },

  /* ============ 字典 ============ */
  {
    url: '/api/docgen/dicts',
    method: 'get',
    timeout: delay(100, 220),
    response: () =>
      ok({
        docTypeCodes: DOC_TYPE_CODES,
        templateCategories: TEMPLATE_CATEGORIES,
        evidenceKinds: EVIDENCE_KINDS,
        docStatus: DOC_STATUS,
        deliveryMethods: DELIVERY_METHODS,
        deliveryStatus: DELIVERY_STATUS,
        exportFormats: EXPORT_FORMATS,
        archiveStatus: ARCHIVE_STATUS,
        borrowStatus: BORROW_STATUS,
        sealTypes: SEAL_TYPES,
        signRoles: SIGN_ROLES,
        issueLevels: ISSUE_LEVELS
      })
  }
] as MockMethod[]
