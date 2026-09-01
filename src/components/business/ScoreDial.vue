<script setup lang="ts">
/**
 * ScoreDial —— 案件质量评分仪表盘（agent05 M31 专属）
 * 五维等权 20 分，以「五叶花瓣」环形呈现：
 *   - 中心大数字为总分，颜色随等级变化
 *   - 五片扇形花瓣分别代表 5 个维度，填充比例 = 该维得分/20
 *   - 花瓣外圈刻度显示等级分界（70 / 80 / 90）
 */
const props = withDefaults(defineProps<{
  /** 总分 0-100 */
  total: number
  grade: string
  /** 5 个维度 */
  dimensions: { dimension: string; score: number; fullScore: number; deductionReason?: string | null }[]
  /** 尺寸 px */
  size?: number
  /** 是否显示维度标签 */
  showLabels?: boolean
  /** 全市平均分（画参考虚线） */
  avg?: number
}>(), { size: 260, showLabels: true })

const GRADE_COLOR: Record<string, string> = {
  优秀: '#12a150', 良好: '#1668dc', 合格: '#e8a30c', 不合格: '#e5484d'
}
const color = computed(() => GRADE_COLOR[props.grade] || '#1668dc')

const R_OUT = 46
const R_IN = 26
const CX = 60
const CY = 60
/** 每片花瓣占 66°，间隔 6° */
const SPAN = 66
const GAP = 6

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

/** 生成环形扇区路径 */
function sector(rIn: number, rOut: number, a0: number, a1: number) {
  const [x0, y0] = polar(CX, CY, rOut, a0)
  const [x1, y1] = polar(CX, CY, rOut, a1)
  const [x2, y2] = polar(CX, CY, rIn, a1)
  const [x3, y3] = polar(CX, CY, rIn, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rIn} ${rIn} 0 ${large} 0 ${x3} ${y3} Z`
}

const petals = computed(() =>
  props.dimensions.map((dm, i) => {
    const a0 = i * (SPAN + GAP) + GAP / 2
    const a1 = a0 + SPAN
    const rate = dm.score / (dm.fullScore || 20)
    // 花瓣按得分比例向外生长
    const rFill = R_IN + (R_OUT - R_IN) * rate
    const mid = (a0 + a1) / 2
    const [lx, ly] = polar(CX, CY, R_OUT + 11, mid)
    return {
      ...dm,
      rate,
      bgPath: sector(R_IN, R_OUT, a0, a1),
      fillPath: sector(R_IN, rFill, a0, a1),
      labelX: lx,
      labelY: ly,
      mid,
      anchor: mid > 20 && mid < 160 ? 'start' : mid > 200 && mid < 340 ? 'end' : 'middle',
      tone: rate >= 1 ? '#12a150' : rate >= 0.85 ? '#1668dc' : rate >= 0.7 ? '#e8a30c' : '#e5484d'
    }
  })
)

/** 等级分界刻度（外圈短线） */
const ticks = [70, 80, 90].map((v) => {
  const deg = (v / 100) * 354
  const [x0, y0] = polar(CX, CY, R_OUT + 2, deg)
  const [x1, y1] = polar(CX, CY, R_OUT + 5.5, deg)
  return { v, x0, y0, x1, y1 }
})
</script>

<template>
  <div class="sd" :style="{ width: size + 'px' }">
    <svg :viewBox="`0 0 120 120`" class="sd__svg">
      <defs>
        <filter id="sd-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <radialGradient id="sd-core">
          <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- 中心柔光 -->
      <circle :cx="CX" :cy="CY" :r="R_IN + 2" fill="url(#sd-core)" />

      <!-- 花瓣底槽 -->
      <path v-for="(p, i) in petals" :key="'bg' + i" :d="p.bgPath"
        fill="#eef1f7" stroke="#e2e8f2" stroke-width="0.5" />

      <!-- 花瓣填充（含发光） -->
      <g filter="url(#sd-blur)" opacity="0.55">
        <path v-for="(p, i) in petals" :key="'gl' + i" :d="p.fillPath" :fill="p.tone" />
      </g>
      <path v-for="(p, i) in petals" :key="'fl' + i" :d="p.fillPath" :fill="p.tone" class="sd__petal"
        :style="{ animationDelay: i * 90 + 'ms' }" />

      <!-- 满分标记 -->
      <template v-for="(p, i) in petals" :key="'pf' + i">
        <circle v-if="p.rate >= 1" :cx="polar(CX, CY, R_OUT - 4, p.mid)[0]" :cy="polar(CX, CY, R_OUT - 4, p.mid)[1]"
          r="1.6" fill="#fff" opacity=".92" />
      </template>

      <!-- 等级刻度 -->
      <line v-for="t in ticks" :key="t.v" :x1="t.x0" :y1="t.y0" :x2="t.x1" :y2="t.y1"
        stroke="#9aa7b8" stroke-width="0.7" />

      <!-- 内圈描边 -->
      <circle :cx="CX" :cy="CY" :r="R_IN - 1" fill="none" :stroke="color" stroke-opacity=".42" stroke-width="0.8" />

      <!-- 中心总分 -->
      <text :x="CX" :y="CY + 1" text-anchor="middle" class="sd__total" :fill="color">{{ total }}</text>
      <text :x="CX" :y="CY + 13" text-anchor="middle" class="sd__grade" :fill="color">{{ grade }}</text>
      <text v-if="avg !== undefined" :x="CX" :y="CY - 12" text-anchor="middle" class="sd__avg">
        均 {{ avg }}
      </text>

      <!-- 维度标签 -->
      <template v-if="showLabels">
        <text v-for="(p, i) in petals" :key="'lb' + i" :x="p.labelX" :y="p.labelY"
          :text-anchor="p.anchor" class="sd__label" :fill="p.tone">
          {{ p.dimension.slice(0, 3) }}
          <tspan class="sd__lv" :fill="p.tone">{{ p.score }}</tspan>
        </text>
      </template>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.sd {
  position: relative;
  aspect-ratio: 1;
  margin: 0 auto;

  &__svg { width: 100%; height: 100%; overflow: visible; }

  &__petal {
    transform-origin: 60px 60px;
    animation: sdGrow .8s cubic-bezier(.22, .9, .28, 1) both;
  }

  &__total {
    font-size: 21px; font-weight: 800;
    font-family: var(--zh-font-num, inherit);
    dominant-baseline: middle;
  }

  &__grade { font-size: 6.5px; font-weight: 700; opacity: .92; }

  &__avg { font-size: 5px; fill: var(--viz-text-faint, #8fabd4); }

  &__label {
    font-size: 5.4px; font-weight: 700;
  }

  &__lv { font-size: 6.2px; font-weight: 800; }
}

@keyframes sdGrow {
  from { transform: scale(.2); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
