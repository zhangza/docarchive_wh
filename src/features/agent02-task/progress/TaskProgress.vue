<script setup lang="ts">
import { getTaskList, getTaskStats, urgeTask } from '@/api/agent02-task/task'
import { fmtMoney, CHART_COLORS, CHART_GRID } from '@/utils/format'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const selection = ref<any[]>([])
const expand = ref(false)
const viewMode = ref<'lane' | 'table'>('lane')

const q = reactive({
  keyword: '', status: '', riskLevel: '', taskType: '', district: '',
  slaStatus: '', assigneeGroup: '', orgType: '',
  dateRange: [] as string[], page: 1, pageSize: 15
})

/** 任务流转节点（泳道列） */
const STAGES = [
  { key: '已派发', label: '已派发', icon: 'Promotion' },
  { key: '已签收', label: '已签收', icon: 'Select' },
  { key: '自查中', label: '机构自查', icon: 'OfficeBuilding' },
  { key: '核查中', label: '现场核查', icon: 'Location' },
  { key: '申诉中', label: '机构申诉', icon: 'ChatDotSquare' },
  { key: '结果确认中', label: '结果确认', icon: 'DocumentChecked' },
  { key: '已结案', label: '已结案', icon: 'CircleCheck' }
]

const TYPE_TONE: Record<string, string> = { 日常稽核: 'primary', 专项检查: 'success', 飞行检查: 'danger', 联合督查: 'warning' }
const SLA_TONE: Record<string, string> = { 正常: 'success', 临期: 'warning', 超期: 'danger' }
const STATUS_TONE: Record<string, string> = {
  草稿: 'info', 待派发: 'warning', 已派发: 'primary', 已签收: 'primary',
  自查中: 'warning', 核查中: 'warning', 申诉中: 'danger', 结果确认中: 'primary', 已结案: 'success'
}

/** 泳道数据：按状态分组 */
const lanes = computed(() =>
  STAGES.map((s) => ({
    ...s,
    tasks: list.value.filter((t) => t.status === s.key)
  }))
)

async function loadStats() { st.value = await getTaskStats() }

async function load() {
  loading.value = true
  try {
    const { dateRange, ...rest } = q
    const res: any = await getTaskList({
      ...rest,
      startTime: dateRange?.[0] || '',
      endTime: dateRange?.[1] || '',
      pageSize: viewMode.value === 'lane' ? 100 : q.pageSize
    })
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, {
    keyword: '', status: '', riskLevel: '', taskType: '', district: '',
    slaStatus: '', assigneeGroup: '', orgType: '', dateRange: [], page: 1
  })
  load()
}

/** 快捷筛选 */
function quick(type: string) {
  doReset()
  if (type === 'overtime') q.slaStatus = '超期'
  else if (type === 'near') q.slaStatus = '临期'
  else if (type === 'high') q.riskLevel = '高'
  else if (type === 'flight') q.taskType = '飞行检查'
  load()
}

/* ---------- 催办 ---------- */
const urgeVisible = ref(false)
const urging = ref(false)
const urgeForm = reactive({ channels: ['站内信'], content: '', escalate: false })

function openUrge(row?: any) {
  const targets = row ? [row] : selection.value
  if (!targets.length) { msg.warning('请先勾选需催办的任务'); return }
  urgeForm.content = `您承办的 ${targets.length} 个检查任务即将到期或已超期，请尽快推进办理并回传核查结果。`
  urgeTargets.value = targets
  urgeVisible.value = true
}
const urgeTargets = ref<any[]>([])

async function doUrge() {
  if (!urgeForm.channels.length) { msg.warning('请选择提醒渠道'); return }
  urging.value = true
  try {
    await urgeTask({ taskIds: urgeTargets.value.map((t) => t.taskId), ...urgeForm })
    msg.success(`已通过${urgeForm.channels.join('、')}向 ${urgeTargets.value.length} 个任务承办人发送催办`)
    urgeVisible.value = false
    selection.value = []
    load()
  } finally {
    urging.value = false
  }
}

/* ---------- 任务详情抽屉 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
function openDetail(row: any) { cur.value = row; drawer.value = true }

/** 详情时间轴节点 */
const timeline = computed(() => {
  if (!cur.value) return []
  const t = cur.value
  return [
    { name: '任务创建', time: t.createTime, done: !!t.createTime, desc: `创建人 ${t.creator}` },
    { name: '任务派发', time: t.dispatchTime, done: !!t.dispatchTime, desc: `${t.dispatchType} · ${t.assigneeGroup}` },
    { name: '承办签收', time: t.signTime, done: !!t.signTime, desc: `组长 ${t.leader}` },
    { name: '机构自查', time: t.selfCheckTime, done: !!t.selfCheckTime, desc: '被检机构在线填报自查说明' },
    { name: '现场核查', time: t.inspectionTime, done: !!t.inspectionTime, desc: '现场取证与证据固化' },
    { name: '机构申诉', time: t.appealTime, done: !!t.appealTime, desc: t.appealTime ? '机构提出申诉，进入复核' : '未申诉' },
    { name: '结果确认', time: t.resultTime, done: !!t.resultTime, desc: 'AI 生成初步结果并人工复核' },
    { name: '任务结案', time: t.closeTime, done: !!t.closeTime, desc: '处置、追回、整改到位后销号' }
  ]
})

/* ---------- 图表 ---------- */
const statusOption = computed(() => {
  const d = st.value?.byStatus || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 46, bottom: 48 },
    xAxis: {
      type: 'category',
      data: d.map((i: any) => i.status),
      axisLabel: { fontSize: 10, interval: 0, rotate: 32, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value', name: '任务数',
      nameTextStyle: { fontSize: 10, color: '#9aa7b8' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8' }
    },
    series: [{
      type: 'bar', barWidth: 20,
      itemStyle: {
        borderRadius: [3, 3, 0, 0],
        color: (p: any) => ['#5a7189', '#e8a30c', '#1668dc', '#3c88ff', '#e8a30c', '#e8a30c', '#e5484d', '#722ed1', '#12a150'][p.dataIndex] || '#1668dc'
      },
      label: { show: true, position: 'top', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.count)
    }]
  }
})

const typeOption = computed(() => {
  const d = st.value?.byType || []
  return {
    color: ['#1668dc', '#12a150', '#e5484d', '#e8a30c'],
    tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['44%', '68%'], center: ['50%', '43%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.type, value: i.count }))
    }]
  }
})

const trendOption = computed(() => {
  const d = st.value?.monthTrend || []
  return {
    color: ['#1668dc', '#12a150'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增立项', '办结'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 42, bottom: 28 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.month.slice(5) + '月'),
      axisLabel: { fontSize: 10, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8' }
    },
    series: [
      { name: '新增立项', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: .12 }, data: d.map((i: any) => i.created) },
      { name: '办结', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: .12 }, data: d.map((i: any) => i.closed) }
    ]
  }
})

watch(viewMode, () => load())

onMounted(() => {
  dict.load()
  loadStats()
  load()
})
</script>

<template>
  <div class="zh-page">
    <PageHeader title="任务进度管控" tag="M17"
      subtitle="泳道进度可视化 · 临期预警超期标红 · 多渠道自动督办">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Warning'" @click="quick('overtime')">超期任务</el-button>
        <el-button type="primary" :icon="'BellFilled'" :disabled="!selection.length" @click="openUrge()">
          催办<template v-if="selection.length">（{{ selection.length }}）</template>
        </el-button>
      </template>
    </PageHeader>

    <!-- ============ 指标卡 ============ -->
    <div class="kpi-grid">
      <StatCard label="任务总数" :value="st?.total || 0" unit="个" icon="Files" tone="primary" />
      <StatCard label="在办任务" :value="(st?.byStatus || []).filter((s: any) => !['草稿', '已结案'].includes(s.status)).reduce((a: number, b: any) => a + b.count, 0)"
        unit="个" icon="Loading" tone="accent" />
      <StatCard label="临期预警" :value="(st?.bySla || []).find((s: any) => s.status === '临期')?.count || 0"
        unit="个" icon="AlarmClock" tone="warning" clickable @click="quick('near')" />
      <StatCard label="已超期" :value="(st?.bySla || []).find((s: any) => s.status === '超期')?.count || 0"
        unit="个" icon="Warning" tone="danger" clickable @click="quick('overtime')" />
      <StatCard label="高风险任务" :value="(st?.byRisk || []).find((s: any) => s.risk === '高')?.count || 0"
        unit="个" icon="Aim" tone="danger" clickable @click="quick('high')" />
      <StatCard label="已结案" :value="(st?.byStatus || []).find((s: any) => s.status === '已结案')?.count || 0"
        unit="个" icon="CircleCheck" tone="success" />
    </div>

    <!-- ============ 统计图表 ============ -->
    <div class="chart-grid">
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">各状态任务分布</span>
        </div>
        <EChart :option="statusOption" height="222px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">任务类型构成</span>
        </div>
        <EChart :option="typeOption" height="222px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">立项与办结趋势</span>
        </div>
        <EChart :option="trendOption" height="222px" />
      </div>
    </div>

    <!-- ============ 查询 ============ -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">任务查询</span>
        <span class="section-title__desc">支持任务编号 / 名称 / 被检机构模糊检索</span>
      </div>
      <el-form class="query-form" :model="q" label-width="80px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="任务编号/名称/机构" clearable :prefix-icon="'Search'"
            @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option v-for="s in ['草稿', '待派发', '已派发', '已签收', '自查中', '核查中', '申诉中', '结果确认中', '已结案']"
              :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="q.taskType" placeholder="全部类型" clearable>
            <el-option v-for="t in ['日常稽核', '专项检查', '飞行检查', '联合督查']" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="q.riskLevel" placeholder="全部等级" clearable>
            <el-option label="高风险" value="高" />
            <el-option label="中风险" value="中" />
            <el-option label="低风险" value="低" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="时限状态">
            <el-select v-model="q.slaStatus" placeholder="全部" clearable>
              <el-option label="正常" value="正常" />
              <el-option label="临期" value="临期" />
              <el-option label="超期" value="超期" />
            </el-select>
          </el-form-item>
          <el-form-item label="所属辖区">
            <el-select v-model="q.district" placeholder="全部辖区" clearable>
              <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="承办组">
            <el-select v-model="q.assigneeGroup" placeholder="全部" clearable>
              <el-option v-for="g in ['稽核一组', '稽核二组', '稽核三组', '基金监管处', '飞行检查组']"
                :key="g" :label="g" :value="g" />
            </el-select>
          </el-form-item>
          <el-form-item label="机构类型">
            <el-select v-model="q.orgType" placeholder="全部" clearable>
              <el-option label="医院" value="医院" />
              <el-option label="药店" value="药店" />
            </el-select>
          </el-form-item>
          <el-form-item label="立项时间" class="is-wide">
            <el-date-picker v-model="q.dateRange" type="daterange" value-format="YYYY-MM-DD"
              start-placeholder="开始" end-placeholder="结束" />
          </el-form-item>
        </template>

        <div class="query-form__actions">
          <el-button link type="primary" @click="expand = !expand">
            {{ expand ? '收起' : '展开' }}
            <el-icon><component :is="expand ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          </el-button>
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </div>
      </el-form>
    </div>

    <!-- ============ 进度视图 ============ -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">任务进度</span>
        <span class="section-title__desc">
          泳道视图按流转节点展示任务分布，超期任务标红，可一键催办
        </span>
        <span class="section-title__extra">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="lane">泳道视图</el-radio-button>
            <el-radio-button label="table">列表视图</el-radio-button>
          </el-radio-group>
        </span>
      </div>

      <!-- 泳道视图 -->
      <div v-if="viewMode === 'lane'" v-loading="loading" class="lane-wrap">
        <div class="lanes">
          <div v-for="l in lanes" :key="l.key" class="lane">
            <div class="lane__head">
              <el-icon><component :is="l.icon" /></el-icon>
              <span class="lane__name">{{ l.label }}</span>
              <span class="lane__cnt num">{{ l.tasks.length }}</span>
            </div>
            <div class="lane__body">
              <div v-for="t in l.tasks" :key="t.taskId" class="lt"
                :class="{ 'is-over': t.slaStatus === '超期', 'is-near': t.slaStatus === '临期' }"
                @click="openDetail(t)">
                <div class="lt__top">
                  <span class="lt__id num">{{ t.taskId }}</span>
                  <RiskTag :level="t.riskLevel" />
                </div>
                <div class="lt__name">{{ t.taskName }}</div>
                <div class="lt__org"><el-icon :size="10"><OfficeBuilding /></el-icon>{{ t.inspectOrg }}</div>
                <div class="lt__foot">
                  <el-tag :type="(TYPE_TONE[t.taskType] as any) || 'info'" size="small" effect="plain">
                    {{ t.taskType }}
                  </el-tag>
                  <span v-if="t.slaStatus !== '正常'" class="lt__sla" :class="`is-${SLA_TONE[t.slaStatus]}`">
                    {{ t.slaStatus }}
                  </span>
                  <span class="lt__amt num num--money-mild">{{ fmtMoney(t.totalSuspectedAmount) }}</span>
                </div>
                <el-progress :percentage="t.progress" :stroke-width="3" :show-text="false"
                  :status="t.slaStatus === '超期' ? 'exception' : undefined" class="lt__pg" />
              </div>
              <div v-if="!l.tasks.length" class="lane__empty">暂无任务</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <template v-else>
        <div class="table-toolbar">
          <el-button :icon="'BellFilled'" type="primary" :disabled="!selection.length" @click="openUrge()">
            批量催办
          </el-button>
          <span class="text-mini">已选 {{ selection.length }} 项</span>
          <div class="table-toolbar__right">
            <el-button :icon="'Warning'" @click="quick('overtime')">仅看超期</el-button>
          </div>
        </div>

        <el-table :data="list" size="small" border stripe v-loading="loading"
          :row-class-name="({ row }: any) => (row.slaStatus === '超期' ? 'row-over' : '')"
          @selection-change="(v: any[]) => (selection = v)">
          <el-table-column type="selection" width="42" />
          <el-table-column prop="taskId" label="任务编号" width="148">
            <template #default="{ row }">
              <span class="num text-link" @click="openDetail(row)">{{ row.taskId }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="taskName" label="任务名称" min-width="230" show-overflow-tooltip />
          <el-table-column prop="taskType" label="类型" width="96" align="center">
            <template #default="{ row }">
              <el-tag :type="(TYPE_TONE[row.taskType] as any) || 'info'" size="small" effect="plain">
                {{ row.taskType }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="(STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="riskLevel" label="风险" width="68" align="center">
            <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
          </el-table-column>
          <el-table-column prop="progress" label="进度" width="120">
            <template #default="{ row }">
              <el-progress :percentage="row.progress" :stroke-width="10" :text-inside="true"
                :status="row.slaStatus === '超期' ? 'exception' : row.progress === 100 ? 'success' : undefined" />
            </template>
          </el-table-column>
          <el-table-column prop="inspectOrg" label="被检机构" min-width="160" show-overflow-tooltip />
          <el-table-column prop="assigneeGroup" label="承办组" width="104" />
          <el-table-column prop="totalSuspectedAmount" label="疑似金额" width="112" align="right">
            <template #default="{ row }">
              <span class="num num--money">{{ fmtMoney(row.totalSuspectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="slaStatus" label="时限" width="76" align="center">
            <template #default="{ row }">
              <el-tag :type="(SLA_TONE[row.slaStatus] as any) || 'info'" size="small"
                :effect="row.slaStatus === '正常' ? 'plain' : 'dark'">{{ row.slaStatus }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="deadline" label="办理时限" width="146">
            <template #default="{ row }"><span class="num text-mini">{{ row.deadline }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="128" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" :icon="'View'" @click="openDetail(row)">详情</el-button>
              <el-button link type="warning" :icon="'BellFilled'" @click="openUrge(row)">催办</el-button>
            </template>
          </el-table-column>
          <template #empty><EmptyState text="暂无符合条件的任务" height="140px" /></template>
        </el-table>

        <div class="pager">
          <span class="text-mini">共 {{ total }} 条</span>
          <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize"
            :total="total" :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper"
            small background @change="load" />
        </div>
      </template>
    </div>

    <!-- ============ 任务详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="620px" :with-header="true" title="任务办理详情">
      <template v-if="cur">
        <div class="dt-hero">
          <div class="dt-hero__t">
            {{ cur.taskName }}
            <el-tag :type="(STATUS_TONE[cur.status] as any) || 'info'" size="small" effect="dark">
              {{ cur.status }}
            </el-tag>
            <el-tag v-if="cur.slaStatus !== '正常'" :type="(SLA_TONE[cur.slaStatus] as any)" size="small" effect="dark">
              {{ cur.slaStatus }}
            </el-tag>
          </div>
          <div class="dt-hero__m">
            <span><el-icon><Files /></el-icon>{{ cur.taskId }}</span>
            <span><el-icon><Ticket /></el-icon>{{ cur.taskType }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ cur.inspectOrg }}</span>
            <span><el-icon><Location /></el-icon>{{ cur.district }}</span>
          </div>
          <el-progress :percentage="cur.progress" :stroke-width="8"
            :status="cur.slaStatus === '超期' ? 'exception' : cur.progress === 100 ? 'success' : undefined"
            class="dt-hero__pg" />
        </div>

        <div class="dt-kpi">
          <div class="dt-kpi__c">
            <div class="dt-kpi__v num">{{ cur.clueCount }}</div>
            <div class="dt-kpi__l">纳入线索</div>
          </div>
          <div class="dt-kpi__c">
            <div class="dt-kpi__v num num--money">{{ fmtMoney(cur.totalSuspectedAmount) }}</div>
            <div class="dt-kpi__l">疑似金额</div>
          </div>
          <div class="dt-kpi__c">
            <div class="dt-kpi__v num num--money">{{ cur.confirmedAmount ? fmtMoney(cur.confirmedAmount) : '—' }}</div>
            <div class="dt-kpi__l">确认金额</div>
          </div>
          <div class="dt-kpi__c">
            <div class="dt-kpi__v num">{{ cur.workdays }}</div>
            <div class="dt-kpi__l">工作日时限</div>
          </div>
        </div>

        <el-descriptions :column="2" border size="small" class="mt12">
          <el-descriptions-item label="承办组">{{ cur.assigneeGroup }}</el-descriptions-item>
          <el-descriptions-item label="组长">{{ cur.leader }}</el-descriptions-item>
          <el-descriptions-item label="承办人员" :span="2">
            <el-tag v-for="m in cur.assigneeMembers" :key="m" size="small" effect="plain" class="mr4">{{ m }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="涉及科室" :span="2">
            <el-tag v-for="d in cur.depts" :key="d" size="small" type="info" effect="plain" class="mr4">{{ d }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="派发方式">{{ cur.dispatchType }}</el-descriptions-item>
          <el-descriptions-item label="办理时限"><span class="num">{{ cur.deadline }}</span></el-descriptions-item>
        </el-descriptions>

        <div class="sub-title">办理进度轨迹</div>
        <el-timeline class="dt-tl">
          <el-timeline-item v-for="(n, i) in timeline" :key="i"
            :type="n.done ? 'primary' : 'info'" :hollow="!n.done" size="normal"
            :timestamp="n.time || '未开始'">
            <div class="tl__n" :class="{ 'is-todo': !n.done }">{{ n.name }}</div>
            <div class="tl__d">{{ n.desc }}</div>
          </el-timeline-item>
        </el-timeline>

        <div class="dt-actions">
          <el-button type="warning" :icon="'BellFilled'" @click="openUrge(cur)">催办提醒</el-button>
          <el-button type="primary" :icon="'Promotion'"
            @click="msg.success('任务办理提醒已推送至承办人')">推送提醒</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 催办弹窗 ============ -->
    <el-dialog v-model="urgeVisible" title="任务催办" width="520px">
      <el-alert type="warning" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">
            将对 <b class="num">{{ urgeTargets.length }}</b> 个任务发送催办，其中超期
            <b class="num">{{ urgeTargets.filter((t) => t.slaStatus === '超期').length }}</b> 个
          </span>
        </template>
      </el-alert>
      <el-form label-width="88px">
        <el-form-item label="提醒渠道" required>
          <el-checkbox-group v-model="urgeForm.channels">
            <el-checkbox label="站内信" />
            <el-checkbox label="短信" />
            <el-checkbox label="企业微信" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="逐级上报">
          <el-switch v-model="urgeForm.escalate" />
          <span class="text-mini ml8">超期任务同步通知承办组上级负责人</span>
        </el-form-item>
        <el-form-item label="催办内容">
          <el-input v-model="urgeForm.content" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="urgeVisible = false">取消</el-button>
        <el-button type="primary" :loading="urging" @click="doUrge">发送催办</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt12 { margin-top: 12px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.chart-grid {
  display: grid; grid-template-columns: 1.35fr 1fr 1.35fr; gap: 12px;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}

:deep(.row-over) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }

/* ---------- 泳道 ---------- */
.lane-wrap { overflow-x: auto; padding-bottom: 4px; }

.lanes {
  display: grid;
  grid-template-columns: repeat(7, minmax(186px, 1fr));
  gap: 8px;
  min-width: 1320px;
}

.lane {
  display: flex; flex-direction: column;
  border-radius: var(--zh-radius);
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  overflow: hidden;

  &__head {
    display: flex; align-items: center; gap: 5px;
    padding: 7px 9px;
    background: #fff;
    border-bottom: 2px solid var(--zh-primary);
    :deep(.el-icon) { color: var(--zh-primary); font-size: 13px; }
  }
  &__name { font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__cnt {
    margin-left: auto; min-width: 20px; height: 17px; padding: 0 5px;
    border-radius: 9px; background: var(--zh-primary); color: #fff;
    font-size: 10px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
  }
  &__body {
    flex: 1; padding: 7px; display: flex; flex-direction: column; gap: 6px;
    max-height: 460px; overflow-y: auto;
  }
  &__empty {
    padding: 22px 0; text-align: center;
    font-size: 11px; color: var(--zh-text-placeholder);
  }
}

.lt {
  padding: 8px 9px; border-radius: 6px; cursor: pointer;
  background: #fff; border: 1px solid var(--zh-border-light);
  transition: all .18s;

  &:hover { box-shadow: var(--zh-shadow-sm); transform: translateY(-2px); border-color: var(--zh-primary); }
  &.is-over { border-left: 3px solid var(--zh-risk-high); background: var(--zh-risk-high-bg); }
  &.is-near { border-left: 3px solid var(--zh-risk-mid); background: var(--zh-risk-mid-bg); }

  &__top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
  &__id { font-size: 10px; font-weight: 700; color: var(--zh-primary); }
  &__name {
    margin-top: 4px; font-size: 11px; font-weight: 600; line-height: 1.5;
    color: var(--zh-text-primary);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  &__org {
    display: flex; align-items: center; gap: 3px; margin-top: 4px;
    font-size: 10px; color: var(--zh-text-secondary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    :deep(.el-icon) { color: var(--zh-accent); flex-shrink: 0; }
  }
  &__foot {
    display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 6px;
  }
  &__sla {
    padding: 0 5px; border-radius: 3px; font-size: 9px; font-weight: 700;
    &.is-warning { background: var(--zh-warning); color: #fff; }
    &.is-danger { background: var(--zh-danger); color: #fff; }
  }
  &__amt { margin-left: auto; font-size: 10px; }
  &__pg { margin-top: 6px; }
}

/* ---------- 详情抽屉 ---------- */
.dt-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 14px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__pg { margin-top: 10px; }
}

.dt-kpi {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px;

  &__c {
    padding: 9px 6px; text-align: center;
    border-radius: 6px; background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }
  &__v { font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}

.sub-title {
  margin: 16px 0 10px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.dt-tl {
  padding-left: 4px;
  :deep(.el-timeline-item) { padding-bottom: 14px; }
  :deep(.el-timeline-item__timestamp) { font-size: 10px; }
}

.tl__n {
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
  &.is-todo { color: var(--zh-text-placeholder); font-weight: 400; }
}
.tl__d { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; line-height: 1.6; }

.dt-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
