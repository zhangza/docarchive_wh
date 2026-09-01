/** 金额格式化：1234.5 -> 1,234.50 */
export function fmtMoney(v?: number | null, precision = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision })
}

/** 大金额单位化：156800 -> 15.68 万 */
export function fmtWan(v?: number | null, precision = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(precision) + ' 万'
  return fmtMoney(v)
}

export function fmtNum(v?: number | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  return v.toLocaleString('zh-CN')
}

export function fmtPercent(v?: number | null, precision = 1): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  return v.toFixed(precision) + '%'
}

/** 2026-08-29 08:15:32 -> 08-29 08:15 */
export function fmtShortTime(v?: string): string {
  if (!v) return '—'
  return v.length >= 16 ? v.slice(5, 16) : v
}

export function fmtDate(v?: string): string {
  if (!v) return '—'
  return v.slice(0, 10)
}

/** 小时 -> 可读时长 */
export function fmtDuration(hours?: number): string {
  if (hours === undefined || hours === null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`
  if (hours < 24) return `${hours.toFixed(1)} 小时`
  const d = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  return h ? `${d} 天 ${h} 小时` : `${d} 天`
}

export const RISK_TONE: Record<string, string> = { 高: 'danger', 中: 'warning', 低: 'success' }

/** 风险等级排序权重 */
export const RISK_WEIGHT: Record<string, number> = { 高: 3, 中: 2, 低: 1 }

export function riskColor(level?: string): string {
  if (level === '高') return 'var(--zh-risk-high)'
  if (level === '中') return 'var(--zh-risk-mid)'
  return 'var(--zh-risk-low)'
}

/** 图表统一色板 */
export const CHART_COLORS = ['#1668dc', '#13c2c2', '#722ed1', '#e8a30c', '#12a150', '#e5484d', '#3c88ff', '#f759ab']

/** 图表通用 grid */
export const CHART_GRID = { left: 46, right: 20, top: 34, bottom: 30 }

export function downloadHint(name: string): string {
  return `${name} 已生成，正在下载，请在浏览器下载列表中查看`
}
