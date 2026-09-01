<script setup lang="ts">
import { getMonitor, handleAlert, runEvaluate } from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const m = ref<any>(null)
const loading = ref(false)
const version = ref('v2.3.1')

const ST_TONE: Record<string, string> = { 优秀: 'lime', 良好: 'cyan', 待改进: 'amber' }
const LV_TONE: Record<string, string> = { 高: 'red', 中: 'amber', 低: 'cyan' }

async function load() {
  loading.value = true
  try { m.value = await getMonitor({ modelVersion: version.value }) } finally { loading.value = false }
}

const evaluating = ref(false)
async function doEvaluate() {
  evaluating.value = true
  try {
    const res: any = await runEvaluate()
    msg.success(res.message)
    await load()
  } finally { evaluating.value = false }
}

/* ---------- 预警处置 ---------- */
const alVisible = ref(false)
const alSaving = ref(false)
const alForm = reactive({ alertId: '', metric: '', action: '' })

function openAlert(a: any) {
  Object.assign(alForm, { alertId: a.alertId, metric: a.metric, action: a.suggestion })
  alVisible.value = true
}

async function doHandleAlert() {
  alSaving.value = true
  try {
    const res: any = await handleAlert(alForm)
    msg.success(res.message)
    alVisible.value = false
    await load()
  } finally { alSaving.value = false }
}

/* ========== 图表 ========== */
const AXIS_DARK = {
  axisLine: { lineStyle: { color: '#cdd7e6' } },
  axisTick: { show: false },
  axisLabel: { color: '#6b7a90', fontSize: 10 },
  splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } }
}
const TT = {
  backgroundColor: '#ffffff', borderColor: '#e2e8f2',
  textStyle: { color: '#1a2230', fontSize: 11 }
}

/** 五指标趋势 */
const trendOption = computed(() => {
  const t = m.value?.trend
  if (!t) return {}
  const series = [
    { k: 'accuracy', n: '准确率', c: '#12a150' },
    { k: 'precision', n: '精确率', c: '#0891b2' },
    { k: 'recall', n: '召回率', c: '#1668dc' },
    { k: 'f1Score', n: 'F1 值', c: '#722ed1' },
    { k: 'fpr', n: '误报率', c: '#e5484d' }
  ]
  return {
    tooltip: { trigger: 'axis', ...TT, valueFormatter: (v: any) => (v * 100).toFixed(1) + '%' },
    legend: {
      data: series.map((s) => s.n), top: 0, right: 0,
      itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 }
    },
    grid: { left: 44, right: 12, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: t.xAxis, boundaryGap: false, ...AXIS_DARK },
    yAxis: {
      type: 'value', min: 0, max: 1,
      axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => (v * 100).toFixed(0) + '%' },
      axisLine: AXIS_DARK.axisLine, axisTick: AXIS_DARK.axisTick, splitLine: AXIS_DARK.splitLine
    },
    series: series.map((s) => ({
      name: s.n, type: 'line', smooth: true, symbolSize: 5,
      lineStyle: { color: s.c, width: s.k === 'accuracy' ? 2.6 : 1.8, shadowColor: s.c, shadowBlur: s.k === 'accuracy' ? 12 : 0 },
      itemStyle: { color: s.c },
      areaStyle: s.k === 'accuracy'
        ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(76,245,168,.26)' }, { offset: 1, color: 'rgba(76,245,168,.01)' }] } }
        : undefined,
      data: t[s.k]
    })),
    markLine: undefined
  }
})

/** 按违规类型（热力条形：准确率 + 误报率双轴） */
const typeOption = computed(() => {
  const d = [...(m.value?.byViolationType || [])].sort((a: any, b: any) => a.accuracy - b.accuracy)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[p[0].dataIndex]
        return `${it.type}（${it.status}）<br/>准确率 ${(it.accuracy * 100).toFixed(1)}%<br/>精确率 ${(it.precision * 100).toFixed(1)}%<br/>召回率 ${(it.recall * 100).toFixed(1)}%<br/>F1 ${(it.f1 * 100).toFixed(1)}%<br/>误报率 ${(it.fpr * 100).toFixed(1)}%<br/>样本 ${it.sampleCount} 条`
      } },
    legend: { data: ['准确率', '误报率'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 8, right: 52, top: 28, bottom: 6, containLabel: true },
    xAxis: { type: 'value', ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.map((i: any) => i.type), ...AXIS_DARK, splitLine: { show: false } },
    series: [
      {
        name: '准确率', type: 'bar', barWidth: 9,
        itemStyle: {
          borderRadius: [0, 5, 5, 0],
          color: (p: any) => {
            const v = d[p.dataIndex].accuracy
            return v >= 0.93 ? '#12a150' : v >= 0.9 ? '#0891b2' : v >= 0.87 ? '#d48806' : '#e5484d'
          }
        },
        label: { show: true, position: 'right', formatter: (p: any) => (p.value * 100).toFixed(1) + '%', color: '#43516b', fontSize: 9.5, fontWeight: 700 },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: '#e5484d', type: 'dashed', width: 1.2 },
          label: { formatter: '预警线 85%', color: '#ffa8ab', fontSize: 9, position: 'insideEndTop' },
          data: [{ xAxis: 0.85 }]
        },
        data: d.map((i: any) => i.accuracy)
      },
      {
        name: '误报率', type: 'bar', barWidth: 9,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: 'rgba(229,72,77,.6)' },
        label: { show: true, position: 'right', formatter: (p: any) => (p.value * 100).toFixed(1) + '%', color: '#ffa8ab', fontSize: 9.5 },
        data: d.map((i: any) => i.fpr)
      }
    ]
  }
})

/** ROC 曲线 */
const rocOption = computed(() => {
  const d = m.value?.rocCurve || []
  const cur = m.value?.overallMetrics
  return {
    tooltip: { trigger: 'axis', ...TT, formatter: (p: any) => `FPR ${(p[0].value[0] * 100).toFixed(1)}%<br/>TPR ${(p[0].value[1] * 100).toFixed(1)}%` },
    grid: { left: 44, right: 14, top: 20, bottom: 30 },
    xAxis: { type: 'value', name: 'FPR', min: 0, max: 1, nameLocation: 'middle', nameGap: 18, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => v.toFixed(1) } },
    yAxis: { type: 'value', name: 'TPR', min: 0, max: 1, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => v.toFixed(1) } },
    series: [
      {
        name: 'ROC', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
        lineStyle: { color: '#0891b2', width: 2.4, shadowColor: '#0891b2', shadowBlur: 12 },
        itemStyle: { color: '#0891b2' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,104,220,.16)' }, { offset: 1, color: 'rgba(22,104,220,.02)' }] } },
        data: d.map((p: any) => [p.fpr, p.tpr]),
        markPoint: {
          symbolSize: 42,
          itemStyle: { color: 'rgba(76,245,168,.9)' },
          label: { formatter: 'AUC\n' + (cur?.auc ?? ''), color: '#1a2230', fontSize: 9, fontWeight: 700, lineHeight: 11 },
          data: [{ coord: [0.5, 0.42] }]
        }
      },
      {
        name: '随机基线', type: 'line', symbol: 'none',
        lineStyle: { color: 'rgba(143,171,212,.4)', type: 'dashed', width: 1 },
        data: [[0, 0], [1, 1]]
      }
    ]
  }
})

/** PR 曲线 */
const prOption = computed(() => {
  const d = m.value?.prCurve || []
  return {
    tooltip: { trigger: 'axis', ...TT, formatter: (p: any) => `Recall ${(p[0].value[0] * 100).toFixed(1)}%<br/>Precision ${(p[0].value[1] * 100).toFixed(1)}%` },
    grid: { left: 44, right: 14, top: 20, bottom: 30 },
    xAxis: { type: 'value', name: 'Recall', min: 0, max: 1, nameLocation: 'middle', nameGap: 18, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => v.toFixed(1) } },
    yAxis: { type: 'value', name: 'Precision', min: 0.6, max: 1, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => v.toFixed(1) } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      lineStyle: { color: '#722ed1', width: 2.4, shadowColor: '#722ed1', shadowBlur: 12 },
      itemStyle: { color: '#722ed1' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(163,91,255,.3)' }, { offset: 1, color: 'rgba(163,91,255,.02)' }] } },
      data: d.map((p: any) => [p.recall, p.precision]),
      markPoint: {
        symbol: 'pin', symbolSize: 34,
        itemStyle: { color: '#12a150' },
        label: { formatter: '当前', color: '#1a2230', fontSize: 8.5, fontWeight: 700 },
        data: [{ coord: [m.value?.overallMetrics?.recall || 0.856, m.value?.overallMetrics?.precision || 0.912] }]
      }
    }]
  }
})

/** 置信度分布（柱 + 准确率折线） */
const confOption = computed(() => {
  const d = m.value?.confidenceDistribution || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[p[0].dataIndex]
        return `置信度 ${it.range}<br/>样本 ${fmtNum(it.count)} 条（${(it.ratio * 100).toFixed(1)}%）<br/>实际准确率 ${(it.accuracy * 100).toFixed(0)}%`
      } },
    legend: { data: ['样本量', '实际准确率'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 42, right: 42, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.range), ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '条', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '准确率%', min: 40, max: 100, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      {
        name: '样本量', type: 'bar', barWidth: '52%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (p: any) => {
            const cs = ['#e5484d', '#ff8c5f', '#d48806', '#0891b2', '#12a150']
            return cs[p.dataIndex] || '#1668dc'
          },
          shadowBlur: 10, shadowColor: 'rgba(22,104,220,.18)'
        },
        label: { show: true, position: 'top', formatter: (p: any) => fmtNum(p.value), color: '#43516b', fontSize: 9.5, fontWeight: 700 },
        data: d.map((i: any) => i.count)
      },
      {
        name: '实际准确率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 7,
        lineStyle: { color: '#722ed1', width: 2.4, shadowColor: '#722ed1', shadowBlur: 10 },
        itemStyle: { color: '#722ed1' },
        label: { show: true, formatter: (p: any) => (p.value * 100).toFixed(0) + '%', color: '#c9a8ff', fontSize: 9.5, fontWeight: 700 },
        data: d.map((i: any) => i.accuracy)
      }
    ]
  }
})

/** 机构类型 + 区域（雷达双系列） */
const dimOption = computed(() => {
  const o = m.value?.byOrgType || []
  if (!o.length) return {}
  return {
    tooltip: { ...TT, valueFormatter: (v: any) => (v * 100).toFixed(1) + '%' },
    legend: { data: ['准确率', '误报率'], bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    radar: {
      indicator: o.map((x: any) => ({ name: x.type.length > 7 ? x.type.slice(0, 7) : x.type, max: 1, min: 0 })),
      radius: '60%', center: ['50%', '48%'],
      axisName: { color: '#6b7a90', fontSize: 9.5 },
      splitLine: { lineStyle: { color: '#eef1f7' } },
      splitArea: { areaStyle: { color: ['rgba(22,104,220,.04)', 'rgba(114,46,209,.05)'] } },
      axisLine: { lineStyle: { color: '#cdd7e6' } },
      axisLabel: { show: false }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: o.map((x: any) => x.accuracy), name: '准确率',
          areaStyle: { color: 'rgba(76,245,168,.24)' },
          lineStyle: { color: '#12a150', width: 2, shadowColor: '#12a150', shadowBlur: 10 },
          itemStyle: { color: '#12a150' },
          label: { show: true, formatter: (p: any) => (p.value * 100).toFixed(0), color: '#12a150', fontSize: 9, fontWeight: 700 }
        },
        {
          value: o.map((x: any) => x.fpr), name: '误报率',
          areaStyle: { color: 'rgba(229,72,77,.12)' },
          lineStyle: { color: '#e5484d', width: 1.8, type: 'dashed' },
          itemStyle: { color: '#e5484d' }
        }
      ]
    }]
  }
})

const cm = computed(() => m.value?.confusionMatrix || { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 })
const cmMax = computed(() => Math.max(cm.value.truePositive, cm.value.falsePositive, cm.value.falseNegative, cm.value.trueNegative, 1))

onMounted(load)
</script>

<template>
  <div class="viz-page" v-loading="loading" element-loading-background="rgba(255,255,255,.65)">
    <header class="viz-head">
      <div class="viz-head__t">
        准确率监控
        <span class="viz-head__sub">混淆矩阵 · ROC / PR 曲线 · 置信度分档 · 阈值自动预警</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Cpu /></el-icon>{{ m?.modelVersion }}</span>
        <span><el-icon><Calendar /></el-icon>{{ m?.monitorPeriod }}</span>
        <span class="viz-head__live" :class="{ 'is-warn': (m?.alerts || []).some((a: any) => !a.handled) }">
          <i />{{ m?.status }}
        </span>
      </div>
      <el-select v-model="version" size="small" class="viz-form" style="width: 122px" @change="load">
        <el-option v-for="v in (m?.modelComparison || [])" :key="v.version"
          :label="`${v.version}${v.status === '当前版本' ? ' ●' : ''}`" :value="v.version" />
      </el-select>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="load">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'DataAnalysis'" :loading="evaluating" @click="doEvaluate">
        月度全量评估
      </el-button>
    </header>

    <!-- ============ 六大指标 ============ -->
    <div class="viz-grid viz-grid--8 mo-kpi">
      <VizMetric label="准确率 Accuracy" :value="(m?.overallMetrics?.accuracy || 0) * 100" unit="%" icon="Aim"
        :tone="(m?.overallMetrics?.accuracy || 0) >= 0.9 ? 'lime' : 'amber'" :precision="1"
        :desc="`预警阈值 ${((m?.thresholds?.accuracy || 0.85) * 100).toFixed(0)}%`"
        :progress="(m?.overallMetrics?.accuracy || 0) * 100" />
      <VizMetric label="精确率 Precision" :value="(m?.overallMetrics?.precision || 0) * 100" unit="%" icon="Crop"
        tone="cyan" :precision="1" desc="预测为违规中真实违规占比"
        :progress="(m?.overallMetrics?.precision || 0) * 100" />
      <VizMetric label="召回率 Recall" :value="(m?.overallMetrics?.recall || 0) * 100" unit="%" icon="Search"
        tone="blue" :precision="1" desc="真实违规被识别出的占比"
        :progress="(m?.overallMetrics?.recall || 0) * 100" />
      <VizMetric label="F1 值" :value="(m?.overallMetrics?.f1Score || 0) * 100" unit="%" icon="Histogram"
        tone="violet" :precision="1" desc="精确率与召回率调和均值"
        :progress="(m?.overallMetrics?.f1Score || 0) * 100" />
      <VizMetric label="误报率 FPR" :value="(m?.overallMetrics?.falsePositiveRate || 0) * 100" unit="%" icon="WarnTriangleFilled"
        :tone="(m?.overallMetrics?.falsePositiveRate || 0) <= 0.1 ? 'lime' : 'red'" :precision="1"
        :desc="`预警阈值 ${((m?.thresholds?.falsePositiveRate || 0.1) * 100).toFixed(0)}%`"
        :progress="(m?.overallMetrics?.falsePositiveRate || 0) * 500" />
      <VizMetric label="漏报率 FNR" :value="(m?.overallMetrics?.falseNegativeRate || 0) * 100" unit="%" icon="CircleClose"
        tone="amber" :precision="1" desc="真实违规未被识别占比"
        :progress="(m?.overallMetrics?.falseNegativeRate || 0) * 400" />
      <VizMetric label="AUC" :value="(m?.overallMetrics?.auc || 0) * 100" unit="%" icon="TrendCharts"
        tone="lime" :precision="1" desc="ROC 曲线下面积"
        :progress="(m?.overallMetrics?.auc || 0) * 100" />
      <VizMetric label="评估样本量" :value="m?.overallMetrics?.sampleCount || 0" unit="条" icon="Files"
        tone="pink" :desc="`正 ${m?.overallMetrics?.positiveCount} / 负 ${m?.overallMetrics?.negativeCount}`" />
    </div>

    <!-- ============ 预警区 ============ -->
    <VizPanel v-if="(m?.alerts || []).length" title="指标预警" tone="red"
      :extra="`${(m?.alerts || []).filter((a: any) => !a.handled).length} 项待处置`" glow class="mo-alerts">
      <div class="alerts">
        <div v-for="a in m.alerts" :key="a.alertId" class="al"
          :class="[`al--${LV_TONE[a.level]}`, { 'is-handled': a.handled }]">
          <div class="al__lv">
            <el-icon :size="15"><component :is="a.handled ? 'CircleCheckFilled' : 'WarnTriangleFilled'" /></el-icon>
            <span>{{ a.level }}</span>
          </div>
          <div class="al__b">
            <div class="al__h">
              <span class="al__id viz-num">{{ a.alertId }}</span>
              <b class="al__m">{{ a.metric }}</b>
              <span class="viz-tag" :class="a.status === '接近阈值' ? 'viz-tag--amber' : 'viz-tag--red'">{{ a.status }}</span>
              <span class="al__v viz-num">
                {{ (a.value * 100).toFixed(1) }}% <small>/ 阈值 {{ (a.threshold * 100).toFixed(0) }}%</small>
              </span>
            </div>
            <div class="al__msg">{{ a.message }}</div>
            <div class="al__sug"><el-icon :size="10"><Opportunity /></el-icon>{{ a.suggestion }}</div>
          </div>
          <div class="al__a">
            <span v-if="a.handled" class="viz-tag viz-tag--lime">已处置</span>
            <el-button v-else class="viz-btn" size="small" :icon="'Tools'" @click="openAlert(a)">处置</el-button>
            <div class="al__t viz-num">{{ a.time?.slice(5, 16) }}</div>
          </div>
        </div>
      </div>
    </VizPanel>

    <!-- ============ 混淆矩阵 + ROC + PR ============ -->
    <div class="mo-c1">
      <VizPanel title="混淆矩阵" tone="cyan" extra="预测 vs 实际" glow>
        <div class="cmx">
          <div class="cmx__corner">
            <span class="cmx__ax">预测 →</span>
            <span class="cmx__ay">↓ 实际</span>
          </div>
          <div class="cmx__hl">违规</div>
          <div class="cmx__hl">合理</div>

          <div class="cmx__vl">违规</div>
          <div class="cmc cmc--tp" :style="{ '--k': cm.truePositive / cmMax }">
            <b class="viz-num">{{ fmtNum(cm.truePositive) }}</b>
            <span>TP 真正例</span>
          </div>
          <div class="cmc cmc--fn" :style="{ '--k': cm.falseNegative / cmMax }">
            <b class="viz-num">{{ fmtNum(cm.falseNegative) }}</b>
            <span>FN 漏报</span>
          </div>

          <div class="cmx__vl">合理</div>
          <div class="cmc cmc--fp" :style="{ '--k': cm.falsePositive / cmMax }">
            <b class="viz-num">{{ fmtNum(cm.falsePositive) }}</b>
            <span>FP 误报</span>
          </div>
          <div class="cmc cmc--tn" :style="{ '--k': cm.trueNegative / cmMax }">
            <b class="viz-num">{{ fmtNum(cm.trueNegative) }}</b>
            <span>TN 真负例</span>
          </div>
        </div>
        <div class="cmx__legend">
          <span><i class="is-ok" />判断正确 {{ fmtNum(cm.truePositive + cm.trueNegative) }} 条</span>
          <span><i class="is-no" />判断错误 {{ fmtNum(cm.falsePositive + cm.falseNegative) }} 条</span>
        </div>
      </VizPanel>

      <VizPanel title="ROC 曲线" tone="cyan" :extra="`AUC = ${m?.overallMetrics?.auc ?? '—'}`">
        <EChart :option="rocOption" height="222px" />
      </VizPanel>

      <VizPanel title="PR 曲线" tone="violet" extra="精确率-召回率权衡">
        <EChart :option="prOption" height="222px" />
      </VizPanel>
    </div>

    <!-- ============ 趋势 + 违规类型 ============ -->
    <div class="mo-c2">
      <VizPanel title="核心指标趋势" tone="lime" extra="3-8月 · 准确率稳步提升" glow>
        <EChart :option="trendOption" height="238px" />
      </VizPanel>
      <VizPanel title="按违规类型表现" tone="amber" extra="准确率 / 误报率 · 含 85% 预警线" glow>
        <EChart :option="typeOption" height="238px" />
      </VizPanel>
    </div>

    <!-- ============ 置信度 + 维度雷达 ============ -->
    <div class="mo-c3">
      <VizPanel title="置信度分档与实际准确率" tone="pink" extra="置信度越高准确率越高" glow>
        <EChart :option="confOption" height="222px" />
        <div class="viz-note" style="margin-top: 6px">
          <el-icon><InfoFilled /></el-icon>
          置信度 90% 以上样本实际准确率达 97%，可用于自动流转；30% 以下样本准确率仅 52%，需人工优先复核。
        </div>
      </VizPanel>

      <VizPanel title="按机构类型表现" tone="blue" extra="准确率 vs 误报率">
        <EChart :option="dimOption" height="222px" />
      </VizPanel>

      <VizPanel title="按区域表现" tone="cyan" extra="8 个统筹区">
        <div class="areas viz-scroll">
          <div v-for="a in (m?.byArea || [])" :key="a.area" class="ar">
            <span class="ar__n">{{ a.area }}</span>
            <span class="ar__bar">
              <span class="ar__f" :style="{ width: (a.accuracy * 100) + '%', '--afc': a.accuracy >= 0.9 ? '#12a150' : a.accuracy >= 0.88 ? '#0891b2' : '#d48806' }" />
            </span>
            <b class="ar__v viz-num">{{ (a.accuracy * 100).toFixed(1) }}%</b>
            <span class="ar__fpr viz-num">FPR {{ (a.fpr * 100).toFixed(1) }}%</span>
            <span class="ar__s viz-num viz-faint">{{ a.sampleCount }}</span>
          </div>
        </div>
      </VizPanel>
    </div>

    <!-- ============ 明细表 + 版本对比 ============ -->
    <div class="mo-c4">
      <VizPanel title="分违规类型指标明细" tone="cyan" extra="8 类违规">
        <el-table class="viz-table" :data="m?.byViolationType || []" size="small" border stripe>
          <el-table-column prop="type" label="违规类型" width="104" />
          <el-table-column prop="accuracy" label="准确率" width="96" align="center" sortable>
            <template #default="{ row }">
              <span class="viz-num" :style="{ color: row.accuracy >= 0.9 ? 'var(--viz-lime)' : row.accuracy >= 0.87 ? 'var(--viz-cyan)' : 'var(--viz-amber)', fontWeight: 700 }">
                {{ (row.accuracy * 100).toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="precision" label="精确率" width="88" align="center">
            <template #default="{ row }"><span class="viz-num viz-dim">{{ (row.precision * 100).toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column prop="recall" label="召回率" width="88" align="center">
            <template #default="{ row }"><span class="viz-num viz-dim">{{ (row.recall * 100).toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column prop="f1" label="F1" width="80" align="center">
            <template #default="{ row }"><span class="viz-num viz-dim">{{ (row.f1 * 100).toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column prop="fpr" label="误报率" width="96" align="center" sortable>
            <template #default="{ row }">
              <span class="viz-num" :style="{ color: row.fpr > 0.1 ? 'var(--viz-red)' : 'var(--viz-text-dim)', fontWeight: row.fpr > 0.1 ? 700 : 400 }">
                {{ (row.fpr * 100).toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="sampleCount" label="样本量" width="88" align="right" sortable>
            <template #default="{ row }"><span class="viz-num viz-dim">{{ row.sampleCount }}</span></template>
          </el-table-column>
          <el-table-column prop="status" label="评级" width="86" align="center">
            <template #default="{ row }">
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[row.status]}`">{{ row.status }}</span>
            </template>
          </el-table-column>
        </el-table>
      </VizPanel>

      <VizPanel title="版本指标对比" tone="lime" extra="含灰度版本">
        <div class="vcmp">
          <div v-for="v in (m?.modelComparison || [])" :key="v.version" class="vc"
            :class="v.status === '当前版本' ? 'is-cur' : v.status === '灰度中' ? 'is-gray' : 'is-old'">
            <div class="vc__h">
              <b class="vc__v viz-num">{{ v.version }}</b>
              <span class="viz-tag"
                :class="v.status === '当前版本' ? 'viz-tag--cyan' : v.status === '灰度中' ? 'viz-tag--amber' : 'viz-tag--faint'">
                {{ v.status }}
              </span>
              <span class="vc__d viz-num viz-faint">{{ v.releaseDate }}</span>
            </div>
            <div class="vc__mx">
              <div class="vcm">
                <span>准确率</span>
                <span class="vcm__bar"><span :style="{ width: (v.accuracy * 100) + '%' }" /></span>
                <b class="viz-num">{{ (v.accuracy * 100).toFixed(1) }}%</b>
              </div>
              <div class="vcm">
                <span>F1 值</span>
                <span class="vcm__bar"><span class="is-f1" :style="{ width: (v.f1 * 100) + '%' }" /></span>
                <b class="viz-num">{{ (v.f1 * 100).toFixed(1) }}%</b>
              </div>
              <div class="vcm">
                <span>误报率</span>
                <span class="vcm__bar"><span class="is-fpr" :style="{ width: (v.fpr * 700) + '%' }" /></span>
                <b class="viz-num" style="color: var(--viz-red)">{{ (v.fpr * 100).toFixed(1) }}%</b>
              </div>
            </div>
          </div>
        </div>
        <div class="viz-note" style="margin-top: 9px">
          <el-icon><InfoFilled /></el-icon>
          下次全量评估：{{ m?.nextEvaluation }}
        </div>
      </VizPanel>
    </div>

    <!-- ============ 预警处置弹窗 ============ -->
    <el-dialog v-model="alVisible" title="预警处置" width="560px" class="viz-dialog">
      <el-alert class="viz-alert" type="warning" :closable="false" show-icon>
        <template #title>
          <span class="viz-mini">处置后将关联至模型优化建议流程，纳入下一轮迭代</span>
        </template>
      </el-alert>
      <el-form class="viz-form" label-width="86px" style="margin-top: 12px">
        <el-form-item label="预警编号">
          <el-input v-model="alForm.alertId" disabled />
        </el-form-item>
        <el-form-item label="预警指标">
          <el-input v-model="alForm.metric" disabled />
        </el-form-item>
        <el-form-item label="处置措施" required>
          <el-input v-model="alForm.action" type="textarea" :rows="3" placeholder="请填写处置措施" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="alVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="alSaving" @click="doHandleAlert">确认处置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mo-kpi { margin-bottom: 12px; }
.mo-alerts { margin-bottom: 12px; }

.viz-head__live.is-warn {
  color: var(--viz-amber); background: rgba(255, 184, 56, .12); border-color: rgba(255, 184, 56, .34);
  i { background: var(--viz-amber); box-shadow: 0 0 8px var(--viz-amber); }
}

.mo-c1 {
  display: grid; grid-template-columns: 1.05fr 1fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1340px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.mo-c2 {
  display: grid; grid-template-columns: 1.15fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.mo-c3 {
  display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1340px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.mo-c4 {
  display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

/* ---------- 预警 ---------- */
.alerts { display: flex; flex-direction: column; gap: 8px; }

.al {
  display: grid; grid-template-columns: 48px 1fr 96px; gap: 11px; align-items: center;
  padding: 9px 12px; border-radius: 4px;
  background: color-mix(in srgb, var(--alc) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--alc) 28%, transparent);
  border-left: 2px solid var(--alc);
  @media (max-width: 820px) { grid-template-columns: 1fr; }

  &--red { --alc: var(--viz-red); }
  &--amber { --alc: var(--viz-amber); }
  &--cyan { --alc: var(--viz-cyan); }

  &.is-handled { opacity: .58; --alc: var(--viz-lime); }

  &__lv {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    :deep(.el-icon) { color: var(--alc); }
    span { font-size: 10px; font-weight: 700; color: var(--alc); }
  }

  &__b { min-width: 0; }
  &__h { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  &__id { font-size: 9.5px; color: var(--viz-text-faint); }
  &__m { font-size: 12px; color: var(--viz-text); }
  &__v {
    margin-left: auto; font-size: 13px; font-weight: 800; color: var(--alc);
    small { font-size: 9.5px; font-weight: 400; color: var(--viz-text-faint); }
  }
  &__msg { margin-top: 5px; font-size: 11px; line-height: 1.7; color: var(--viz-text-dim); }
  &__sug {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 4px;
    font-size: 10.5px; line-height: 1.65; color: var(--viz-cyan);
    :deep(.el-icon) { flex-shrink: 0; margin-top: 3px; }
  }

  &__a { text-align: center; }
  &__t { margin-top: 4px; font-size: 9px; color: var(--viz-text-faint); }
}

/* ---------- 混淆矩阵 ---------- */
.cmx {
  display: grid; grid-template-columns: 46px 1fr 1fr; gap: 6px;
  align-items: stretch;

  &__corner {
    position: relative;
  }
  &__ax {
    position: absolute; right: -2px; bottom: 4px;
    font-size: 8.5px; color: var(--viz-text-faint);
  }
  &__ay {
    position: absolute; left: 0; bottom: -20px;
    font-size: 8.5px; color: var(--viz-text-faint);
  }

  &__hl {
    display: flex; align-items: center; justify-content: center;
    font-size: 10.5px; font-weight: 700; color: var(--viz-text-dim);
    padding-bottom: 3px;
  }

  &__vl {
    display: flex; align-items: center; justify-content: center;
    font-size: 10.5px; font-weight: 700; color: var(--viz-text-dim);
  }

  &__legend {
    display: flex; gap: 16px; justify-content: center; margin-top: 12px;
    font-size: 10px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 4px; }
    i {
      width: 9px; height: 9px; border-radius: 2px;
      &.is-ok { background: var(--viz-lime); box-shadow: 0 0 6px var(--viz-lime); }
      &.is-no { background: var(--viz-red); box-shadow: 0 0 6px var(--viz-red); }
    }
  }
}

.cmc {
  padding: 14px 8px; border-radius: 4px; text-align: center;
  background: color-mix(in srgb, var(--cc) calc(12% + var(--k) * 30%), transparent);
  border: 1px solid color-mix(in srgb, var(--cc) 34%, transparent);
  transition: transform .2s;
  &:hover { transform: scale(1.04); }

  &--tp { --cc: var(--viz-lime); }
  &--tn { --cc: var(--viz-lime); }
  &--fp { --cc: var(--viz-red); }
  &--fn { --cc: var(--viz-amber); }

  b {
    display: block; font-size: 22px; font-weight: 800; color: var(--cc);
  }
  span { font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- 区域列表 ---------- */
.areas { display: flex; flex-direction: column; gap: 6px; max-height: 222px; }

.ar {
  display: grid; grid-template-columns: 54px 1fr 50px 74px 40px;
  align-items: center; gap: 7px;
  padding: 5px 8px; border-radius: 3px;
  background: var(--zh-bg-soft);

  &__n { font-size: 10.5px; color: var(--viz-text-dim); }
  &__bar { height: 5px; border-radius: 3px; background: var(--zh-border-light); overflow: hidden; }
  &__f {
    display: block; height: 100%; border-radius: 3px;
    background: var(--afc); box-shadow: 0 0 8px var(--afc);
  }
  &__v { text-align: right; font-size: 11px; font-weight: 700; color: var(--viz-text); }
  &__fpr { text-align: right; font-size: 9.5px; color: var(--viz-red); }
  &__s { text-align: right; font-size: 9.5px; }
}

/* ---------- 版本对比 ---------- */
.vcmp { display: flex; flex-direction: column; gap: 8px; }

.vc {
  padding: 9px 11px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--vcc);

  &.is-cur { --vcc: var(--viz-cyan); background: var(--zh-primary-lighter); }
  &.is-gray { --vcc: var(--viz-amber); background: rgba(255, 184, 56, .07); }
  &.is-old { --vcc: var(--viz-text-faint); }

  &__h { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  &__v { font-size: 12.5px; font-weight: 800; color: var(--vcc); }
  &__d { margin-left: auto; font-size: 9.5px; }
  &__mx { margin-top: 7px; display: flex; flex-direction: column; gap: 5px; }
}

.vcm {
  display: grid; grid-template-columns: 46px 1fr 48px;
  align-items: center; gap: 7px;
  font-size: 9.5px; color: var(--viz-text-faint);

  &__bar {
    height: 4px; border-radius: 2px; background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--viz-lime); box-shadow: 0 0 6px var(--viz-lime);
      &.is-f1 { background: var(--viz-violet); box-shadow: 0 0 6px var(--viz-violet); }
      &.is-fpr { background: var(--viz-red); box-shadow: 0 0 6px var(--viz-red); }
    }
  }
  b { text-align: right; font-size: 10.5px; font-weight: 700; color: var(--viz-text-dim); }
}
</style>
