<script setup lang="ts">
import {
  getConfirmStats, getConfirmList, getConfirmDetail, aiQualify,
  submitConfirm, reviewConfirm, generateReport, pushResult
} from '@/api/agent03-punish/punish'
import { fmtMoney, fmtWan, CHART_COLORS, CHART_GRID } from '@/utils/format'
import {
  buildInspectReport, buildConfirmDoc, buildNoticeDoc,
  exportCsv, type LegalDoc
} from '@/utils/legalDoc'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const expand = ref(false)

const q = reactive({
  keyword: '', problemNature: '', status: '', district: '', orgType: '', needDual: '',
  page: 1, pageSize: 15
})

const NATURE_TONE: Record<string, string> = {
  一般违规: 'info', 较重违规: 'warning', 严重违规: 'danger', 涉嫌欺诈骗保: 'danger'
}
const STATUS_TONE: Record<string, string> = {
  待复核: 'warning', 复核中: 'primary', 已退回: 'danger', 复核通过: 'success', 已送达: 'success', 已处置: 'success'
}

async function loadStats() { st.value = await getConfirmStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getConfirmList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', problemNature: '', status: '', district: '', orgType: '', needDual: '', page: 1 })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'pending') q.status = '待复核'
  else if (t === 'returned') q.status = '已退回'
  else if (t === 'fraud') q.problemNature = '涉嫌欺诈骗保'
  else if (t === 'dual') q.needDual = 'true'
  load()
}

/* ---------- 详情抽屉 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const detailLoading = ref(false)
const activeTab = ref('qualify')

async function openDetail(row: any) {
  drawer.value = true
  detailLoading.value = true
  activeTab.value = 'qualify'
  try {
    cur.value = await getConfirmDetail(row.confirmationId)
  } finally {
    detailLoading.value = false
  }
}

/* ---------- AI 定性 ---------- */
const aiLoading = ref(false)
const aiResult = ref<any>(null)
async function runAi() {
  if (!cur.value) return
  aiLoading.value = true
  aiResult.value = null
  try {
    aiResult.value = await aiQualify({ confirmationId: cur.value.confirmationId })
    msg.success(`AI 定性完成，置信度 ${aiResult.value?.aiSuggestion?.confidence}%`)
  } finally {
    aiLoading.value = false
  }
}

/* ---------- 双人复核 ---------- */
const reviewVisible = ref(false)
const reviewing = ref(false)
const reviewForm = reactive({
  items: [] as { item: string; result: string; comment: string }[],
  result: '通过',
  opinion: ''
})
const REVIEW_ITEMS = ['违规定性', '金额核算', '证据充分性', '程序合规性', '法律依据']

function openReview() {
  if (!cur.value) return
  reviewForm.items = REVIEW_ITEMS.map((i) => ({ item: i, result: '符合', comment: '' }))
  reviewForm.result = '通过'
  reviewForm.opinion = '定性准确、金额核算无误、证据链完整、程序合规、法律依据适当，同意按承办意见处置'
  reviewVisible.value = true
}

async function doReview() {
  if (!reviewForm.opinion.trim()) { msg.warning('请填写复核意见'); return }
  reviewing.value = true
  try {
    const res: any = await reviewConfirm({ confirmationId: cur.value.confirmationId, ...reviewForm })
    msg.success(res?.message || '复核完成')
    reviewVisible.value = false
    await Promise.all([loadStats(), load()])
    if (cur.value) cur.value = await getConfirmDetail(cur.value.confirmationId)
  } finally {
    reviewing.value = false
  }
}

/* ---------- 报告 / 送达 ---------- */
const reportRes = ref<any>(null)
const reporting = ref(false)
async function doReport() {
  reporting.value = true
  try {
    reportRes.value = await generateReport({ confirmationId: cur.value.confirmationId })
    msg.success('检查报告已生成')
  } finally {
    reporting.value = false
  }
}

const pushing = ref(false)
const pushRes = ref<any>(null)
async function doPush() {
  await ElMessageBox.confirm(
    '推送后将正式告知被检机构检查结果，并告知陈述申辩权（5 个工作日）与听证权（3 个工作日），确认推送？',
    '结果送达',
    { type: 'warning', confirmButtonText: '确认送达', cancelButtonText: '取消' }
  ).then(async () => {
    pushing.value = true
    try {
      pushRes.value = await pushResult({ confirmationId: cur.value.confirmationId })
      msg.success(pushRes.value?.message || '已送达')
      await load()
    } finally {
      pushing.value = false
    }
  }).catch(() => undefined)
}

/* ---------- 文书预览与导出 ---------- */
const docVisible = ref(false)
const curDoc = ref<LegalDoc | null>(null)

/** 打开指定类型的文书 */
function openDoc(kind: 'report' | 'confirm' | 'notice', row?: any) {
  const c = row || cur.value
  if (!c) return
  const seq = Number(String(c.confirmationId).slice(-4)) || 1
  if (kind === 'report') curDoc.value = buildInspectReport(c, seq)
  else if (kind === 'confirm') curDoc.value = buildConfirmDoc(c, seq)
  else curDoc.value = buildNoticeDoc(c, seq)
  docVisible.value = true
}

/** 导出违规确认台账 */
function doExportLedger() {
  if (!list.value.length) { msg.warning('当前无可导出数据'); return }
  exportCsv(
    `违规确认台账_${new Date().toISOString().slice(0, 10)}`,
    ['确认书编号', '被检机构', '机构编码', '所属辖区', '违规类型', '问题性质',
      '违规金额(元)', '涉及基金(元)', '拟罚款(元)', '应追缴合计(元)',
      '是否双人复核', '确认状态', '确认时间'],
    list.value.map((c: any) => [
      c.confirmationId, c.orgName, c.orgCode, c.district,
      (c.violationTypes || []).map((v: any) => v.type).join('/'),
      c.problemNature,
      c.amount.totalViolationAmount, c.amount.insuranceFundAmount,
      c.amount.penaltyAmount, c.amount.totalRecoverable,
      c.needDualReview ? '是' : '否', c.status, c.confirmTime
    ])
  )
  msg.success(`已导出 ${list.value.length} 条违规确认台账`)
}

/* ---------- 图表 ---------- */
const natureOption = computed(() => {
  const d = st.value?.natureDist || []
  const colors: Record<string, string> = {
    一般违规: '#5a7189', 较重违规: '#e8a30c', 严重违规: '#d4380d', 涉嫌欺诈骗保: '#e5484d'
  }
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 份 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['44%', '68%'], center: ['50%', '43%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] } }))
    }]
  }
})

const typeOption = computed(() => {
  const d = (st.value?.byViolationType || []).slice(0, 8)
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any) => `${ps[0].name}<br/>确认 ${ps[0].value} 份<br/>金额 ${(ps[1]?.value || 0).toLocaleString('zh-CN')} 元` },
    legend: { data: ['确认份数', '违规金额'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 46, right: 52, bottom: 46 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.name),
      axisLabel: { fontSize: 10, interval: 0, rotate: 30, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: [
      { type: 'value', name: '份数', nameTextStyle: { fontSize: 10, color: '#9aa7b8' }, splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
      { type: 'value', name: '金额', nameTextStyle: { fontSize: 10, color: '#9aa7b8' }, splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v / 10000).toFixed(0) + '万' } }
    ],
    series: [
      { name: '确认份数', type: 'bar', barWidth: 18, itemStyle: { color: '#1668dc', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.count) },
      { name: '违规金额', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6, itemStyle: { color: '#e5484d' }, data: d.map((i: any) => i.amount) }
    ]
  }
})

const trendOption = computed(() => {
  const d = st.value?.monthTrend || []
  return {
    color: ['#1668dc', '#12a150'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['违规确认', '已处置'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 42, bottom: 28 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.month.slice(5) + '月'),
      axisLabel: { fontSize: 10, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    series: [
      { name: '违规确认', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: .12 }, data: d.map((i: any) => i.confirmed) },
      { name: '已处置', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: .12 }, data: d.map((i: any) => i.handled) }
    ]
  }
})

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="违规确认与复核" tag="M19"
      subtitle="AI 辅助定性 · 金额核算 · 责任界定 · 双人复核 · 报告生成与送达">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Warning'" @click="quick('fraud')">涉嫌骗保</el-button>
        <el-button type="primary" :icon="'DocumentChecked'" @click="quick('pending')">待复核</el-button>
      </template>
    </PageHeader>

    <!-- 指标 -->
    <div class="kpi-grid">
      <StatCard label="违规确认书" :value="st?.confirmTotal || 0" unit="份" icon="Tickets" tone="primary" />
      <StatCard label="待复核" :value="st?.pendingReview || 0" unit="份" icon="Clock" tone="warning" clickable @click="quick('pending')" />
      <StatCard label="复核通过" :value="st?.reviewPassed || 0" unit="份" icon="CircleCheck" tone="success" />
      <StatCard label="已退回" :value="st?.returned || 0" unit="份" icon="RefreshLeft" tone="danger" clickable @click="quick('returned')" />
      <StatCard label="违规金额" :value="fmtWan(st?.violationAmount || 0)" unit="元" icon="Coin" tone="danger" />
      <StatCard label="拟罚款金额" :value="fmtWan(st?.penaltyAmount || 0)" unit="元" icon="Stamp" tone="purple" />
    </div>

    <!-- 图表 -->
    <div class="chart-grid">
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">问题性质分布</span>
        </div>
        <EChart :option="natureOption" height="218px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">违规类型与金额</span>
        </div>
        <EChart :option="typeOption" height="218px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">确认与处置趋势</span>
        </div>
        <EChart :option="trendOption" height="218px" />
      </div>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">违规确认书查询</span>
        <span class="section-title__desc">支持确认书编号 / 机构 / 任务号 / 违规类型检索</span>
      </div>
      <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="确认书号/机构/任务号" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="问题性质">
          <el-select v-model="q.problemNature" placeholder="全部性质" clearable>
            <el-option v-for="n in ['一般违规', '较重违规', '严重违规', '涉嫌欺诈骗保']" :key="n" :label="n" :value="n" />
          </el-select>
        </el-form-item>
        <el-form-item label="确认状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option v-for="s in ['待复核', '复核中', '已退回', '复核通过', '已送达', '已处置']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="双人复核">
          <el-select v-model="q.needDual" placeholder="全部" clearable>
            <el-option label="需双人复核" value="true" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="所属辖区">
            <el-select v-model="q.district" placeholder="全部辖区" clearable>
              <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="机构类型">
            <el-select v-model="q.orgType" placeholder="全部" clearable>
              <el-option label="医院" value="医院" />
              <el-option label="药店" value="药店" />
            </el-select>
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

    <!-- 列表 -->
    <div class="section-card">
      <div class="table-toolbar">
        <el-button :icon="'MagicStick'" @click="quick('dual')">仅看需双人复核</el-button>
        <span class="text-mini">共 {{ total }} 份违规确认书</span>
        <div class="table-toolbar__right">
          <el-button :icon="'Download'" @click="doExportLedger">导出台账</el-button>
        </div>
      </div>

      <el-table :data="list" size="small" border stripe v-loading="loading"
        :row-class-name="({ row }: any) => (row.problemNature === '涉嫌欺诈骗保' ? 'row-fraud' : '')">
        <el-table-column prop="confirmationId" label="确认书编号" width="158">
          <template #default="{ row }">
            <span class="num text-link" @click="openDetail(row)">{{ row.confirmationId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="被检机构" min-width="180" show-overflow-tooltip />
        <el-table-column label="违规类型" min-width="150">
          <template #default="{ row }">
            <el-tag v-for="v in row.violationTypes.slice(0, 2)" :key="v.type" size="small" type="warning" effect="plain" class="mr4">
              {{ v.type }}
            </el-tag>
            <span v-if="row.violationTypes.length > 2" class="text-mini">+{{ row.violationTypes.length - 2 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="problemNature" label="问题性质" width="112" align="center">
          <template #default="{ row }">
            <el-tag :type="(NATURE_TONE[row.problemNature] as any)" size="small" effect="dark">
              {{ row.problemNature }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="违规金额" width="116" align="right">
          <template #default="{ row }">
            <span class="num num--money">{{ fmtMoney(row.amount.totalViolationAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="涉及基金" width="116" align="right">
          <template #default="{ row }">
            <span class="num num--money-mild">{{ fmtMoney(row.amount.insuranceFundAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="拟罚款" width="112" align="right">
          <template #default="{ row }">
            <span v-if="row.amount.penaltyAmount" class="num num--money">{{ fmtMoney(row.amount.penaltyAmount) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="双人复核" width="86" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.needDualReview" size="small" type="danger" effect="plain">需复核</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="(STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confirmTime" label="确认时间" width="148">
          <template #default="{ row }"><span class="num text-mini">{{ row.confirmTime }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :icon="'View'" @click="openDetail(row)">办理</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无符合条件的违规确认书" height="140px" /></template>
      </el-table>

      <div class="pager">
        <span class="text-mini">共 {{ total }} 条</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </div>

    <!-- ============ 办理抽屉 ============ -->
    <el-drawer v-model="drawer" size="720px" title="违规确认办理">
      <template v-if="cur">
        <div v-loading="detailLoading">
          <!-- 头部 -->
          <div class="cf-hero" :class="{ 'is-fraud': cur.problemNature === '涉嫌欺诈骗保' }">
            <div class="cf-hero__t">
              {{ cur.orgName }}
              <el-tag :type="(NATURE_TONE[cur.problemNature] as any)" size="small" effect="dark">{{ cur.problemNature }}</el-tag>
              <el-tag :type="(STATUS_TONE[cur.status] as any) || 'info'" size="small" effect="light">{{ cur.status }}</el-tag>
            </div>
            <div class="cf-hero__m">
              <span><el-icon><Tickets /></el-icon>{{ cur.confirmationId }}</span>
              <span><el-icon><Files /></el-icon>{{ cur.taskId }}</span>
              <span><el-icon><Location /></el-icon>{{ cur.district }}</span>
              <span><el-icon><Clock /></el-icon>{{ cur.confirmTime }}</span>
            </div>
            <div class="cf-hero__amt">
              <div class="cf-amt">
                <span class="cf-amt__l">违规本金</span>
                <span class="cf-amt__v num num--money">{{ fmtMoney(cur.amount.totalViolationAmount) }}</span>
              </div>
              <div class="cf-amt">
                <span class="cf-amt__l">涉及医保基金</span>
                <span class="cf-amt__v num num--money">{{ fmtMoney(cur.amount.insuranceFundAmount) }}</span>
              </div>
              <div class="cf-amt">
                <span class="cf-amt__l">拟罚款（{{ cur.amount.penaltyMultiple || 0 }}倍）</span>
                <span class="cf-amt__v num num--money">{{ cur.amount.penaltyAmount ? fmtMoney(cur.amount.penaltyAmount) : '—' }}</span>
              </div>
              <div class="cf-amt is-total">
                <span class="cf-amt__l">应追缴合计</span>
                <span class="cf-amt__v num num--money">{{ fmtMoney(cur.amount.totalRecoverable) }}</span>
              </div>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="cf-tabs">
            <!-- AI 定性 -->
            <el-tab-pane label="AI 辅助定性" name="qualify">
              <div class="ai-bar">
                <el-button type="primary" :icon="'MagicStick'" :loading="aiLoading" @click="runAi">
                  {{ aiLoading ? 'AI 分析中…' : '重新运行 AI 定性' }}
                </el-button>
                <span class="text-mini">
                  模型 v2.3.2 · 置信度 <b class="num">{{ (aiResult || cur).aiSuggestion.confidence }}%</b>
                </span>
              </div>

              <div class="ai-card">
                <div class="ai-card__h">
                  <el-icon><MagicStick /></el-icon>
                  <span>AI 定性结论与处置建议</span>
                  <el-tag size="small" effect="dark" type="primary">{{ (aiResult || cur).aiSuggestion.suggestedHandling }}</el-tag>
                </div>
                <div class="ai-card__b">
                  <div class="ai-row">
                    <span class="ai-row__k">问题性质</span>
                    <span class="ai-row__v">
                      <el-tag :type="(NATURE_TONE[cur.problemNature] as any)" size="small" effect="dark">{{ cur.problemNature }}</el-tag>
                    </span>
                  </div>
                  <div class="ai-row">
                    <span class="ai-row__k">认定理由</span>
                    <span class="ai-row__v">{{ cur.natureReason }}</span>
                  </div>
                  <div class="ai-row">
                    <span class="ai-row__k">建议措施</span>
                    <span class="ai-row__v">
                      <el-tag v-for="m in (aiResult || cur).aiSuggestion.suggestedMeasures" :key="m" size="small" type="warning" effect="plain" class="mr4">{{ m }}</el-tag>
                    </span>
                  </div>
                  <div class="ai-row">
                    <span class="ai-row__k">推荐依据</span>
                    <span class="ai-row__v">{{ (aiResult || cur).aiSuggestion.reason }}</span>
                  </div>
                </div>
              </div>

              <div class="sub-title">违规类型认定</div>
              <el-table :data="cur.violationTypes" size="small" border stripe>
                <el-table-column prop="type" label="违规类型" min-width="120" />
                <el-table-column prop="level" label="分类层级" width="86" align="center" />
                <el-table-column prop="count" label="涉及人次" width="90" align="right">
                  <template #default="{ row }"><span class="num">{{ row.count }}</span></template>
                </el-table-column>
                <el-table-column prop="amount" label="涉及金额" align="right">
                  <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.amount) }}</span></template>
                </el-table-column>
              </el-table>

              <div class="sub-title">金额核算明细</div>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="违规本金">
                  <span class="num num--money">{{ fmtMoney(cur.amount.totalViolationAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="涉及医保基金">
                  <span class="num num--money">{{ fmtMoney(cur.amount.insuranceFundAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="统筹基金（职工）">
                  <span class="num">{{ fmtMoney(cur.amount.byInsurance['职工医保']) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="统筹基金（居民）">
                  <span class="num">{{ fmtMoney(cur.amount.byInsurance['居民医保']) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="个人账户">
                  <span class="num">{{ fmtMoney(cur.amount.personalAccountAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="个人自付">
                  <span class="num">{{ fmtMoney(cur.amount.selfPayAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="罚款依据" :span="2">
                  <span class="text-mini">{{ cur.amount.penaltyBasis }}</span>
                </el-descriptions-item>
              </el-descriptions>

              <div class="sub-title">法律与协议依据</div>
              <div class="legal-list">
                <div v-for="(l, i) in cur.legalBasis" :key="i" class="lg">
                  <div class="lg__h">
                    <el-icon><Notebook /></el-icon>
                    <b>{{ l.law }}</b>
                    <el-tag size="small" effect="plain">{{ l.article }}</el-tag>
                    <el-tag size="small" type="success" effect="plain">现行有效</el-tag>
                  </div>
                  <div class="lg__c">{{ l.content }}</div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 责任界定 -->
            <el-tab-pane label="责任界定" name="resp">
              <div class="sub-title">机构主体责任</div>
              <div class="resp-card is-org">
                <div class="resp-card__h">
                  <el-icon><OfficeBuilding /></el-icon>
                  <b>{{ cur.responsibility.orgResponsibility.org }}</b>
                  <el-tag size="small" type="danger" effect="dark">{{ cur.responsibility.orgResponsibility.type }}</el-tag>
                  <el-tag size="small" type="warning" effect="plain">{{ cur.responsibility.orgResponsibility.degree }}</el-tag>
                </div>
                <div class="resp-card__c">{{ cur.responsibility.orgResponsibility.description }}</div>
              </div>

              <div class="sub-title">科室管理责任</div>
              <div class="resp-list">
                <div v-for="(dp, i) in cur.responsibility.deptResponsibility" :key="i" class="resp-card is-dept">
                  <div class="resp-card__h">
                    <el-icon><Grid /></el-icon>
                    <b>{{ dp.dept }}</b>
                    <el-tag size="small" type="warning" effect="dark">{{ dp.type }}</el-tag>
                    <el-tag size="small" effect="plain">{{ dp.degree }}</el-tag>
                  </div>
                  <div class="resp-card__c">{{ dp.description }}</div>
                </div>
              </div>

              <div class="sub-title">个人直接责任</div>
              <el-table :data="cur.responsibility.personalResponsibility" size="small" border stripe>
                <el-table-column prop="name" label="姓名" width="92" />
                <el-table-column prop="dept" label="科室" width="112" />
                <el-table-column prop="type" label="责任类型" width="92" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" type="danger" effect="plain">{{ row.type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="degree" label="责任程度" width="92" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.degree === '主要责任' ? 'danger' : row.degree === '次要责任' ? 'warning' : 'info'" effect="dark">
                      {{ row.degree }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="责任说明" min-width="200" show-overflow-tooltip />
                <template #empty><EmptyState text="未认定个人责任" height="90px" /></template>
              </el-table>
            </el-tab-pane>

            <!-- 双人复核 -->
            <el-tab-pane name="review">
              <template #label>
                双人复核
                <el-badge v-if="cur.needDualReview && cur.review.status === '待复核'" is-dot class="tab-dot" />
              </template>

              <el-alert v-if="cur.needDualReview" type="warning" :closable="false" show-icon class="mb12">
                <template #title>
                  <span class="text-mini">本案触发双人复核条件：{{ cur.dualReviewReasons.join('、') }}</span>
                </template>
              </el-alert>
              <el-alert v-else type="info" :closable="false" show-icon class="mb12">
                <template #title><span class="text-mini">本案未触发双人复核条件，由承办人确认后即可流转</span></template>
              </el-alert>

              <div class="sub-title">第一承办人</div>
              <div class="rv-card">
                <div class="rv-card__h">
                  <el-icon><User /></el-icon>
                  <b>{{ cur.review.firstReviewer.name }}</b>
                  <el-tag size="small" effect="plain">{{ cur.review.firstReviewer.role }}</el-tag>
                  <span class="rv-card__t num">{{ cur.review.firstReviewer.signTime }}</span>
                </div>
                <div class="rv-card__c">{{ cur.review.firstReviewer.opinion }}</div>
                <div class="rv-card__sign">
                  <el-icon><EditPen /></el-icon>已电子签名 · 签名时间与 IP 已留痕
                </div>
              </div>

              <div class="sub-title">第二复核人</div>
              <template v-if="cur.review.secondReviewer">
                <div class="rv-card" :class="cur.review.secondReviewer.result === '通过' ? 'is-pass' : 'is-back'">
                  <div class="rv-card__h">
                    <el-icon><UserFilled /></el-icon>
                    <b>{{ cur.review.secondReviewer.name }}</b>
                    <el-tag size="small" effect="plain">{{ cur.review.secondReviewer.role }}</el-tag>
                    <el-tag :type="cur.review.secondReviewer.result === '通过' ? 'success' : 'danger'" size="small" effect="dark">
                      {{ cur.review.secondReviewer.result }}
                    </el-tag>
                    <span class="rv-card__t num">{{ cur.review.secondReviewer.signTime }}</span>
                  </div>
                  <el-table :data="cur.review.secondReviewer.reviewItems" size="small" border stripe class="mt8">
                    <el-table-column prop="item" label="复核事项" width="120" />
                    <el-table-column prop="result" label="结论" width="80" align="center">
                      <template #default="{ row }">
                        <el-tag :type="row.result === '符合' ? 'success' : 'danger'" size="small" effect="plain">{{ row.result }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="comment" label="复核意见" min-width="200" show-overflow-tooltip />
                  </el-table>
                  <div class="rv-card__c mt8">{{ cur.review.secondReviewer.opinion }}</div>
                  <div class="rv-card__sign">
                    <el-icon><EditPen /></el-icon>已电子签名 · 防篡改留痕
                  </div>
                </div>
              </template>
              <EmptyState v-else text="尚未复核，可点击下方按钮开始复核" height="110px" />

              <div class="tab-actions">
                <el-button v-if="cur.review.status !== '复核通过'" type="primary" :icon="'DocumentChecked'" @click="openReview">
                  开始复核
                </el-button>
                <el-button v-else type="success" :icon="'Select'" disabled>复核已通过</el-button>
              </div>
            </el-tab-pane>

            <!-- 报告与送达 -->
            <el-tab-pane label="报告与送达" name="report">
              <div class="sub-title">检查报告</div>
              <template v-if="cur.report || reportRes">
                <div class="rp-card">
                  <div class="rp-card__h">
                    <el-icon><Document /></el-icon>
                    <b>{{ (reportRes || cur.report).reportNo }}</b>
                    <el-tag size="small" type="success" effect="dark">已生成</el-tag>
                    <span class="rp-card__t num">{{ (reportRes || cur.report).generateTime }}</span>
                  </div>
                  <div class="rp-sections">
                    <div v-for="(s, i) in (reportRes?.sections || [
                      { no: '封面', title: cur.orgName + '医保基金使用检查报告' },
                      { no: '一', title: '检查基本情况' }, { no: '二', title: '检查发现问题' },
                      { no: '三', title: '违规金额认定' }, { no: '四', title: '问题性质认定' },
                      { no: '五', title: '责任界定' }, { no: '六', title: '处理建议' }, { no: '七', title: '附件清单' }
                    ])" :key="i" class="rp-sec">
                      <span class="rp-sec__no">{{ s.no }}</span>
                      <span class="rp-sec__t">{{ s.title }}</span>
                      <el-icon class="rp-sec__ck"><CircleCheckFilled /></el-icon>
                    </div>
                  </div>
                  <div class="rp-card__f">
                    <el-button link type="primary" :icon="'View'" @click="openDoc('report')">在线预览</el-button>
                    <el-button link type="primary" :icon="'Tickets'" @click="openDoc('confirm')">违规确认书</el-button>
                    <el-button link type="primary" :icon="'Bell'" @click="openDoc('notice')">处理意见告知书</el-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <EmptyState text="复核通过后可生成检查报告" height="100px" />
                <div class="tab-actions">
                  <el-button type="primary" :icon="'Document'" :loading="reporting"
                    :disabled="cur.review.status !== '复核通过'" @click="doReport">生成检查报告</el-button>
                </div>
              </template>

              <div class="sub-title">结果送达</div>
              <template v-if="cur.delivery || pushRes">
                <div class="dl-card">
                  <div class="dl-card__h">
                    <el-icon><Promotion /></el-icon>
                    <b>已送达被检机构</b>
                    <span class="dl-card__t num">{{ (pushRes || cur.delivery).pushTime }}</span>
                  </div>
                  <div class="dl-row">
                    <span class="dl-row__k">送达方式</span>
                    <span class="dl-row__v">
                      <el-tag v-for="m in (pushRes || cur.delivery).pushMethod" :key="m" size="small" effect="plain" class="mr4">{{ m }}</el-tag>
                    </span>
                  </div>
                  <div class="dl-row">
                    <span class="dl-row__k">送达文书</span>
                    <span class="dl-row__v">
                      <el-tag v-for="d in ['检查报告', '违规确认书', '违规金额认定表', '处理意见告知书']" :key="d" size="small" type="info" effect="plain" class="mr4">{{ d }}</el-tag>
                    </span>
                  </div>
                  <div class="dl-row">
                    <span class="dl-row__k">签收状态</span>
                    <span class="dl-row__v">
                      <el-tag v-if="(pushRes || cur.delivery).signed" size="small" type="success" effect="dark">已签收</el-tag>
                      <el-tag v-else size="small" type="warning" effect="dark">未签收（5 个工作日后视为送达）</el-tag>
                    </span>
                  </div>
                  <div class="rights">
                    <div class="rights__t"><el-icon><InfoFilled /></el-icon>已告知权利与时限</div>
                    <ul class="rights__l">
                      <li>陈述申辩权：收到之日起 <b class="num">5</b> 个工作日内提出</li>
                      <li>听证权：拟较大数额罚款等情形，收到之日起 <b class="num">3</b> 个工作日内申请</li>
                      <li>申诉渠道：芜湖市医疗保障局基金监管处 0553-3901234</li>
                    </ul>
                  </div>
                </div>
              </template>
              <template v-else>
                <EmptyState text="生成检查报告后可送达机构" height="100px" />
                <div class="tab-actions">
                  <el-button type="primary" :icon="'Promotion'" :loading="pushing"
                    :disabled="!(cur.report || reportRes)" @click="doPush">推送并送达</el-button>
                </div>
              </template>
            </el-tab-pane>
          </el-tabs>

          <!-- 文书组快捷入口 -->
          <div class="doc-group">
            <div class="doc-group__t">
              <el-icon><FolderOpened /></el-icon>本案关联文书（可预览 / 导出 Word / 导出 PDF）
            </div>
            <div class="doc-group__b">
              <el-button size="small" :icon="'Document'" @click="openDoc('report')">医保基金使用情况检查报告</el-button>
              <el-button size="small" :icon="'Tickets'" @click="openDoc('confirm')">违规行为确认书</el-button>
              <el-button size="small" :icon="'Bell'" @click="openDoc('notice')">处理意见告知书</el-button>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- 文书预览 -->
    <DocPreview v-model:visible="docVisible" :doc="curDoc" />

    <!-- ============ 复核弹窗 ============ -->
    <el-dialog v-model="reviewVisible" title="双人复核" width="600px">
      <el-alert v-if="cur" type="warning" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">
            复核 {{ cur.orgName }} · {{ cur.problemNature }} · 违规金额
            <b class="num">{{ fmtMoney(cur.amount.totalViolationAmount) }}</b>
          </span>
        </template>
      </el-alert>

      <el-form label-width="92px">
        <el-form-item label="逐项复核" required>
          <div class="rvf-list">
            <div v-for="(it, i) in reviewForm.items" :key="i" class="rvf">
              <span class="rvf__n">{{ it.item }}</span>
              <el-radio-group v-model="it.result" size="small">
                <el-radio-button label="符合" />
                <el-radio-button label="不符合" />
              </el-radio-group>
              <el-input v-model="it.comment" size="small" placeholder="复核意见（选填）" class="rvf__c" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="复核结论" required>
          <el-radio-group v-model="reviewForm.result">
            <el-radio-button label="通过" />
            <el-radio-button label="退回修改" />
            <el-radio-button label="需补充证据" />
            <el-radio-button label="需集体审议" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="复核意见" required>
          <el-input v-model="reviewForm.opinion" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="电子签名">
          <div class="sign-tip">
            <el-icon><EditPen /></el-icon>
            提交即视为电子签名，签名人、时间与 IP 将不可篡改留痕
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewing" @click="doReview">提交复核并签名</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt8 { margin-top: 8px; }
.mr4 { margin-right: 4px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.5fr 1.2fr; gap: 12px;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}

:deep(.row-fraud) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

/* ---------- 抽屉头部 ---------- */
.cf-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &.is-fraud {
    background: linear-gradient(120deg, var(--zh-risk-high-bg), #fff);
    border-color: var(--zh-risk-high-border);
  }

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__amt {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 11px;
    @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
  }
}

.cf-amt {
  padding: 7px 8px; border-radius: 6px; text-align: center;
  background: #fff; border: 1px solid var(--zh-border-light);
  &.is-total { border-color: var(--zh-danger); background: var(--zh-risk-high-bg); }
  &__l { display: block; font-size: 10px; color: var(--zh-text-secondary); }
  &__v { display: block; font-size: 13px; font-weight: 700; margin-top: 2px; }
}

.cf-tabs { margin-top: 12px; }
.tab-dot { margin-left: 3px; }

.tab-actions {
  display: flex; gap: 8px; margin-top: 14px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- AI ---------- */
.ai-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 11px;
  b { color: var(--zh-primary); }
}

.ai-card {
  border-radius: var(--zh-radius); overflow: hidden;
  background: var(--zh-purple-light); border: 1px solid var(--zh-purple);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    padding: 7px 11px; background: var(--zh-purple); color: #fff;
    font-size: var(--zh-font-xs); font-weight: 700;
  }
  &__b { padding: 9px 11px; }
}

.ai-row {
  display: flex; gap: 9px; font-size: 11px; line-height: 1.85;
  & + & { margin-top: 5px; padding-top: 5px; border-top: 1px dashed rgba(114, 46, 209, .2); }
  &__k { flex-shrink: 0; width: 62px; color: var(--zh-text-secondary); }
  &__v { flex: 1; color: var(--zh-text-regular); }
}

/* ---------- 法律依据 ---------- */
.legal-list { display: flex; flex-direction: column; gap: 8px; }

.lg {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--zh-primary);

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-primary); }
    b { color: var(--zh-text-primary); }
  }
  &__c {
    margin-top: 5px; font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary);
    padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
  }
}

/* ---------- 责任 ---------- */
.resp-list { display: flex; flex-direction: column; gap: 8px; }

.resp-card {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &.is-org { border-left: 3px solid var(--zh-danger); background: var(--zh-risk-high-bg); }
  &.is-dept { border-left: 3px solid var(--zh-warning); background: var(--zh-risk-mid-bg); }

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-primary); }
    b { color: var(--zh-text-primary); }
  }
  &__c { margin-top: 5px; font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary); }
}

/* ---------- 复核 ---------- */
.rv-card {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &.is-pass { border-color: var(--zh-success); background: var(--zh-success-light); }
  &.is-back { border-color: var(--zh-danger); background: var(--zh-risk-high-bg); }

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-primary); }
    b { color: var(--zh-text-primary); }
  }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
  &__c { margin-top: 7px; font-size: 11px; line-height: 1.85; color: var(--zh-text-regular); }
  &__sign {
    display: flex; align-items: center; gap: 4px; margin-top: 7px;
    padding-top: 6px; border-top: 1px dashed var(--zh-border-light);
    font-size: 10px; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-success); }
  }
}

.rvf-list { display: flex; flex-direction: column; gap: 7px; width: 100%; }

.rvf {
  display: flex; align-items: center; gap: 8px;
  &__n { flex-shrink: 0; width: 78px; font-size: 11px; color: var(--zh-text-regular); }
  &__c { flex: 1; }
}

.sign-tip {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--zh-text-secondary); line-height: 1.7;
  :deep(.el-icon) { color: var(--zh-warning); }
}

/* ---------- 报告 ---------- */
.rp-card {
  border-radius: var(--zh-radius); overflow: hidden;
  border: 1px solid var(--zh-border-light);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    padding: 8px 11px; background: var(--zh-bg-soft);
    border-bottom: 1px solid var(--zh-border-light);
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-primary); }
    b { color: var(--zh-text-primary); }
  }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
  &__f {
    display: flex; gap: 4px; padding: 6px 11px;
    border-top: 1px solid var(--zh-border-light); background: var(--zh-bg-soft);
  }
}

.rp-sections { padding: 7px 11px; }

.rp-sec {
  display: flex; align-items: center; gap: 8px; padding: 5px 0;
  font-size: 11px;
  & + & { border-top: 1px dashed var(--zh-border-light); }

  &__no {
    flex-shrink: 0; min-width: 26px; text-align: center;
    font-size: 10px; font-weight: 700; color: var(--zh-primary);
  }
  &__t { flex: 1; color: var(--zh-text-regular); }
  &__ck { color: var(--zh-success); font-size: 12px; }
}

/* ---------- 送达 ---------- */
.dl-card {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-success); }
    b { color: var(--zh-text-primary); }
  }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
}

.dl-row {
  display: flex; gap: 9px; margin-top: 7px; font-size: 11px; line-height: 1.9;
  &__k { flex-shrink: 0; width: 60px; color: var(--zh-text-secondary); }
  &__v { flex: 1; }
}

.rights {
  margin-top: 9px; padding: 8px 10px; border-radius: 6px;
  background: #fff; border: 1px solid var(--zh-border-light);

  &__t {
    display: flex; align-items: center; gap: 5px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__l {
    margin: 6px 0 0; padding-left: 18px;
    font-size: 11px; line-height: 2; color: var(--zh-text-secondary);
    b { color: var(--zh-danger); }
  }
}

/* ---------- 文书组 ---------- */
.doc-group {
  margin-top: 16px; padding: 10px 12px;
  border-radius: var(--zh-radius);
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--zh-purple);

  &__t {
    display: flex; align-items: center; gap: 5px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-purple); }
  }
  &__b {
    display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px;
    :deep(.el-button) { margin-left: 0 !important; }
  }
}
</style>
