import { get, post } from '../request'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

/* ===== 3.1 文书模板库 ===== */
export const getTemplateStats = () => get<any>('/docgen/template/stats')
export const getTemplateList = (params?: any) => get<any>('/docgen/template/list', params)
export const getTemplateDetail = (templateId: any) => get<any>('/docgen/template/detail', p(templateId, 'templateId'))
export const getTemplateEditable = (templateId: any) => get<any>('/docgen/template/editable', p(templateId, 'templateId'))
export const saveTemplate = (data: any) => post<any>('/docgen/template/save', data)
export const rollbackTemplate = (data: any) => post<any>('/docgen/template/rollback', data)

/* ===== 3.2 文书智能生成 ===== */
export const getDocStats = () => get<any>('/docgen/doc/stats')
export const getDocList = (params?: any) => get<any>('/docgen/doc/list', params)
export const getDocDetail = (documentId: any) => get<any>('/docgen/doc/detail', p(documentId, 'documentId'))
export const generateDoc = (data: any) => post<any>('/docgen/doc/generate', data)
export const runAiWrite = (data: any) => post<any>('/docgen/doc/ai-write', data)
export const getAiWriting = (documentId: any) => get<any>('/docgen/doc/ai-writing', p(documentId, 'documentId'))
export const reviewAiDraft = (data: any) => post<any>('/docgen/doc/review-ai', data)

/** 文号管理 */
export const getDocNoStats = () => get<any>('/docgen/docno/stats')
export const preOccupyDocNo = (data: any) => post<any>('/docgen/docno/preoccupy', data)
export const voidDocNo = (data: any) => post<any>('/docgen/docno/void', data)

/** 批量生成 */
export const getBatchList = (params?: any) => get<any>('/docgen/batch/list', params)
export const getBatchDetail = (batchId: any) => get<any>('/docgen/batch/detail', p(batchId, 'batchId'))
export const createBatch = (data: any) => post<any>('/docgen/batch/create', data)
export const batchReview = (data: any) => post<any>('/docgen/batch/review', data)
export const batchExport = (data: any) => post<any>('/docgen/batch/export', data)

/* ===== 3.3 智能校对 ===== */
export const getProofreadStats = () => get<any>('/docgen/proofread/stats')
export const getLegalProofread = (documentId: any) => get<any>('/docgen/proofread/legal', p(documentId, 'documentId'))
export const getTextProofread = (documentId: any) => get<any>('/docgen/proofread/text', p(documentId, 'documentId'))
export const runProofread = (data: any) => post<any>('/docgen/proofread/run', data)
export const oneClickFix = (data: any) => post<any>('/docgen/proofread/one-click-fix', data)
export const confirmProofread = (data: any) => post<any>('/docgen/proofread/confirm', data)

/* ===== 3.4 签章与送达 ===== */
export const getSignStats = () => get<any>('/docgen/sign/stats')
export const getSignList = (params?: any) => get<any>('/docgen/sign/list', params)
export const getSignDetail = (params: any) => get<any>('/docgen/sign/detail', p(params, 'signId'))
export const applySign = (data: any) => post<any>('/docgen/sign/apply', data)
export const doSign = (data: any) => post<any>('/docgen/sign/do-sign', data)

export const getDeliveryList = (params?: any) => get<any>('/docgen/delivery/list', params)
export const getDeliveryDetail = (deliveryId: any) => get<any>('/docgen/delivery/detail', p(deliveryId, 'deliveryId'))
export const sendDelivery = (data: any) => post<any>('/docgen/delivery/send', data)
export const retryDelivery = (data: any) => post<any>('/docgen/delivery/retry', data)
export const genReceipt = (data: any) => post<any>('/docgen/delivery/receipt', data)

export const getExportList = (params?: any) => get<any>('/docgen/export/list', params)
export const doExportDoc = (data: any) => post<any>('/docgen/export/do', data)

/* ===== 3.5 证据全链管理 ===== */
export const getEvidenceStats = () => get<any>('/docgen/evidence/stats')
export const getEvidenceList = (params?: any) => get<any>('/docgen/evidence/list', params)
export const getEvidenceDetail = (evidenceId: any) => get<any>('/docgen/evidence/detail', p(evidenceId, 'evidenceId'))
export const collectEvidence = (data: any) => post<any>('/docgen/evidence/collect', data)
export const getEvidenceChain = (caseId: any) => get<any>('/docgen/evidence/chain', p(caseId, 'caseId'))
export const getTamperExports = (params?: any) => get<any>('/docgen/evidence/tamper-export', params)
export const doTamperExport = (data: any) => post<any>('/docgen/evidence/tamper-export/do', data)
export const verifyEvidencePackage = (data: any) => post<any>('/docgen/evidence/verify', data)

/* ===== 3.6 案卷归档 ===== */
export const getCaseFileStats = () => get<any>('/docgen/casefile/stats')
export const getCaseFileList = (params?: any) => get<any>('/docgen/casefile/list', params)
export const getCaseFileDetail = (caseFileId: any) => get<any>('/docgen/casefile/detail', p(caseFileId, 'caseFileId'))
export const assembleCaseFile = (data: any) => post<any>('/docgen/casefile/assemble', data)
export const archiveCaseFile = (data: any) => post<any>('/docgen/casefile/archive', data)

export const getBorrowList = (params?: any) => get<any>('/docgen/borrow/list', params)
export const applyBorrow = (data: any) => post<any>('/docgen/borrow/apply', data)
export const approveBorrow = (data: any) => post<any>('/docgen/borrow/approve', data)
export const returnBorrow = (data: any) => post<any>('/docgen/borrow/return', data)

export const getScanList = (params?: any) => get<any>('/docgen/scan/list', params)
export const uploadScan = (data: any) => post<any>('/docgen/scan/upload', data)

/* ===== 字典 ===== */
export const getDocGenDicts = () => get<any>('/docgen/dicts')
