<script setup lang="ts">
import {
  getLedgerStats, getArchives, getStandards, getTypicalCases,
  getReviewScores, uploadArchive, adoptFeedback, exportLedgerReport
} from '@/api/agent03-punish/punish'
import { fmtMoney, fmtWan, CHART_COLORS, CHART_GRID } from '@/utils/format'
import {
  buildReviewReportDoc, buildAnalysisReportDoc, exportCsv,
  ARCHIVE_CATEGORIES_9, type LegalDoc
} from '@/utils/legalDoc'

const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('achievement')

/* ---------- 档案 ---------- */
const arcList = ref<any[]>([])
const arcTotal = ref(0)
const arcLoading = ref(false)
const arcQ = reactive({ keyword: '', status: '', year: '', page: 1, pageSize: 10 })

/* ---------- 标准 ---------- */
const stdList = ref<any[]>([])
const stdTotal = ref(0)
const stdLoading = ref(false)
const stdQ = reactive({ keyword: '', violationType: '', page: 1, pageSize: 10 })

/* ---------- 案例 ---------- */
const caseList = ref<any[]>([])
const caseTotal = ref(0)
const caseLoading = ref(false)
const caseQ = reactive({ keyword: '', violationType: '', problemNature: '', page: 1, pageSize: 10 })

/* ---------- 复盘 ---------- */
const rsList = ref<any[]>([])
const rsTotal = ref(0)
const rsLoading = ref(false)
const rsQ = reactive({ keyword: '', grade: '', keyOnly: '', page: 1, pageSize: 10 })

const NATURE_TONE: Record<string, string> = {
  一般违规: 'info', 较重违规: 'warning', 严重违规: 'danger', 涉嫌欺诈骗保: 'danger'
}
const GRADE_TONE: Record<string, string> = { 优秀: 'success', 良好: 'primary', 合格: 'warning', 待改进: 'danger' }
const VIOLATION_OPTS = ['重复收费', '过度诊疗', '无指征收费', '超量开药', '串换药品', '虚假诊疗', '虚构住院', '分解住院', '管理问题']

async function loadStats() { st.value = await getLedgerStats() }

async function loadArc() {
  arcLoading.value = true
  try {
    const res: any = await getArchives(arcQ)
    arcList.value = res?.list || []
    arcTotal.value = res?.total || 0
  } finally { arcLoading.value = false }
}
async function loadStd() {
  stdLoading.value = true
  try {
    const res: any = await getStandards(stdQ)
    stdList.value = res?.list || []
    stdTotal.value = res?.total || 0
  } finally { stdLoading.value = false }
}
async function loadCase() {
  caseLoading.value = true
  try {
    const res: any = await getTypicalCases(caseQ)
    caseList.value = res?.list || []
    caseTotal.value = res?.total || 0
  } finally { caseLoading.value = false }
}
async function loadRs() {
  rsLoading.value = true
  try {
    const res: any = await getReviewScores(rsQ)
    rsList.value = res?.list || []
    rsTotal.value = res?.total || 0
  } finally { rsLoading.value = false }
}

/* ---------- 档案详情 ---------- */
const arcDrawer = ref(false)
const curArc = ref<any>(null)
function openArc(row: any) { curArc.value = row; arcDrawer.value = true }

const uploading = ref(false)
const ocrRes = ref<any>(null)
async function doUpload() {
  uploading.value = true
  ocrRes.value = null
  try {
    const res: any = await uploadArchive({ archiveId: curArc.value?.archiveId })
    ocrRes.value = res
    msg.success(res?.message || '上传成功')
  } finally { uploading.value = false }
}

/* ---------- 案例详情 ---------- */
const caseDrawer = ref(false)
const curCase = ref<any>(null)
function openCase(row: any) { curCase.value = row; caseDrawer.value = true }

/* ---------- 复盘详情 ---------- */
const rsDrawer = ref(false)
const curRs = ref<any>(null)
function openRs(row: any) { curRs.value = row; rsDrawer.value = true }

const adopting = ref(false)
async function doAdopt() {
  adopting.value = true
  try {
    const res: any = await adoptFeedback({ scoreId: curRs.value.scoreId })
    msg.success(res?.message || '已采纳')
    if (curRs.value.modelFeedback) curRs.value.modelFeedback.adopted = true
    await Promise.all([loadStats(), loadRs()])
  } finally { adopting.value = false }
}

/* ---------- 导出报告 ---------- */
const docVisible = ref(false)
const curDoc = ref<LegalDoc | null>(null)

/** 监管分析报告 / 专项检查总结报告 */
async function doExport(type: 'analysis' | 'summary') {
  const res: any = await exportLedgerReport({ reportType: type })
  curDoc.value = buildAnalysisReportDoc(st.value, type)
  docVisible.value = true
  msg.success(`${res?.reportName || '报告'}已生成，可预览与导出`)
}

/** 案件复盘报告 */
function openReviewDoc() {
  if (!curRs.value) return
  curDoc.value = buildReviewReportDoc(curRs.value)
  docVisible.value = true
}

/** 导出电子案卷目录 */
function exportArchiveIndex() {
  if (!curArc.value) return
  const a = curArc.value
  exportCsv(
    `电子案卷目录_${a.archiveNo.replace(/[〔〕]/g, '')}`,
    ['序号', '材料类别', '份数', '来源', '案卷号', '案件名称', '归档人', '归档时间', '保管期限(年)'],
    (a.materials || []).map((m: any, i: number) => [
      i + 1, m.category, m.count, m.source,
      a.archiveNo, a.caseName, a.archiver, a.archiveTime, a.retentionYears
    ])
  )
  msg.success(`案卷目录已导出（${ARCHIVE_CATEGORIES_9.length} 类归档材料）`)
}

/* ---------- 图表 ---------- */
const districtOption = computed(() => {
  const d = st.value?.byDistrict || []
  return {
    color: ['#e5484d', '#e8a30c'],
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: any) => `${ps[0].name}<br/>` + ps.map((p: any) => `${p.seriesName}: ${(p.value / 10000).toFixed(1)} 万元`).join('<br/>')
    },
    legend: { data: ['违规金额', '处罚金额'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 48, bottom: 42 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.name),
      axisLabel: { fontSize: 10, interval: 0, rotate: 26, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', name: '万元', nameTextStyle: { fontSize: 10, color: '#9aa7b8' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v / 10000).toFixed(0) }
    },
    series: [
      { name: '违规金额', type: 'bar', barWidth: 15, itemStyle: { color: '#e5484d', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.amount) },
      { name: '处罚金额', type: 'bar', barWidth: 15, itemStyle: { color: '#e8a30c', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.penalty) }
    ]
  }
})

const trendOption = computed(() => {
  const d = st.value?.monthTrend || []
  return {
    color: ['#e5484d', '#12a150'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['违规金额', '追回金额'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 48, bottom: 28 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.month.slice(5) + '月'),
      axisLabel: { fontSize: 10, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', name: '万元', nameTextStyle: { fontSize: 10, color: '#9aa7b8' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v / 10000).toFixed(0) }
    },
    series: [
      { name: '违规金额', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: .12 }, data: d.map((i: any) => i.violationAmount) },
      { name: '追回金额', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: .12 }, data: d.map((i: any) => i.recoveredAmount) }
    ]
  }
})

const violationOption = computed(() => {
  const d = (st.value?.byViolationType || []).slice(0, 8)
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.value} 件` },
    legend: { type: 'scroll', bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['42%', '64%'], center: ['50%', '42%'],
      label: { show: true, formatter: '{c}', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.count }))
    }]
  }
})

const dimOption = computed(() => {
  const d = st.value?.scoreDimAvg || []
  // 数据未就绪时不渲染雷达图，避免 ECharts 因空 indicator 报错
  if (!d.length) return {}
  return {
    tooltip: { trigger: 'item' },
    radar: {
      indicator: d.map((i: any) => ({ name: i.name, max: 100 })),
      radius: '62%', center: ['50%', '52%'],
      axisName: { fontSize: 10, color: '#43516b' },
      splitLine: { lineStyle: { color: '#eef1f7' } },
      splitArea: { areaStyle: { color: ['#fff', '#f8fafd'] } },
      axisLine: { lineStyle: { color: '#e2e8f2' } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: d.map((i: any) => i.value),
        name: '平均得分',
        areaStyle: { color: 'rgba(22, 104, 220, .18)' },
        lineStyle: { color: '#1668dc', width: 2 },
        itemStyle: { color: '#1668dc' },
        label: { show: true, fontSize: 10, fontWeight: 700 }
      }]
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'archive' && !arcList.value.length) loadArc()
  else if (v === 'standard' && !stdList.value.length) loadStd()
  else if (v === 'case' && !caseList.value.length) loadCase()
  else if (v === 'review' && !rsList.value.length) loadRs()
})

onMounted(() => { loadStats() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="台账与经验沉淀" tag="M24"
      subtitle="全流程归档 · 监管战果统计 · 标准案例沉淀 · 复盘驱动模型迭代">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats()">刷新</el-button>
        <el-button :icon="'Document'" @click="doExport('analysis')">监管分析报告</el-button>
        <el-button type="primary" :icon="'Printer'" @click="doExport('summary')">专项检查总结</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="lg-tabs">
      <!-- ===================== 监管战果 ===================== -->
      <el-tab-pane label="监管战果统计" name="achievement">
        <div class="ach-grid">
          <div class="ach-c is-primary">
            <el-icon class="ach-c__i"><User /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ st?.achievement?.inspectPersonTimes || 0 }}</div>
              <div class="ach-c__l">检查人次</div>
            </div>
          </div>
          <div class="ach-c is-primary">
            <el-icon class="ach-c__i"><OfficeBuilding /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ st?.achievement?.coveredHospitals || 0 }}<i>/{{ st?.achievement?.coveredPharmacies || 0 }}</i></div>
              <div class="ach-c__l">覆盖医院 / 药店</div>
            </div>
          </div>
          <div class="ach-c is-accent">
            <el-icon class="ach-c__i"><Aim /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ (st?.achievement?.clueCount || 0).toLocaleString('zh-CN') }}</div>
              <div class="ach-c__l">疑点线索数</div>
            </div>
          </div>
          <div class="ach-c is-accent">
            <el-icon class="ach-c__i"><TrendCharts /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ st?.achievement?.positiveRate || 0 }}<i>%</i></div>
              <div class="ach-c__l">线索阳性率</div>
            </div>
          </div>
          <div class="ach-c is-danger">
            <el-icon class="ach-c__i"><Coin /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ fmtWan(st?.achievement?.violationAmount || 0) }}<i>元</i></div>
              <div class="ach-c__l">违规金额</div>
            </div>
          </div>
          <div class="ach-c is-warning">
            <el-icon class="ach-c__i"><Stamp /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ fmtWan(st?.achievement?.penaltyAmount || 0) }}<i>元</i></div>
              <div class="ach-c__l">处罚金额</div>
            </div>
          </div>
          <div class="ach-c is-success">
            <el-icon class="ach-c__i"><Money /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ fmtWan(st?.achievement?.recoveredAmount || 0) }}<i>元</i></div>
              <div class="ach-c__l">基金追回</div>
            </div>
          </div>
          <div class="ach-c is-success">
            <el-icon class="ach-c__i"><Select /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ st?.achievement?.rectifyCompleteRate || 0 }}<i>%</i></div>
              <div class="ach-c__l">整改完成率</div>
            </div>
          </div>
          <div class="ach-c is-purple">
            <el-icon class="ach-c__i"><Position /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ st?.achievement?.transferCount || 0 }}</div>
              <div class="ach-c__l">移送案件</div>
            </div>
          </div>
          <div class="ach-c is-purple">
            <el-icon class="ach-c__i"><Medal /></el-icon>
            <div class="ach-c__b">
              <div class="ach-c__v num">{{ st?.achievement?.creditLinkCount || 0 }}</div>
              <div class="ach-c__l">信用联动</div>
            </div>
          </div>
        </div>

        <div class="chart-grid mt12">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">辖区违规与处罚金额</span>
            </div>
            <EChart :option="districtOption" height="230px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">违规与追回金额趋势</span>
            </div>
            <EChart :option="trendOption" height="230px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">违规类型构成</span>
            </div>
            <EChart :option="violationOption" height="230px" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ===================== 档案管理 ===================== -->
      <el-tab-pane label="全流程档案" name="archive">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">电子案卷归档</span>
            <span class="section-title__desc">
              线索 / 任务 / 核查 / 证据 / 处置 / 文书 / 申诉 / 整改 / 销号材料统一归档，纸质材料扫码上传 OCR 识别关联
            </span>
            <span class="section-title__extra">
              <el-tag size="small" effect="plain">已归档 {{ st?.archivedCount || 0 }} / {{ st?.archiveTotal || 0 }} 卷</el-tag>
            </span>
          </div>

          <el-form class="query-form" :model="arcQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="arcQ.keyword" placeholder="档案号/案件/机构" clearable :prefix-icon="'Search'"
                @keyup.enter="arcQ.page = 1; loadArc()" />
            </el-form-item>
            <el-form-item label="归档状态">
              <el-select v-model="arcQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['归档中', '已归档', '已移交']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item label="归档年度">
              <el-select v-model="arcQ.year" placeholder="全部年度" clearable>
                <el-option label="2026" value="2026" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="arcQ.page = 1; loadArc()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(arcQ, { keyword: '', status: '', year: '', page: 1 }); loadArc()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="arcList" size="small" border stripe v-loading="arcLoading">
            <el-table-column prop="archiveNo" label="档案号" width="164">
              <template #default="{ row }">
                <span class="num text-link" @click="openArc(row)">{{ row.archiveNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="volumeCount" label="卷数" width="70" align="right">
              <template #default="{ row }"><span class="num">{{ row.volumeCount }}</span></template>
            </el-table-column>
            <el-table-column prop="pageCount" label="页数" width="80" align="right">
              <template #default="{ row }"><span class="num">{{ row.pageCount }}</span></template>
            </el-table-column>
            <el-table-column label="纸质/OCR" width="118" align="center">
              <template #default="{ row }">
                <el-tag :type="row.paperUploaded ? 'success' : 'info'" size="small" effect="plain" class="mr4">
                  {{ row.paperUploaded ? '已上传' : '未上传' }}
                </el-tag>
                <el-tag v-if="row.ocrRecognized" type="primary" size="small" effect="plain">OCR</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '已归档' ? 'success' : row.status === '已移交' ? 'primary' : 'warning'" size="small" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="archiver" label="归档人" width="130" />
            <el-table-column prop="archiveTime" label="归档时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.archiveTime }}</span></template>
            </el-table-column>
            <el-table-column prop="retentionYears" label="保管期" width="86" align="center">
              <template #default="{ row }"><span class="num">{{ row.retentionYears }} 年</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'FolderOpened'" @click="openArc(row)">调阅</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无档案" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ arcTotal }} 卷</span>
            <el-pagination v-model:current-page="arcQ.page" v-model:page-size="arcQ.pageSize" :total="arcTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadArc" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ===================== 标准口径 ===================== -->
      <el-tab-pane label="标准口径库" name="standard">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">检查标准与判定口径</span>
            <span class="section-title__desc">
              沉淀判定标准、违规情形定义、金额核算规则、处罚裁量基准，支持版本管理
            </span>
            <span class="section-title__extra">
              <el-tag size="small" effect="plain">{{ st?.standardTotal || 0 }} 条标准</el-tag>
            </span>
          </div>

          <el-form class="query-form" :model="stdQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="stdQ.keyword" placeholder="标准名称/违规类型" clearable :prefix-icon="'Search'"
                @keyup.enter="stdQ.page = 1; loadStd()" />
            </el-form-item>
            <el-form-item label="违规类型">
              <el-select v-model="stdQ.violationType" placeholder="全部类型" clearable>
                <el-option v-for="v in VIOLATION_OPTS" :key="v" :label="v" :value="v" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="stdQ.page = 1; loadStd()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(stdQ, { keyword: '', violationType: '', page: 1 }); loadStd()">重　置</el-button>
            </div>
          </el-form>

          <div v-loading="stdLoading" class="std-list">
            <div v-for="s in stdList" :key="s.standardId" class="std">
              <div class="std__h">
                <el-tag size="small" type="warning" effect="dark">{{ s.violationType }}</el-tag>
                <b>{{ s.standardName }}</b>
                <el-tag size="small" effect="plain">{{ s.version }}</el-tag>
                <el-tag size="small" type="success" effect="plain">{{ s.effective }}</el-tag>
                <span class="std__use">引用 <b class="num">{{ s.useCount }}</b> 次</span>
              </div>
              <div class="std-row">
                <span class="std-row__k">判定标准</span>
                <span class="std-row__v">{{ s.judgeCriteria }}</span>
              </div>
              <div class="std-row">
                <span class="std-row__k">金额核算</span>
                <span class="std-row__v">{{ s.amountRule }}</span>
              </div>
              <div class="std-row">
                <span class="std-row__k">裁量基准</span>
                <span class="std-row__v">{{ s.discretionBase }}</span>
              </div>
              <div class="std__f">
                最近更新 <span class="num">{{ s.updateTime }}</span> · {{ s.updater }}
              </div>
            </div>
            <EmptyState v-if="!stdList.length && !stdLoading" text="暂无标准口径" height="130px" />
          </div>

          <div class="pager">
            <span class="text-mini">共 {{ stdTotal }} 条</span>
            <el-pagination v-model:current-page="stdQ.page" v-model:page-size="stdQ.pageSize" :total="stdTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadStd" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ===================== 典型案例 ===================== -->
      <el-tab-pane label="典型案例库" name="case">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">已办结典型案例</span>
            <span class="section-title__desc">
              结构化存储案件背景、违规事实、认定依据、处置结果、申诉改判情况，支持按类型检索比对
            </span>
            <span class="section-title__extra">
              <el-tag size="small" effect="plain">{{ st?.caseTotal || 0 }} 件案例</el-tag>
            </span>
          </div>

          <el-form class="query-form" :model="caseQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="caseQ.keyword" placeholder="案例名称/违规类型" clearable :prefix-icon="'Search'"
                @keyup.enter="caseQ.page = 1; loadCase()" />
            </el-form-item>
            <el-form-item label="违规类型">
              <el-select v-model="caseQ.violationType" placeholder="全部类型" clearable>
                <el-option v-for="v in VIOLATION_OPTS" :key="v" :label="v" :value="v" />
              </el-select>
            </el-form-item>
            <el-form-item label="问题性质">
              <el-select v-model="caseQ.problemNature" placeholder="全部性质" clearable>
                <el-option v-for="n in ['一般违规', '较重违规', '严重违规', '涉嫌欺诈骗保']" :key="n" :label="n" :value="n" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="caseQ.page = 1; loadCase()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(caseQ, { keyword: '', violationType: '', problemNature: '', page: 1 }); loadCase()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="caseList" size="small" border stripe v-loading="caseLoading">
            <el-table-column prop="caseName" label="案例名称" min-width="212" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="text-link" @click="openCase(row)">{{ row.caseName }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="violationType" label="违规类型" width="106" align="center">
              <template #default="{ row }"><el-tag size="small" type="warning" effect="plain">{{ row.violationType }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="problemNature" label="问题性质" width="112" align="center">
              <template #default="{ row }">
                <el-tag :type="(NATURE_TONE[row.problemNature] as any)" size="small" effect="dark">{{ row.problemNature }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="涉案金额" width="116" align="right">
              <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column prop="result" label="处置结果" min-width="168" show-overflow-tooltip />
            <el-table-column label="申诉改判" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.appealChanged" size="small" type="danger" effect="plain">已改判</el-tag>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="useCount" label="参考次数" width="90" align="right">
              <template #default="{ row }"><span class="num">{{ row.useCount }}</span></template>
            </el-table-column>
            <el-table-column prop="score" label="办案质量" width="92" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.score >= 90 ? 'success' : row.score >= 80 ? 'primary' : 'warning'" effect="dark">
                  {{ row.score }} 分
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openCase(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无典型案例" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ caseTotal }} 件</span>
            <el-pagination v-model:current-page="caseQ.page" v-model:page-size="caseQ.pageSize" :total="caseTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadCase" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ===================== 复盘优化 ===================== -->
      <el-tab-pane label="复盘与模型迭代" name="review">
        <div class="rv-top">
          <div class="kpi-col">
            <StatCard label="复盘案件" :value="st?.reviewScoreTotal || 0" unit="件" icon="Histogram" tone="primary" />
            <StatCard label="平均得分" :value="st?.avgScore || 0" unit="分" icon="TrendCharts" tone="success" :precision="1" />
            <StatCard label="重点复盘" :value="st?.keyReviewCount || 0" unit="件" icon="Warning" tone="warning" />
            <StatCard label="建议已采纳" :value="st?.adoptedFeedback || 0" unit="条" icon="MagicStick" tone="purple" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">五维办案质量画像</span>
              <span class="section-title__desc">定性准确性 30% · 程序合规性 25% · 证据完整性 20% · 文书规范性 15% · 处置适当性 10%</span>
            </div>
            <EChart :option="dimOption" height="250px" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">案件质量评分与优化建议</span>
            <span class="section-title__desc">低分、申诉改判、复议撤销案件自动纳入重点复盘，优化建议回流模型库</span>
          </div>

          <el-form class="query-form" :model="rsQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="rsQ.keyword" placeholder="案件名称/评分编号" clearable :prefix-icon="'Search'"
                @keyup.enter="rsQ.page = 1; loadRs()" />
            </el-form-item>
            <el-form-item label="评价等级">
              <el-select v-model="rsQ.grade" placeholder="全部等级" clearable>
                <el-option v-for="g in ['优秀', '良好', '合格', '待改进']" :key="g" :label="g" :value="g" />
              </el-select>
            </el-form-item>
            <el-form-item label="重点复盘">
              <el-select v-model="rsQ.keyOnly" placeholder="全部" clearable>
                <el-option label="仅看重点复盘" value="true" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="rsQ.page = 1; loadRs()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(rsQ, { keyword: '', grade: '', keyOnly: '', page: 1 }); loadRs()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="rsList" size="small" border stripe v-loading="rsLoading"
            :row-class-name="({ row }: any) => (row.isKeyReview ? 'row-key' : '')">
            <el-table-column prop="scoreId" label="评分编号" width="106">
              <template #default="{ row }">
                <span class="num text-link" @click="openRs(row)">{{ row.scoreId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="totalScore" label="综合得分" width="112" align="center">
              <template #default="{ row }">
                <el-progress type="dashboard" :percentage="row.totalScore" :width="34" :stroke-width="4"
                  :show-text="false"
                  :color="row.totalScore >= 90 ? '#12a150' : row.totalScore >= 80 ? '#1668dc' : row.totalScore >= 70 ? '#e8a30c' : '#e5484d'" />
                <span class="num score-t">{{ row.totalScore }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="grade" label="等级" width="88" align="center">
              <template #default="{ row }">
                <el-tag :type="(GRADE_TONE[row.grade] as any)" size="small" effect="dark">{{ row.grade }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="重点复盘" width="130" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.isKeyReview" size="small" type="danger" effect="plain">{{ row.keyReason }}</el-tag>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="模型反馈" width="106" align="center">
              <template #default="{ row }">
                <template v-if="row.modelFeedback">
                  <el-tag :type="row.modelFeedback.adopted ? 'success' : 'warning'" size="small" effect="dark">
                    {{ row.modelFeedback.adopted ? '已采纳' : '待采纳' }}
                  </el-tag>
                </template>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="reviewer" label="复盘人" width="130" />
            <el-table-column prop="scoreTime" label="复盘时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.scoreTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openRs(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无复盘评分" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ rsTotal }} 件</span>
            <el-pagination v-model:current-page="rsQ.page" v-model:page-size="rsQ.pageSize" :total="rsTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadRs" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 档案详情 ============ -->
    <el-drawer v-model="arcDrawer" size="600px" title="电子案卷调阅">
      <template v-if="curArc">
        <div class="ar-hero">
          <div class="ar-hero__t">
            {{ curArc.caseName }}
            <el-tag :type="curArc.status === '已归档' ? 'success' : 'warning'" size="small" effect="dark">{{ curArc.status }}</el-tag>
          </div>
          <div class="ar-hero__m">
            <span><el-icon><FolderOpened /></el-icon>{{ curArc.archiveNo }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ curArc.orgName }}</span>
            <span><el-icon><Files /></el-icon>{{ curArc.volumeCount }} 卷 / {{ curArc.pageCount }} 页</span>
            <span><el-icon><Clock /></el-icon>保管 {{ curArc.retentionYears }} 年</span>
          </div>
        </div>

        <div class="sub-title">归档材料清单（九类）</div>
        <el-table :data="curArc.materials" size="small" border stripe>
          <el-table-column prop="category" label="材料类别" width="140" />
          <el-table-column prop="count" label="份数" width="80" align="right">
            <template #default="{ row }"><span class="num">{{ row.count }}</span></template>
          </el-table-column>
          <el-table-column prop="source" label="来源" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="80" align="center">
            <template #default>
              <el-button link type="primary" :icon="'View'" @click="msg.info('正在调阅归档材料，请稍候')">查阅</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="sub-title">纸质材料扫码上传</div>
        <div class="ocr-box">
          <div class="ocr-box__s">
            <el-tag :type="curArc.paperUploaded ? 'success' : 'info'" size="small" effect="plain">
              {{ curArc.paperUploaded ? '纸质材料已上传' : '纸质材料未上传' }}
            </el-tag>
            <el-tag v-if="curArc.ocrRecognized" type="primary" size="small" effect="plain">OCR 已识别分类</el-tag>
          </div>
          <el-upload action="#" :auto-upload="false" :limit="5" class="mt8">
            <el-button :icon="'Upload'" size="small">扫码上传纸质材料</el-button>
            <template #tip><span class="text-mini">支持 JPG / PDF，上传后自动 OCR 识别分类并关联电子案卷</span></template>
          </el-upload>
          <el-button type="primary" size="small" :icon="'MagicStick'" :loading="uploading" class="mt8" @click="doUpload">
            {{ uploading ? 'OCR 识别中…' : '模拟上传并 OCR 识别' }}
          </el-button>

          <div v-if="ocrRes" class="ocr-res">
            <div class="ocr-res__h">
              <el-icon><CircleCheckFilled /></el-icon>
              <b>OCR 识别成功</b>
              <el-tag size="small" type="success" effect="dark">置信度 {{ ocrRes.ocrResult.confidence }}%</el-tag>
            </div>
            <div class="ocr-row"><span class="ocr-row__k">识别类别</span><span class="ocr-row__v">{{ ocrRes.ocrResult.category }}</span></div>
            <div class="ocr-row"><span class="ocr-row__k">文书名称</span><span class="ocr-row__v">{{ ocrRes.ocrResult.docName }}</span></div>
            <div class="ocr-row"><span class="ocr-row__k">文书编号</span><span class="ocr-row__v num">{{ ocrRes.ocrResult.docNo }}</span></div>
            <div class="ocr-row"><span class="ocr-row__k">页数</span><span class="ocr-row__v num">{{ ocrRes.ocrResult.pages }} 页</span></div>
          </div>
        </div>

        <div class="dr-actions">
          <el-button type="primary" :icon="'Download'" @click="msg.success('电子案卷已打包导出，正在下载')">导出全卷</el-button>
          <el-button :icon="'Printer'" @click="exportArchiveIndex">导出目录</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 案例详情 ============ -->
    <el-drawer v-model="caseDrawer" size="620px" title="典型案例详情">
      <template v-if="curCase">
        <div class="ar-hero">
          <div class="ar-hero__t">
            {{ curCase.caseName }}
            <el-tag :type="(NATURE_TONE[curCase.problemNature] as any)" size="small" effect="dark">{{ curCase.problemNature }}</el-tag>
            <el-tag v-if="curCase.appealChanged" size="small" type="danger" effect="plain">申诉改判</el-tag>
          </div>
          <div class="ar-hero__m">
            <span><el-icon><Tickets /></el-icon>{{ curCase.caseId }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ curCase.orgType }}</span>
            <span><el-icon><Coin /></el-icon>{{ fmtMoney(curCase.amount) }}</span>
            <span><el-icon><Clock /></el-icon>{{ curCase.decisionDate }}</span>
          </div>
        </div>

        <div class="sub-title">案件背景</div>
        <div class="txt-box">{{ curCase.background }}</div>

        <div class="sub-title">违规事实</div>
        <div class="txt-box">{{ curCase.facts }}</div>

        <div class="sub-title">认定依据</div>
        <div class="txt-box">{{ curCase.basis }}</div>

        <div class="sub-title">处置结果</div>
        <div class="rs-box">
          <div class="rs-row">
            <span class="rs-row__k">处置路径</span>
            <span class="rs-row__v">{{ curCase.result }}</span>
          </div>
          <div class="rs-row">
            <span class="rs-row__k">处置措施</span>
            <span class="rs-row__v">
              <el-tag v-for="m in curCase.handleMeasures" :key="m" size="small" type="warning" effect="plain" class="mr4">{{ m }}</el-tag>
            </span>
          </div>
          <div class="rs-row">
            <span class="rs-row__k">涉案金额</span>
            <span class="rs-row__v num num--money">{{ fmtMoney(curCase.amount) }}</span>
          </div>
          <div class="rs-row">
            <span class="rs-row__k">罚款金额</span>
            <span class="rs-row__v num num--money">{{ curCase.penaltyAmount ? fmtMoney(curCase.penaltyAmount) : '—' }}</span>
          </div>
          <div class="rs-row">
            <span class="rs-row__k">办案质量</span>
            <span class="rs-row__v">
              <el-tag size="small" :type="curCase.score >= 90 ? 'success' : curCase.score >= 80 ? 'primary' : 'warning'" effect="dark">
                {{ curCase.score }} 分
              </el-tag>
            </span>
          </div>
        </div>

        <div class="dr-actions">
          <el-button type="primary" :icon="'DocumentCopy'" @click="msg.success('案例已引用至当前处置决定')">引用本案例</el-button>
          <el-button :icon="'Share'" @click="msg.success('案例已推送至成果宣教智能体')">推送宣教</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 复盘详情 ============ -->
    <el-drawer v-model="rsDrawer" size="640px" title="案件复盘详情">
      <template v-if="curRs">
        <div class="ar-hero" :class="{ 'is-key': curRs.isKeyReview }">
          <div class="ar-hero__t">
            {{ curRs.caseName }}
            <el-tag :type="(GRADE_TONE[curRs.grade] as any)" size="small" effect="dark">{{ curRs.grade }}</el-tag>
            <el-tag v-if="curRs.isKeyReview" size="small" type="danger" effect="plain">重点复盘</el-tag>
          </div>
          <div class="ar-hero__m">
            <span><el-icon><Histogram /></el-icon>{{ curRs.scoreId }}</span>
            <span><el-icon><User /></el-icon>{{ curRs.reviewer }}</span>
            <span><el-icon><Clock /></el-icon>{{ curRs.scoreTime }}</span>
          </div>
          <div class="score-hero">
            <span class="score-hero__l">综合得分</span>
            <span class="score-hero__v num">{{ curRs.totalScore }}</span>
            <span class="score-hero__u">分</span>
            <span v-if="curRs.keyReason" class="score-hero__r">{{ curRs.keyReason }}</span>
          </div>
        </div>

        <div class="sub-title">五维评分明细</div>
        <div class="dim-list">
          <div v-for="d in curRs.dimensions" :key="d.name" class="dim">
            <div class="dim__h">
              <span class="dim__n">{{ d.name }}</span>
              <el-tag size="small" effect="plain">权重 {{ d.weight }}%</el-tag>
              <span class="dim__s num"
                :style="{ color: d.score >= 90 ? 'var(--zh-success)' : d.score >= 78 ? 'var(--zh-primary)' : 'var(--zh-danger)' }">
                {{ d.score }}
              </span>
            </div>
            <el-progress :percentage="d.score" :stroke-width="7" :show-text="false"
              :color="d.score >= 90 ? '#12a150' : d.score >= 78 ? '#1668dc' : '#e5484d'" />
            <div class="dim__c">{{ d.comment }}</div>
          </div>
        </div>

        <template v-if="curRs.problems.length">
          <div class="sub-title">发现问题</div>
          <ul class="pb-list">
            <li v-for="(p, i) in curRs.problems" :key="i">{{ p }}</li>
          </ul>
        </template>

        <template v-if="curRs.suggestions.length">
          <div class="sub-title">优化建议</div>
          <ul class="sg-list">
            <li v-for="(s, i) in curRs.suggestions" :key="i">{{ s }}</li>
          </ul>
        </template>

        <template v-if="curRs.modelFeedback">
          <div class="sub-title">模型 / 规则迭代反馈</div>
          <div class="mf-card">
            <div class="mf-card__h">
              <el-icon><MagicStick /></el-icon>
              <b>{{ curRs.modelFeedback.ruleName }}</b>
              <el-tag size="small" effect="plain">{{ curRs.modelFeedback.ruleId }}</el-tag>
              <el-tag :type="curRs.modelFeedback.adopted ? 'success' : 'warning'" size="small" effect="dark">
                {{ curRs.modelFeedback.adopted ? '已采纳' : '待采纳' }}
              </el-tag>
            </div>
            <div class="mf-card__c">{{ curRs.modelFeedback.adjustSuggestion }}</div>
            <div class="mf-card__f">
              <el-icon><InfoFilled /></el-icon>
              历史案件、核查数据、处置结果与误判反馈将全量回流模型库与规则库，实现"一次处置、一次优化、持续进化"
            </div>
          </div>

          <div class="dr-actions">
            <el-button v-if="!curRs.modelFeedback.adopted" type="primary" :icon="'MagicStick'"
              :loading="adopting" @click="doAdopt">采纳建议并调整规则</el-button>
            <el-button v-else type="success" :icon="'Select'" disabled>建议已采纳</el-button>
            <el-button :icon="'Printer'" @click="openReviewDoc">生成复盘报告</el-button>
          </div>
        </template>
        <div v-else class="dr-actions">
          <el-button :icon="'Printer'" @click="openReviewDoc">生成复盘报告</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 文书 / 报告预览 -->
    <DocPreview v-model:visible="docVisible" :doc="curDoc" />
  </div>
</template>

<style scoped lang="scss">
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.mr4 { margin-right: 4px; }

.lg-tabs {
  :deep(.el-tabs__header) { margin-bottom: 12px; }
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.chart-grid {
  display: grid; grid-template-columns: 1.25fr 1.25fr 1fr; gap: 12px;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}

/* ---------- 战果卡 ---------- */
.ach-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 11px;
  @media (max-width: 1400px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 860px) { grid-template-columns: repeat(2, 1fr); }
}

.ach-c {
  display: flex; align-items: center; gap: 11px;
  padding: 13px 14px; border-radius: var(--zh-radius-lg);
  background: #fff; border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--ac, var(--zh-primary));
  box-shadow: var(--zh-shadow-xs);
  transition: all .22s;

  &:hover { transform: translateY(-3px); box-shadow: var(--zh-shadow-sm); }

  &.is-primary { --ac: var(--zh-primary); }
  &.is-accent { --ac: var(--zh-accent); }
  &.is-danger { --ac: var(--zh-danger); }
  &.is-warning { --ac: var(--zh-warning); }
  &.is-success { --ac: var(--zh-success); }
  &.is-purple { --ac: var(--zh-purple); }

  &__i { font-size: 22px; color: var(--ac); flex-shrink: 0; }
  &__b { min-width: 0; }
  &__v {
    font-size: 21px; font-weight: 800; color: var(--zh-text-primary); line-height: 1.2;
    i { font-size: 12px; font-style: normal; opacity: .7; margin-left: 1px; }
  }
  &__l { font-size: 11px; color: var(--zh-text-secondary); margin-top: 2px; }
}

/* ---------- 标准 ---------- */
.std-list { display: flex; flex-direction: column; gap: 9px; }

.std {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--zh-accent);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    b { color: var(--zh-text-primary); }
  }
  &__use { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); b { color: var(--zh-primary); } }
  &__f {
    margin-top: 7px; padding-top: 6px; border-top: 1px dashed var(--zh-border-light);
    font-size: 10px; color: var(--zh-text-secondary); text-align: right;
  }
}

.std-row {
  display: flex; gap: 9px; margin-top: 6px; font-size: 11px; line-height: 1.8;
  &__k { flex-shrink: 0; width: 56px; color: var(--zh-text-secondary); }
  &__v { flex: 1; color: var(--zh-text-regular); }
}

/* ---------- 复盘 ---------- */
.rv-top {
  display: grid; grid-template-columns: 262px 1fr; gap: 12px; align-items: start; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.kpi-col { display: flex; flex-direction: column; gap: 12px; }

:deep(.row-key) { --el-table-tr-bg-color: var(--zh-warning-light); }

.score-t {
  display: block; font-size: 11px; font-weight: 700;
  color: var(--zh-text-primary); margin-top: -4px;
}

/* ---------- 抽屉 ---------- */
.ar-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &.is-key { background: linear-gradient(120deg, var(--zh-warning-light), #fff); border-color: var(--zh-warning); }

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
}

.score-hero {
  display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; margin-top: 10px;
  padding-top: 9px; border-top: 1px dashed var(--zh-border-light);

  &__l { font-size: 11px; color: var(--zh-text-secondary); }
  &__v { font-size: 28px; font-weight: 800; color: var(--zh-primary); line-height: 1; }
  &__u { font-size: 11px; color: var(--zh-text-secondary); }
  &__r {
    margin-left: auto; padding: 2px 7px; border-radius: 3px;
    background: var(--zh-danger); color: #fff; font-size: 10px; font-weight: 700;
  }
}

.txt-box {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: 11px; line-height: 1.9; color: var(--zh-text-regular);
}

.rs-box {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
}

.rs-row {
  display: flex; gap: 9px; font-size: 11px; line-height: 2;
  & + & { margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--zh-border-light); }
  &__k { flex-shrink: 0; width: 60px; color: var(--zh-text-secondary); }
  &__v { flex: 1; color: var(--zh-text-regular); }
}

.dim-list { display: flex; flex-direction: column; gap: 10px; }

.dim {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__h { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
  &__n { font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__s { margin-left: auto; font-size: 15px; font-weight: 800; }
  &__c { margin-top: 5px; font-size: 10px; color: var(--zh-text-secondary); }
}

.pb-list, .sg-list {
  margin: 0; padding-left: 20px;
  font-size: 11px; line-height: 2; color: var(--zh-text-regular);
}
.pb-list li { color: var(--zh-danger); }
.sg-list li { color: var(--zh-success); }

.mf-card {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-purple-light); border: 1px solid var(--zh-purple);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-purple); }
    b { color: var(--zh-text-primary); }
  }
  &__c { margin-top: 7px; font-size: 11px; line-height: 1.85; color: var(--zh-text-regular); }
  &__f {
    display: flex; align-items: flex-start; gap: 5px; margin-top: 8px;
    padding-top: 7px; border-top: 1px dashed rgba(114, 46, 209, .25);
    font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-purple); flex-shrink: 0; margin-top: 2px; }
  }
}

/* ---------- OCR ---------- */
.ocr-box {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__s { display: flex; gap: 6px; flex-wrap: wrap; }
}

.ocr-res {
  margin-top: 11px; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-success); }
    b { color: var(--zh-text-primary); }
  }
}

.ocr-row {
  display: flex; gap: 9px; margin-top: 5px; font-size: 11px;
  &__k { flex-shrink: 0; width: 62px; color: var(--zh-text-secondary); }
  &__v { flex: 1; color: var(--zh-text-regular); }
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
