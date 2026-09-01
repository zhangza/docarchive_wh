<script setup lang="ts">
import { READY_AGENTS, resolveAgentByPath, agentEntryPath } from '@/router'
import { useUserStore } from '@/stores/user'
import { useDictStore } from '@/stores/dict'
import { getNotices } from '@/api/shared/common'
import type { AgentMeta } from '@/router'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const dictStore = useDictStore()

const collapsed = ref(false)
const notices = ref<any[]>([])
const noticeVisible = ref(false)
const clock = ref('')
let timer: number | undefined

const unread = computed(() => notices.value.filter((n) => !n.read).length)

/** 当前智能体 */
const currentAgent = computed<AgentMeta | undefined>(() => resolveAgentByPath(route.path))

/** 当前智能体的菜单路由 */
const currentAgentRoutes = computed(() => currentAgent.value?.routes || [])

const menus = computed(() =>
  currentAgentRoutes.value.map((g: any) => ({
    title: g.meta?.title as string,
    icon: g.meta?.icon as string,
    group: g.meta?.group as string,
    path: g.path,
    children: (g.children || []).map((c: any) => ({
      title: c.meta?.title as string,
      code: c.meta?.code as string,
      icon: c.meta?.icon as string,
      side: c.meta?.side as string,
      path: `${g.path}/${(c.path as string).split('/:')[0]}`
    }))
  }))
)

const activeMenu = computed(() => {
  const p = route.path
  const seg = p.split('/').slice(0, 3).join('/')
  return seg
})

const openeds = computed(() => menus.value.map((m: any) => m.path))

/** 切换智能体 */
function switchAgent(a?: AgentMeta) {
  if (!a?.routes?.length) return
  router.push(agentEntryPath(a))
}

function tick() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  clock.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 周${w} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function onUserCmd(cmd: string) {
  if (cmd === 'gov' || cmd === 'org') {
    userStore.switchSide(cmd === 'gov' ? 'GOV' : 'ORG')
    ElMessage.success(cmd === 'gov' ? '已切换至医保监管端' : '已切换至定点医药机构端')
    if (cmd === 'org') router.push('/screening/org')
    else router.push('/compare/dashboard')
  } else if (cmd === 'logout') {
    ElMessageBox.confirm('退出后需重新登录，确认退出当前账号？', '退出登录', {
      type: 'warning',
      confirmButtonText: '确认退出',
      cancelButtonText: '取消'
    })
      .then(() => {
        ElMessage.success('已安全退出登录')
        router.push('/portal')
      })
      .catch(() => undefined)
  }
}

/** 返回平台统一入口 */
function goPortal() {
  router.push('/portal')
}

onMounted(async () => {
  tick()
  timer = window.setInterval(tick, 1000)
  userStore.load()
  dictStore.load()
  try {
    notices.value = await getNotices()
  } catch {
    /* ignore */
  }
})

onBeforeUnmount(() => timer && clearInterval(timer))
</script>

<template>
  <div class="app-shell">
    <!-- 顶栏 -->
    <header class="app-header">
      <div
        class="app-header__brand"
        :class="{ 'is-collapsed': collapsed }"
        title="返回平台统一入口"
        @click="goPortal"
      >
        <div class="app-header__logo">智</div>
        <div v-show="!collapsed" class="app-header__names">
          <div class="app-header__title">智行合医 · 医保智能监管平台</div>
          <div class="app-header__sub">疑点线索管理智能体 v1.2</div>
        </div>
      </div>

      <div class="app-header__mid">
        <el-icon class="app-header__fold" @click="collapsed = !collapsed">
          <component :is="collapsed ? 'Expand' : 'Fold'" />
        </el-icon>
        <span class="app-header__home" @click="goPortal">
          <el-icon><Grid /></el-icon>智能体矩阵
        </span>
      </div>

      <div class="app-header__right">
        <span class="app-header__clock num">{{ clock }}</span>
        <el-badge :value="unread" :hidden="!unread" class="app-header__badge">
          <el-icon class="app-header__icon" @click="noticeVisible = true"><Bell /></el-icon>
        </el-badge>
        <el-dropdown trigger="click" @command="onUserCmd">
          <div class="app-header__user">
            <div class="app-header__avatar">王</div>
            <div class="app-header__user-info">
              <div class="app-header__user-name">{{ userStore.info?.name || '王振华' }}</div>
              <div class="app-header__user-role">
                {{ userStore.side === 'GOV' ? '医保监管端' : '机构端' }} · {{ userStore.group }}
              </div>
            </div>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                {{ userStore.info?.dept || '芜湖市医疗保障局 · 基金监管处' }}
              </el-dropdown-item>
              <el-dropdown-item command="gov" divided>切换至医保监管端</el-dropdown-item>
              <el-dropdown-item command="org">切换至定点医药机构端</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="app-body">
      <!-- 侧栏 -->
      <aside class="app-sider" :class="{ 'is-collapsed': collapsed }">
        <!-- 当前智能体标识 + 切换 -->
        <el-dropdown trigger="click" placement="bottom-start" class="agent-switch"
          popper-class="agent-switch__popper" @command="switchAgent">
          <div class="agent-switch__cur" :class="{ 'is-collapsed': collapsed }">
            <span class="agent-switch__no num">{{ String(currentAgent?.no).padStart(2, '0') }}</span>
            <template v-if="!collapsed">
              <div class="agent-switch__names">
                <div class="agent-switch__name">{{ currentAgent?.name }}</div>
                <div class="agent-switch__sub">智能体 · 点击切换</div>
              </div>
              <el-icon class="agent-switch__arrow"><ArrowDown /></el-icon>
            </template>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="a in READY_AGENTS" :key="a.key" :command="a"
                :class="{ 'is-current': a.key === currentAgent?.key }">
                <span class="as-item">
                  <span class="as-item__no num">{{ String(a.no).padStart(2, '0') }}</span>
                  <span class="as-item__name">{{ a.name }}</span>
                  <el-icon v-if="a.key === currentAgent?.key" class="as-item__ck"><Select /></el-icon>
                </span>
              </el-dropdown-item>
              <el-dropdown-item divided>
                <span class="as-item" @click="goPortal">
                  <el-icon><Grid /></el-icon>
                  <span class="as-item__name">返回智能体矩阵</span>
                </span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-menu
          :default-active="activeMenu"
          :default-openeds="openeds"
          :collapse="collapsed"
          :collapse-transition="false"
          background-color="transparent"
          text-color="rgba(255,255,255,.72)"
          active-text-color="#ffffff"
          router
        >
          <el-sub-menu v-for="m in menus" :key="m.path" :index="m.path">
            <template #title>
              <el-icon><component :is="m.icon" /></el-icon>
              <span>{{ m.title }}</span>
            </template>
            <el-menu-item v-for="c in m.children" :key="c.path" :index="c.path">
              <el-icon><component :is="c.icon" /></el-icon>
              <template #title>
                <span class="app-sider__item">
                  {{ c.title }}
                  <em v-if="c.side === 'ORG'" class="app-sider__flag">机构</em>
                </span>
              </template>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>

        <div v-show="!collapsed" class="app-sider__foot">
          <div class="app-sider__foot-title">数据更新</div>
          <div class="app-sider__foot-time num">2026-08-29 06:00</div>
          <div class="app-sider__foot-tip">8 类数据源 · 实时同步中</div>
        </div>
      </aside>

      <!-- 内容区 -->
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="zh-page-fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 通知抽屉 -->
    <el-drawer v-model="noticeVisible" title="系统通知" size="420px">
      <div class="notice-list">
        <div v-for="n in notices" :key="n.id" class="notice-item" :class="{ 'is-unread': !n.read }">
          <div class="notice-item__head">
            <span class="notice-item__type" :class="`is-${n.level || 'info'}`">{{ n.type }}</span>
            <span class="notice-item__title">{{ n.title }}</span>
          </div>
          <div class="notice-item__content">{{ n.content }}</div>
          <div class="notice-item__time num">{{ n.time }}</div>
        </div>
        <EmptyState v-if="!notices.length" text="暂无通知" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--zh-bg-page);
}

/* ============ 顶栏 ============ */
.app-header {
  height: var(--zh-header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: var(--zh-bg-header);
  color: #fff;
  box-shadow: 0 2px 12px rgba(10, 47, 107, .22);
  position: relative;
  z-index: 20;

  &__brand {
    width: var(--zh-sider-w);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 14px;
    transition: width .22s;
    cursor: pointer;
    &:hover .app-header__logo { transform: scale(1.06); box-shadow: 0 3px 12px rgba(0, 0, 0, .28); }
    &.is-collapsed { width: var(--zh-sider-w-collapsed); padding: 0 10px; justify-content: center; }
  }

  &__logo {
    width: 30px; height: 30px;
    flex-shrink: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, #fff, #d6e9ff);
    color: #0a2f6b;
    font-weight: 800;
    font-size: 17px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .18);
    transition: all .2s;
  }

  &__names { min-width: 0; }
  &__title { font-size: 15px; font-weight: 700; letter-spacing: .4px; white-space: nowrap; }
  &__sub { font-size: 10px; opacity: .72; white-space: nowrap; }

  &__mid {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    overflow: hidden;
    padding-left: 4px;
  }

  &__home {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(255, 255, 255, .14);
    border: 1px solid rgba(255, 255, 255, .24);
    font-size: var(--zh-font-xs);
    cursor: pointer;
    white-space: nowrap;
    transition: all .18s;
    &:hover { background: rgba(255, 255, 255, .28); transform: translateY(-1px); }
  }

  &__fold {
    font-size: 17px; cursor: pointer; opacity: .85;
    padding: 5px; border-radius: 5px;
    flex-shrink: 0;
    transition: all .18s;
    &:hover { opacity: 1; background: rgba(255, 255, 255, .14); }
  }

  &__right { display: flex; align-items: center; gap: 14px; padding-right: 16px; flex-shrink: 0; }

  &__clock {
    font-size: var(--zh-font-xs);
    opacity: .8;
    white-space: nowrap;
    // 窄屏隐藏时钟，避免挤压左侧折叠按钮与智能体入口
    @media (max-width: 1100px) { display: none; }
  }

  &__icon {
    font-size: 17px; cursor: pointer;
    transition: transform .18s;
    &:hover { transform: scale(1.12); }
  }

  &__user {
    display: flex; align-items: center; gap: 8px;
    cursor: pointer; color: #fff;
    padding: 3px 8px 3px 4px;
    border-radius: 20px;
    transition: background .18s;
    &:hover { background: rgba(255, 255, 255, .14); }
  }

  &__avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #13c2c2, #1668dc);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    border: 1.5px solid rgba(255, 255, 255, .5);
  }

  &__user-info { line-height: 1.25; }
  &__user-name { font-size: var(--zh-font-xs); font-weight: 600; }
  &__user-role { font-size: 10px; opacity: .7; }
}

:deep(.app-header__badge .el-badge__content) {
  top: 4px; right: 6px;
  border: none;
  font-size: 10px;
  height: 15px; line-height: 15px; padding: 0 4px;
}

/* ============ 主体 ============ */
.app-body { flex: 1; display: flex; min-height: 0; }

/* ---------- 侧栏智能体切换 ---------- */
.agent-switch {
  width: 100%;
  flex-shrink: 0;

  &__cur {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 12px;
    margin: 8px 8px 6px;
    border-radius: var(--zh-radius);
    cursor: pointer;
    background: rgba(255, 255, 255, .09);
    border: 1px solid rgba(255, 255, 255, .14);
    transition: all .2s;

    &:hover {
      background: rgba(255, 255, 255, .16);
      border-color: rgba(127, 240, 230, .4);
    }

    &.is-collapsed {
      justify-content: center;
      padding: 10px 0;
      margin: 8px 6px 6px;
    }
  }

  &__no {
    flex-shrink: 0;
    width: 26px; height: 26px;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #3c88ff, #13c2c2);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 2px 8px rgba(22, 104, 220, .4);
  }

  &__names { flex: 1; min-width: 0; }

  &__name {
    font-size: var(--zh-font-xs);
    font-weight: 700;
    color: #fff;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__sub {
    font-size: 10px;
    color: rgba(255, 255, 255, .5);
    margin-top: 1px;
    white-space: nowrap;
  }

  &__arrow {
    flex-shrink: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, .6);
  }
}

.as-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 170px;

  &__no {
    width: 20px; height: 20px;
    flex-shrink: 0;
    border-radius: 5px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--zh-primary-light);
    color: var(--zh-primary);
    font-size: 10px;
    font-weight: 800;
  }

  &__name { flex: 1; font-size: var(--zh-font-xs); }
  &__ck { color: var(--zh-primary); font-size: 13px; }
}

.app-sider {
  width: var(--zh-sider-w);
  flex-shrink: 0;
  background: var(--zh-bg-sider);
  transition: width .22s;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid rgba(255, 255, 255, .06);

  &.is-collapsed { width: var(--zh-sider-w-collapsed); }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, .16); border-radius: 2px; }

  :deep(.el-menu) { border-right: none; }

  :deep(.el-sub-menu__title) {
    height: 42px; line-height: 42px;
    font-size: var(--zh-font-sm);
    font-weight: 600;
  }

  :deep(.el-menu-item) {
    height: 38px; line-height: 38px;
    font-size: var(--zh-font-sm);
    margin: 2px 8px;
    border-radius: var(--zh-radius-sm);
    min-width: auto;
  }

  :deep(.el-menu-item:hover),
  :deep(.el-sub-menu__title:hover) { background: rgba(255, 255, 255, .08) !important; }

  :deep(.el-menu-item.is-active) {
    background: var(--zh-bg-sider-active) !important;
    font-weight: 600;
    position: relative;
    &::before {
      content: '';
      position: absolute;
      left: -8px; top: 50%;
      transform: translateY(-50%);
      width: 3px; height: 16px;
      border-radius: 0 3px 3px 0;
      background: linear-gradient(180deg, #13c2c2, #3c88ff);
    }
  }

  &__item { display: inline-flex; align-items: center; gap: 5px; }

  &__flag {
    font-style: normal;
    font-size: 9px;
    padding: 0 4px;
    border-radius: 2px;
    background: rgba(19, 194, 194, .22);
    color: #7ce8e8;
    font-weight: 700;
  }

  &__foot {
    margin: auto 12px 14px;
    padding: 10px;
    border-radius: var(--zh-radius);
    background: rgba(255, 255, 255, .05);
    border: 1px solid rgba(255, 255, 255, .08);
    &-title { font-size: 10px; color: rgba(255, 255, 255, .5); }
    &-time { font-size: var(--zh-font-xs); color: #7ce8e8; font-weight: 700; margin-top: 2px; }
    &-tip { font-size: 10px; color: rgba(255, 255, 255, .42); margin-top: 3px; }
  }
}

.app-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  position: relative;
}

.zh-page-fade-enter-active { transition: all .24s ease; }
.zh-page-fade-leave-active { transition: all .12s ease; }
.zh-page-fade-enter-from { opacity: 0; transform: translateY(8px); }
.zh-page-fade-leave-to { opacity: 0; }

/* ============ 通知 ============ */
.notice-list { display: flex; flex-direction: column; gap: 10px; }

.notice-item {
  padding: 10px 12px;
  border-radius: var(--zh-radius);
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  &.is-unread { background: var(--zh-primary-lighter); border-color: #cfe3ff; }

  &__head { display: flex; align-items: center; gap: 7px; }
  &__type {
    font-size: 10px; font-weight: 700;
    padding: 1px 6px; border-radius: 3px;
    background: var(--zh-info-light); color: var(--zh-info);
    flex-shrink: 0;
    &.is-danger { background: var(--zh-danger-light); color: var(--zh-danger); }
    &.is-warning { background: var(--zh-warning-light); color: var(--zh-warning); }
    &.is-success { background: var(--zh-success-light); color: var(--zh-success); }
  }
  &__title { font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-text-primary); }
  &__content { font-size: var(--zh-font-xs); color: var(--zh-text-regular); line-height: 1.7; margin-top: 5px; }
  &__time { font-size: 10px; color: var(--zh-text-placeholder); margin-top: 5px; }
}
</style>

<style lang="scss">
/* 非 scoped：agent-switch 下拉菜单由 Teleport 渲染到 body 下 */
.agent-switch__popper {
  .el-dropdown-menu__item {
    &.is-current {
      background: var(--zh-primary-lighter);
      color: var(--zh-primary);
    }
  }
}
</style>
