<script setup lang="ts">
import { getAlertOverview, getAlertStream } from '@/api/agent01-clue/clue'
import { fmtWan, fmtNum, fmtPercent, fmtMoney, CHART_COLORS, CHART_GRID } from '@/utils/format'

const router = useRouter()
const loading = ref(false)
const ov = ref<any>(null)
const stream = ref<any[]>([])
const paused = ref(false)
let timer: any = null

async function loadOverview() {
  loading.value = true
  try {
    ov.value = await getAlertOverview()
  } finally {
    loading.value = false
  }
}

async function loadStream() {
  const res = await getAlertStream({ limit: 40 })
  stream.value = res
}

/** 模拟实时滚动：每 5 秒把队首元素轮转，营造"流式预警"效果 */
function startRolling() {
  timer = setInterval(() => {
    if (paused.value || stream.value.length < 4) return
    const last = stream.value.pop()
    if (last) stream.value.unshift({ ...last, _new: true })
    setTimeout(() => {
      if (stream.value[0]) stream.value[0]._new = false
    }, 2200)
  }, 5000)
}

/* ---------- 图表 ---------- */
const hourOption = computed(() => {
  const d = ov.value?.hourTrend || []
  return {
    tooltip: { trigger: 'axis' },
    grid: { ...CHART_GRID, bottom: 26, top: 22 },
    xAxis: {
      type: 'category',
      data: d.map((i: any) => `${i.hour}`),
      axisLabel: { fontSize: 10, color: '#6b7a90', interval: 1 },
      axisLine: { lineStyle: { color: '#e2e8f2' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8' }
    },
    series: [
      {
        type: 'bar',
        barWidth: '58%',
        data: d.map((i: any) => i.count),
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#3c88ff' }, { offset: 1, color: 'rgba(19,194,194,.35)' }]
          }
        }
      }
    ]
  }
})

const levelOption = computed(() => {
  const d = ov.value?.levelDist || []
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} 条（{d}%）' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#6b7a90' } },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } }))
      }
    ]
  }
})

const categoryOption = computed(() => {
  const d = ov.value?.categoryDist || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}<br/>数量：{c} 条' },
    legend: { type: 'scroll', bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10, color: '#6b7a90' } },
    series: [
      {
        type: 'pie',
        radius: ['0%', '68%'],
        center: ['50%', '44%'],
        roseType: 'radius',
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
        label: { show: false },
        data: d.map((i: any) => ({ name: i.name, value: i.value }))
      }
    ]
  }
})

const violationOption = computed(() => {
  const d = ov.value?.topViolations || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 92, right: 56, top: 8, bottom: 16 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { show: false }, axisLine: { show: false } },
    yAxis: {
      type: 'category',
      data: d.map((i: any) => i.name).reverse(),
      axisLabel: { fontSize: 11, color: '#43516b' },
      axisLine: { show: false }, axisTick: { show: false }
    },
    series: [
      {
        type: 'bar', barWidth: 12,
        data: d.map((i: any) => i.count).reverse(),
        label: { show: true, position: 'right', fontSize: 11, color: '#6b7a90', fontFamily: 'DIN Alternate' },
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#e5484d' }, { offset: 1, color: '#e8a30c' }] }
        }
      }
    ]
  }
})

function gotoClue(row: any) {
  router.push({ name: 'M06', params: { clueId: row.clueId } })
}

const engineTone = (s: string) => (s === '正常' ? 'success' : s === '负载偏高' ? 'warning' : 'danger')

onMounted(async () => {
  await Promise.all([loadOverview(), loadStream()])
  startRolling()
})
onBeforeUnmount(() => timer && clearInterval(timer))
</script>

<template>
  <div class="zh-page" v-loading="loading">
    <PageHeader title="实时预警看板" subtitle="智能识别 · 风险分级 · 标准化线索自动生成" tag="M03">
      <template #actions>
        <el-tag type="success" effect="dark" size="small" class="live-tag">
          <span class="live-dot" />实时监测中
        </el-tag>
        <el-button :icon="'Refresh'" @click="loadOverview(); loadStream()">刷新</el-button>
        <el-button type="primary" :icon="'Files'" @click="router.push('/alert/clues')">进入线索库</el-button>
      </template>
    </PageHeader>

    <!-- 顶部 KPI -->
    <div class="kpi-grid">
      <StatCard label="今日新增线索" :value="ov?.today?.newClueCount || 0" unit="条" icon="Bell" tone="primary"
        :trend="ov && ov.yesterday ? Number((((ov.today.newClueCount - ov.yesterday.newClueCount) / ov.yesterday.newClueCount) * 100).toFixed(1)) : 0"
        :desc="`昨日 ${fmtNum(ov?.yesterday?.newClueCount)} 条`" />
      <StatCard label="今日高风险" :value="ov?.today?.high || 0" unit="条" icon="Warning" tone="danger"
        :desc="`中 ${ov?.today?.mid} · 低 ${ov?.today?.low}`" />
      <StatCard label="今日可疑金额" :value="fmtWan(ov?.today?.totalSuspectedAmount)" icon="Money" tone="warning"
        :desc="`昨日 ${fmtWan(ov?.yesterday?.totalSuspectedAmount)}`" />
      <StatCard label="今日已处理" :value="ov?.today?.handled || 0" unit="条" icon="CircleCheck" tone="success"
        :desc="`处理率 ${fmtPercent(ov?.today?.handleRate)}`" />
      <StatCard label="本月累计线索" :value="ov?.month?.newClueCount || 0" unit="条" icon="Calendar" tone="accent"
        :desc="`涉及金额 ${fmtWan(ov?.month?.totalSuspectedAmount)}`" />
      <StatCard label="本月挽回基金" :value="fmtWan(ov?.month?.recoveredAmount || ov?.month?.confirmedAmount)"
        icon="Wallet" tone="purple" desc="已确认违规追回" />
    </div>

    <div class="main-row">
      <!-- 左：实时流 -->
      <div class="section-card stream-card">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">实时预警流</span>
          <span class="section-title__desc">按识别时间倒序 · 5 秒滚动</span>
          <span class="section-title__extra">
            <el-button link size="small" :type="paused ? 'primary' : 'info'" @click="paused = !paused">
              <el-icon><component :is="paused ? 'VideoPlay' : 'VideoPause'" /></el-icon>
              {{ paused ? '继续滚动' : '暂停滚动' }}
            </el-button>
          </span>
        </div>

        <div class="stream" @mouseenter="paused = true" @mouseleave="paused = false">
          <div v-for="s in stream" :key="s.clueId" class="stream-item" :class="[`is-${s.riskLevel}`, { 'is-new': s._new }]"
            @click="gotoClue(s)">
            <div class="stream-item__time num">{{ s.time?.slice(11, 19) }}</div>
            <div class="stream-item__bar" />
            <div class="stream-item__body">
              <div class="stream-item__l1">
                <RiskTag :level="s.riskLevel" size="small" />
                <span class="stream-item__type">{{ s.violationType }}</span>
                <span class="stream-item__id num">{{ s.clueId }}</span>
              </div>
              <div class="stream-item__l2">
                <span class="stream-item__org">{{ s.orgName }}</span>
                <span class="stream-item__rule">命中：{{ s.ruleHit }}</span>
              </div>
            </div>
            <div class="stream-item__right">
              <div class="stream-item__amt num num--money">¥{{ fmtMoney(s.amount) }}</div>
              <div class="stream-item__conf">置信度 <b class="num">{{ s.confidence }}%</b></div>
            </div>
          </div>
          <EmptyState v-if="!stream.length" text="暂无实时预警" height="200px" />
        </div>
      </div>

      <!-- 右：分布 -->
      <div class="right-col">
        <SectionCard title="风险等级分布" desc="今日新增线索">
          <EChart :option="levelOption" height="196px" />
        </SectionCard>
        <SectionCard title="违规大类分布" desc="五大类占比">
          <EChart :option="categoryOption" height="208px" />
        </SectionCard>
      </div>
    </div>

    <div class="chart-row">
      <SectionCard title="24 小时预警时段分布" desc="识别高峰时段分析" class="chart-row__main">
        <EChart :option="hourOption" height="238px" />
      </SectionCard>
      <SectionCard title="高发违规类型 TOP8" desc="按线索数量排序" class="chart-row__side">
        <EChart :option="violationOption" height="238px" />
      </SectionCard>
    </div>

    <!-- 引擎状态 -->
    <SectionCard title="智能识别引擎运行状态" desc="规则引擎 / AI 模型 / 知识图谱 / 实时流处理">
      <div class="engine-grid">
        <div v-for="e in ov?.engineStatus || []" :key="e.name" class="engine-card" :class="`is-${engineTone(e.status)}`">
          <div class="engine-card__head">
            <el-icon class="engine-card__icon"><Cpu /></el-icon>
            <span class="engine-card__name">{{ e.name }}</span>
            <span class="engine-card__status">
              <span class="engine-card__dot" />{{ e.status }}
            </span>
          </div>
          <div class="engine-card__metrics">
            <div class="engine-card__m">
              <span>吞吐</span><b class="num">{{ e.qps }}</b><i>QPS</i>
            </div>
            <div class="engine-card__m">
              <span>延迟</span><b class="num">{{ e.latency }}</b><i>ms</i>
            </div>
            <div class="engine-card__m">
              <span>负载</span><b class="num">{{ e.load }}</b><i>%</i>
            </div>
          </div>
          <el-progress :percentage="e.load" :stroke-width="4" :show-text="false"
            :color="e.load >= 80 ? '#e5484d' : e.load >= 60 ? '#e8a30c' : '#12a150'" />
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.live-tag { display: inline-flex; align-items: center; gap: 5px; }
.live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #fff;
  animation: zh-pulse 1.4s infinite;
}

.main-row {
  display: grid; grid-template-columns: 1fr 330px; gap: 12px;
  @media (max-width: 1280px) { grid-template-columns: 1fr; }
}
.right-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.stream-card { display: flex; flex-direction: column; min-width: 0; }
.stream {
  max-height: 452px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  padding-right: 4px;
}

.stream-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: var(--zh-radius);
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  cursor: pointer; transition: all .18s;
  --tone: var(--zh-risk-low);

  &.is-高 { --tone: var(--zh-risk-high); background: var(--zh-risk-high-bg); border-color: var(--zh-risk-high-border); }
  &.is-中 { --tone: var(--zh-risk-mid); background: var(--zh-risk-mid-bg); border-color: var(--zh-risk-mid-border); }
  &.is-低 { --tone: var(--zh-risk-low); }

  &:hover { transform: translateX(2px); box-shadow: var(--zh-shadow-sm); }
  &.is-new { animation: zh-fade-up .5s ease; }

  &__time { font-size: 11px; color: var(--zh-text-secondary); width: 54px; flex-shrink: 0; }
  &__bar { width: 3px; align-self: stretch; border-radius: 2px; background: var(--tone); flex-shrink: 0; }
  &__body { flex: 1; min-width: 0; }
  &__l1 { display: flex; align-items: center; gap: 6px; }
  &__type { font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary); }
  &__id { font-size: 10px; color: var(--zh-text-placeholder); }
  &__l2 {
    display: flex; align-items: center; gap: 10px; margin-top: 2px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  &__org { color: var(--zh-text-regular); }
  &__rule { color: var(--zh-text-placeholder); }
  &__right { text-align: right; flex-shrink: 0; }
  &__amt { font-size: var(--zh-font-md); font-weight: 700; color: var(--tone); }
  &__conf { font-size: 10px; color: var(--zh-text-placeholder); b { color: var(--zh-text-secondary); } }
}

.chart-row {
  display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px;
  @media (max-width: 1280px) { grid-template-columns: 1fr; }
  &__main, &__side { min-width: 0; }
}

.engine-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
}
.engine-card {
  padding: 11px 12px; border-radius: var(--zh-radius);
  border: 1px solid var(--zh-border-light); background: var(--zh-bg-soft);
  --tone: var(--zh-success);
  &.is-success { --tone: var(--zh-success); }
  &.is-warning { --tone: var(--zh-warning); }
  &.is-danger { --tone: var(--zh-danger); }
  transition: all .2s;
  &:hover { box-shadow: var(--zh-shadow-sm); border-color: var(--tone); }

  &__head { display: flex; align-items: center; gap: 6px; }
  &__icon { color: var(--zh-primary); font-size: 14px; }
  &__name { font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary); flex: 1; }
  &__status {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 700; color: var(--tone);
  }
  &__dot { width: 5px; height: 5px; border-radius: 50%; background: var(--tone); animation: zh-pulse 1.6s infinite; }
  &__metrics { display: flex; gap: 12px; margin: 8px 0 6px; }
  &__m {
    display: flex; align-items: baseline; gap: 3px;
    span { font-size: 10px; color: var(--zh-text-placeholder); }
    b { font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary); }
    i { font-size: 9px; font-style: normal; color: var(--zh-text-placeholder); }
  }
}
</style>
