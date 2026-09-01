<script setup lang="ts">
import {
  getLifecycleStats, getLifecycleList, getLifecycleDetail,
  urgeLifecycle, sendFeedbackResult
} from '@/api/agent01-clue/lifecycle'
import { fmtMoney, CHART_COLORS, CHART_GRID } from '@/utils/format'
import { useDictStore } from '@/stores/dict'

const router = useRouter()
const dict = useDictStore()
/** 模板中可用的消息提示别名 */
const msg = ElMessage
/** 全链路数据完整的典型案例，供快速查阅办理轨迹 */
const TYPICAL_ID = 'CL20260829000001'

const STAGES = ['线索研判', '线上筛查', '线下核查', '机构申诉', '违规处置', '已结案']
const SLA = ['按时', '临期', '超时']

const st = ref<any>(null)
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const expand = ref(false)
const sel = ref<any[]>([])

const q = reactive({
  keyword: '', riskLevel: '', status: '', currentStage: '', slaStatus: '',
  district: '', orgType: '', violationCategory: '', overtime: '',
  amountMin: undefined as any, amountMax: undefined as any,
  dateRange: [] as string[], page: 1, pageSize: 15
})

async function loadStats() { st.value = await getLifecycleStats() }
async function load() {
  loading.value = true
  try {
    const { dateRange, ...rest } = q
    const res: any = await getLifecycleList({
      ...rest, startTime: dateRange?.[0] || '', endTime: dateRange?.[1] || ''
    })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}
function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, {
    keyword: '', riskLevel: '', status: '', currentStage: '', slaStatus: '', district: '',
    orgType: '', violationCategory: '', overtime: '',
    amountMin: undefined, amountMax: undefined, dateRange: [], page: 1
  })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'overtime') q.overtime = 'true'
  if (t === 'closed') q.status = '已结案'
  if (t === 'processing') q.currentStage = '线下核查'
  load()
}

/* ===== 图表 ===== */
const funnelOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条' },
  color: CHART_COLORS,
  series: [{
    type: 'funnel', left: '4%', right: '4%', top: 12, bottom: 12,
    minSize: '24%', maxSize: '100%', sort: 'descending', gap: 2,
    label: { position: 'inside', fontSize: 11, color: '#fff', formatter: '{b} {c}' },
    itemStyle: { borderColor: '#fff', borderWidth: 1 },
    data: (st.value?.stageFunnel || []).map((i: any) => ({ name: i.stage, value: i.count }))
  }]
}))

const durationOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { ...CHART_GRID, left: 62 },
  xAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
  yAxis: {
    type: 'category', inverse: true, axisLabel: { fontSize: 10 },
    data: (st.value?.durationDist || []).map((i: any) => i.range)
  },
  series: [{
    type: 'bar', barWidth: 14, name: '线索数',
    itemStyle: {
      borderRadius: [0, 4, 4, 0],
      color: (p: any) => ['#12a150', '#3c88ff', '#1668dc', '#e8a30c', '#f759ab', '#e5484d'][p.dataIndex] || '#1668dc'
    },
    label: { show: true, position: 'right', fontSize: 10, formatter: '{c}' },
    data: (st.value?.durationDist || []).map((i: any) => i.count)
  }]
}))

const trendOption = computed(() => {
  const rows: any[] = st.value?.monthTrend || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 9, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, bottom: 44, right: 54 },
    xAxis: { type: 'category', data: rows.map((r) => r.month), axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', name: '条', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
      { type: 'value', name: '万元', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, splitLine: { show: false } }
    ],
    series: [
      { name: '新增线索', type: 'bar', barWidth: 15, itemStyle: { color: '#3c88ff', borderRadius: [3, 3, 0, 0] }, data: rows.map((r) => r.created) },
      { name: '结案线索', type: 'bar', barWidth: 15, itemStyle: { color: '#12a150', borderRadius: [3, 3, 0, 0] }, data: rows.map((r) => r.closed) },
      {
        name: '涉及基金(万元)', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6,
        itemStyle: { color: '#e8a30c' }, lineStyle: { width: 2.4 },
        data: rows.map((r) => Math.round((r.amount / 10000) * 10) / 10)
      }
    ]
  }
})

const resultOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 ({d}%)' },
  legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
  color: ['#e5484d', '#12a150', '#e8a30c', '#1668dc'],
  series: [{
    type: 'pie', radius: ['42%', '68%'], center: ['50%', '42%'],
    itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
    label: { show: false },
    data: (st.value?.resultDist || []).map((i: any) => ({ name: i.name, value: i.value }))
  }]
}))

/* ===== 督办 ===== */
const urging = ref(false)
async function doUrge() {
  const ids = sel.value.filter((x) => x.slaStatus === '超时').map((x) => x.clueId)
  if (!ids.length) return ElMessage.warning('请勾选至少一条「超时」线索')
  urging.value = true
  try {
    const r: any = await urgeLifecycle({ clueIds: ids })
    ElMessage.success(r.message)
    sel.value = []
  } finally { urging.value = false }
}

/* ===== 轨迹抽屉 ===== */
const drawer = ref(false)
const dLoading = ref(false)
const cur = ref<any>(null)
const curRow = ref<any>(null)

async function openTrack(row: any) {
  drawer.value = true
  dLoading.value = true
  cur.value = null
  curRow.value = row
  try { cur.value = await getLifecycleDetail({ clueId: row.clueId }) }
  finally { dLoading.value = false }
}

/* 结果告知 */
const fbSending = ref(false)
async function doSendFb() {
  fbSending.value = true
  try {
    const r: any = await sendFeedbackResult({ clueId: cur.value.clueId })
    ElMessage.success(r.message)
    openTrack(curRow.value)
  } finally { fbSending.value = false }
}

const SLA_TONE: Record<string, any> = { 按时: 'success', 临期: 'warning', 超时: 'danger' }
const STAGE_TONE: Record<string, any> = {
  线索研判: 'primary', 线上筛查: 'primary', 线下核查: 'warning',
  机构申诉: 'warning', 违规处置: 'danger', 已结案: 'success'
}

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="线索全周期跟踪" tag="M14"
      subtitle="线索状态全链路留痕 · 阶段时长与 SLA 监控 · 处理结果闭环告知机构">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Warning'" @click="quick('overtime')">超时督办</el-button>
        <el-button type="primary" :icon="'Guide'"
          @click="openTrack({ clueId: TYPICAL_ID })">典型案例轨迹</el-button>
      </template>
    </PageHeader>

    <div class="kpi-grid">
      <StatCard label="线索总量" :value="st?.totalClue || 0" unit="条" icon="Files" tone="primary" />
      <StatCard label="已结案" :value="st?.closed || 0" unit="条" icon="CircleCheck" tone="success"
        clickable @click="quick('closed')" :desc="`结案率 ${st?.closeRate || 0}%`" />
      <StatCard label="流转中" :value="st?.processing || 0" unit="条" icon="Loading" tone="warning"
        clickable @click="quick('processing')" />
      <StatCard label="已流转处置" :value="st?.transferred || 0" unit="条" icon="Promotion" tone="accent"
        desc="推送违规处置 / 专项任务" />
      <StatCard label="结案率" :value="st?.closeRate || 0" unit="%" icon="PieChart" tone="success" :precision="1" />
      <StatCard label="平均处理时长" :value="st?.avgDurationHours || 0" unit="小时" icon="Timer" tone="primary" :precision="1" />
      <StatCard label="SLA 按时率" :value="st?.slaOnTime || 0" unit="%" icon="AlarmClock" tone="accent" :precision="1"
        desc="全流程时限达标情况" />
      <StatCard label="超时线索" :value="Math.round(((st?.totalClue || 0) * (100 - (st?.slaOnTime || 0))) / 100)"
        unit="条" icon="Warning" tone="danger" clickable @click="quick('overtime')" desc="点击督办" />
    </div>

    <div class="chart-row">
      <SectionCard title="全流程阶段漏斗" desc="各环节线索沉降情况" tight>
        <EChart :option="funnelOption" height="252px" />
      </SectionCard>
      <SectionCard title="月度线索流转趋势" desc="新增 / 结案 / 涉及基金" tight>
        <EChart :option="trendOption" height="252px" />
      </SectionCard>
      <SectionCard title="处理结果构成" tight>
        <EChart :option="resultOption" height="252px" />
      </SectionCard>
    </div>

    <div class="chart-row2">
      <SectionCard title="处理时长分布" desc="从预警生成到结案的全周期耗时" tight>
        <EChart :option="durationOption" height="220px" />
      </SectionCard>
      <SectionCard title="全周期管理机制" tight>
        <div class="tips">
          <div class="tip">
            <el-icon><Link /></el-icon>
            <div><b>全链路留痕</b><span>比对→预警→研判→筛查→核查→申诉→处置→结案，每个节点记录操作人、时间与时长</span></div>
          </div>
          <div class="tip">
            <el-icon><AlarmClock /></el-icon>
            <div><b>时限预警督办</b><span>高风险 24 小时、中风险 72 小时、低风险 7 日内首次处理；临期自动提醒、超时自动督办</span></div>
          </div>
          <div class="tip">
            <el-icon><Promotion /></el-icon>
            <div><b>结果闭环告知</b><span>结案后自动向机构推送处理结果告知书，机构确认后归档，形成完整闭环</span></div>
          </div>
          <div class="tip">
            <el-icon><MagicStick /></el-icon>
            <div><b>误判沉淀迭代</b><span>驳回、申诉成立的线索自动进入误判反馈池，作为负样本反哺模型持续优化</span></div>
          </div>
        </div>
      </SectionCard>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">线索全周期检索</span>
        <span class="section-title__desc">支持线索号、机构、参保人、稽核员模糊检索</span>
      </div>
      <el-form class="query-form" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="线索号 / 机构 / 参保人 / 稽核员" clearable @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="当前环节">
          <el-select v-model="q.currentStage" placeholder="全部" clearable>
            <el-option v-for="s in STAGES" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="线索状态">
          <el-select v-model="q.status" placeholder="全部" clearable>
            <el-option v-for="s in dict.clueStatus" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="时限状态">
          <el-select v-model="q.slaStatus" placeholder="全部" clearable>
            <el-option v-for="s in SLA" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="风险等级">
            <el-select v-model="q.riskLevel" placeholder="全部" clearable>
              <el-option v-for="r in ['高', '中', '低']" :key="r" :label="`${r}风险`" :value="r" />
            </el-select>
          </el-form-item>
          <el-form-item label="违规大类">
            <el-select v-model="q.violationCategory" placeholder="全部" clearable>
              <el-option v-for="c in dict.violationTree" :key="c.category" :label="c.category" :value="c.category" />
            </el-select>
          </el-form-item>
          <el-form-item label="所属区县">
            <el-select v-model="q.district" placeholder="全部" clearable>
              <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="机构类型">
            <el-select v-model="q.orgType" placeholder="全部" clearable>
              <el-option v-for="t in dict.orgTypes" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="涉及金额" class="is-wide">
            <div class="amt">
              <el-input-number v-model="q.amountMin" :min="0" :controls="false" placeholder="最小" />
              <span>—</span>
              <el-input-number v-model="q.amountMax" :min="0" :controls="false" placeholder="最大" />
            </div>
          </el-form-item>
          <el-form-item label="生成时间" class="is-wide">
            <el-date-picker v-model="q.dateRange" type="daterange" value-format="YYYY-MM-DD"
              start-placeholder="开始" end-placeholder="结束" style="width: 100%" />
          </el-form-item>
        </template>

        <el-form-item class="query-form__actions">
          <el-button link type="primary" @click="expand = !expand">
            {{ expand ? '收起' : '展开' }}<el-icon class="ml4"><component :is="expand ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          </el-button>
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 列表 -->
    <div class="section-card">
      <div class="table-toolbar">
        <span>共 <b class="num">{{ total }}</b> 条线索档案</span>
        <span v-if="sel.length" class="text-mini">已选 <b class="num">{{ sel.length }}</b> 条</span>
        <div class="table-toolbar__right">
          <el-button type="danger" plain size="small" :icon="'Bell'" :loading="urging"
            :disabled="!sel.length" @click="doUrge">批量督办</el-button>
          <el-button size="small" :icon="'Download'"
            @click="msg.success('全周期档案台账已导出')">导出台账</el-button>
        </div>
      </div>
      <el-table :data="list" v-loading="loading" size="small" border stripe @row-dblclick="openTrack"
        @selection-change="(v: any[]) => (sel = v)"
        :row-class-name="({ row }: any) => (row.slaStatus === '超时' ? 'row-over' : '')">
        <el-table-column type="selection" width="42" align="center" />
        <el-table-column prop="clueId" label="线索编号" width="148">
          <template #default="{ row }">
            <span class="text-link num" @click="openTrack(row)">{{ row.clueId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="72" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="violationType" label="违规类型" width="126" show-overflow-tooltip />
        <el-table-column prop="orgName" label="涉事机构" min-width="176" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.orgName }}</div>
            <div class="text-mini">{{ row.district }} · {{ row.orgType }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="patientName" label="参保人" width="82" align="center" />
        <el-table-column label="当前环节" width="106" align="center">
          <template #default="{ row }">
            <el-tag :type="STAGE_TONE[row.currentStage] || 'info'" size="small" effect="light">{{ row.currentStage }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96" align="center">
          <template #default="{ row }"><StatusTag :status="row.status" /></template>
        </el-table-column>
        <el-table-column label="节点" width="66" align="center">
          <template #default="{ row }"><span class="num">{{ row.stageCount }}/10</span></template>
        </el-table-column>
        <el-table-column prop="suspectedAmount" label="疑似(元)" width="102" align="right">
          <template #default="{ row }"><span class="num">{{ fmtMoney(row.suspectedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="confirmAmount" label="认定(元)" width="102" align="right">
          <template #default="{ row }">
            <span v-if="row.confirmAmount" class="num num--money-mild">{{ fmtMoney(row.confirmAmount) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="recoveredAmount" label="追回(元)" width="102" align="right" sortable>
          <template #default="{ row }">
            <span v-if="row.recoveredAmount" class="num num--money">{{ fmtMoney(row.recoveredAmount) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="durationText" label="累计时长" width="104" align="center">
          <template #default="{ row }"><span class="num">{{ row.durationText }}</span></template>
        </el-table-column>
        <el-table-column label="时限" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="SLA_TONE[row.slaStatus] || 'info'" size="small" effect="dark">{{ row.slaStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assignee" label="承办人" width="118" show-overflow-tooltip />
        <el-table-column label="标记" width="92" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.hasAppeal" type="warning" size="small" effect="plain">有申诉</el-tag>
            <el-tag v-if="row.feedbackConfirmed" type="success" size="small" effect="plain">已告知</el-tag>
            <span v-if="!row.hasAppeal && !row.feedbackConfirmed" class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="86" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'Guide'" @click="openTrack(row)">轨迹</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无线索档案" desc="调整筛选条件后重试" /></template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @current-change="load" @size-change="q.page = 1; load()" />
      </div>
    </div>

    <!-- 轨迹抽屉 -->
    <el-drawer v-model="drawer" :title="`线索全周期轨迹 · ${cur?.clueId || ''}`" size="880px">
      <div v-loading="dLoading" class="tk">
        <template v-if="cur">
          <div class="tk-hero">
            <div>
              <div class="tk-hero__t">
                {{ curRow?.violationType || '疑点线索全周期档案' }}
                <el-tag v-if="cur.clueId === TYPICAL_ID" type="warning" size="small" effect="dark">典型案例</el-tag>
                <el-tag :type="STAGE_TONE[cur.currentStage] || 'info'" size="small" effect="light">{{ cur.currentStage }}</el-tag>
              </div>
              <div class="tk-hero__m">
                <span><el-icon><Files /></el-icon>{{ cur.clueId }}</span>
                <span v-if="curRow?.orgName"><el-icon><OfficeBuilding /></el-icon>{{ curRow.orgName }}</span>
                <span v-if="curRow?.assignee"><el-icon><User /></el-icon>{{ curRow.assignee }}</span>
              </div>
            </div>
            <div class="tk-hero__n">
              <div class="tn"><span>全周期时长</span><b class="num">{{ cur.totalDuration }}</b></div>
              <div class="tn"><span>流转节点</span><b class="num">{{ cur.stageCount }}</b></div>
              <div class="tn"><span>时限状态</span>
                <b class="num" :class="cur.slaStatus === '超时' ? 'is-red' : 'is-ok'">{{ cur.slaStatus }}</b>
              </div>
            </div>
          </div>

          <div v-if="curRow" class="mn-row">
            <div class="mn"><span>疑似金额</span><b class="num">{{ fmtMoney(curRow.suspectedAmount) }}</b></div>
            <div class="mn"><span>认定金额</span>
              <b class="num is-warn">{{ curRow.confirmAmount ? fmtMoney(curRow.confirmAmount) : '—' }}</b>
            </div>
            <div class="mn"><span>已追回</span>
              <b class="num is-ok">{{ curRow.recoveredAmount ? fmtMoney(curRow.recoveredAmount) : '—' }}</b>
            </div>
            <div class="mn"><span>生成时间</span><b class="num sm">{{ curRow.createTime }}</b></div>
            <div class="mn"><span>最近更新</span><b class="num sm">{{ curRow.updateTime }}</b></div>
          </div>

          <SectionCard title="流转轨迹" :desc="`共 ${cur.nodes?.length || 0} 个节点，逐环节留痕操作人与处理时长`" tight>
            <template #extra>
              <el-button type="primary" link size="small" :icon="'Cpu'"
                @click="router.push({ name: 'M06', params: { clueId: cur.clueId } })">线索详情</el-button>
            </template>
            <LifecycleTimeline :nodes="cur.nodes || []" :current-stage="cur.currentStage" />
          </SectionCard>

          <SectionCard title="处理结果告知" desc="结案后向机构闭环推送处理结果" tight>
            <template v-if="cur.feedback">
              <div class="fb">
                <div class="fb__h">
                  <el-icon :size="16"><Message /></el-icon>
                  <b>{{ cur.feedback.feedbackId }}</b>
                  <el-tag :type="cur.feedback.confirmed ? 'success' : 'warning'" size="small" effect="dark">
                    {{ cur.feedback.confirmed ? '机构已确认' : '待机构确认' }}
                  </el-tag>
                </div>
                <div class="fb__c">{{ cur.feedback.content }}</div>
                <div class="fb__f">
                  <span>推送渠道：{{ cur.feedback.channel }}</span>
                  <span>推送 <b class="num">{{ cur.feedback.sendTime }}</b></span>
                  <span>阅读 <b class="num">{{ cur.feedback.readTime || '未读' }}</b></span>
                </div>
              </div>
            </template>
            <template v-else>
              <el-alert type="info" :closable="false" show-icon
                title="该线索尚未结案，结案后可向机构推送处理结果告知书。" style="margin-bottom: 10px" />
              <el-button type="primary" plain :icon="'Promotion'" :loading="fbSending"
                style="width: 100%" @click="doSendFb">立即推送处理结果告知</el-button>
            </template>
          </SectionCard>

          <div class="nx">
            <div class="nx__t"><el-icon><Connection /></el-icon>下游联动</div>
            <div class="nx__b">
              <el-button size="small" :icon="'MagicStick'" @click="router.push('/lifecycle/feedback')">误判反馈沉淀</el-button>
              <el-button size="small" :icon="'Location'" @click="router.push('/inspection/manage')">线下核查档案</el-button>
              <el-button size="small" :icon="'ChatDotSquare'" @click="router.push('/appeal/review')">申诉复核记录</el-button>
              <el-button size="small" :icon="'Share'"
                @click="msg.info('已推送至「专项任务管理智能体」/「违规处置智能体」')">推送处置智能体</el-button>
            </div>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.is-red { color: var(--zh-danger); }
.is-ok { color: var(--zh-success); }
.is-warn { color: var(--zh-warning); }

.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
}
.chart-row {
  display: grid; grid-template-columns: 330px 1fr 330px; gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 1000px) { grid-template-columns: 1fr; }
}
.chart-row2 {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}
.tips { display: flex; flex-direction: column; gap: 8px; }
.tip {
  display: flex; gap: 9px; padding: 8px 10px;
  border-radius: var(--zh-radius); background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
  b { display: block; font-size: var(--zh-font-sm); color: var(--zh-text-primary); }
  span { font-size: 11px; line-height: 1.6; color: var(--zh-text-secondary); }
}
.amt {
  display: flex; align-items: center; gap: 6px; width: 100%;
  :deep(.el-input-number) { flex: 1; }
  span { color: var(--zh-text-placeholder); }
}
:deep(.row-over) { background: var(--zh-risk-high-bg) !important; }

.tk { display: flex; flex-direction: column; gap: 12px; }
.tk-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 16px; border-radius: var(--zh-radius-lg); color: #fff;
  background: linear-gradient(98deg, #0a2f6b, #1668dc 60%, #1495b3);
  box-shadow: var(--zh-shadow-base);
  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-lg); font-weight: 700;
  }
  &__m {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px;
    font-size: var(--zh-font-xs); opacity: .9;
    span { display: inline-flex; align-items: center; gap: 4px; }
  }
  &__n { display: flex; gap: 20px; flex-shrink: 0; }
}
.tn {
  display: flex; flex-direction: column; align-items: center;
  span { font-size: 11px; opacity: .82; }
  b {
    font-size: 17px; font-family: var(--zh-font-num); line-height: 1.3;
    &.is-ok { color: #95f2c8; }
    &.is-red { color: #ffb3b3; }
  }
}
.mn-row {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}
.mn {
  padding: 9px 11px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  span { display: block; font-size: 11px; color: var(--zh-text-secondary); }
  b {
    display: block; margin-top: 2px; font-size: 16px; font-weight: 700;
    font-family: var(--zh-font-num); color: var(--zh-text-primary);
    &.sm { font-size: 12px; font-weight: 600; }
  }
}
.fb {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
  border-left: 4px solid var(--zh-primary);
  &__h {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-sm); color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-primary); }
    b { font-family: var(--zh-font-num); }
  }
  &__c {
    margin-top: 8px; font-size: var(--zh-font-sm); line-height: 1.85; color: var(--zh-text-regular);
  }
  &__f {
    display: flex; gap: 16px; flex-wrap: wrap; margin-top: 9px;
    padding-top: 9px; border-top: 1px dashed var(--zh-primary-light);
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    b { color: var(--zh-text-regular); }
  }
}
.nx {
  padding: 11px 14px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px dashed var(--zh-border-strong);
  &__t {
    display: flex; align-items: center; gap: 6px;
    font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-accent); }
  }
  &__b { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 9px; }
}
</style>
