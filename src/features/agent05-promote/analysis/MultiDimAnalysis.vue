<script setup lang="ts">
import { getMultiDim, drillDown } from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const data = ref<any>(null)
const loading = ref(false)
const timeRange = ref('2026年1-8月')

/** 当前分析维度 */
const dimKey = ref('area')
const method = ref('占比分析')

async function load() {
  loading.value = true
  try { data.value = await getMultiDim({ timeRange: timeRange.value }) } finally { loading.value = false }
}

/* ---------- 五级钻取 ---------- */
const drillLevel = ref(1)
const drillData = ref<any>(null)
const drillLoading = ref(false)

async function doDrill(lv: number) {
  if (lv < 1 || lv > 5) return
  drillLoading.value = true
  try {
    drillData.value = await drillDown(lv)
    drillLevel.value = lv
  } finally { drillLoading.value = false }
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
const HEX = ['#0891b2', '#12a150', '#722ed1', '#d48806', '#d43878', '#1668dc', '#e5484d', '#5a9cf0']

/** 区域对比（柱线组合：线索/金额/阳性率） */
const areaOption = computed(() => {
  const d = data.value?.byArea || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: {
      data: ['线索数', '违规金额(万)', '阳性率(%)'], top: 0, right: 0,
      itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 }
    },
    grid: { left: 42, right: 44, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.area), ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '条', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '% / 万', min: 0, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      {
        name: '线索数', type: 'bar', barWidth: 15,
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#0891b2' }, { offset: 1, color: 'rgba(22,104,220,.14)' }] }
        },
        data: d.map((i: any) => i.clue)
      },
      {
        name: '违规金额(万)', type: 'bar', barWidth: 15, yAxisIndex: 1,
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#d43878' }, { offset: 1, color: 'rgba(212,56,120,.12)' }] }
        },
        data: d.map((i: any) => i.violation)
      },
      {
        name: '阳性率(%)', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6,
        lineStyle: { color: '#12a150', width: 2.4, shadowColor: '#12a150', shadowBlur: 10 },
        itemStyle: { color: '#12a150' },
        label: { show: true, color: '#12a150', fontSize: 9, fontWeight: 700 },
        data: d.map((i: any) => i.positiveRate)
      }
    ]
  }
})

/** 机构类型对比（横条：线索 vs 金额，双向对称） */
const orgOption = computed(() => {
  const d = data.value?.byOrgType || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[p[0].dataIndex]
        return `${it.type}<br/>线索 ${fmtNum(it.clue)} 条<br/>违规金额 ${it.violation} 万元<br/>单条均值 ${(it.avgAmount * 10000).toFixed(0)} 元<br/>金额占比 ${it.ratio}%`
      } },
    legend: { data: ['线索数', '违规金额(万)'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 8, right: 12, top: 28, bottom: 6, containLabel: true },
    xAxis: [
      { type: 'value', ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } }
    ],
    yAxis: { type: 'category', data: d.map((i: any) => i.type), ...AXIS_DARK, splitLine: { show: false }, inverse: true },
    series: [
      {
        name: '线索数', type: 'bar', barWidth: 9, stack: undefined,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: '#0891b2' },
        label: { show: true, position: 'right', formatter: (p: any) => fmtNum(p.value), color: '#0891b2', fontSize: 9.5 },
        data: d.map((i: any) => i.clue)
      },
      {
        name: '违规金额(万)', type: 'bar', barWidth: 9,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: '#d43878' },
        label: { show: true, position: 'right', color: '#ffb8d6', fontSize: 9.5 },
        data: d.map((i: any) => i.violation)
      }
    ]
  }
})

/** 违规类型（气泡散点：线索数 × 追回率，气泡=金额） */
const vtOption = computed(() => {
  const d = data.value?.byViolationType || []
  const max = Math.max(...d.map((x: any) => x.violation), 1)
  return {
    tooltip: { ...TT,
      formatter: (p: any) =>
        `${p.data.name}<br/>线索 ${fmtNum(p.data.value[0])} 条<br/>追回率 ${p.data.value[1]}%<br/>违规金额 ${p.data.value[2]} 万元<br/>趋势 ${p.data.trend} · 同比 ${p.data.yoy}` },
    grid: { left: 46, right: 20, top: 22, bottom: 30 },
    xAxis: { type: 'value', name: '线索数', nameLocation: 'middle', nameGap: 20, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    yAxis: { type: 'value', name: '追回率%', min: 88, max: 94, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    series: [{
      type: 'scatter',
      symbolSize: (v: any) => 12 + (v[2] / max) * 34,
      itemStyle: {
        color: (p: any) => (p.data.trend === '上升' ? '#e5484d' : p.data.trend === '下降' ? '#12a150' : '#d48806'),
        shadowBlur: 12,
        shadowColor: (p: any) => (p.data.trend === '上升' ? 'rgba(255,90,95,.6)' : 'rgba(76,245,168,.5)'),
        opacity: .85
      },
      label: {
        show: true, formatter: '{b}', position: 'top', distance: 4,
        color: '#43516b', fontSize: 9.5, fontWeight: 600,
        textShadowColor: 'rgba(255,255,255,.9)', textShadowBlur: 4
      },
      data: d.map((i: any) => ({
        name: i.type, value: [i.clue, i.recoveryRate, i.violation],
        trend: i.trend, yoy: i.yoy
      }))
    }]
  }
})

/** 月度趋势（多指标堆叠 + 阳性率） */
const monthOption = computed(() => {
  const d = data.value?.monthlyTrend || []
  return {
    tooltip: { trigger: 'axis', ...TT },
    legend: {
      data: ['线索数', '违规金额', '追回金额', '处罚金额', '阳性率'], top: 0, right: 0,
      itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 }
    },
    grid: { left: 42, right: 42, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.month), boundaryGap: false, ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '条 / 万', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '%', min: 42, max: 54, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      {
        name: '线索数', type: 'line', smooth: true, symbolSize: 4,
        lineStyle: { color: '#0891b2', width: 2, shadowColor: '#0891b2', shadowBlur: 8 }, itemStyle: { color: '#0891b2' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,104,220,.2)' }, { offset: 1, color: 'rgba(22,104,220,.02)' }] } },
        data: d.map((i: any) => i.clue)
      },
      { name: '违规金额', type: 'bar', barWidth: 9, itemStyle: { color: '#d43878', borderRadius: [2, 2, 0, 0] }, data: d.map((i: any) => i.violation) },
      { name: '追回金额', type: 'bar', barWidth: 9, itemStyle: { color: '#12a150', borderRadius: [2, 2, 0, 0] }, data: d.map((i: any) => i.recovered) },
      { name: '处罚金额', type: 'bar', barWidth: 9, itemStyle: { color: '#d48806', borderRadius: [2, 2, 0, 0] }, data: d.map((i: any) => i.penalty) },
      {
        name: '阳性率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5,
        lineStyle: { color: '#722ed1', width: 2.2, type: 'dashed' }, itemStyle: { color: '#722ed1' },
        label: { show: true, color: '#c9a8ff', fontSize: 9, fontWeight: 700 },
        data: d.map((i: any) => i.positiveRate)
      }
    ]
  }
})

/** 险种 + 风险等级（双环嵌套） */
const nestOption = computed(() => {
  const ins = data.value?.byInsurance || []
  const risk = data.value?.byRiskLevel || []
  return {
    tooltip: { trigger: 'item', ...TT },
    legend: { bottom: 0, itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 } },
    series: [
      {
        name: '险种', type: 'pie', radius: ['22%', '38%'], center: ['50%', '46%'],
        itemStyle: { borderColor: '#ffffff', borderWidth: 1.5 },
        label: { position: 'inner', formatter: '{b}\n{d}%', color: '#1a2230', fontSize: 9, fontWeight: 700 },
        data: ins.map((i: any, k: number) => ({ name: i.type, value: i.clue, itemStyle: { color: k ? '#722ed1' : '#1668dc' } }))
      },
      {
        name: '风险等级', type: 'pie', radius: ['48%', '68%'], center: ['50%', '46%'],
        itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 3 },
        label: { formatter: '{b} {d}%', color: '#43516b', fontSize: 9.5 },
        labelLine: { length: 6, length2: 8, lineStyle: { color: '#cdd7e6' } },
        data: risk.map((i: any) => ({
          name: i.level, value: i.clue,
          itemStyle: { color: i.level === '高风险' ? '#e5484d' : i.level === '中风险' ? '#d48806' : '#12a150' }
        }))
      }
    ]
  }
})

/** 科室分布（横条） */
const deptOption = computed(() => {
  const d = [...(data.value?.byDept || [])].sort((a: any, b: any) => a.clue - b.clue)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[p[0].dataIndex]
        return `${it.dept}<br/>线索 ${fmtNum(it.clue)} 条<br/>违规金额 ${it.violation} 万元<br/>主要违规：${it.mainType}`
      } },
    grid: { left: 8, right: 44, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'value', ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.map((i: any) => i.dept), ...AXIS_DARK, splitLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: (p: any) => HEX[p.dataIndex % HEX.length]
      },
      label: { show: true, position: 'right', formatter: (p: any) => fmtNum(p.value), color: '#43516b', fontSize: 9.5, fontWeight: 700 },
      data: d.map((i: any) => i.clue)
    }]
  }
})

/** 相关性散点 + 趋势线 */
const corrOption = computed(() => {
  const c = data.value?.correlation
  if (!c) return {}
  return {
    tooltip: { ...TT, formatter: (p: any) => `${p.data.name}<br/>机构 ${p.data.value[0]} 家<br/>线索 ${fmtNum(p.data.value[1])} 条` },
    grid: { left: 52, right: 20, top: 20, bottom: 34 },
    xAxis: { type: 'value', name: c.xName, nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    yAxis: { type: 'value', name: c.yName, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    series: [{
      type: 'scatter', symbolSize: 15,
      itemStyle: { color: '#0891b2', shadowBlur: 12, shadowColor: 'rgba(22,104,220,.3)' },
      label: { show: true, formatter: '{b}', position: 'top', distance: 5, color: '#43516b', fontSize: 9.5 },
      data: c.points.map((p: any) => ({ name: p.area, value: [p.x, p.y] })),
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: '#d43878', type: 'dashed', width: 1.5 },
        data: [[{ coord: [110, 4800] }, { coord: [190, 1200] }]]
      }
    }]
  }
})

onMounted(() => { load(); doDrill(1) })
</script>

<template>
  <div class="viz-page">
    <header class="viz-head">
      <div class="viz-head__t">
        多维对比分析
        <span class="viz-head__sub">八维度交叉分析 · 五级数据钻取 · 同比环比与相关性</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Calendar /></el-icon>{{ data?.timeRange }}</span>
        <span><el-icon><Search /></el-icon>线索 <b>{{ fmtNum(data?.summary?.totalClue || 0) }}</b></span>
        <span><el-icon><Aim /></el-icon>阳性率 <b>{{ data?.summary?.positiveRate }}%</b></span>
      </div>
      <el-select v-model="timeRange" size="small" class="viz-form" style="width: 138px" @change="load">
        <el-option label="2026年1-8月" value="2026年1-8月" />
        <el-option label="2026年上半年" value="2026年上半年" />
        <el-option label="2026年第三季度" value="2026年第三季度" />
        <el-option label="2025年同期" value="2025年同期" />
      </el-select>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="load">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'Download'"
        @click="msg.success('分析结果已导出 Excel，正在下载')">导出</el-button>
    </header>

    <!-- ============ 汇总指标 ============ -->
    <div class="viz-grid viz-grid--4 md-kpi" v-loading="loading" element-loading-background="rgba(255,255,255,.6)">
      <VizMetric label="疑点线索总数" :value="data?.summary?.totalClue || 0" unit="条" icon="Search" tone="cyan"
        :desc="`问题阳性率 ${data?.summary?.positiveRate || 0}%`" />
      <VizMetric label="违规金额认定" :value="data?.summary?.totalViolation || 0" unit="万元" icon="Money" tone="pink" :precision="1"
        :desc="`已追回 ${data?.summary?.totalRecovered || 0} 万元`"
        :progress="data?.summary ? (data.summary.totalRecovered / data.summary.totalViolation) * 100 : 0" />
      <VizMetric label="处罚金额" :value="data?.summary?.totalPenalty || 0" unit="万元" icon="Stamp" tone="amber" :precision="1"
        :desc="`平均处罚倍数约 1.57 倍`" />
      <VizMetric label="基金追回金额" :value="data?.summary?.totalRecovered || 0" unit="万元" icon="Coin" tone="lime" :precision="1"
        :desc="`追回率 ${data?.summary ? ((data.summary.totalRecovered / data.summary.totalViolation) * 100).toFixed(1) : 0}%`" />
    </div>

    <!-- ============ 维度导航 ============ -->
    <VizPanel title="分析维度" tone="violet" extra="八大维度 · 六种分析方法" class="md-dims">
      <div class="dnav">
        <button v-for="(dm, i) in (data?.dimensionList || [])" :key="dm.key" class="dnb"
          :class="{ 'is-active': dimKey === dm.key }"
          :style="{ '--dnc': HEX[i % HEX.length] }" @click="dimKey = dm.key">
          <el-icon :size="14"><component :is="dm.icon" /></el-icon>
          {{ dm.name }}
        </button>
      </div>
      <div class="mnav">
        <span class="mnav__l">分析方法</span>
        <button v-for="m in (data?.methods || [])" :key="m" class="mnb"
          :class="{ 'is-active': method === m }" @click="method = m">{{ m }}</button>
      </div>
    </VizPanel>

    <!-- ============ 主图表区 ============ -->
    <div class="md-c1">
      <VizPanel title="统筹区横向对比" tone="cyan" extra="线索 / 金额 / 阳性率" glow>
        <EChart :option="areaOption" height="248px" />
      </VizPanel>
      <VizPanel title="险种与风险等级构成" tone="violet" extra="内环险种 · 外环风险">
        <EChart :option="nestOption" height="248px" />
      </VizPanel>
    </div>

    <div class="md-c2">
      <VizPanel title="机构等级对比" tone="blue" extra="线索数 vs 违规金额">
        <EChart :option="orgOption" height="230px" />
      </VizPanel>
      <VizPanel title="违规类型态势气泡图" tone="red" extra="X 线索数 · Y 追回率 · 气泡=金额 · 红升绿降" glow>
        <EChart :option="vtOption" height="230px" />
      </VizPanel>
      <VizPanel title="科室分布" tone="amber" extra="按线索数排序">
        <EChart :option="deptOption" height="230px" />
      </VizPanel>
    </div>

    <div class="md-c3">
      <VizPanel title="月度多指标趋势" tone="cyan" extra="1-8月 · 五指标联动" glow>
        <EChart :option="monthOption" height="238px" />
      </VizPanel>
      <VizPanel title="相关性分析" tone="pink"
        :extra="`相关系数 ${data?.correlation?.coefficient ?? '—'}`">
        <EChart :option="corrOption" height="200px" />
        <div class="viz-note" style="margin-top: 6px">
          <el-icon><Opportunity /></el-icon>{{ data?.correlation?.conclusion }}
        </div>
      </VizPanel>
    </div>

    <!-- ============ 五级钻取 ============ -->
    <VizPanel title="数据钻取（汇总 → 区域 → 机构类型 → 违规类型 → 单笔明细）" tone="lime"
      extra="点击层级卡逐级下钻" glow>
      <div class="drill" v-loading="drillLoading" element-loading-background="rgba(255,255,255,.6)">
        <div v-for="(p, i) in (data?.drillDown?.path || [])" :key="p" class="dlv"
          :class="{ 'is-active': drillLevel === i + 1, 'is-done': drillLevel > i + 1 }"
          @click="doDrill(i + 1)">
          <span class="dlv__no viz-num">L{{ i + 1 }}</span>
          <span class="dlv__n">{{ p }}</span>
          <el-icon v-if="i < 4" class="dlv__arrow" :size="12"><ArrowRight /></el-icon>
        </div>
      </div>

      <template v-if="drillData">
        <div class="dcur">
          <div class="dcur__l">
            <span class="dcur__lb">当前层级</span>
            <b class="dcur__n">{{ drillData.current?.name }}</b>
          </div>
          <div class="dcur__m">
            <span>线索 <b class="viz-num">{{ fmtNum(drillData.current?.clue || 0) }}</b> 条</span>
            <span>违规金额 <b class="viz-num">{{ drillData.current?.violation }}</b> 万元</span>
          </div>
          <div v-if="drillData.next" class="dcur__next">
            <el-icon :size="11"><Bottom /></el-icon>
            下钻至「{{ drillData.next.name }}」：{{ fmtNum(drillData.next.clue) }} 条 / {{ drillData.next.violation }} 万元
          </div>
        </div>

        <!-- 单笔明细 -->
        <template v-if="drillData.details?.length">
          <div class="viz-sub">单笔违规明细<span class="viz-sub__x" /><span class="viz-sub__e">{{ drillData.details.length }} 笔</span></div>
          <el-table class="viz-table" :data="drillData.details" size="small" border stripe>
            <el-table-column prop="clueId" label="线索编号" width="150">
              <template #default="{ row }"><span class="viz-num viz-mini" style="color: var(--viz-cyan)">{{ row.clueId }}</span></template>
            </el-table-column>
            <el-table-column prop="orgName" label="机构名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="patient" label="参保人" width="92" align="center">
              <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.patient }}</span></template>
            </el-table-column>
            <el-table-column prop="item" label="违规情形" min-width="220" show-overflow-tooltip />
            <el-table-column prop="amount" label="金额(元)" width="100" align="right">
              <template #default="{ row }">
                <span class="viz-num" style="color: var(--viz-pink); font-weight: 700">{{ row.amount.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="发生日期" width="102">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.date }}</span></template>
            </el-table-column>
          </el-table>
        </template>
        <div v-else class="viz-note">
          <el-icon><InfoFilled /></el-icon>
          {{ drillData.message }}，继续点击右侧层级可逐级下钻至单笔违规明细。
        </div>
      </template>
    </VizPanel>

    <!-- ============ 明细数据表 ============ -->
    <VizPanel title="各统筹区监管情况明细" tone="cyan" extra="含同比">
      <el-table class="viz-table" :data="data?.byArea || []" size="small" border stripe
        show-summary :summary-method="() => ['合计', fmtNum(data?.summary?.totalClue || 0), String(data?.summary?.totalViolation), String(data?.summary?.totalPenalty), String(data?.summary?.totalRecovered), data?.summary?.positiveRate + '%', '1258', '—']">
        <el-table-column prop="area" label="统筹区" width="98" />
        <el-table-column prop="clue" label="线索数" width="104" align="right" sortable>
          <template #default="{ row }"><span class="viz-num">{{ fmtNum(row.clue) }}</span></template>
        </el-table-column>
        <el-table-column prop="violation" label="违规金额(万)" width="122" align="right" sortable>
          <template #default="{ row }"><span class="viz-num" style="color: var(--viz-pink)">{{ row.violation }}</span></template>
        </el-table-column>
        <el-table-column prop="penalty" label="处罚金额(万)" width="122" align="right" sortable>
          <template #default="{ row }"><span class="viz-num" style="color: var(--viz-amber)">{{ row.penalty }}</span></template>
        </el-table-column>
        <el-table-column prop="recovered" label="追回金额(万)" width="122" align="right" sortable>
          <template #default="{ row }"><span class="viz-num" style="color: var(--viz-lime)">{{ row.recovered }}</span></template>
        </el-table-column>
        <el-table-column prop="positiveRate" label="阳性率" width="98" align="center" sortable>
          <template #default="{ row }">
            <div class="prb">
              <span class="prb__v viz-num">{{ row.positiveRate }}%</span>
              <span class="prb__bar"><span :style="{ width: (row.positiveRate - 45) * 12 + '%' }" /></span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="orgCount" label="机构数" width="88" align="right" sortable>
          <template #default="{ row }"><span class="viz-num viz-dim">{{ row.orgCount }}</span></template>
        </el-table-column>
        <el-table-column prop="yoy" label="同比" width="90" align="center">
          <template #default="{ row }">
            <span class="viz-tag" :class="row.yoy.startsWith('+') ? 'viz-tag--red' : 'viz-tag--lime'">
              {{ row.yoy }}
            </span>
          </template>
        </el-table-column>
        <template #empty><div class="viz-empty">暂无数据</div></template>
      </el-table>
    </VizPanel>
  </div>
</template>

<style scoped lang="scss">
.md-kpi { margin-bottom: 12px; }
.md-dims { margin-bottom: 12px; }

.md-c1 {
  display: grid; grid-template-columns: 1.7fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.md-c2 {
  display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.md-c3 {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

/* ---------- 维度导航 ---------- */
.dnav {
  display: flex; flex-wrap: wrap; gap: 7px;
}

.dnb {
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  padding: 6px 12px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid color-mix(in srgb, var(--dnc) 26%, transparent);
  color: var(--viz-text-dim); font-size: 11.5px;
  transition: all .2s;

  :deep(.el-icon) { color: var(--dnc); }
  &:hover { transform: translateY(-2px); border-color: var(--dnc); color: var(--viz-text); }
  &.is-active {
    background: color-mix(in srgb, var(--dnc) 16%, transparent);
    border-color: var(--dnc); color: var(--dnc); font-weight: 700;
    box-shadow: 0 0 16px -5px var(--dnc);
  }
}

.mnav {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 10px; padding-top: 9px;
  border-top: 1px dashed var(--zh-border-light);

  &__l { font-size: 10.5px; color: var(--viz-text-faint); margin-right: 3px; }
}

.mnb {
  cursor: pointer; padding: 3px 10px; border-radius: 11px;
  background: transparent;
  border: 1px solid var(--zh-border);
  color: var(--viz-text-dim); font-size: 10.5px;
  transition: all .18s;

  &:hover { border-color: rgba(22, 104, 220, .25); color: var(--viz-text); }
  &.is-active {
    background: var(--zh-primary-light);
    border-color: var(--viz-cyan); color: var(--viz-cyan); font-weight: 700;
  }
}

/* ---------- 五级钻取 ---------- */
.drill {
  display: flex; align-items: stretch; gap: 4px; flex-wrap: wrap; margin-bottom: 12px;
}

.dlv {
  position: relative; cursor: pointer; flex: 1; min-width: 120px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 9px 8px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  transition: all .22s;

  &__no {
    font-size: 9.5px; font-weight: 800; color: var(--viz-text-faint);
    padding: 1px 6px; border-radius: 8px; background: var(--zh-border-light);
  }
  &__n { font-size: 11.5px; color: var(--viz-text-dim); }
  &__arrow {
    position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
    color: var(--zh-text-placeholder) !important; z-index: 1;
  }

  &:hover { border-color: var(--viz-line-strong); }

  &.is-done {
    background: rgba(76, 245, 168, .08);
    border-color: var(--zh-risk-low-border);
    .dlv__no { color: var(--viz-lime); background: rgba(76, 245, 168, .18); }
    .dlv__n { color: var(--viz-lime); }
  }

  &.is-active {
    background: var(--zh-primary-lighter);
    border-color: var(--viz-cyan);
    box-shadow: 0 0 18px -6px var(--viz-cyan);
    .dlv__no { color: #fff; background: var(--viz-cyan); }
    .dlv__n { color: var(--viz-cyan); font-weight: 700; }
  }
}

/* ---------- 当前层级卡 ---------- */
.dcur {
  display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: center;
  padding: 11px 14px; border-radius: 4px; margin-bottom: 10px;
  background: linear-gradient(120deg, var(--zh-success-light), var(--zh-bg-soft));
  border: 1px solid rgba(76, 245, 168, .3);
  @media (max-width: 900px) { grid-template-columns: 1fr; }

  &__lb { display: block; font-size: 9.5px; color: var(--viz-text-faint); }
  &__n { font-size: 15px; font-weight: 800; color: var(--viz-lime); }

  &__m {
    display: flex; gap: 20px; flex-wrap: wrap;
    font-size: 11px; color: var(--viz-text-dim);
    b { color: var(--viz-text); font-size: 14px; }
  }

  &__next {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10.5px; color: var(--viz-cyan);
    :deep(.el-icon) { color: var(--viz-cyan); }
  }
}

/* ---------- 阳性率条 ---------- */
.prb {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  &__v { font-size: 11px; font-weight: 700; color: var(--viz-text-dim); }
  &__bar {
    width: 100%; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--viz-cyan); box-shadow: 0 0 6px var(--viz-cyan);
    }
  }
}

:deep(.el-table__footer) {
  td.el-table__cell {
    background: #f5f8fd !important;
    color: var(--zh-primary) !important;
    font-weight: 700;
  }
}
</style>
