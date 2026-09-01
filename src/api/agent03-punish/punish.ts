import { get, post } from '../request'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

/* ===== M19 违规确认与复核 ===== */
export const getConfirmStats = () => get<any>('/punish/confirm/stats')
export const getConfirmList = (params?: any) => get<any>('/punish/confirm/list', params)
export const getConfirmDetail = (confirmationId: any) => get<any>('/punish/confirm/detail', p(confirmationId, 'confirmationId'))
export const aiQualify = (data: any) => post<any>('/punish/confirm/ai-qualify', data)
export const submitConfirm = (data: any) => post<any>('/punish/confirm/submit', data)
export const reviewConfirm = (data: any) => post<any>('/punish/confirm/review', data)
export const generateReport = (data: any) => post<any>('/punish/confirm/report', data)
export const pushResult = (data: any) => post<any>('/punish/confirm/push', data)

/* ===== M20 分类处置 ===== */
export const getHandleStats = () => get<any>('/punish/handle/stats')
export const getAgreementHandlings = (params?: any) => get<any>('/punish/handle/agreement', params)
export const getPenalties = (params?: any) => get<any>('/punish/handle/penalty', params)
export const getTransfers = (params?: any) => get<any>('/punish/handle/transfer', params)
export const getHandleBasis = (confirmationId: any) => get<any>('/punish/handle/basis', p(confirmationId, 'confirmationId'))
export const createHandling = (data: any) => post<any>('/punish/handle/create', data)
export const approveHandling = (data: any) => post<any>('/punish/handle/approve', data)
export const advancePenaltyStep = (data: any) => post<any>('/punish/handle/penalty-step', data)
export const submitTransfer = (data: any) => post<any>('/punish/handle/transfer-submit', data)

/* ===== M21 基金追回台账 ===== */
export const getRecoveryStats = () => get<any>('/punish/recovery/stats')
export const getRecoveryList = (params?: any) => get<any>('/punish/recovery/list', params)
export const getRecoveryDetail = (recoveryId: any) => get<any>('/punish/recovery/detail', p(recoveryId, 'recoveryId'))
export const writeOffRecovery = (data: any) => post<any>('/punish/recovery/write-off', data)
export const urgeRecovery = (data: any) => post<any>('/punish/recovery/urge', data)

/* ===== M22 整改跟踪 ===== */
export const getRectifyStats = () => get<any>('/punish/rectify/stats')
export const getRectifyList = (params?: any) => get<any>('/punish/rectify/list', params)
export const getRectifyDetail = (rectifyId: any) => get<any>('/punish/rectify/detail', p(rectifyId, 'rectifyId'))
export const issueRectify = (data: any) => post<any>('/punish/rectify/issue', data)
export const reviewRectifyItem = (data: any) => post<any>('/punish/rectify/review', data)
export const acceptRectify = (data: any) => post<any>('/punish/rectify/accept', data)

/* ===== M23 闭环销号 ===== */
export const getCancelStats = () => get<any>('/punish/cancel/stats')
export const getCancelList = (params?: any) => get<any>('/punish/cancel/list', params)
export const getCancelDetail = (cancelId: any) => get<any>('/punish/cancel/detail', p(cancelId, 'cancelId'))
export const verifyCancel = (data: any) => post<any>('/punish/cancel/verify', data)
export const submitCancel = (data: any) => post<any>('/punish/cancel/submit', data)
export const approveCancel = (data: any) => post<any>('/punish/cancel/approve', data)
export const linkCredit = (data: any) => post<any>('/punish/cancel/credit', data)

/* ===== M24 台账与经验沉淀 ===== */
export const getLedgerStats = () => get<any>('/punish/ledger/stats')
export const getArchives = (params?: any) => get<any>('/punish/ledger/archives', params)
export const getStandards = (params?: any) => get<any>('/punish/ledger/standards', params)
export const getTypicalCases = (params?: any) => get<any>('/punish/ledger/cases', params)
export const getReviewScores = (params?: any) => get<any>('/punish/ledger/review-scores', params)
export const uploadArchive = (data: any) => post<any>('/punish/ledger/archive-upload', data)
export const adoptFeedback = (data: any) => post<any>('/punish/ledger/adopt-feedback', data)
export const exportLedgerReport = (data: any) => post<any>('/punish/ledger/export-report', data)

/* ===== 字典 ===== */
export const getPunishDicts = () => get<any>('/punish/dicts')
