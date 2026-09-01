<script setup lang="ts">
import { getCompareOverview, getCompareTasks, createCompareTask } from '@/api/agent01-clue/compare'
import { fmtWan, fmtNum, fmtPercent, CHART_COLORS, CHART_GRID } from '@/utils/format'

const router = useRouter()
const loading = ref(false)
const ov = ref<any>(null)
const tasks = ref<any[]>([])
const taskLoading = ref(false)
const dialogVisible = ref(false)
const creating = ref(false)

const form = reactive({
  taskName: '',
  compareType: '药品进销存比对',
  scope: '全市定点医药机构',
  dateRange: ['2026-08-01', '2026-08-29']
})

const COMPARE_TYPES = ['药品进销存比对', '病历结算比对', '处方结算比对', '检查检验比对', '就医行为比对']

async function loadAll() {
  loading.value = true
  taskLoading.value = true
  try {
    const [o, t] = await Promise.all([getCompareOverview(), getCompareTasks({ page: 1, pageSize: 10 })])
    ov.value = o
    tasks.value = t.list || t
  } finally {
    loading.value = false
    taskLoading.value = false
  }
}

async function submitTask() {
  if (!form.taskName) return ElMessage.warning('请填写任务名称')
  creating.value = true
  try {
    await createCompareTask({ ...form })
    ElMessage.success('比对任务已创建，正在排队执行')
    dialogVisible.value = false
    form.taskName = ''
    loadAll()
  } finally {
    creating.value = false
  }
}

/* ---------- 图表 ---------- */
const typeOption = computed(() => {
  const d = ov.value?.byCompareType || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['高风险', '中风险', '低风险'], right: 10, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 60, bottom: 46 },
    xAxis: {
      type: 'category',
      data: d.map((i: any) => String(i.name || i.compareType || '').replace('比对', '')),
      axisLabel: { fontSize: 11, interval: 0, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '疑点数',
      nameTextStyle: { fontSize: 10, color: '#9aa7b8' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 11, color: '#9aa7b8' }
    },
    series: [
      { name: '高风险', type: 'bar', stack: 'a', barWidth: 26, itemStyle: { color: '#e5484d' }, data: d.map((i: any) => i.high) },
      { name: '中风险', type: 'bar', stack: 'a', itemStyle: { color: '#e8a30c' }, data: d.map((i: any) => i.mid) },
      {
        name: '低风险',
        type: 'bar',
        stack: 'a',
        itemStyle: { color: '#12a150', borderRadius: [3, 3, 0, 0] },
        data: d.map((i: any) => i.low)
      }
    ]
  }
})

const trendOption = computed(() => {
  const d = ov.value?.trend || []
  return {
    tooltip: { trigger: 'axis' },
    grid: { ...CHART_GRID, bottom: 28 },
    xAxis: {
      type: 'category',
      data: d.map((i: any) => i.date?.slice(5) || i.date),
      boundaryGap: false,
      axisLabel: { fontSize: 11, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 11, color: '#9aa7b8' }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: d.map((i: any) => i.count),
        lineStyle: { width: 2.5, color: '#1668dc' },
        itemStyle: { color: '#1668dc', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(22,104,220,.28)' },
              { offset: 1, color: 'rgba(22,104,220,.02)' }
            ]
          }
        }
      }
    ]
  }
})

const districtOption = computed(() => {
  const d = ov.value?.byDistrict || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 78, right: 46, top: 10, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 11, color: '#9aa7b8' } },
    yAxis: {
      type: 'category',
      data: d.map((i: any) => i.district).reverse(),
      axisLabel: { fontSize: 11, color: '#43516b' },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        barWidth: 13,
        data: d.map((i: any) => i.count).reverse(),
        label: { show: true, position: 'right', fontSize: 11, color: '#6b7a90', fontFamily: 'DIN Alternate' },
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#3c88ff' }, { offset: 1, color: '#13c2c2' }] }
        }
      }
    ]
  }
})

const statusTone: Record<string, string> = {
  已完成: 'success',
  进行中: 'primary',
  排队中: 'info',
  异常终止: 'danger'
}

const srcTone = (s: string) => (s === '正常' ? 'success' : s === '延迟' ? 'warning' : 'danger')

onMounted(loadAll)
</script>

<template>
  <div class="zh-page" v-loading="loading">
    <PageHeader title="数据比对看板" subtitle="多源数据融合 · 五类比对场景 · 疑点自动生成" tag="M01">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadAll">刷新</el-button>
        <el-button type="primary" :icon="'Plus'" @click="dialogVisible = true">新建比对任务</el-button>
      </template>
    </PageHeader>

    <!-- KPI -->
    <div class="kpi-grid">
      <StatCard label="累计比对疑点" :value="ov?.totalAnomaly || 0" unit="条" icon="DataLine" tone="primary"
        :trend="12.4" desc="较上周期" />
      <StatCard label="高风险疑点" :value="ov?.high || 0" unit="条" icon="Warning" tone="danger"
        :desc="`中风险 ${fmtNum(ov?.mid)} · 低风险 ${fmtNum(ov?.low)}`" />
      <StatCard label="涉及可疑金额" :value="fmtWan(ov?.totalAmount)" icon="Money" tone="warning" desc="按结算数据折算" />
      <StatCard label="已转线索" :value="ov?.transferredClue || 0" unit="条" icon="Promotion" tone="success"
        :desc="`转化率 ${fmtPercent(ov?.transferRate)}`" />
      <StatCard label="比对任务" :value="ov?.taskRunning || 0" unit="个进行中" icon="Loading" tone="accent"
        :desc="`已完成 ${fmtNum(ov?.taskDone)} 个`" />
      <StatCard label="接入数据源" :value="ov?.dataSourceCount || 0" unit="类" icon="Coin" tone="purple"
        :desc="`最近运行 ${ov?.lastRunTime?.slice(5, 16) || '—'}`" />
    </div>

    <!-- 图表区 -->
    <div class="chart-row">
      <SectionCard title="五类比对场景疑点分布" desc="按风险等级堆叠" class="chart-row__main">
        <EChart :option="typeOption" height="272px" />
      </SectionCard>
      <SectionCard title="近 7 日疑点趋势" desc="每日新增疑点数" class="chart-row__side">
        <EChart :option="trendOption" height="272px" />
      </SectionCard>
    </div>

    <div class="chart-row">
      <SectionCard title="辖区疑点分布" desc="7 个县市区" class="chart-row__side">
        <EChart :option="districtOption" height="252px" />
      </SectionCard>

      <SectionCard title="疑点高发机构 TOP10" desc="按疑点数排序" class="chart-row__main">
        <el-table :data="ov?.topOrgs || []" size="small" border stripe height="252">
          <el-table-column type="index" label="#" width="46" align="center" />
          <el-table-column prop="orgName" label="机构名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="orgType" label="类型" width="86" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.orgType === '医院' ? 'primary' : 'success'" effect="plain">
                {{ row.orgType }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="district" label="辖区" width="86" align="center" />
          <el-table-column prop="anomalyCount" label="疑点数" width="86" align="right">
            <template #default="{ row }"><span class="num">{{ row.anomalyCount }}</span></template>
          </el-table-column>
          <el-table-column prop="amount" label="可疑金额(元)" width="120" align="right">
            <template #default="{ row }"><span class="num num--money">{{ fmtNum(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column prop="highCount" label="高风险" width="80" align="center">
            <template #default="{ row }"><span class="num" style="color: var(--zh-danger); font-weight: 700">{{ row.highCount }}</span></template>
          </el-table-column>
        </el-table>
      </SectionCard>
    </div>

    <!-- 数据源 -->
    <SectionCard title="多源数据接入状态" desc="8 类核心数据源实时监测">
      <div class="src-grid">
        <div v-for="s in ov?.dataSources || []" :key="s.code" class="src-card" :class="`is-${srcTone(s.status)}`">
          <div class="src-card__head">
            <span class="src-card__name">{{ s.name }}</span>
            <span class="src-card__status">{{ s.status }}</span>
          </div>
          <div class="src-card__code num">{{ s.code }}</div>
          <div class="src-card__row">
            <span>今日接入</span><b class="num">{{ fmtNum(s.todayCount) }}</b>
          </div>
          <div class="src-card__row">
            <span>同步频率</span><b>{{ s.freq }}</b>
          </div>
          <div class="src-card__row">
            <span>完整度</span>
            <b class="num">{{ fmtPercent(s.integrity) }}</b>
          </div>
          <el-progress :percentage="s.integrity" :stroke-width="4" :show-text="false"
            :color="s.integrity >= 99 ? '#12a150' : s.integrity >= 95 ? '#e8a30c' : '#e5484d'" />
        </div>
      </div>
    </SectionCard>

    <!-- 任务列表 -->
    <SectionCard title="比对任务执行记录" desc="最近 10 次任务">
      <template #extra>
        <el-button link type="primary" size="small" @click="router.push('/compare/anomaly')">
          查看疑点清单<el-icon><ArrowRight /></el-icon>
        </el-button>
      </template>
      <el-table :data="tasks" v-loading="taskLoading" size="small" border stripe>
        <el-table-column prop="taskId" label="任务编号" width="160">
          <template #default="{ row }"><span class="num text-link">{{ row.taskId }}</span></template>
        </el-table-column>
        <el-table-column prop="taskName" label="任务名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="compareType" label="比对场景" width="140" align="center" />
        <el-table-column prop="scope" label="比对范围" width="150" show-overflow-tooltip />
        <el-table-column prop="startTime" label="开始时间" width="150">
          <template #default="{ row }"><span class="num">{{ row.startTime }}</span></template>
        </el-table-column>
        <el-table-column prop="duration" label="耗时" width="90" align="center" />
        <el-table-column prop="dataVolume" label="数据量(条)" width="110" align="right">
          <template #default="{ row }"><span class="num">{{ fmtNum(row.dataVolume) }}</span></template>
        </el-table-column>
        <el-table-column prop="anomalyCount" label="疑点数" width="86" align="right">
          <template #default="{ row }"><span class="num" style="font-weight: 700">{{ row.anomalyCount }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="140" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTone[row.status] as any" effect="light">{{ row.status }}</el-tag>
            <el-progress v-if="row.status === '进行中'" :percentage="row.progress" :stroke-width="3"
              :show-text="false" style="margin-top: 4px" />
          </template>
        </el-table-column>
        <el-table-column prop="creator" label="创建人" width="120" />
      </el-table>
    </SectionCard>

    <!-- 新建任务 -->
    <el-dialog v-model="dialogVisible" title="新建比对任务" width="520px">
      <el-form :model="form" label-width="94px">
        <el-form-item label="任务名称" required>
          <el-input v-model="form.taskName" placeholder="如：8月全市定点药店进销存专项比对" />
        </el-form-item>
        <el-form-item label="比对场景">
          <el-select v-model="form.compareType" style="width: 100%">
            <el-option v-for="t in COMPARE_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="比对范围">
          <el-select v-model="form.scope" style="width: 100%">
            <el-option label="全市定点医药机构" value="全市定点医药机构" />
            <el-option label="全市定点医疗机构" value="全市定点医疗机构" />
            <el-option label="全市定点零售药店" value="全市定点零售药店" />
            <el-option label="三级医疗机构" value="三级医疗机构" />
            <el-option label="镜湖区定点机构" value="镜湖区定点机构" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据区间">
          <el-date-picker v-model="form.dateRange" type="daterange" value-format="YYYY-MM-DD"
            start-placeholder="开始日期" end-placeholder="结束日期" style="width: 100%" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon
          title="任务创建后进入执行队列，系统将自动完成数据抽取、清洗、比对与疑点生成。" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitTask">创建并执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.chart-row {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 12px;
  @media (max-width: 1280px) { grid-template-columns: 1fr; }
  &__main, &__side { min-width: 0; }
}

.src-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  @media (max-width: 1400px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 1000px) { grid-template-columns: repeat(2, 1fr); }
}

.src-card {
  padding: 10px 12px;
  border-radius: var(--zh-radius);
  border: 1px solid var(--zh-border-light);
  background: var(--zh-bg-soft);
  --tone: var(--zh-success);
  transition: all .2s;
  &:hover { box-shadow: var(--zh-shadow-sm); border-color: var(--tone); transform: translateY(-1px); }

  &.is-success { --tone: var(--zh-success); }
  &.is-warning { --tone: var(--zh-warning); }
  &.is-danger { --tone: var(--zh-danger); }

  &__head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  &__name { font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary); }
  &__status {
    font-size: 10px; font-weight: 700;
    padding: 1px 6px; border-radius: 3px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 12%, #fff);
    flex-shrink: 0;
  }
  &__code { font-size: 10px; color: var(--zh-text-placeholder); margin-top: 2px; letter-spacing: .5px; }
  &__row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    margin-top: 5px;
    b { color: var(--zh-text-primary); font-weight: 700; }
  }
  :deep(.el-progress) { margin-top: 8px; }
}
</style>
