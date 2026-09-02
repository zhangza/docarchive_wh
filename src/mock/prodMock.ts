/**
 * 生产环境 Mock 适配器
 * ------------------------------------------------------------------
 * 背景：`vite-plugin-mock` 仅在 Vite 开发服务器上以中间件形式生效，
 * `vite build` 的静态产物中不存在任何 `/api/**` 服务端。因此部署到
 * Netlify / Nginx 等纯静态托管后，所有接口都会返回 404。
 *
 * 方案：复用 `mock/` 目录下已有的接口定义（唯一数据口径），在浏览器端
 * 以 **axios adapter** 的形式接管请求，不产生任何真实网络流量。
 *
 * 本模块只被 `main.ts` 通过**动态 import** 在生产环境按需加载，
 * 开发环境完全不引入，dev 仍走 vite-plugin-mock 中间件，两者互不干扰。
 */
import axios, { type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { MockMethod } from 'vite-plugin-mock'
import http from '@/api/request'

/** 归一化后的路由表项 */
interface MockRoute {
  timeout: number
  statusCode: number
  handler: MockMethod['response']
}

/**
 * 收集 mock/ 目录下所有接口定义。
 * - 路径以 `/mock/` 开头（相对项目根），Vite 会静态分析并打包进产物
 * - `shared/utils.ts`、`shared/data/**` 为纯工具与数据集，无 default 导出，自动被过滤
 */
function collectRoutes(): Map<string, MockRoute> {
  const modules = import.meta.glob<{ default?: MockMethod[] }>('/mock/**/*.ts', { eager: true })
  const table = new Map<string, MockRoute>()

  for (const mod of Object.values(modules)) {
    const list = mod?.default
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item?.url) continue
      const key = `${(item.method || 'get').toLowerCase()} ${normalize(item.url)}`
      table.set(key, {
        timeout: Number(item.timeout) || 0,
        statusCode: Number(item.statusCode) || 200,
        handler: item.response
      })
    }
  }
  return table
}

/** 去掉 query、hash 与末尾斜杠，保证与 mock 中声明的 url 精确对齐 */
function normalize(url: string): string {
  const clean = url.split('?')[0].split('#')[0]
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean
}

/** 拼接 baseURL 与相对路径，得到 mock 表中登记的完整路径 */
function resolvePath(config: AxiosRequestConfig): string {
  const url = config.url || ''
  if (/^https?:\/\//i.test(url)) {
    try {
      return normalize(new URL(url).pathname)
    } catch {
      return normalize(url)
    }
  }
  const base = (config.baseURL || '').replace(/\/+$/, '')
  const rest = url.startsWith('/') ? url : `/${url}`
  return normalize(`${base}${rest}`)
}

/** 解析 query：优先取 axios 的 params，其次解析 url 上的查询串 */
function resolveQuery(config: AxiosRequestConfig): Record<string, any> {
  const query: Record<string, any> = {}
  const search = (config.url || '').split('?')[1]
  if (search) {
    new URLSearchParams(search).forEach((v, k) => {
      query[k] = v
    })
  }
  const params = config.params
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      if (v !== undefined && v !== null && v !== '') query[k] = v
    }
  }
  return query
}

/** 解析请求体：axios 在 adapter 阶段拿到的通常已是 JSON 字符串 */
function resolveBody(config: AxiosRequestConfig): any {
  const data = config.data
  if (data == null) return {}
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve())

/**
 * 安装生产 Mock：把请求实例的适配器替换为「先查 Mock 表，未命中再走真实 XHR」。
 * @returns 已注册的接口数量
 */
export function setupProdMock(): number {
  const table = collectRoutes()
  const xhr = axios.getAdapter('xhr')

  const adapter: AxiosAdapter = async (config) => {
    const method = (config.method || 'get').toLowerCase()
    const path = resolvePath(config)
    const route = table.get(`${method} ${path}`) ?? table.get(`get ${path}`)

    // 未命中的接口回落到真实请求，便于将来逐步对接后端
    if (!route) return xhr(config)

    await sleep(route.timeout)

    const payload =
      typeof route.handler === 'function'
        ? (route.handler as (opt: any) => any).call({} as any, {
            url: config.url,
            method,
            query: resolveQuery(config),
            body: resolveBody(config),
            headers: config.headers ?? {}
          })
        : route.handler

    const data = payload instanceof Promise ? await payload : payload

    return {
      data,
      status: route.statusCode,
      statusText: 'OK',
      headers: {},
      config: config as AxiosResponse['config'],
      request: null
    } as AxiosResponse
  }

  http.defaults.adapter = adapter
  return table.size
}

export default setupProdMock
