<script setup lang="ts">
import * as echarts from 'echarts'

interface Props {
  /** 图表配置。此处放宽为 any，页面可直接书写字面量 option 而无需逐项断言 */
  option: Record<string, any>
  height?: string
  loading?: boolean
}
const props = withDefaults(defineProps<Props>(), { height: '280px', loading: false })
const emit = defineEmits<{ (e: 'click', params: any): void }>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let timer: any = null

function render() {
  if (!el.value) return
  if (!chart) {
    chart = echarts.init(el.value)
    chart.on('click', (p) => emit('click', p))
  }
  chart.setOption(props.option, true)
  safeResize()
}

/**
 * 防抖 resize，并跳过零宽度：
 * 图表处于 el-tab-pane / v-show 隐藏态时容器宽度为 0，ECharts 会退化成 100×100 默认画布；
 * 等切换显示后由 ResizeObserver / IntersectionObserver 触发，把画布尺寸纠正回容器实际尺寸。
 * 注意用 setTimeout 而非 requestAnimationFrame：后台标签页与部分内嵌浏览器会节流 rAF 导致回调不执行。
 */
function safeResize() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!chart || !el.value) return
    const { width, height } = el.value.getBoundingClientRect()
    if (width < 2 || height < 2) return
    // 画布尺寸与容器不一致时才 resize，避免无意义重绘
    if (Math.abs(chart.getWidth() - width) > 1 || Math.abs(chart.getHeight() - height) > 1) {
      chart.resize({ width, height })
    }
  }, 60)
}

watch(() => props.option, () => render(), { deep: true })
watch(
  () => props.loading,
  (v) => {
    if (!chart) return
    v ? chart.showLoading('default', { text: '加载中…', color: '#1668dc', textColor: '#43516b', maskColor: 'rgba(255,255,255,.7)' }) : chart.hideLoading()
  }
)

onMounted(() => {
  render()
  if (el.value) {
    ro = new ResizeObserver(safeResize)
    ro.observe(el.value)
    // 兜底：容器由隐藏变为可见时纠正尺寸（Tab / 折叠面板场景）
    io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) safeResize() })
    io.observe(el.value)
  }
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  ro?.disconnect()
  io?.disconnect()
  chart?.dispose()
  chart = null
})

defineExpose({ getInstance: () => chart })
</script>

<template>
  <div ref="el" class="e-chart" :style="{ height }" />
</template>

<style scoped lang="scss">
.e-chart { width: 100%; }
</style>
