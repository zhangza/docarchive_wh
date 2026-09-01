import { defineStore } from 'pinia'
import { getDicts } from '@/api/shared/common'

export const useDictStore = defineStore('dict', () => {
  const dicts = ref<Record<string, any>>({})
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return dicts.value
    try {
      dicts.value = await getDicts()
      loaded.value = true
    } catch {
      /* ignore */
    }
    return dicts.value
  }

  const districts = computed<string[]>(() => dicts.value.districts || [])
  const depts = computed<string[]>(() => dicts.value.depts || [])
  const compareTypes = computed<string[]>(() => dicts.value.compareTypes || [])
  const riskLevels = computed<string[]>(() => dicts.value.riskLevels || ['高', '中', '低'])
  const clueStatus = computed<string[]>(() => dicts.value.clueStatus || [])
  const orgTypes = computed<string[]>(() => dicts.value.orgTypes || [])
  const violationTree = computed<any[]>(() => {
    const v = dicts.value.violationTree
    if (Array.isArray(v)) return v
    // 兼容接口返回对象形态：{ 大类: [子类...] }
    if (v && typeof v === 'object') {
      return Object.keys(v).map((k) => ({ category: k, children: (v as any)[k] }))
    }
    return []
  })
  const inspectTypes = computed<string[]>(() => dicts.value.inspectTypes || [])
  const appealTypes = computed<string[]>(() => dicts.value.appealTypes || [])
  const feedbackTypes = computed<string[]>(() => dicts.value.feedbackTypes || [])
  const evidenceTypes = computed<string[]>(() => dicts.value.evidenceTypes || [])
  const insuranceTypes = computed<string[]>(() => dicts.value.insuranceTypes || [])
  const visitTypes = computed<string[]>(() => dicts.value.visitTypes || [])

  /** 违规类型平铺列表 */
  const allViolationTypes = computed<string[]>(() => {
    const out: string[] = []
    const tree = violationTree.value
    if (!Array.isArray(tree)) return out
    tree.forEach((c: any) => {
      const children = c?.children || c?.types || []
      if (!Array.isArray(children)) return
      children.forEach((t: any) => out.push(typeof t === 'string' ? t : t?.value || t?.label))
    })
    return out.filter(Boolean)
  })

  /** el-cascader 可用的违规类型树 */
  const violationCascader = computed(() =>
    violationTree.value.map((c: any) => ({
      value: c.category || c.value || c.label,
      label: c.category || c.label,
      children: (c.children || c.types || []).map((t: any) => {
        const v = typeof t === 'string' ? t : t.value || t.label
        return { value: v, label: v }
      })
    }))
  )

  return {
    dicts,
    loaded,
    load,
    districts,
    depts,
    compareTypes,
    riskLevels,
    clueStatus,
    orgTypes,
    violationTree,
    inspectTypes,
    appealTypes,
    feedbackTypes,
    evidenceTypes,
    insuranceTypes,
    visitTypes,
    allViolationTypes,
    violationCascader
  }
})
