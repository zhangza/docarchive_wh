import { defineStore } from 'pinia'
import { getUserInfo } from '@/api/shared/common'

export interface UserInfo {
  userId: string
  name: string
  displayName: string
  title: string
  dept: string
  group: string
  roles: string[]
  currentRole: string
  permissions: string[]
  loginTime: string
  lastLoginIp: string
  orgSwitch: { code: string; name: string; type: string }[]
}

export const useUserStore = defineStore('user', () => {
  const info = ref<UserInfo | null>(null)
  /** 当前端：GOV 监管端 / ORG 机构端 */
  const side = ref<'GOV' | 'ORG'>('GOV')
  const currentOrgCode = ref('H340200001')
  const loaded = ref(false)

  const displayName = computed(() => info.value?.displayName || '稽核员·王振华')
  const group = computed(() => info.value?.group || '稽核一组')

  async function load() {
    if (loaded.value) return
    try {
      info.value = await getUserInfo()
      loaded.value = true
    } catch {
      /* mock 环境兜底 */
    }
  }

  function switchSide(v: 'GOV' | 'ORG') {
    side.value = v
  }

  return { info, side, currentOrgCode, loaded, displayName, group, load, switchSide }
})
