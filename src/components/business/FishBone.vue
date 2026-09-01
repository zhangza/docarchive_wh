<script setup lang="ts">
/**
 * FishBone —— 因果鱼骨图（agent05 M32 原因分析专属）
 * 制度 / 流程 / 人员 / 技术 四类原因作为主骨，问题条目作为细刺。
 * 纯 SVG 绘制，鼠标悬停高亮该骨支。
 */
const props = withDefaults(defineProps<{
  /** 结果（鱼头文字） */
  effect: string
  /** 四类原因 */
  causes: { causeType: string; count: number; problems: string[]; ratio?: number }[]
  height?: number
}>(), { height: 320 })

const TONE: Record<string, string> = {
  制度: '#722ed1', 流程: '#0891b2', 人员: '#d48806', 技术: '#12a150'
}

const W = 900
const SPINE_Y = computed(() => props.height / 2)
const X0 = 60
const X1 = computed(() => W - 150)

const active = ref<string>('')

/** 上下交错排布骨支 */
const bones = computed(() => {
  const list = props.causes.filter((c) => c.count > 0)
  const n = list.length || 1
  const step = (X1.value - X0 - 60) / n
  return list.map((c, i) => {
    const up = i % 2 === 0
    const baseX = X0 + 70 + step * i + step * 0.35
    const tipX = baseX - 74
    const tipY = up ? SPINE_Y.value - props.height * 0.34 : SPINE_Y.value + props.height * 0.34
    const labelY = up ? tipY - 8 : tipY + 14
    // 细刺：沿主骨方向等距分布
    const items = c.problems.slice(0, 4).map((p, j) => {
      const k = (j + 1) / (c.problems.slice(0, 4).length + 1)
      const px = baseX + (tipX - baseX) * k
      const py = SPINE_Y.value + (tipY - SPINE_Y.value) * k
      return { text: p, x: px, y: py, up, idx: j }
    })
    return {
      ...c,
      up, baseX, tipX, tipY, labelY,
      tone: TONE[c.causeType] || '#3d8bff',
      items
    }
  })
})
</script>

<template>
  <div class="fb" :style="{ height: height + 'px' }">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="xMidYMid meet" class="fb__svg">
      <defs>
        <linearGradient id="fb-spine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0891b2" stop-opacity=".3" />
          <stop offset="60%" stop-color="#1668dc" stop-opacity=".85" />
          <stop offset="100%" stop-color="#d43878" stop-opacity=".95" />
        </linearGradient>
        <filter id="fb-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <!-- 鱼尾 -->
      <path :d="`M ${X0 - 34} ${SPINE_Y - 20} L ${X0} ${SPINE_Y} L ${X0 - 34} ${SPINE_Y + 20} Z`"
        fill="rgba(8,145,178,.1)" stroke="#0891b2" stroke-opacity=".5" stroke-width="1" />

      <!-- 主骨 -->
      <line :x1="X0" :y1="SPINE_Y" :x2="X1" :y2="SPINE_Y" stroke="url(#fb-spine)" stroke-width="2.5" />
      <line :x1="X0" :y1="SPINE_Y" :x2="X1" :y2="SPINE_Y" stroke="#1668dc" stroke-width="6"
        stroke-opacity=".14" filter="url(#fb-glow)" />

      <!-- 鱼头（结果） -->
      <g>
        <path :d="`M ${X1} ${SPINE_Y - 34} L ${X1 + 92} ${SPINE_Y} L ${X1} ${SPINE_Y + 34} Z`"
          fill="rgba(212,56,120,.08)" stroke="#d43878" stroke-width="1.2" />
        <text :x="X1 + 22" :y="SPINE_Y - 4" class="fb__effect">{{ effect.slice(0, 5) }}</text>
        <text :x="X1 + 22" :y="SPINE_Y + 10" class="fb__effect">{{ effect.slice(5, 10) }}</text>
      </g>

      <!-- 骨支 -->
      <g v-for="b in bones" :key="b.causeType"
        :class="['fb__bone', { 'is-dim': active && active !== b.causeType }]"
        @mouseenter="active = b.causeType" @mouseleave="active = ''">
        <!-- 主刺 -->
        <line :x1="b.baseX" :y1="SPINE_Y" :x2="b.tipX" :y2="b.tipY"
          :stroke="b.tone" stroke-width="2" stroke-linecap="round" />
        <line :x1="b.baseX" :y1="SPINE_Y" :x2="b.tipX" :y2="b.tipY"
          :stroke="b.tone" stroke-width="7" stroke-opacity=".2" filter="url(#fb-glow)" />

        <!-- 骨支标签 -->
        <g>
          <rect :x="b.tipX - 30" :y="b.up ? b.tipY - 20 : b.tipY + 2" width="60" height="17" rx="3"
            :fill="b.tone" fill-opacity=".16" :stroke="b.tone" stroke-opacity=".55" stroke-width="0.8" />
          <text :x="b.tipX" :y="b.up ? b.tipY - 8 : b.tipY + 14" text-anchor="middle"
            class="fb__cause" :fill="b.tone">
            {{ b.causeType }} · {{ b.count }}
          </text>
        </g>

        <!-- 细刺 + 文字 -->
        <g v-for="it in b.items" :key="it.idx">
          <line :x1="it.x" :y1="it.y" :x2="it.x + 40" :y2="it.y"
            :stroke="b.tone" stroke-width="1" stroke-opacity=".55" stroke-dasharray="2 2" />
          <circle :cx="it.x" :cy="it.y" r="2" :fill="b.tone" />
          <text :x="it.x + 44" :y="it.y + 3" class="fb__item">
            {{ it.text.length > 17 ? it.text.slice(0, 17) + '…' : it.text }}
          </text>
        </g>
      </g>
    </svg>

    <!-- 图例 -->
    <div class="fb__legend">
      <span v-for="b in bones" :key="b.causeType" class="fb__lg"
        :class="{ 'is-active': active === b.causeType }"
        :style="{ '--lc': b.tone }" @mouseenter="active = b.causeType" @mouseleave="active = ''">
        <i />{{ b.causeType }}
        <b>{{ b.ratio ?? 0 }}%</b>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fb {
  position: relative;
  width: 100%;

  &__svg { width: 100%; height: 100%; }

  &__effect {
    font-size: 11px; font-weight: 800; fill: #d43878; letter-spacing: 1px;
  }

  &__cause { font-size: 10px; font-weight: 700; }

  &__item {
    font-size: 9.5px; fill: var(--viz-text-dim, #8fabd4);
  }

  &__bone {
    cursor: pointer;
    transition: opacity .2s;
    &.is-dim { opacity: .26; }
  }

  &__legend {
    position: absolute; left: 0; bottom: -2px;
    display: flex; gap: 12px; flex-wrap: wrap;
  }

  &__lg {
    display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
    font-size: 10px; color: var(--viz-text-dim, #8fabd4);
    transition: color .18s;

    i {
      width: 8px; height: 8px; border-radius: 2px;
      background: var(--lc);
    }
    b { color: var(--lc); font-variant-numeric: tabular-nums; }
    &.is-active { color: var(--viz-text, #e8f2ff); }
  }
}
</style>
