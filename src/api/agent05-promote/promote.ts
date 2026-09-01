import { get, post } from '../request'

/** 允许传字符串主键或参数对象 */
const p = (v: any, key: string) => (v && typeof v === 'object' ? v : { [key]: v })

/* ===== 3.1.1 案件质量评分 ===== */
export const getScoreStats = () => get<any>('/promote/score/stats')
export const getScoreList = (params?: any) => get<any>('/promote/score/list', params)
export const getScoreDetail = (scoreId: any) => get<any>('/promote/score/detail', p(scoreId, 'scoreId'))
export const runAiRate = (data: any) => post<any>('/promote/score/ai-rate', data)
export const confirmScore = (data: any) => post<any>('/promote/score/confirm', data)

/* ===== 3.1.2 重点案件复盘 ===== */
export const getReviewStats = () => get<any>('/promote/review/stats')
export const getReviewList = (params?: any) => get<any>('/promote/review/list', params)
export const getReviewDetail = (reviewId: any) => get<any>('/promote/review/detail', p(reviewId, 'reviewId'))
export const createReview = (data: any) => post<any>('/promote/review/create', data)
export const updateMeasure = (data: any) => post<any>('/promote/review/measure/update', data)
export const getMeasures = (params?: any) => get<any>('/promote/review/measures', params)
export const getLessons = (params?: any) => get<any>('/promote/review/lessons', params)

/* ===== 3.1.3 复盘报告 ===== */
export const getReviewReportStats = () => get<any>('/promote/review-report/stats')
export const getReviewReportList = (params?: any) => get<any>('/promote/review-report/list', params)
export const getReviewReportDetail = (reportId: any) => get<any>('/promote/review-report/detail', p(reportId, 'reportId'))
export const generateReviewReport = (data: any) => post<any>('/promote/review-report/generate', data)
export const publishReviewReport = (data: any) => post<any>('/promote/review-report/publish', data)

/* ===== 3.2.1 监管可视化大屏 ===== */
export const getDashboard = (params?: any) => get<any>('/promote/dashboard', params)
export const getDashboardPulse = () => get<any>('/promote/dashboard/pulse')

/* ===== 3.2.2 多维对比分析 ===== */
export const getMultiDim = (params?: any) => get<any>('/promote/analysis/multi-dim', params)
export const drillDown = (level: any) => get<any>('/promote/analysis/drill', p(level, 'level'))

/* ===== 3.2.3 成果效能评估 ===== */
export const getEvaluation = () => get<any>('/promote/evaluation')
export const exportEvaluation = (data?: any) => post<any>('/promote/evaluation/export', data || {})

/* ===== 3.2.4 一键分析报告 ===== */
export const getAnalysisReportStats = () => get<any>('/promote/analysis-report/stats')
export const getAnalysisReportList = (params?: any) => get<any>('/promote/analysis-report/list', params)
export const getAnalysisReportDetail = (reportId: any) => get<any>('/promote/analysis-report/detail', p(reportId, 'reportId'))
export const generateAnalysisReport = (data: any) => post<any>('/promote/analysis-report/generate', data)
export const exportAnalysisReport = (data: any) => post<any>('/promote/analysis-report/export', data)

/* ===== 3.3.1 案例数据回流 ===== */
export const getFeedbackStats = () => get<any>('/promote/feedback/stats')
export const getFeedbackList = (params?: any) => get<any>('/promote/feedback/list', params)
export const getFeedbackDetail = (feedbackId: any) => get<any>('/promote/feedback/detail', p(feedbackId, 'feedbackId'))
export const runFeedback = (data: any) => post<any>('/promote/feedback/run', data)

/* ===== 3.3.2 模型优化 ===== */
export const getOptimizeStats = () => get<any>('/promote/optimize/stats')
export const getOptimizeList = (params?: any) => get<any>('/promote/optimize/list', params)
export const getOptimizeDetail = (optimizationId: any) => get<any>('/promote/optimize/detail', p(optimizationId, 'optimizationId'))
export const decideSuggestion = (data: any) => post<any>('/promote/optimize/decide', data)
export const grayRelease = (data: any) => post<any>('/promote/optimize/gray-release', data)
export const fullRelease = (data: any) => post<any>('/promote/optimize/full-release', data)
export const rollbackVersion = (data: any) => post<any>('/promote/optimize/rollback', data)

/* ===== 3.3.3 准确率监控 ===== */
export const getMonitor = (params?: any) => get<any>('/promote/monitor', params)
export const handleAlert = (data: any) => post<any>('/promote/monitor/alert/handle', data)
export const runEvaluate = (data?: any) => post<any>('/promote/monitor/evaluate', data || {})

/* ===== 3.4.1 宣教素材生成 ===== */
export const getMaterialStats = () => get<any>('/promote/material/stats')
export const getMaterialList = (params?: any) => get<any>('/promote/material/list', params)
export const getMaterialDetail = (materialId: any) => get<any>('/promote/material/detail', p(materialId, 'materialId'))
export const generateMaterial = (data: any) => post<any>('/promote/material/generate', data)
export const reviewMaterial = (data: any) => post<any>('/promote/material/review', data)

/* ===== 3.4.2 多端分类推送 ===== */
export const getPushStats = () => get<any>('/promote/push/stats')
export const getPushList = (params?: any) => get<any>('/promote/push/list', params)
export const getPushDetail = (pushId: any) => get<any>('/promote/push/detail', p(pushId, 'pushId'))
export const sendPush = (data: any) => post<any>('/promote/push/send', data)
export const toggleSchedule = (data: any) => post<any>('/promote/push/schedule/toggle', data)
export const saveSchedule = (data: any) => post<any>('/promote/push/schedule/save', data)

/* ===== 3.4.3 宣教效果统计 ===== */
export const getEduStats = (params?: any) => get<any>('/promote/edu-stats', params)
export const exportEduStats = (data?: any) => post<any>('/promote/edu-stats/export', data || {})

/* ===== 字典 ===== */
export const getPromoteDicts = () => get<any>('/promote/dicts')
