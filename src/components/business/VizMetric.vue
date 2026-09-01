<script setup lang="ts">
/**
 * VizMetric —— 大屏核心指标卡（agent05 专属）
 * 特点：数字滚动动画 + 霓虹描边 + 趋势箭头 + 底部微型进度轨
 */
const props = withDefaults(defineProps<{
  label: string
  value: number | string
  unit?: string
  /** 趋势文本，如 +12.5% */
  trend?: string
  /** 趋势是否向上 */
  up?: boolean
  icon?: string
  tone?: 'cyan' | 'blue' | 'violet' | 'lime' | 'amber' | 'pink' | 'red' | 'faint'
  /** 小数位 */
  precision?: number
  /** 底部补充说明 */
  desc?: string
  /** 底部进度轨（0-100），不传则不显示 */
  progress?: number
  /** 是否启用数字滚动 */
  animate?: boolean
  /** 紧凑模式 */
  compact?: boolean
}>(), { tone: 'cyan', precision: 0, animate: true, compact: false })

const shown = ref<number>(0)
const isNum = computed(() => typeof props.value === 'number')
let timer: any = null

function runAnim(target: number) {
  if (timer) { clearInterval(timer); timer = null }
  if (!props.animate) { shown.value = target; return }
  const from = shown.value
  const diff = target - from
  if (!diff) { shown.value = target; return }
  const dur = 900
  const t0 = Date.now()
  // 用 setInterval 而非 rAF：后台标签页 / 部分内嵌浏览器会节流 rAF 导致动画不执行
  timer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / dur)
    // easeOutCubic
    shown.value = from + diff * (1 - Math.pow(1 - k, 3))
    if (k >= 1) {
      shown.value = target
      clearInterval(timer)
      timer = null
    }
  }, 24)
}

const display = computed(() => {
  if (!isNum.value) return String(props.value)
  const v = shown.value
  return props.precision > 0
    ? v.toFixed(props.precision)
    : Math.round(v).toLocaleString('en-US')
})

watch(() => props.value, (v) => { if (typeof v === 'number') runAnim(v) })
onMounted(() => { if (isNum.value) runAnim(props.value as number) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="vm" :class="[`vm--${tone}`, { 'is-compact': compact }]">
    <div class="vm__glow" />

    <div class="vm__top">
      <span class="vm__label">{{ label }}</span>
      <el-icon v-if="icon" class="vm__icon"><component :is="icon" /></el-icon>
    </div>

    <div class="vm__val">
      <span class="vm__num">{{ display }}</span>
      <span v-if="unit" class="vm__unit">{{ unit }}</span>
    </div>

    <div class="vm__foot">
      <span v-if="trend" class="vm__trend" :class="up ? 'is-up' : 'is-down'">
        <el-icon :size="10"><component :is="up ? 'Top' : 'Bottom'" /></el-icon>{{ trend }}
      </span>
      <span v-if="desc" class="vm__desc">{{ desc }}</span>
    </div>

    <div v-if="progress !== undefined" class="vm__track">
      <span class="vm__fill" :style="{ width: Math.min(100, Math.max(0, progress)) + '%' }" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.vm {
  position: relative;
  padding: 11px 13px 12px;
  border-radius: 4px;
  background: var(--viz-panel);
  border: 1px solid var(--viz-line);
  box-shadow: var(--zh-shadow-xs);
  overflow: hidden;
  transition: transform .22s, box-shadow .22s, border-color .22s;

  &--cyan { --mc: var(--viz-cyan); }
  &--blue { --mc: var(--viz-blue); }
  &--violet { --mc: var(--viz-violet); }
  &--lime { --mc: var(--viz-lime); }
  &--amber { --mc: var(--viz-amber); }
  &--pink { --mc: var(--viz-pink); }
  &--red { --mc: var(--viz-red); }
  &--faint { --mc: var(--viz-text-faint); }

  &:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--mc) 52%, transparent);
    box-shadow: 0 8px 26px -10px color-mix(in srgb, var(--mc) 48%, transparent);
  }

  // 左侧竖条
  &::before {
    content: '';
    position: absolute; left: 0; top: 12%; bottom: 12%; width: 2px;
    background: var(--mc);
    box-shadow: 0 0 10px var(--mc);
  }

  &__glow {
    position: absolute; right: -28px; top: -28px;
    width: 84px; height: 84px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--mc) 34%, transparent), transparent 70%);
    pointer-events: none;
  }

  &__top {
    display: flex; align-items: center; justify-content: space-between; gap: 6px;
  }

  &__label {
    font-size: 11px; color: var(--viz-text-dim); letter-spacing: .3px;
  }

  &__icon { font-size: 14px; color: var(--mc); opacity: .88; }

  &__val {
    display: flex; align-items: baseline; gap: 4px; margin-top: 5px;
  }

  &__num {
    font-size: 26px; font-weight: 800; line-height: 1.1;
    color: var(--viz-text);
    font-variant-numeric: tabular-nums;
  }

  &__unit { font-size: 11px; color: var(--viz-text-dim); }

  &__foot {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 5px;
    min-height: 14px;
  }

  &__trend {
    display: inline-flex; align-items: center; gap: 2px;
    font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums;
    padding: 1px 5px; border-radius: 3px;

    &.is-up { color: var(--viz-lime); background: color-mix(in srgb, var(--viz-lime) 12%, transparent); }
    &.is-down { color: var(--viz-red); background: color-mix(in srgb, var(--viz-red) 10%, transparent); }
  }

  &__desc { font-size: 10px; color: var(--viz-text-faint); }

  &__track {
    margin-top: 8px; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
  }

  &__fill {
    display: block; height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--mc) 55%, transparent), var(--mc));
    transition: width .9s cubic-bezier(.22, .8, .3, 1);
  }

  &.is-compact {
    padding: 8px 10px 9px;
    .vm__num { font-size: 20px; }
    .vm__label { font-size: 10px; }
  }
}
</style>
