import { defineStore } from 'pinia'

/** 跨页面共享的线索上下文：详情页/图谱/研判之间联动 */
export const useClueStore = defineStore('clue', () => {
  /** 最近查看过的线索 ID（面包屑 & 快速返回） */
  const recent = ref<string[]>([])
  /** 研判工作台批量选中 */
  const selectedIds = ref<string[]>([])
  /** 从列表跳详情时携带的筛选条件，返回时恢复 */
  const listQueryCache = ref<Record<string, any>>({})

  function touch(clueId: string) {
    if (!clueId) return
    recent.value = [clueId, ...recent.value.filter((i) => i !== clueId)].slice(0, 12)
  }

  function cacheQuery(key: string, q: Record<string, any>) {
    listQueryCache.value[key] = { ...q }
  }

  function readQuery(key: string) {
    return listQueryCache.value[key]
  }

  return { recent, selectedIds, listQueryCache, touch, cacheQuery, readQuery }
})
