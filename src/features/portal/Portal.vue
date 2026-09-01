<script setup lang="ts">
import { getPortalAgents, getPortalOverview } from '@/api/shared/portal'
import { fmtWan, fmtNum } from '@/utils/format'

const router = useRouter()
const msg = ElMessage

const agents = ref<any[]>([])
const ov = ref<any>(null)
const loading = ref(true)
const clock = ref('')
let timer: number | undefined

/** 当前悬浮的智能体卡片 key */
const hoverKey = ref('')

const readyCount = computed(() => agents.value.filter((a) => a.ready).length)

async function load() {
  loading.value = true
  try {
    const [a, o] = await Promise.all([getPortalAgents(), getPortalOverview()])
    agents.value = a || []
    ov.value = o
  } finally {
    loading.value = false
  }
}

function enter(agent: any) {
  if (agent.ready && agent.entry) {
    router.push(agent.entry)
  } else {
    msg.info(`${agent.name} 正在建设中，敬请期待`)
  }
}

/** 点击功能组直达对应页面 */
function gotoFeature(agent: any, f: any) {
  // 未上线的智能体，交由卡片统一提示，避免提示信息割裂
  if (!agent.ready) {
    msg.info(`${agent.name} 正在建设中，敬请期待`)
    return
  }
  if (f.path) {
    router.push(f.path)
  } else {
    msg.info(`「${f.no} ${f.name}」正在建设中`)
  }
}

function tick() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  clock.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 星期${w} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 1000)
  load()
})

onBeforeUnmount(() => timer && clearInterval(timer))
</script>

<template>
  <div class="portal" v-loading="loading" element-loading-text="平台加载中…">
    <!-- 背景装饰 -->
    <div class="portal__bg">
      <span class="portal__orb portal__orb--1" />
      <span class="portal__orb portal__orb--2" />
      <span class="portal__orb portal__orb--3" />
      <div class="portal__grid" />
    </div>

    <!-- ============ 品牌头图 ============ -->
    <header class="portal-hero">
      <div class="portal-hero__top">
        <div class="portal-hero__logo">智</div>
        <div class="portal-hero__brand">
          <div class="portal-hero__name">智行合医</div>
          <div class="portal-hero__en">ZHIXING HEYI · MEDICAL INSURANCE INTELLIGENT SUPERVISION</div>
        </div>
        <div class="portal-hero__meta">
          <div class="portal-hero__clock num">{{ clock }}</div>
          <div class="portal-hero__org">芜湖市医疗保障局 · 基金监管处</div>
        </div>
      </div>

      <h1 class="portal-hero__title">
        医保基金智能监管平台
        <span class="portal-hero__ver">v1.2</span>
      </h1>
      <p class="portal-hero__slogan">
        以<b>数据融合</b>破壁垒 · 以<b>AI 研判</b>提精度 · 以<b>全程留痕</b>保公正 ·
        以<b>持续迭代</b>促进化
      </p>

      <div class="portal-hero__desc">
        构建「疑点发现 → 智能研判 → 核实取证 → 专项立项 → 违规处置 → 文书归档 → 复盘宣教」全链路闭环，
        六大智能体协同联动，推动医保监管从<em>被动处置</em>向<em>数据驱动、智能迭代</em>转型。
      </div>

      <!-- 平台核心指标 -->
      <div v-if="ov" class="portal-kpi">
        <div class="portal-kpi__item">
          <div class="portal-kpi__val num">{{ readyCount }}<i>/{{ ov.stats.agentTotal }}</i></div>
          <div class="portal-kpi__label">智能体上线</div>
        </div>
        <div class="portal-kpi__item">
          <div class="portal-kpi__val num">{{ ov.stats.featureGroupTotal }}</div>
          <div class="portal-kpi__label">功能组</div>
        </div>
        <div class="portal-kpi__item">
          <div class="portal-kpi__val num">{{ ov.stats.orgCovered }}</div>
          <div class="portal-kpi__label">覆盖定点机构</div>
        </div>
        <div class="portal-kpi__item">
          <div class="portal-kpi__val num">{{ fmtNum(ov.stats.clueTotal) }}</div>
          <div class="portal-kpi__label">累计疑点线索</div>
        </div>
        <div class="portal-kpi__item">
          <div class="portal-kpi__val num">{{ (ov.stats.recoveredAmount / 10000).toFixed(1) }}<i>万元</i></div>
          <div class="portal-kpi__label">基金挽回</div>
        </div>
        <div class="portal-kpi__item">
          <div class="portal-kpi__val num">{{ ov.stats.modelAccuracy }}<i>%</i></div>
          <div class="portal-kpi__label">模型准确率</div>
        </div>
      </div>

      <!-- 今日动态 -->
      <div v-if="ov" class="portal-live">
        <span class="portal-live__dot" />
        <span class="portal-live__label">今日实时</span>
        <span class="portal-live__item">新增线索 <b class="num">{{ ov.today.newClue }}</b></span>
        <span class="portal-live__sep">·</span>
        <span class="portal-live__item">高风险 <b class="num is-high">{{ ov.today.high }}</b></span>
        <span class="portal-live__sep">·</span>
        <span class="portal-live__item">已处理 <b class="num">{{ ov.today.handled }}</b></span>
        <span class="portal-live__sep">·</span>
        <span class="portal-live__item">处理率 <b class="num">{{ ov.today.handleRate }}%</b></span>
        <span class="portal-live__sep">·</span>
        <span class="portal-live__item">涉及金额 <b class="num">{{ fmtWan(ov.today.amount) }}元</b></span>
      </div>
    </header>

    <!-- ============ 智能体矩阵 ============ -->
    <section class="portal-section">
      <div class="portal-section__head">
        <div class="portal-section__title">
          <span class="portal-section__dot" />
          智能体矩阵
          <span class="portal-section__sub">选择智能体进入对应业务工作台</span>
        </div>
        <div class="portal-section__legend">
          <span class="portal-legend portal-legend--on">● 已上线</span>
          <span class="portal-legend portal-legend--off">● 建设中</span>
        </div>
      </div>

      <div class="agent-grid">
        <article
          v-for="a in agents"
          :key="a.key"
          class="agent-card"
          :class="[`is-${a.tone}`, { 'is-ready': a.ready, 'is-hover': hoverKey === a.key }]"
          @mouseenter="hoverKey = a.key"
          @mouseleave="hoverKey = ''"
          @click="enter(a)"
        >
          <!-- 序号水印 -->
          <span class="agent-card__no">{{ String(a.no).padStart(2, '0') }}</span>

          <div class="agent-card__head">
            <div class="agent-card__icon">
              <el-icon><component :is="a.icon" /></el-icon>
            </div>
            <div class="agent-card__names">
              <div class="agent-card__name">{{ a.name }}</div>
              <div class="agent-card__en">{{ a.enName }}</div>
            </div>
            <span class="agent-card__badge" :class="a.ready ? 'is-on' : 'is-off'">
              {{ a.ready ? `已上线 ${a.pageCount} 页` : '建设中' }}
            </span>
          </div>

          <p class="agent-card__pos">{{ a.positioning }}</p>

          <div class="agent-card__tags">
            <span v-for="t in a.tags" :key="t" class="agent-card__tag">{{ t }}</span>
          </div>

          <div class="agent-card__features">
            <div
              v-for="f in a.features"
              :key="f.no"
              class="agent-feature"
              :class="{ 'is-link': !!f.path }"
              @click.stop="gotoFeature(a, f)"
            >
              <span class="agent-feature__no">{{ f.no }}</span>
              <span class="agent-feature__name">{{ f.name }}</span>
              <span class="agent-feature__desc">{{ f.desc }}</span>
              <el-icon v-if="f.path" class="agent-feature__arrow"><ArrowRight /></el-icon>
            </div>
          </div>

          <footer class="agent-card__foot">
            <span class="agent-card__doc">
              <el-icon><Document /></el-icon>{{ a.features.length }} 个功能组
            </span>
            <span class="agent-card__enter">
              {{ a.ready ? '进入工作台' : '敬请期待' }}
              <el-icon><ArrowRight /></el-icon>
            </span>
          </footer>
        </article>
      </div>
    </section>

    <!-- ============ 业务主链路 ============ -->
    <section v-if="ov" class="portal-section">
      <div class="portal-section__head">
        <div class="portal-section__title">
          <span class="portal-section__dot" />
          业务主链路
          <span class="portal-section__sub">八大环节全流程闭环，跨智能体协同联动</span>
        </div>
      </div>

      <div class="flow">
        <div v-for="(s, i) in ov.flow" :key="s.no" class="flow__cell">
          <div class="flow__node" :class="`is-agent${s.agent}`">
            <div class="flow__no num">{{ s.no }}</div>
            <div class="flow__name">{{ s.name }}</div>
            <div class="flow__desc">{{ s.desc }}</div>
            <div class="flow__agent">智能体 {{ s.agent }}</div>
          </div>
          <el-icon v-if="i < ov.flow.length - 1" class="flow__arrow"><DArrowRight /></el-icon>
        </div>
      </div>
    </section>

    <!-- ============ 建设成效 ============ -->
    <section v-if="ov" class="portal-section">
      <div class="portal-section__head">
        <div class="portal-section__title">
          <span class="portal-section__dot" />
          建设成效
          <span class="portal-section__sub">平台上线前后监管效能对比</span>
        </div>
      </div>

      <div class="effect-grid">
        <div v-for="e in ov.effects" :key="e.name" class="effect-card">
          <div class="effect-card__icon"><el-icon><component :is="e.icon" /></el-icon></div>
          <div class="effect-card__body">
            <div class="effect-card__name">{{ e.name }}</div>
            <div class="effect-card__cmp">
              <span class="effect-card__before">{{ e.before }}</span>
              <el-icon class="effect-card__arrow"><Right /></el-icon>
              <span class="effect-card__after">{{ e.after }}</span>
            </div>
          </div>
          <div class="effect-card__improve num">{{ e.improve }}</div>
        </div>
      </div>
    </section>

    <footer class="portal-foot">
      <span>智行合医 · 医保基金智能监管平台</span>
      <span class="portal-foot__sep">|</span>
      <span>芜湖市医疗保障局</span>
      <span class="portal-foot__sep">|</span>
      <span>数据安全等级：涉密 · 操作全程留痕审计</span>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.portal {
  position: relative;
  min-height: 100vh;
  padding: 0 0 40px;
  background:
    radial-gradient(1200px 600px at 50% -8%, #12408f 0%, rgba(10, 34, 74, 0) 62%),
    linear-gradient(178deg, #071c3d 0%, #0a2450 40%, #0d2a58 100%);
  overflow-x: hidden;
  color: #fff;
}

/* ---------- 背景装饰 ---------- */
.portal__bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.portal__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: .4;

  &--1 { width: 460px; height: 460px; top: -140px; left: -80px; background: #1668dc; }
  &--2 { width: 380px; height: 380px; top: 120px; right: -100px; background: #13c2c2; opacity: .3; }
  &--3 { width: 420px; height: 420px; bottom: -160px; left: 38%; background: #722ed1; opacity: .22; }
}

.portal__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, .045) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, .9), transparent 68%);
}

/* ---------- 品牌头图 ---------- */
.portal-hero {
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  padding: 26px 32px 30px;
  text-align: center;

  &__top {
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    margin-bottom: 34px;
  }

  &__logo {
    width: 44px; height: 44px;
    flex-shrink: 0;
    border-radius: 11px;
    background: linear-gradient(135deg, #3c88ff, #13c2c2);
    display: flex; align-items: center; justify-content: center;
    font-size: 23px; font-weight: 800;
    box-shadow: 0 6px 18px rgba(22, 104, 220, .45);
  }

  &__brand { flex: 1; min-width: 0; }
  &__name { font-size: 19px; font-weight: 800; letter-spacing: 3px; }
  &__en { font-size: 9px; opacity: .5; letter-spacing: 1.1px; margin-top: 2px; }

  &__meta { text-align: right; flex-shrink: 0; }
  &__clock { font-size: var(--zh-font-sm); opacity: .9; letter-spacing: .5px; }
  &__org { font-size: 11px; opacity: .55; margin-top: 3px; }

  &__title {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: 8px;
    margin: 0 0 16px;
    background: linear-gradient(92deg, #fff 12%, #a9d4ff 52%, #7ff0e6 92%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 8px 40px rgba(60, 136, 255, .3);
  }

  &__ver {
    -webkit-text-fill-color: #7ff0e6;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    vertical-align: super;
    margin-left: 6px;
    opacity: .8;
  }

  &__slogan {
    font-size: var(--zh-font-lg);
    letter-spacing: 1.6px;
    opacity: .9;
    margin: 0 0 14px;
    b { color: #7ff0e6; font-weight: 700; }
  }

  &__desc {
    max-width: 950px;
    margin: 0 auto;
    font-size: var(--zh-font-sm);
    line-height: 1.95;
    opacity: .62;
    em { font-style: normal; color: #ffd591; }
  }
}

/* ---------- 平台指标 ---------- */
.portal-kpi {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin: 30px auto 0;
  max-width: 1180px;

  &__item {
    padding: 15px 10px;
    border-radius: var(--zh-radius-lg);
    background: rgba(255, 255, 255, .07);
    border: 1px solid rgba(255, 255, 255, .12);
    backdrop-filter: blur(8px);
    transition: all .25s;
    &:hover {
      background: rgba(255, 255, 255, .12);
      transform: translateY(-3px);
      border-color: rgba(127, 240, 230, .4);
    }
  }

  &__val {
    font-size: 29px;
    font-weight: 800;
    line-height: 1.15;
    background: linear-gradient(180deg, #fff, #9fd0ff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    i {
      font-size: 14px;
      font-style: normal;
      opacity: .65;
      -webkit-text-fill-color: #cfe6ff;
      margin-left: 1px;
    }
  }

  &__label { font-size: 11px; opacity: .62; margin-top: 5px; letter-spacing: .6px; }
}

/* ---------- 今日实时 ---------- */
.portal-live {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
  padding: 8px 18px;
  border-radius: 22px;
  background: rgba(19, 194, 194, .1);
  border: 1px solid rgba(19, 194, 194, .3);
  font-size: var(--zh-font-xs);

  &__dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #13c2c2;
    box-shadow: 0 0 0 3px rgba(19, 194, 194, .25);
    animation: zh-pulse 1.7s infinite;
  }

  &__label { font-weight: 700; color: #7ff0e6; letter-spacing: .8px; }
  &__item { opacity: .82; b { color: #fff; font-weight: 700; margin-left: 2px; } b.is-high { color: #ff9c9e; } }
  &__sep { opacity: .3; }
}

/* ---------- 区块通用 ---------- */
.portal-section {
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px 32px 0;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: var(--zh-font-title);
    font-weight: 700;
    letter-spacing: 1.6px;
  }

  &__dot {
    width: 4px; height: 17px;
    border-radius: 3px;
    background: linear-gradient(180deg, #7ff0e6, #3c88ff);
  }

  &__sub {
    font-size: var(--zh-font-xs);
    font-weight: 400;
    opacity: .5;
    letter-spacing: .5px;
    margin-left: 4px;
  }

  &__legend { display: flex; gap: 14px; font-size: var(--zh-font-xs); }
}

.portal-legend {
  opacity: .72;
  &--on { color: #7ff0e6; }
  &--off { color: #9aa7b8; }
}

/* ---------- 智能体卡片 ---------- */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.agent-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 18px 18px 14px;
  border-radius: var(--zh-radius-xl);
  background: linear-gradient(168deg, rgba(255, 255, 255, .1), rgba(255, 255, 255, .04));
  border: 1px solid rgba(255, 255, 255, .13);
  backdrop-filter: blur(10px);
  cursor: pointer;
  overflow: hidden;
  transition: transform .28s cubic-bezier(.34, 1.4, .64, 1), box-shadow .28s, border-color .28s;

  /* 顶部主色条 */
  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: var(--card-tone, #1668dc);
    opacity: .9;
  }

  /* 悬浮光晕 */
  &::after {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 190px; height: 190px;
    border-radius: 50%;
    background: var(--card-tone, #1668dc);
    filter: blur(55px);
    opacity: 0;
    transition: opacity .35s;
  }

  &.is-hover {
    transform: translateY(-6px);
    border-color: color-mix(in srgb, var(--card-tone) 55%, transparent);
    box-shadow: 0 18px 44px rgba(4, 18, 42, .5);
    &::after { opacity: .3; }
  }

  &:not(.is-ready) { opacity: .82; }

  /* 主色调 */
  &.is-primary { --card-tone: #3c88ff; }
  &.is-accent  { --card-tone: #13c2c2; }
  &.is-purple  { --card-tone: #9254de; }
  &.is-warning { --card-tone: #e8a30c; }
  &.is-success { --card-tone: #12a150; }
  &.is-info    { --card-tone: #8fa3bd; }

  &__no {
    position: absolute;
    top: 8px; right: 14px;
    font-family: var(--zh-font-num);
    font-size: 52px;
    font-weight: 800;
    line-height: 1;
    color: rgba(255, 255, 255, .06);
    pointer-events: none;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    margin-bottom: 11px;
  }

  &__icon {
    width: 40px; height: 40px;
    flex-shrink: 0;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    background: color-mix(in srgb, var(--card-tone) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--card-tone) 45%, transparent);
    color: #fff;
  }

  &__names { flex: 1; min-width: 0; padding-top: 1px; }

  &__name {
    font-size: var(--zh-font-md);
    font-weight: 700;
    letter-spacing: .5px;
    line-height: 1.35;
  }

  &__en {
    font-size: 9px;
    opacity: .42;
    letter-spacing: .7px;
    margin-top: 2px;
    text-transform: uppercase;
  }

  &__badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 11px;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
    &.is-on {
      color: #7ff0e6;
      background: rgba(19, 194, 194, .16);
      border: 1px solid rgba(19, 194, 194, .4);
    }
    &.is-off {
      color: #cbd5e1;
      background: rgba(255, 255, 255, .1);
      border: 1px solid rgba(255, 255, 255, .18);
    }
  }

  &__pos {
    font-size: var(--zh-font-xs);
    line-height: 1.85;
    opacity: .68;
    margin: 0 0 11px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 12px;
  }

  &__tag {
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    background: color-mix(in srgb, var(--card-tone) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--card-tone) 32%, transparent);
    color: #e8f2ff;
  }

  &__features {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-top: 10px;
    border-top: 1px dashed rgba(255, 255, 255, .14);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, .1);
    font-size: var(--zh-font-xs);
  }

  &__doc {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    opacity: .5;
  }

  &__enter {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 700;
    color: var(--card-tone);
    filter: brightness(1.35);
    transition: gap .2s;
  }

  &.is-hover &__enter { gap: 7px; }
}

.agent-feature {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 5px;
  font-size: var(--zh-font-xs);
  transition: background .18s;

  &.is-link {
    cursor: pointer;
    &:hover {
      background: rgba(255, 255, 255, .11);
      .agent-feature__name { color: #7ff0e6; }
      .agent-feature__arrow { opacity: .8; transform: translateX(2px); }
    }
  }

  &__no {
    flex-shrink: 0;
    width: 24px;
    font-family: var(--zh-font-num);
    font-size: 10px;
    font-weight: 700;
    opacity: .45;
  }

  &__name {
    flex-shrink: 0;
    font-weight: 600;
    transition: color .18s;
  }

  &__desc {
    flex: 1;
    min-width: 0;
    font-size: 10px;
    opacity: .45;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    flex-shrink: 0;
    font-size: 11px;
    opacity: 0;
    transition: all .18s;
  }
}

/* ---------- 业务主链路 ---------- */
.flow {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 18px 16px;
  border-radius: var(--zh-radius-lg);
  background: rgba(255, 255, 255, .05);
  border: 1px solid rgba(255, 255, 255, .1);
  overflow-x: auto;

  &__cell { display: flex; align-items: center; flex: 1; min-width: 0; }

  &__node {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 12px 10px;
    border-radius: var(--zh-radius-base);
    text-align: center;
    background: rgba(255, 255, 255, .06);
    border: 1px solid rgba(255, 255, 255, .12);
    border-top: 2px solid var(--flow-tone, #3c88ff);
    transition: all .25s;

    &:hover {
      background: rgba(255, 255, 255, .13);
      transform: translateY(-3px);
    }

    &.is-agent1 { --flow-tone: #3c88ff; }
    &.is-agent2 { --flow-tone: #13c2c2; }
    &.is-agent3 { --flow-tone: #e8a30c; }
    &.is-agent4 { --flow-tone: #9254de; }
    &.is-agent5 { --flow-tone: #12a150; }
  }

  &__no {
    width: 20px; height: 20px;
    margin: 0 auto 6px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px;
    font-weight: 800;
    background: var(--flow-tone);
    color: #06203f;
  }

  &__name {
    font-size: var(--zh-font-sm);
    font-weight: 700;
    letter-spacing: .5px;
    white-space: nowrap;
  }

  &__desc {
    font-size: 10px;
    opacity: .5;
    margin-top: 3px;
    line-height: 1.5;
  }

  &__agent {
    display: inline-block;
    margin-top: 6px;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    background: color-mix(in srgb, var(--flow-tone) 22%, transparent);
    color: #e8f2ff;
  }

  &__arrow {
    flex-shrink: 0;
    font-size: 13px;
    opacity: .3;
    margin: 0 1px;
  }
}

/* ---------- 建设成效 ---------- */
.effect-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.effect-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 16px;
  border-radius: var(--zh-radius-lg);
  background: rgba(255, 255, 255, .06);
  border: 1px solid rgba(255, 255, 255, .11);
  transition: all .25s;

  &:hover {
    background: rgba(255, 255, 255, .1);
    transform: translateY(-3px);
    border-color: rgba(127, 240, 230, .35);
  }

  &__icon {
    width: 38px; height: 38px;
    flex-shrink: 0;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    background: linear-gradient(135deg, rgba(60, 136, 255, .3), rgba(19, 194, 194, .3));
    border: 1px solid rgba(127, 240, 230, .28);
  }

  &__body { flex: 1; min-width: 0; }

  &__name {
    font-size: var(--zh-font-sm);
    font-weight: 700;
    letter-spacing: .5px;
  }

  &__cmp {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    font-size: 10px;
    white-space: nowrap;
  }

  &__before { opacity: .45; text-decoration: line-through; }
  &__arrow { font-size: 10px; opacity: .4; }
  &__after { color: #7ff0e6; font-weight: 600; }

  &__improve {
    flex-shrink: 0;
    font-size: 17px;
    font-weight: 800;
    color: #52d69a;
  }
}

/* ---------- 页脚 ---------- */
.portal-foot {
  position: relative;
  margin-top: 34px;
  text-align: center;
  font-size: var(--zh-font-xs);
  opacity: .38;
  letter-spacing: .6px;

  &__sep { margin: 0 10px; opacity: .5; }
}

/* ---------- 响应式 ---------- */
@media (max-width: 1440px) {
  .agent-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 1200px) {
  .portal-kpi { grid-template-columns: repeat(3, 1fr); }
  .effect-grid { grid-template-columns: repeat(2, 1fr); }
  .portal-hero__title { font-size: 36px; letter-spacing: 5px; }
}

@media (max-width: 860px) {
  .agent-grid { grid-template-columns: 1fr; }
  .portal-kpi { grid-template-columns: repeat(2, 1fr); }
  .effect-grid { grid-template-columns: 1fr; }
  .portal-hero { padding: 20px 16px 24px; }
  .portal-section { padding: 24px 16px 0; }
  .portal-hero__title { font-size: 27px; letter-spacing: 3px; }
  .portal-hero__top { flex-wrap: wrap; }
  .portal-hero__meta { text-align: left; }
}
</style>
