/** Mock 通用工具：统一响应体 / 分页 / 延迟 */
export function ok<T>(data: T) {
  return { code: 0, message: 'ok', data }
}

export function fail(message = '操作失败', code = 500) {
  return { code, message, data: null }
}

/** 随机延迟 300~600ms，AI 类接口可传更大区间 */
export function delay(min = 300, max = 600): number {
  return Math.floor(Math.random() * (max - min)) + min
}

export function paginate<T>(list: T[], page = 1, pageSize = 20) {
  const p = Number(page) || 1
  const ps = Number(pageSize) || 20
  return {
    list: list.slice((p - 1) * ps, p * ps),
    total: list.length,
    page: p,
    pageSize: ps
  }
}

/** 通用多条件过滤 */
export function filterBy<T extends Record<string, any>>(
  list: T[],
  query: Record<string, any>,
  cfg: {
    eq?: string[]
    like?: string[]
    in?: string[]
    range?: Array<{ key: string; min: string; max: string }>
    dateRange?: Array<{ key: string; start: string; end: string }>
  }
): T[] {
  let out = list
  for (const k of cfg.eq ?? []) {
    const v = query[k]
    if (v !== undefined && v !== '' && v !== null) out = out.filter((x) => String(x[k]) === String(v))
  }
  for (const k of cfg.like ?? []) {
    const v = query[k]
    if (v) out = out.filter((x) => String(x[k] ?? '').includes(String(v)))
  }
  for (const k of cfg.in ?? []) {
    const v = query[k]
    if (v) {
      const arr = Array.isArray(v) ? v : String(v).split(',').filter(Boolean)
      if (arr.length) out = out.filter((x) => arr.includes(String(x[k])))
    }
  }
  for (const r of cfg.range ?? []) {
    const min = query[r.min]
    const max = query[r.max]
    if (min !== undefined && min !== '') out = out.filter((x) => Number(x[r.key]) >= Number(min))
    if (max !== undefined && max !== '') out = out.filter((x) => Number(x[r.key]) <= Number(max))
  }
  for (const r of cfg.dateRange ?? []) {
    const s = query[r.start]
    const e = query[r.end]
    if (s) out = out.filter((x) => String(x[r.key]) >= String(s))
    if (e) out = out.filter((x) => String(x[r.key]) <= String(e) + ' 23:59:59')
  }
  return out
}

/** 关键字全字段搜索 */
export function keywordSearch<T extends Record<string, any>>(list: T[], kw: string, fields: string[]): T[] {
  if (!kw) return list
  const k = String(kw).trim()
  if (!k) return list
  return list.filter((x) => fields.some((f) => String(x[f] ?? '').includes(k)))
}
