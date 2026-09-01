<script setup lang="ts">
import {
  getScreeningStats, getScreeningTasks, getScreeningDetail,
  issueScreening, aiScreen, reviewScreening, urgeScreening
} from '@/api/agent01-clue/screening'
import { getClueList } from '@/api/agent01-clue/clue'
import { fmtMoney, CHART_COLORS, CHART_GRID } from '@/utils/format'
import { useDictStore } from '@/stores/dict'

const router = useRouter()
const dict = useDictStore()
/** 模板中可用的消息提示别名 */
const msg = ElMessage

const st = ref<any>(null)
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const selection = ref<any[]>([])
const expand = ref(false)

const q = reactive({
  keyword: '', status: '', riskLevel: '', screenResult: '',
  district: '', orgType: '', violationCategory: '', overdue: '',
  amountMin: undefined as any, amountMax: undefined as any,
  dateRange: [] as string[], page: 1, pageSize: 15
})

async function loadStats() { st.value = await getScreeningStats() }

async function load() {
  loading.value = true
  try {
    const { dateRange, ...rest } = q
    const res: any = await getScreeningTasks({
      ...rest,
      startTime: dateRange?.[0] || '',
      endTime: dateRange?.[1] || ''
    })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}
function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, {
    keyword: '', status: '', riskLevel: '', screenResult: '', district: '', orgType: '',
    violationCategory: '', overdue: '', amountMin: undefined, amountMax: undefined,
    dateRange: [], page: 1
  })
  load()
}
function quick(type: string) {
  doReset()
  if (type === 'issue') q.status = '待下发'
  if (type === 'submit') q.status = '待提交'
  if (type === 'review') q.status = '已提交'
  if (type === 'overdue') q.overdue = 'true'
  load()
}

/* ===== 图表 ===== */
const resultOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 项 ({d}%)' },
  legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
  color: ['#12a150', '#e8a30c', '#e5484d'],
  series: [{
    type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'], avoidLabelOverlap: true,
    itemStyle: { borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{d}%', fontSize: 11, fontWeight: 700 },
    data: (st.value?.resultDist || []).map((i: any) => ({ name: i.name, value: i.value }))
  }]
}))

const rankOption = computed(() => {
  const rows = [...(st.value?.orgResponseRank || [])].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 150, right: 56, top: 12, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: { type: 'category', data: rows.map((i: any) => i.orgName), axisLabel: { fontSize: 10 }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 13,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (p: any) => (p.value >= 90 ? '#12a150' : p.value >= 80 ? '#e8a30c' : '#e5484d')
      },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700, formatter: '{c}%' },
      data: rows.map((i: any) => i.rate)
    }]
  }
})

/* ===== 下发自查 ===== */
const issueVisible = ref(false)
const issuing = ref(false)
const candidateLoading = ref(false)
const candidates = ref<any[]>([])
const issueSel = ref<any[]>([])
const issueForm = reactive({ deadline: '2026-09-05', requireMaterials: ['处方/医嘱', '病历记录', '情况说明'], remark: '' })
const MATERIAL_OPTS = ['处方/医嘱', '病历记录', '情况说明', '出入库台账', '检查报告', '收费票据']

async function openIssue() {
  issueVisible.value = true
  if (candidates.value.length) return
  candidateLoading.value = true
  try {
    const res: any = await getClueList({ status: '待研判', riskLevel: '高', page: 1, pageSize: 30 })
    candidates.value = res.list
  } finally { candidateLoading.value = false }
}
async function doIssue() {
  if (!issueSel.value.length) return ElMessage.warning('请选择需下发自查的线索')
  issuing.value = true
  try {
    const res: any = await issueScreening({
      clueIds: issueSel.value.map((i) => i.clueId),
      deadline: issueForm.deadline,
      requireMaterials: issueForm.requireMaterials,
      remark: issueForm.remark
    })
    ElMessage.success(res.message)
    issueVisible.value = false
    issueSel.value = []
    loadStats(); load()
  } finally { issuing.value = false }
}

/* ===== 审核抽屉 ===== */
const drawer = ref(false)
const detailLoading = ref(false)
const cur = ref<any>(null)
const tab = ref('report')
const aiLoading = ref(false)
const aiResult = ref<any>(null)
const reviewVisible = ref(false)
const reviewing = ref(false)
const reviewForm = reactive({ result: '', opinion: '', confirmAmount: 0 })

const RESULTS = [
  { v: '合理说明·结案', tone: 'success', icon: 'CircleCheck', desc: '机构说明合理、举证充分，线索直接结案' },
  { v: '存疑·转线下核查', tone: 'warning', icon: 'Location', desc: '疑点未消除，转入线下现场核查取证' },
  { v: '违规苗头·直接确认', tone: 'danger', icon: 'CircleClose', desc: '违规事实清楚，直接确认并推送处置' }
]

async function openDetail(row: any) {
  drawer.value = true
  tab.value = 'report'
  aiResult.value = null
  detailLoading.value = true
  cur.value = null
  try {
    cur.value = await getScreeningDetail({ taskId: row.taskId })
    reviewForm.confirmAmount = cur.value.suspectedAmount || 0
  } finally { detailLoading.value = false }
}

async function runAi() {
  aiLoading.value = true
  aiResult.value = null
  try {
    aiResult.value = await aiScreen({ taskId: cur.value.taskId })
    ElMessage.success('AI 初筛完成')
  } finally { aiLoading.value = false }
}

function openReview(preset?: string) {
  reviewForm.result = preset || cur.value?.aiScreen?.conclusion || ''
  reviewForm.opinion = ''
  reviewVisible.value = true
}
function adoptAi() {
  const c = aiResult.value?.recommendNext || cur.value?.aiScreen?.conclusion || ''
  const map: Record<string, string> = { 转线下核查: '存疑·转线下核查', 结案: '合理说明·结案', 直接确认: '违规苗头·直接确认' }
  reviewForm.result = map[c] || (c.includes('存疑') ? '存疑·转线下核查' : c)
  reviewForm.opinion = `采纳 AI 初筛结论（置信度 ${aiResult.value?.confidence || cur.value?.aiScreen?.confidence}%）：${aiResult.value?.analysis || cur.value?.aiScreen?.analysis}`
  reviewVisible.value = true
}
async function doReview() {
  if (!reviewForm.result) return ElMessage.warning('请选择审核结论')
  if (!reviewForm.opinion.trim()) return ElMessage.warning('请填写审核意见')
  reviewing.value = true
  try {
    const res: any = await reviewScreening({ taskId: cur.value.taskId, ...reviewForm })
    ElMessage.success(res.message)
    reviewVisible.value = false
    drawer.value = false
    loadStats(); load()
    if (reviewForm.result.includes('转线下核查')) {
      ElMessageBox.confirm('该线索已转入线下核查流程，是否立即前往「线下核查管理」创建核查任务？', '流程流转', {
        confirmButtonText: '前往核查管理', cancelButtonText: '稍后处理', type: 'warning'
      }).then(() => router.push('/inspection/manage')).catch(() => {})
    }
  } finally { reviewing.value = false }
}

async function doUrge() {
  const ids = selection.value.length ? selection.value.map((i) => i.taskId) : []
  if (!ids.length) return ElMessage.warning('请勾选需催办的任务')
  const res: any = await urgeScreening({ taskIds: ids })
  ElMessage.success(res.message)
  selection.value = []
}

const STATUS_TONE: Record<string, any> = {
  待下发: 'info', 待提交: 'warning', 已提交: 'primary', 待审核: 'primary',
  已初筛: 'primary', 已完成: 'success', 已逾期: 'danger'
}
const resCls = (r: string) => (r?.includes('合理') ? 'is-ok' : r?.includes('存疑') ? 'is-warn' : r ? 'is-bad' : '')

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="线上筛查核实" subtitle="向机构下发在线自查 · 自查数据自动比对 · AI 初筛辅助三向分流" tag="M09">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Bell'" @click="doUrge">批量催办</el-button>
        <el-button type="primary" :icon="'Promotion'" @click="openIssue">下发自查任务</el-button>
      </template>
    </PageHeader>

    <div class="kpi-grid">
      <StatCard label="自查任务总量" :value="st?.totalTask || 0" unit="项" icon="Files" tone="primary" />
      <StatCard label="待下发" :value="st?.pendingIssue || 0" unit="项" icon="Promotion" tone="accent"
        clickable @click="quick('issue')" />
      <StatCard label="待机构提交" :value="st?.waitingSubmit || 0" unit="项" icon="EditPen" tone="warning"
        clickable @click="quick('submit')" />
      <StatCard label="待审核" :value="st?.waitingReview || 0" unit="项" icon="DocumentChecked" tone="purple"
        desc="需人工确认初筛结论" clickable @click="quick('review')" />
      <StatCard label="按期提交率" :value="st?.onTimeRate || 0" unit="%" icon="Timer" tone="success" :precision="1" />
      <StatCard label="逾期未提交" :value="st?.overdueCount || 0" unit="项" icon="WarningFilled" tone="danger"
        desc="将直接转线下核查" clickable @click="quick('overdue')" />
    </div>

    <div class="chart-row">
      <SectionCard title="筛查结论分布" desc="三向分流结果占比" tight>
        <EChart :option="resultOption" height="234px" />
      </SectionCard>
      <SectionCard title="机构自查响应质量排名" desc="按期提交率（含提交量与平均响应时长）" tight>
        <template #extra>
          <span class="text-mini">绿≥90% · 黄≥80% · 红&lt;80%</span>
        </template>
        <EChart :option="rankOption" height="234px" />
      </SectionCard>
      <SectionCard title="机构响应明细" tight>
        <el-table :data="st?.orgResponseRank || []" size="small" border height="234">
          <el-table-column prop="orgName" label="机构" min-width="150" show-overflow-tooltip />
          <el-table-column prop="issued" label="下发" width="60" align="center" />
          <el-table-column prop="submitted" label="提交" width="60" align="center" />
          <el-table-column prop="avgHours" label="均时(h)" width="76" align="right">
            <template #default="{ row }"><span class="num">{{ row.avgHours }}</span></template>
          </el-table-column>
        </el-table>
      </SectionCard>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">筛查条件</span>
        <span class="section-title__desc">支持任务号、线索号、机构名称、参保人模糊检索</span>
      </div>
      <el-form class="query-form" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="任务号 / 线索号 / 机构 / 参保人" clearable @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="q.status" placeholder="全部" clearable>
            <el-option v-for="s in ['待下发', '待提交', '已提交', '待审核', '已初筛', '已完成', '已逾期']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="q.riskLevel" placeholder="全部" clearable>
            <el-option v-for="r in ['高', '中', '低']" :key="r" :label="`${r}风险`" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="初筛结论">
          <el-select v-model="q.screenResult" placeholder="全部" clearable>
            <el-option v-for="r in RESULTS" :key="r.v" :label="r.v" :value="r.v" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
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
          <el-form-item label="违规大类">
            <el-select v-model="q.violationCategory" placeholder="全部" clearable>
              <el-option v-for="n in dict.violationTree" :key="n.category" :label="n.category" :value="n.category" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否逾期">
            <el-select v-model="q.overdue" placeholder="全部" clearable>
              <el-option label="仅看逾期" value="true" />
            </el-select>
          </el-form-item>
          <el-form-item label="金额区间" class="is-wide">
            <div class="range">
              <el-input-number v-model="q.amountMin" :min="0" :controls="false" placeholder="最小" />
              <span class="range__sep">~</span>
              <el-input-number v-model="q.amountMax" :min="0" :controls="false" placeholder="最大" />
            </div>
          </el-form-item>
          <el-form-item label="下发时间" class="is-wide">
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
        <span>共 <b class="num">{{ total }}</b> 项自查任务</span>
        <span v-if="selection.length" class="sel">已选 <b class="num">{{ selection.length }}</b> 项</span>
        <div class="table-toolbar__right">
          <el-button size="small" :icon="'Bell'" :disabled="!selection.length" @click="doUrge">催办提醒</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" size="small" border stripe
        :row-class-name="({ row }: any) => (row.overdue ? 'row-over' : '')"
        @selection-change="(v: any) => (selection = v)" @row-dblclick="openDetail">
        <el-table-column type="selection" width="42" align="center" />
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="taskId" label="自查任务号" width="150">
          <template #default="{ row }">
            <span class="text-link num" @click="openDetail(row)">{{ row.taskId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clueId" label="关联线索" width="146">
          <template #default="{ row }">
            <span class="text-link num text-mini" @click="router.push({ name: 'M06', params: { clueId: row.clueId } })">{{ row.clueId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="机构" min-width="168" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.orgName }}</div>
            <div class="text-mini">{{ row.district }} · {{ row.orgType }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="violationType" label="疑点类型" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.violationType }}</div>
            <div class="text-mini">{{ row.itemName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="76" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="suspectedAmount" label="疑似金额(元)" width="114" align="right" sortable>
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.suspectedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="issueTime" label="下发时间" width="144">
          <template #default="{ row }"><span class="num text-mini">{{ row.issueTime }}</span></template>
        </el-table-column>
        <el-table-column prop="deadline" label="期限" width="144">
          <template #default="{ row }">
            <span class="num text-mini">{{ row.deadline }}</span>
            <el-tag v-if="row.overdue" type="danger" size="small" effect="dark" class="ml4">逾期</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="材料" width="74" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.materialCount }}</span>
            <el-tag v-if="row.needFix" type="danger" size="small" effect="plain" class="mt2">补正</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="AI 置信度" width="112" align="center">
          <template #default="{ row }">
            <el-progress v-if="row.aiConfidence" :percentage="row.aiConfidence" :stroke-width="8"
              :color="row.aiConfidence >= 85 ? '#12a150' : row.aiConfidence >= 70 ? '#e8a30c' : '#e5484d'" />
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="screenResult" label="初筛结论" width="140">
          <template #default="{ row }">
            <span v-if="row.screenResult" class="res" :class="resCls(row.screenResult)">{{ row.screenResult }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="92" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'DocumentChecked'" @click="openDetail(row)">审核</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无自查任务" desc="可点击右上角「下发自查任务」向机构发起在线自查" /></template>
      </el-table>

      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @current-change="load" @size-change="q.page = 1; load()" />
      </div>
    </div>

    <!-- 下发自查 -->
    <el-dialog v-model="issueVisible" title="下发机构自查任务" width="900px" top="6vh">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
        选择需机构在线自查的线索（默认展示高风险待研判线索），系统将自动向对应机构工作台推送自查任务并短信通知。
      </el-alert>
      <el-table :data="candidates" v-loading="candidateLoading" size="small" border height="330"
        @selection-change="(v: any) => (issueSel = v)">
        <el-table-column type="selection" width="42" align="center" />
        <el-table-column prop="clueId" label="线索号" width="146">
          <template #default="{ row }"><span class="num">{{ row.clueId }}</span></template>
        </el-table-column>
        <el-table-column prop="orgName" label="机构" min-width="160" show-overflow-tooltip />
        <el-table-column prop="violationType" label="违规类型" width="116" />
        <el-table-column label="风险" width="76" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="suspectedAmount" label="疑似金额(元)" width="112" align="right">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.suspectedAmount) }}</span></template>
        </el-table-column>
      </el-table>
      <el-form label-width="100px" style="margin-top: 14px">
        <el-form-item label="提交期限">
          <el-date-picker v-model="issueForm.deadline" type="date" value-format="YYYY-MM-DD" style="width: 200px" />
          <span class="text-mini ml8">逾期未提交将直接转入线下核查</span>
        </el-form-item>
        <el-form-item label="要求材料">
          <el-checkbox-group v-model="issueForm.requireMaterials">
            <el-checkbox v-for="m in MATERIAL_OPTS" :key="m" :value="m" border size="small">{{ m }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="下发说明">
          <el-input v-model="issueForm.remark" type="textarea" :rows="3"
            placeholder="请依据《芜湖市医疗保障基金智能监管自查工作规程》，如实填报自查数据并上传举证材料…" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="text-mini fl">已选 <b class="num">{{ issueSel.length }}</b> 条线索</span>
        <el-button @click="issueVisible = false">取消</el-button>
        <el-button type="primary" :loading="issuing" :icon="'Promotion'" @click="doIssue">确认下发</el-button>
      </template>
    </el-dialog>

    <!-- 审核抽屉 -->
    <el-drawer v-model="drawer" :title="`自查审核 · ${cur?.taskId || ''}`" size="980px">
      <div v-loading="detailLoading" class="rv">
        <template v-if="cur">
          <div class="rv-hero" :class="`is-${cur.riskLevel}`">
            <div class="rv-hero__main">
              <div class="rv-hero__title">
                {{ cur.orgName }}
                <RiskTag :level="cur.riskLevel" />
                <el-tag :type="STATUS_TONE[cur.status] || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              </div>
              <div class="rv-hero__meta">
                <span><el-icon><Files /></el-icon>{{ cur.clueId }}</span>
                <span><el-icon><Warning /></el-icon>{{ cur.violationType }}</span>
                <span><el-icon><FirstAidKit /></el-icon>{{ cur.itemName }}</span>
                <span><el-icon><User /></el-icon>{{ cur.patientName }}</span>
                <span><el-icon><Clock /></el-icon>提交 {{ cur.submitTime || '未提交' }}</span>
              </div>
            </div>
            <div class="rv-hero__nums">
              <div class="rn"><span class="rn__l">疑似金额</span><span class="rn__v">{{ fmtMoney(cur.suspectedAmount) }}</span></div>
              <div class="rn"><span class="rn__l">材料份数</span><span class="rn__v">{{ cur.materialCount }}</span></div>
              <div class="rn"><span class="rn__l">AI 置信度</span><span class="rn__v">{{ cur.aiConfidence }}%</span></div>
            </div>
          </div>

          <div class="rv-body">
            <div class="rv-left">
              <div class="section-card section-card--tight">
                <el-tabs v-model="tab">
                  <el-tab-pane label="自查数据比对" name="report">
                    <el-table :data="cur.selfReport || []" size="small" border
                      :row-class-name="({ row }: any) => (row.match ? '' : 'row-flag')">
                      <el-table-column prop="itemName" label="项目名称" min-width="150" />
                      <el-table-column prop="selfQty" label="机构自报" width="92" align="center">
                        <template #default="{ row }"><span class="num">{{ row.selfQty }}</span></template>
                      </el-table-column>
                      <el-table-column prop="insuranceQty" label="医保结算" width="92" align="center">
                        <template #default="{ row }"><span class="num">{{ row.insuranceQty }}</span></template>
                      </el-table-column>
                      <el-table-column prop="diff" label="差异" width="76" align="center">
                        <template #default="{ row }">
                          <span class="num" :style="{ color: row.diff ? 'var(--zh-danger)' : 'var(--zh-success)', fontWeight: 700 }">
                            {{ row.diff > 0 ? '+' : '' }}{{ row.diff }}
                          </span>
                        </template>
                      </el-table-column>
                      <el-table-column prop="unitPrice" label="单价(元)" width="92" align="right">
                        <template #default="{ row }"><span class="num">{{ fmtMoney(row.unitPrice) }}</span></template>
                      </el-table-column>
                      <el-table-column prop="diffAmount" label="差异金额(元)" width="116" align="right">
                        <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.diffAmount) }}</span></template>
                      </el-table-column>
                      <el-table-column label="比对" width="82" align="center">
                        <template #default="{ row }">
                          <el-tag :type="row.match ? 'success' : 'danger'" size="small" effect="light">{{ row.match ? '一致' : '不一致' }}</el-tag>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-tab-pane>

                  <el-tab-pane :label="`举证材料(${cur.materials?.length || 0})`" name="material">
                    <el-table :data="cur.materials || []" size="small" border>
                      <el-table-column type="index" label="#" width="44" align="center" />
                      <el-table-column prop="name" label="材料名称" min-width="190" />
                      <el-table-column prop="type" label="格式" width="70" align="center" />
                      <el-table-column prop="size" label="大小" width="88" align="right" />
                      <el-table-column prop="uploadTime" label="上传时间" width="146">
                        <template #default="{ row }"><span class="num text-mini">{{ row.uploadTime }}</span></template>
                      </el-table-column>
                      <el-table-column label="OCR 置信度" width="146" align="center">
                        <template #default="{ row }">
                          <el-progress :percentage="row.ocrConfidence" :stroke-width="8"
                            :color="row.ocrConfidence >= 90 ? '#12a150' : row.ocrConfidence >= 85 ? '#e8a30c' : '#e5484d'" />
                        </template>
                      </el-table-column>
                      <el-table-column prop="verify" label="核验" width="86" align="center">
                        <template #default="{ row }">
                          <el-tag :type="row.verify === '通过' ? 'success' : 'danger'" size="small" effect="light">{{ row.verify }}</el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column label="操作" width="70" align="center">
                        <template #default>
                          <el-button type="primary" link size="small" :icon="'View'"
                            @click="msg.info('正在调取材料原件，请稍候')">预览</el-button>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-tab-pane>

                  <el-tab-pane label="机构自查说明" name="reply">
                    <div class="reply">
                      <div class="reply__head">
                        <el-icon><ChatDotSquare /></el-icon>
                        {{ cur.orgName }} 于 {{ cur.submitTime || '—' }} 提交
                      </div>
                      <div class="reply__body">{{ cur.orgReply }}</div>
                    </div>
                  </el-tab-pane>
                </el-tabs>
              </div>
            </div>

            <div class="rv-right">
              <SectionCard title="AI 初筛结论" desc="基于自查数据比对 + 材料 OCR + 机构历史采信率" tight>
                <template #extra>
                  <el-button type="primary" link size="small" :icon="'MagicStick'" :loading="aiLoading" @click="runAi">
                    重新初筛
                  </el-button>
                </template>
                <div v-if="aiLoading" class="ai-loading">
                  <el-icon class="is-loading" :size="26"><Loading /></el-icon>
                  <span>AI 正在比对自查数据与举证材料…</span>
                </div>
                <template v-else>
                  <div class="ai-conc" :class="resCls(aiResult?.recommendNext || cur.aiScreen?.conclusion)">
                    <span class="ai-conc__label">初筛结论</span>
                    <span class="ai-conc__v">{{ aiResult?.conclusion || cur.aiScreen?.conclusion }}</span>
                  </div>
                  <div class="ai-conf">
                    <span class="text-mini">置信度</span>
                    <el-progress :percentage="aiResult?.confidence || cur.aiScreen?.confidence || 0" :stroke-width="12"
                      :text-inside="true" :color="'#1668dc'" style="flex: 1" />
                  </div>
                  <div class="ai-analysis">{{ aiResult?.analysis || cur.aiScreen?.analysis }}</div>
                  <div class="ai-points">
                    <div v-for="(p, i) in cur.aiScreen?.points || []" :key="i" class="ap">
                      <el-icon :size="12"><CircleCheckFilled /></el-icon>{{ p }}
                    </div>
                  </div>
                  <div v-if="aiResult?.recommendNext" class="ai-next">
                    <el-icon><Right /></el-icon>建议下一步：<b>{{ aiResult.recommendNext }}</b>
                  </div>
                  <el-button type="primary" plain :icon="'Select'" style="width: 100%; margin-top: 10px" @click="adoptAi">
                    采纳 AI 初筛结论
                  </el-button>
                </template>
              </SectionCard>

              <SectionCard title="审核分流" desc="请选择三向分流结论" tight>
                <div class="flow-btns">
                  <div v-for="r in RESULTS" :key="r.v" class="fb" :class="`fb-${r.tone}`" @click="openReview(r.v)">
                    <el-icon :size="18"><component :is="r.icon" /></el-icon>
                    <div>
                      <div class="fb__t">{{ r.v }}</div>
                      <div class="fb__d">{{ r.desc }}</div>
                    </div>
                  </div>
                </div>
                <div class="flow-hint">
                  <el-icon><InfoFilled /></el-icon>
                  「存疑」将自动创建线下核查任务；「违规苗头」将直接推送违规处置智能体。
                </div>
              </SectionCard>
            </div>
          </div>
        </template>
      </div>
    </el-drawer>

    <!-- 审核结论弹窗 -->
    <el-dialog v-model="reviewVisible" title="确认筛查审核结论" width="620px">
      <el-form label-width="96px">
        <el-form-item label="审核结论">
          <el-radio-group v-model="reviewForm.result">
            <el-radio v-for="r in RESULTS" :key="r.v" :value="r.v" border class="rv-radio">{{ r.v }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="reviewForm.result.includes('违规苗头')" label="确认金额">
          <el-input-number v-model="reviewForm.confirmAmount" :min="0" :precision="2" :step="10" style="width: 200px" />
          <span class="text-mini ml8">元，将作为违规处置追回基数</span>
        </el-form-item>
        <el-form-item label="审核意见">
          <el-input v-model="reviewForm.opinion" type="textarea" :rows="6"
            placeholder="请说明审核依据：机构举证材料完整性、数据差异是否消除、政策适用条款等…" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewing" :icon="'DocumentChecked'" @click="doReview">提交审核结论</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.ml8 { margin-left: 8px; }
.mt2 { margin-top: 2px; }
.fl { float: left; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}
.chart-row {
  display: grid; grid-template-columns: 320px 1fr 380px; gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 1000px) { grid-template-columns: 1fr; }
}
.range {
  display: flex; align-items: center; gap: 6px; width: 100%;
  :deep(.el-input-number) { flex: 1; }
  &__sep { color: var(--zh-text-placeholder); }
}
.sel { margin-left: 12px; color: var(--zh-primary); }
.res {
  font-size: 11px; font-weight: 700;
  &.is-ok { color: var(--zh-success); }
  &.is-warn { color: var(--zh-warning); }
  &.is-bad { color: var(--zh-danger); }
}
:deep(.row-over) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }
:deep(.row-flag) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }

.rv { display: flex; flex-direction: column; gap: 12px; }
.rv-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 16px; border-radius: var(--zh-radius-lg);
  border: 1px solid var(--zh-border); border-left: 4px solid var(--zh-info);
  background: var(--zh-bg-soft);
  &.is-高 { border-left-color: var(--zh-danger); background: linear-gradient(96deg, var(--zh-risk-high-bg), #fff); }
  &.is-中 { border-left-color: var(--zh-warning); background: linear-gradient(96deg, var(--zh-risk-mid-bg), #fff); }
  &.is-低 { border-left-color: var(--zh-success); background: linear-gradient(96deg, var(--zh-risk-low-bg), #fff); }
  &__title {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary);
  }
  &__meta {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 4px; }
    :deep(.el-icon) { color: var(--zh-text-placeholder); }
  }
  &__nums { display: flex; gap: 20px; flex-shrink: 0; }
}
.rn {
  display: flex; flex-direction: column; align-items: flex-end;
  &__l { font-size: 11px; color: var(--zh-text-secondary); }
  &__v { font-size: 17px; font-weight: 700; color: var(--zh-primary); font-family: var(--zh-font-num); }
}

.rv-body {
  display: grid; grid-template-columns: 1fr 348px; gap: 12px; align-items: start;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}
.rv-left, .rv-right { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.reply {
  &__head {
    display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary); font-weight: 600;
    :deep(.el-icon) { color: var(--zh-accent); }
  }
  &__body {
    padding: 12px 14px; border-radius: var(--zh-radius);
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
    font-size: var(--zh-font-sm); line-height: 1.85; color: var(--zh-text-regular);
  }
}

.ai-loading {
  display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 0;
  font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); }
}
.ai-conc {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: var(--zh-radius); margin-bottom: 10px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border);
  &.is-ok { background: var(--zh-risk-low-bg); border-color: var(--zh-risk-low-border); .ai-conc__v { color: var(--zh-success); } }
  &.is-warn { background: var(--zh-risk-mid-bg); border-color: var(--zh-risk-mid-border); .ai-conc__v { color: var(--zh-warning); } }
  &.is-bad { background: var(--zh-risk-high-bg); border-color: var(--zh-risk-high-border); .ai-conc__v { color: var(--zh-danger); } }
  &__label { font-size: 11px; color: var(--zh-text-secondary); }
  &__v { font-size: var(--zh-font-lg); font-weight: 700; }
}
.ai-conf { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.ai-analysis {
  font-size: var(--zh-font-xs); line-height: 1.75; color: var(--zh-text-regular);
  padding: 9px 11px; border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter); border: 1px solid #dce8fb;
}
.ai-points { display: flex; flex-direction: column; gap: 4px; margin-top: 9px; }
.ap {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-success); flex-shrink: 0; }
}
.ai-next {
  display: flex; align-items: center; gap: 5px; margin-top: 9px;
  font-size: var(--zh-font-xs); color: var(--zh-text-regular);
  b { color: var(--zh-primary); }
  :deep(.el-icon) { color: var(--zh-primary); }
}

.flow-btns { display: flex; flex-direction: column; gap: 8px; }
.fb {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
  padding: 10px 12px; border-radius: var(--zh-radius);
  border: 1px solid var(--b); background: var(--bg); transition: all .18s;
  --b: var(--zh-border); --bg: #fff; --c: var(--zh-primary);
  &.fb-success { --b: var(--zh-risk-low-border); --bg: var(--zh-risk-low-bg); --c: var(--zh-success); }
  &.fb-warning { --b: var(--zh-risk-mid-border); --bg: var(--zh-risk-mid-bg); --c: var(--zh-warning); }
  &.fb-danger { --b: var(--zh-risk-high-border); --bg: var(--zh-risk-high-bg); --c: var(--zh-danger); }
  &:hover { transform: translateX(3px); box-shadow: var(--zh-shadow-sm); border-color: var(--c); }
  :deep(.el-icon) { color: var(--c); flex-shrink: 0; }
  &__t { font-size: var(--zh-font-sm); font-weight: 700; color: var(--c); }
  &__d { font-size: 11px; color: var(--zh-text-secondary); line-height: 1.5; margin-top: 1px; }
}
.flow-hint {
  display: flex; gap: 6px; margin-top: 10px; padding: 8px 10px;
  border-radius: var(--zh-radius); border: 1px dashed var(--zh-border-strong);
  font-size: 11px; line-height: 1.6; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
}
.rv-radio { margin-right: 6px !important; margin-bottom: 6px; }
</style>
