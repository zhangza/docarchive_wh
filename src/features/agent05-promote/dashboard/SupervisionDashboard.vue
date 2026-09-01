<script setup lang="ts">
import { getDashboard, getDashboardPulse } from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const data = ref<any>(null)
const loading = ref(false)
const pulse = ref<any>(null)

const filters = reactive({ area: '芜湖市', timeRange: '2026年', orgType: '' })
const clock = ref('')
const onlineUsers = ref(0)
let clockTimer: any = null
let pulseTimer: any = null

/** 全屏 */
const rootEl = ref<HTMLElement | null>(null)
const isFull = ref(false)
async function toggleFull() {
  try {
    if (!document.fullscreenElement) {
      await rootEl.value?.requestFullscreen()
      isFull.value = true
    } else {
      await document.exitFullscreen()
      isFull.value = false
    }
  } catch { msg.warning('当前浏览器不支持全屏，请按 F11') }
}

async function load() {
  loading.value = true
  try { data.value = await getDashboard(filters) } finally { loading.value = false }
}

async function loadPulse() {
  pulse.value = await getDashboardPulse()
  onlineUsers.value = pulse.value?.onlineUsers || 0
  // 活动流滚动插入
  if (data.value && pulse.value?.activities?.length) {
    data.value.latestActivities = [...pulse.value.activities, ...data.value.latestActivities].slice(0, 12)
    data.value.agentPulse = pulse.value.agentPulse
  }
}

function tickClock() {
  const n = new Date()
  const w = ['日', '一', '二', '三', '四', '五', '六'][n.getDay()]
  const p = (v: number) => String(v).padStart(2, '0')
  clock.value = `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} 周${w} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`
}

/* ---------- 指标钻取 ---------- */
const drillVisible = ref(false)
const drillItem = ref<any>(null)
function openDrill(c: any) {
  drillItem.value = c
  drillVisible.value = true
}

/* ========== 图表配置 ========== */
const AXIS_DARK = {
  axisLine: { lineStyle: { color: '#cdd7e6' } },
  axisTick: { show: false },
  axisLabel: { color: '#6b7a90', fontSize: 10 },
  splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } }
}
const VIZ_C = ['#0891b2', '#12a150', '#722ed1', '#d48806', '#d43878', '#1668dc', '#e5484d', '#5a9cf0']

/** 线索趋势（双 Y 轴 + 面积渐变） */
const clueTrendOption = computed(() => {
  const t = data.value?.clueTrend
  if (!t) return {}
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff', borderColor: '#e2e8f2',
      textStyle: { color: '#1a2230', fontSize: 11 }
    },
    legend: {
      data: t.series.map((s: any) => s.name), top: 0, right: 0,
      itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 }
    },
    grid: { left: 42, right: 44, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: t.xAxis, boundaryGap: false, ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '条', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '%', min: 40, max: 55, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: t.series.map((s: any, i: number) => {
      const isRate = s.name.includes('%')
      return {
        name: s.name, data: s.data,
        type: 'line', smooth: true, symbolSize: 5,
        yAxisIndex: isRate ? 1 : 0,
        lineStyle: { width: isRate ? 2 : 2.4, color: VIZ_C[i], shadowColor: VIZ_C[i], shadowBlur: 10 },
        itemStyle: { color: VIZ_C[i], borderColor: '#ffffff', borderWidth: 1.4 },
        areaStyle: isRate ? undefined : {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: VIZ_C[i] + '55' },
              { offset: 1, color: VIZ_C[i] + '02' }
            ]
          }
        }
      }
    })
  }
})

/** 违规类型分布（玫瑰环 + 中心统计） */
const violationOption = computed(() => {
  const d = data.value?.violationTypeDistribution || []
  return {
    color: VIZ_C,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff', borderColor: '#e2e8f2',
      textStyle: { color: '#1a2230', fontSize: 11 },
      formatter: (p: any) => `${p.name}<br/>${p.value} 条（${p.data.ratio}%）<br/>金额 ${p.data.amount} 万元`
    },
    legend: {
      type: 'scroll', orient: 'vertical', right: 0, top: 'middle',
      itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 }, pageIconColor: '#0891b2'
    },
    series: [{
      type: 'pie', radius: ['38%', '68%'], center: ['34%', '50%'], roseType: 'radius',
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 3 },
      label: { show: false },
      emphasis: {
        scaleSize: 8,
        label: { show: true, formatter: '{b}\n{d}%', color: '#1a2230', fontSize: 10, fontWeight: 700 },
        itemStyle: { shadowBlur: 18, shadowColor: 'rgba(22,104,220,.3)' }
      },
      data: d.map((i: any) => ({ name: i.name, value: i.value, ratio: i.ratio, amount: i.amount }))
    }]
  }
})

/** 区域散点热力（气泡地图效果） */
const areaOption = computed(() => {
  const d = data.value?.areaHeatmap || []
  const max = Math.max(...d.map((x: any) => x.clueCount), 1)
  return {
    tooltip: {
      backgroundColor: '#ffffff', borderColor: '#e2e8f2',
      textStyle: { color: '#1a2230', fontSize: 11 },
      formatter: (p: any) =>
        `${p.data.name}<br/>线索 ${p.data.value[2]} 条<br/>金额 ${p.data.amount} 万元<br/>机构 ${p.data.orgCount} 家 · ${p.data.level}风险`
    },
    grid: { left: 8, right: 8, top: 10, bottom: 8 },
    xAxis: { type: 'value', min: 117.8, max: 118.7, show: false },
    yAxis: { type: 'value', min: 30.85, max: 31.45, show: false },
    series: [
      {
        type: 'effectScatter', symbolSize: (v: any) => 12 + (v[2] / max) * 30,
        rippleEffect: { brushType: 'stroke', scale: 3.2, period: 4 },
        showEffectOn: 'render',
        itemStyle: {
          color: (p: any) => (p.data.level === '高' ? '#e5484d' : p.data.level === '中' ? '#d48806' : '#12a150'),
          shadowBlur: 14,
          shadowColor: (p: any) => (p.data.level === '高' ? '#e5484d' : '#d48806')
        },
        label: {
          show: true, formatter: '{b}', position: 'bottom', distance: 6,
          color: '#43516b', fontSize: 10, fontWeight: 600,
          textShadowColor: 'rgba(255,255,255,.9)', textShadowBlur: 4
        },
        data: d.map((i: any) => ({
          name: i.area, value: [i.lng, i.lat, i.clueCount],
          amount: i.amount, orgCount: i.orgCount, level: i.level
        }))
      }
    ]
  }
})

/** 机构排名（渐变横条） */
const rankOption = computed(() => {
  const d = (data.value?.orgRankingTOP10 || []).slice(0, 8)
  return {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.06)' } },
      backgroundColor: '#ffffff', borderColor: '#e2e8f2',
      textStyle: { color: '#1a2230', fontSize: 11 },
      formatter: (p: any) => {
        const it = d[d.length - 1 - p[0].dataIndex]
        return `${it.orgName}<br/>${it.type} · ${it.violationType}<br/>金额 ${it.amount} 万元 · ${it.count} 条`
      }
    },
    grid: { left: 8, right: 52, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'value', ...AXIS_DARK, splitLine: { show: false }, axisLabel: { show: false } },
    yAxis: {
      type: 'category',
      data: d.map((i: any) => (i.orgName.length > 11 ? i.orgName.slice(0, 11) + '…' : i.orgName)).reverse(),
      ...AXIS_DARK, splitLine: { show: false },
      axisLabel: { color: '#6b7a90', fontSize: 10 }
    },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: 'rgba(22,104,220,.18)' }, { offset: 1, color: '#d43878' }]
        }
      },
      label: {
        show: true, position: 'right', formatter: '{c} 万',
        color: '#d43878', fontSize: 10, fontWeight: 700
      },
      data: d.map((i: any) => i.amount).reverse()
    }]
  }
})

/** 基金追缴趋势（堆叠面积） */
const fundOption = computed(() => {
  const t = data.value?.fundTrend
  if (!t) return {}
  const cs = ['#d43878', '#12a150', '#d48806']
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff', borderColor: '#e2e8f2',
      textStyle: { color: '#1a2230', fontSize: 11 }, valueFormatter: (v: any) => `${v} 万元`
    },
    legend: {
      data: t.series.map((s: any) => s.name), top: 0, right: 0,
      itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 }
    },
    grid: { left: 40, right: 12, top: 28, bottom: 20 },
    xAxis: { type: 'category', data: t.xAxis, boundaryGap: false, ...AXIS_DARK },
    yAxis: { type: 'value', ...AXIS_DARK },
    series: t.series.map((s: any, i: number) => ({
      name: s.name, data: s.data, type: 'line', smooth: true, symbolSize: 4,
      lineStyle: { width: 2, color: cs[i], shadowColor: cs[i], shadowBlur: 8 },
      itemStyle: { color: cs[i] },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: cs[i] + '46' }, { offset: 1, color: cs[i] + '02' }]
        }
      }
    }))
  }
})

/** 处置类型分布（极坐标柱） */
const disposalOption = computed(() => {
  const d = data.value?.disposalTypeDistribution || []
  return {
    tooltip: {
      backgroundColor: '#ffffff', borderColor: '#e2e8f2',
      textStyle: { color: '#1a2230', fontSize: 11 },
      formatter: (p: any) => `${p.name}<br/>${p.value} 件${d[p.dataIndex]?.amount ? `<br/>金额 ${d[p.dataIndex].amount} 万元` : ''}`
    },
    angleAxis: {
      type: 'category', data: d.map((i: any) => i.name),
      axisLine: { lineStyle: { color: '#cdd7e6' } },
      axisTick: { show: false },
      axisLabel: { color: '#6b7a90', fontSize: 9.5 }
    },
    radiusAxis: {
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#8290a5', fontSize: 8.5 },
      splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } }
    },
    polar: { center: ['50%', '52%'], radius: ['16%', '76%'] },
    series: [{
      type: 'bar', coordinateSystem: 'polar', barWidth: 13, roundCap: true,
      itemStyle: {
        color: (p: any) => VIZ_C[p.dataIndex % VIZ_C.length],
        shadowBlur: 10, shadowColor: 'rgba(22,104,220,.25)'
      },
      data: d.map((i: any) => i.value)
    }]
  }
})

/* ---------- 任务漏斗（自绘 CSS，非 ECharts） ---------- */
const taskMax = computed(() => Math.max(...(data.value?.taskProgress || []).map((t: any) => t.count), 1))

onMounted(() => {
  load()
  loadPulse()
  tickClock()
  clockTimer = setInterval(tickClock, 1000)
  pulseTimer = setInterval(loadPulse, 8000)
  document.addEventListener('fullscreenchange', () => { isFull.value = !!document.fullscreenElement })
})
onUnmounted(() => {
  clearInterval(clockTimer)
  clearInterval(pulseTimer)
})
</script>

<template>
  <div ref="rootEl" class="viz-page dash" v-loading="loading"
    element-loading-background="rgba(255,255,255,.72)">

    <!-- ============ 大屏页头 ============ -->
    <header class="viz-head">
      <div class="viz-head__t">
        医保基金智能监管指挥大屏
        <span class="viz-head__sub">Medical Insurance Fund Supervision Command Center</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span class="viz-head__live"><i />实时监测</span>
        <span><el-icon><Location /></el-icon>{{ data?.area || '芜湖市' }}</span>
        <span><el-icon><Calendar /></el-icon>{{ data?.timeRange }}</span>
        <span><el-icon><User /></el-icon>在线 <b>{{ onlineUsers }}</b></span>
        <span class="viz-num"><el-icon><Clock /></el-icon>{{ clock }}</span>
      </div>
      <div class="dash__ops viz-form">
        <el-select v-model="filters.area" size="small" style="width: 104px" @change="load">
          <el-option label="全市" value="芜湖市" />
          <el-option v-for="a in (data?.areaHeatmap || [])" :key="a.area" :label="a.area" :value="a.area" />
        </el-select>
        <el-select v-model="filters.orgType" size="small" clearable placeholder="机构类型" style="width: 112px" @change="load">
          <el-option v-for="t in ['三级医院', '二级医院', '社区中心', '零售药店']" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="load(); loadPulse()">刷新</el-button>
        <el-button class="viz-btn is-hot" size="small" :icon="isFull ? 'Aim' : 'FullScreen'" @click="toggleFull">
          {{ isFull ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </header>

    <!-- ============ 核心指标 8 卡 ============ -->
    <div class="viz-grid viz-grid--8 dash__kpi">
      <VizMetric v-for="c in (data?.coreIndicators || [])" :key="c.name"
        :label="c.name" :value="c.value" :unit="c.unit" :trend="c.trend" :up="c.up"
        :icon="c.icon" :tone="c.tone" :precision="c.unit === '%' || c.unit === '万元' ? 1 : 0"
        :desc="c.todayNew !== undefined ? `今日新增 ${c.todayNew}`
          : c.confirmedCount !== undefined ? `确认 ${fmtNum(c.confirmedCount)} 条`
          : c.ongoing !== undefined ? `进行 ${c.ongoing} · 完成 ${c.completed}`
          : c.coverageRate !== undefined ? `覆盖率 ${c.coverageRate}%`
          : c.insuranceFund !== undefined ? `涉及基金 ${c.insuranceFund} 万`
          : c.recoveryRate !== undefined ? `追回率 ${c.recoveryRate}%`
          : c.penaltyCases !== undefined ? `处罚 ${c.penaltyCases} 起`
          : c.total !== undefined ? `${c.completed}/${c.total} 项` : ''"
        :progress="c.unit === '%' ? c.value : undefined"
        @click="openDrill(c)" />
    </div>

    <!-- ============ 主体三列 ============ -->
    <div class="viz-main dash__main">
      <!-- ---------- 左列 ---------- -->
      <div class="viz-col">
        <VizPanel title="违规类型分布" tone="violet" extra="8 类" glow>
          <EChart :option="violationOption" height="222px" />
        </VizPanel>

        <VizPanel title="任务流转看板" tone="blue" extra="漏斗视图">
          <div class="funnel">
            <div v-for="(t, i) in (data?.taskProgress || [])" :key="t.status" class="fn"
              :class="`fn--${t.tone}`" :style="{ animationDelay: i * 70 + 'ms' }">
              <span class="fn__n">{{ t.status }}</span>
              <span class="fn__bar">
                <span class="fn__fill" :style="{ width: (t.count / taskMax) * 100 + '%' }" />
              </span>
              <b class="fn__v viz-num">{{ t.count }}</b>
            </div>
          </div>
        </VizPanel>

        <VizPanel title="智能体运行脉冲" tone="lime" extra="6 智能体">
          <div class="pulse">
            <div v-for="a in (data?.agentPulse || [])" :key="a.no" class="pl" :class="`pl--${a.tone}`">
              <span class="pl__no viz-num">{{ a.no }}</span>
              <div class="pl__b">
                <div class="pl__n">{{ a.name }}</div>
                <div class="pl__t viz-num">
                  今日 <b>{{ a.today }}</b> · 累计 {{ fmtNum(a.total) }}
                </div>
              </div>
              <div class="pl__h">
                <span class="pl__wave"><i /><i /><i /><i /><i /></span>
                <span class="pl__hv viz-num">{{ a.health }}%</span>
              </div>
            </div>
          </div>
        </VizPanel>
      </div>

      <!-- ---------- 中列 ---------- -->
      <div class="viz-col">
        <VizPanel title="疑点线索发现趋势" tone="cyan" extra="1-8月 · 双轴" glow>
          <EChart :option="clueTrendOption" height="216px" />
        </VizPanel>

        <VizPanel title="全市违规风险地理分布" tone="red" extra="气泡越大风险越高" glow>
          <EChart :option="areaOption" height="264px" />
          <div class="lvl">
            <span class="lvl__i is-high"><i />高风险</span>
            <span class="lvl__i is-mid"><i />中风险</span>
            <span class="lvl__i is-low"><i />低风险</span>
          </div>
        </VizPanel>

        <VizPanel title="基金追缴趋势" tone="pink" extra="违规认定 / 追回 / 处罚">
          <EChart :option="fundOption" height="196px" />
        </VizPanel>
      </div>

      <!-- ---------- 右列 ---------- -->
      <div class="viz-col">
        <VizPanel title="违规机构金额排名" tone="amber" extra="TOP 8" glow>
          <EChart :option="rankOption" height="214px" />
        </VizPanel>

        <VizPanel title="处置方式构成" tone="cyan" extra="极坐标">
          <EChart :option="disposalOption" height="212px" />
        </VizPanel>

        <VizPanel title="监管效能对比" tone="lime" extra="上线前 → 上线后">
          <div class="eff">
            <div v-for="e in (data?.efficiencyIndicators || [])" :key="e.name" class="ef">
              <div class="ef__h">
                <span class="ef__n">{{ e.name }}</span>
                <b class="ef__v viz-num">↑{{ e.improvement }}%</b>
              </div>
              <div class="ef__c">
                <span class="ef__b">{{ e.before }}</span>
                <el-icon :size="11"><DArrowRight /></el-icon>
                <span class="ef__a">{{ e.after }}</span>
              </div>
              <div class="ef__track"><span :style="{ width: e.improvement + '%' }" /></div>
            </div>
          </div>
        </VizPanel>
      </div>
    </div>

    <!-- ============ 底部滚动动态 ============ -->
    <VizPanel title="实时监管动态" tone="cyan" extra="每 8 秒自动刷新" class="dash__ticker">
      <div class="tick viz-scroll">
        <div v-for="(a, i) in (data?.latestActivities || [])" :key="i" class="tk"
          :class="[`tk--${a.level === '高' ? 'red' : a.level === '中' ? 'amber' : 'lime'}`, { 'is-new': i < 3 }]">
          <span class="tk__t viz-num">{{ a.time }}</span>
          <span class="viz-tag" :class="a.type === '线索' ? 'viz-tag--cyan' : a.type === '任务' ? 'viz-tag--blue' : 'viz-tag--pink'">
            {{ a.type }}
          </span>
          <span class="tk__c">{{ a.content }}</span>
          <span class="tk__l">{{ a.level }}</span>
        </div>
      </div>
    </VizPanel>

    <!-- ============ 指标钻取抽屉 ============ -->
    <el-drawer v-model="drillVisible" size="480px" class="viz-drawer" title="指标钻取">
      <template v-if="drillItem">
        <div class="dr-hero" :class="`dr-hero--${drillItem.tone}`">
          <div class="dr-hero__n">{{ drillItem.name }}</div>
          <div class="dr-hero__v viz-num">
            {{ typeof drillItem.value === 'number' ? drillItem.value.toLocaleString() : drillItem.value }}
            <small>{{ drillItem.unit }}</small>
          </div>
          <div class="dr-hero__t" :class="drillItem.up ? 'is-up' : 'is-down'">
            <el-icon :size="11"><component :is="drillItem.up ? 'Top' : 'Bottom'" /></el-icon>
            同比 {{ drillItem.trend }}
          </div>
        </div>

        <div class="viz-sub">指标构成明细<span class="viz-sub__x" /></div>
        <el-descriptions class="viz-desc" :column="1" border size="small">
          <el-descriptions-item v-if="drillItem.todayNew !== undefined" label="今日新增">
            <span class="viz-num">{{ drillItem.todayNew }} 条</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.confirmedCount !== undefined" label="确认违规">
            <span class="viz-num">{{ fmtNum(drillItem.confirmedCount) }} 条</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.ongoing !== undefined" label="进行中 / 已完成">
            <span class="viz-num">{{ drillItem.ongoing }} / {{ drillItem.completed }} 次</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.coverageRate !== undefined" label="覆盖率">
            <span class="viz-num">{{ drillItem.coverageRate }}%</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.insuranceFund !== undefined" label="涉及医保基金">
            <span class="viz-num">{{ drillItem.insuranceFund }} 万元</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.recoveryRate !== undefined" label="基金追回率">
            <span class="viz-num">{{ drillItem.recoveryRate }}%</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.penaltyCases !== undefined" label="处罚案件数">
            <span class="viz-num">{{ drillItem.penaltyCases }} 起</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="drillItem.total !== undefined" label="整改完成 / 总数">
            <span class="viz-num">{{ drillItem.completed }} / {{ drillItem.total }} 项</span>
          </el-descriptions-item>
          <el-descriptions-item label="统计范围">{{ data?.area }} · {{ data?.timeRange }}</el-descriptions-item>
          <el-descriptions-item label="数据更新时间">
            <span class="viz-num">{{ data?.updateTime }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="viz-sub">按区域分解<span class="viz-sub__x" /></div>
        <el-table class="viz-table" :data="data?.areaHeatmap || []" size="small" border stripe max-height="260">
          <el-table-column prop="area" label="统筹区" width="88" />
          <el-table-column prop="clueCount" label="线索数" width="88" align="right">
            <template #default="{ row }"><span class="viz-num">{{ fmtNum(row.clueCount) }}</span></template>
          </el-table-column>
          <el-table-column prop="amount" label="金额(万)" width="92" align="right">
            <template #default="{ row }"><span class="viz-num">{{ row.amount }}</span></template>
          </el-table-column>
          <el-table-column prop="orgCount" label="机构" width="72" align="right">
            <template #default="{ row }"><span class="viz-num">{{ row.orgCount }}</span></template>
          </el-table-column>
          <el-table-column prop="level" label="风险" width="70" align="center">
            <template #default="{ row }">
              <span class="viz-tag" :class="row.level === '高' ? 'viz-tag--red' : row.level === '中' ? 'viz-tag--amber' : 'viz-tag--lime'">
                {{ row.level }}
              </span>
            </template>
          </el-table-column>
        </el-table>

        <div class="viz-note">
          <el-icon><InfoFilled /></el-icon>
          大屏支持按时间、区域、机构类型联动筛选，图表间自动联动；数据每 5 分钟自动刷新，实时动态每 8 秒轮询更新。
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.dash {
  &__ops {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    :deep(.el-button) { margin-left: 0 !important; }
  }

  &__kpi { margin-bottom: 12px; }
  &__main { margin-bottom: 12px; }
  &__ticker { margin-bottom: 0; }
}

/* ---------- 任务漏斗 ---------- */
.funnel { display: flex; flex-direction: column; gap: 6px; }

.fn {
  display: grid; grid-template-columns: 52px 1fr 32px;
  align-items: center; gap: 8px;
  animation: fnIn .5s cubic-bezier(.2, .9, .3, 1) both;

  &--faint { --fc: var(--viz-text-faint); }
  &--blue { --fc: var(--viz-blue); }
  &--cyan { --fc: var(--viz-cyan); }
  &--violet { --fc: var(--viz-violet); }
  &--amber { --fc: var(--viz-amber); }
  &--red { --fc: var(--viz-red); }
  &--lime { --fc: var(--viz-lime); }

  &__n { font-size: 10.5px; color: var(--viz-text-dim); }

  &__bar {
    height: 12px; border-radius: 3px; overflow: hidden;
    background: var(--zh-border-light);
  }

  &__fill {
    display: block; height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--fc) 40%, transparent), var(--fc));
    box-shadow: 0 0 10px var(--fc);
    animation: fnGrow .8s cubic-bezier(.22, .8, .3, 1) both;
  }

  &__v {
    text-align: right; font-size: 12px; font-weight: 800; color: var(--fc);
  }
}

@keyframes fnIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes fnGrow { from { width: 0 !important; } }

/* ---------- 智能体脉冲 ---------- */
.pulse { display: flex; flex-direction: column; gap: 6px; }

.pl {
  display: flex; align-items: center; gap: 9px;
  padding: 6px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--pc);
  transition: background .2s;
  &:hover { background: var(--zh-primary-lighter); }

  &--cyan { --pc: var(--viz-cyan); }
  &--blue { --pc: var(--viz-blue); }
  &--amber { --pc: var(--viz-amber); }
  &--violet { --pc: var(--viz-violet); }
  &--lime { --pc: var(--viz-lime); }
  &--pink { --pc: var(--viz-pink); }

  &__no {
    width: 18px; height: 18px; flex-shrink: 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; color: #fff;
    background: var(--pc);
  }

  &__b { flex: 1; min-width: 0; }
  &__n { font-size: 11px; font-weight: 600; color: var(--viz-text); }
  &__t {
    font-size: 9.5px; color: var(--viz-text-faint); margin-top: 1px;
    b { color: var(--pc); font-size: 11px; }
  }

  &__h { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  &__hv { font-size: 10px; font-weight: 700; color: var(--viz-lime); }

  &__wave {
    display: inline-flex; align-items: flex-end; gap: 1.5px; height: 12px;
    i {
      width: 2px; border-radius: 1px; background: var(--pc);
      animation: plWave 1.1s ease-in-out infinite;
      &:nth-child(1) { height: 40%; animation-delay: 0s; }
      &:nth-child(2) { height: 70%; animation-delay: .12s; }
      &:nth-child(3) { height: 100%; animation-delay: .24s; }
      &:nth-child(4) { height: 62%; animation-delay: .36s; }
      &:nth-child(5) { height: 34%; animation-delay: .48s; }
    }
  }
}

@keyframes plWave {
  0%, 100% { transform: scaleY(.42); opacity: .55; }
  50% { transform: scaleY(1); opacity: 1; }
}

/* ---------- 风险等级图例 ---------- */
.lvl {
  display: flex; gap: 14px; justify-content: center; margin-top: -4px;

  &__i {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--viz-text-dim);
    i { width: 8px; height: 8px; border-radius: 50%; }
    &.is-high i { background: var(--viz-red); box-shadow: 0 0 8px var(--viz-red); }
    &.is-mid i { background: var(--viz-amber); box-shadow: 0 0 8px var(--viz-amber); }
    &.is-low i { background: var(--viz-lime); box-shadow: 0 0 8px var(--viz-lime); }
  }
}

/* ---------- 效能对比 ---------- */
.eff { display: flex; flex-direction: column; gap: 8px; }

.ef {
  padding: 7px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);

  &__h { display: flex; align-items: center; justify-content: space-between; }
  &__n { font-size: 10.5px; color: var(--viz-text); font-weight: 600; }
  &__v { font-size: 12px; font-weight: 800; color: var(--viz-lime); }

  &__c {
    display: flex; align-items: center; gap: 6px; margin-top: 4px;
    font-size: 10px;
    :deep(.el-icon) { color: var(--viz-cyan); }
  }
  &__b { color: var(--viz-text-faint); text-decoration: line-through; }
  &__a { color: var(--viz-lime); font-weight: 700; }

  &__track {
    margin-top: 5px; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: linear-gradient(90deg, rgba(76, 245, 168, .35), var(--viz-lime));
      box-shadow: 0 0 8px var(--viz-lime);
      animation: fnGrow 1s cubic-bezier(.22, .8, .3, 1) both;
    }
  }
}

/* ---------- 滚动动态 ---------- */
.tick {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 148px;
}

.tk {
  display: grid; grid-template-columns: 62px auto 1fr 34px;
  align-items: center; gap: 9px;
  padding: 5px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--kc);
  transition: background .2s;
  &:hover { background: var(--zh-primary-lighter); }

  &--red { --kc: var(--viz-red); }
  &--amber { --kc: var(--viz-amber); }
  &--lime { --kc: var(--viz-lime); }

  &.is-new { animation: tkIn .55s cubic-bezier(.2, .9, .3, 1) both; }

  &__t { font-size: 10px; color: var(--viz-text-faint); }
  &__c {
    font-size: 11px; color: var(--viz-text-dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  &__l {
    text-align: right; font-size: 10px; font-weight: 700; color: var(--kc);
  }

  @media (max-width: 900px) {
    grid-template-columns: 56px auto 1fr;
    &__l { display: none; }
  }
}

@keyframes tkIn {
  from { opacity: 0; transform: translateX(-14px); background: var(--zh-primary-light); }
  to { opacity: 1; transform: none; }
}

/* ---------- 钻取抽屉 ---------- */
.dr-hero {
  padding: 14px 16px; border-radius: 5px;
  background: linear-gradient(130deg, color-mix(in srgb, var(--hc) 20%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--hc) 40%, transparent);

  &--cyan { --hc: var(--viz-cyan); }
  &--blue { --hc: var(--viz-blue); }
  &--violet { --hc: var(--viz-violet); }
  &--lime { --hc: var(--viz-lime); }
  &--amber { --hc: var(--viz-amber); }
  &--pink { --hc: var(--viz-pink); }
  &--red { --hc: var(--viz-red); }

  &__n { font-size: 12px; color: var(--viz-text-dim); }
  &__v {
    margin-top: 4px; font-size: 32px; font-weight: 800; color: var(--hc);
    small { font-size: 12px; font-weight: 400; color: var(--viz-text-dim); margin-left: 4px; }
  }
  &__t {
    display: inline-flex; align-items: center; gap: 3px; margin-top: 5px;
    font-size: 11px; font-weight: 700;
    &.is-up { color: var(--viz-lime); }
    &.is-down { color: var(--viz-red); }
  }
}
</style>
