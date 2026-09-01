<script setup lang="ts">
import {
  getDocStats, getDocList, getDocDetail, generateDoc, runAiWrite, getAiWriting,
  reviewAiDraft, getDocNoStats, preOccupyDocNo, voidDocNo,
  getBatchList, getBatchDetail, createBatch, batchReview, batchExport,
  getTemplateList
} from '@/api/agent04-doc/docgen'
import { fmtMoney, CHART_GRID } from '@/utils/format'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('workbench')

/* ---------- M03 文书列表 ---------- */
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', docType: '', status: '', district: '', aiOnly: '', page: 1, pageSize: 15 })

const STATUS_TONE: Record<string, string> = {
  草稿: 'info', 待校对: 'warning', 校对完成: 'primary', 待签章: 'warning', 签章中: 'primary',
  已签章: 'success', 待送达: 'warning', 已送达: 'success', 已签收: 'success', 已归档: 'success', 已作废: 'danger'
}

async function loadStats() { st.value = await getDocStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getDocList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', docType: '', status: '', district: '', aiOnly: '', page: 1 })
  load()
}

/* ---------- 文书详情 + AI 撰写 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const detailLoading = ref(false)
const docTab = ref('fill')
const aiData = ref<any>(null)

async function openDetail(row: any) {
  drawer.value = true
  detailLoading.value = true
  docTab.value = 'fill'
  aiData.value = null
  try {
    cur.value = await getDocDetail(row.documentId)
    if (cur.value?.aiGenerated) aiData.value = await getAiWriting(cur.value.documentId)
  } finally { detailLoading.value = false }
}

const aiRunning = ref(false)
async function doAiWrite() {
  if (!cur.value) return
  aiRunning.value = true
  try {
    aiData.value = await runAiWrite({ documentId: cur.value.documentId })
    msg.success(`AI 撰写完成，综合质量得分 ${aiData.value?.qualityScore?.overall} 分`)
    docTab.value = 'ai'
  } finally { aiRunning.value = false }
}

const reviewing = ref(false)
async function doReviewAi(result: string) {
  reviewing.value = true
  try {
    const res: any = await reviewAiDraft({ documentId: cur.value.documentId, result })
    msg.success(res?.message || '已审核')
    await load()
  } finally { reviewing.value = false }
}

/* ---------- 新建文书 ---------- */
const genVisible = ref(false)
const generating = ref(false)
const templates = ref<any[]>([])
const genForm = reactive({ templateId: '', caseId: '', orgName: '', aiWrite: true })

async function openGen() {
  if (!templates.value.length) {
    const res: any = await getTemplateList({ page: 1, pageSize: 30 })
    templates.value = res?.list || []
  }
  Object.assign(genForm, { templateId: templates.value[0]?.templateId || '', caseId: '', orgName: '', aiWrite: true })
  genVisible.value = true
}

async function doGen() {
  if (!genForm.templateId) { msg.warning('请选择文书模板'); return }
  if (!genForm.orgName.trim()) { msg.warning('请填写被检机构'); return }
  generating.value = true
  try {
    const res: any = await generateDoc(genForm)
    msg.success(`${res?.message || '已生成'}，文号 ${res?.docNo}`)
    genVisible.value = false
    await Promise.all([loadStats(), load()])
  } finally { generating.value = false }
}

/* ---------- M05 文号管理 ---------- */
const noStats = ref<any>(null)
const noLoading = ref(false)
async function loadNo() {
  noLoading.value = true
  try { noStats.value = await getDocNoStats() } finally { noLoading.value = false }
}

const preVisible = ref(false)
const preForm = reactive({ docType: '' })
const preRes = ref<any>(null)
async function doPreOccupy() {
  if (!preForm.docType) { msg.warning('请选择文书类型'); return }
  preRes.value = await preOccupyDocNo(preForm)
  msg.success(preRes.value?.message || '已预占')
  await loadNo()
}

async function doVoid(row: any) {
  await ElMessageBox.confirm(
    `确认作废文号 ${row.docNo}？作废后该号段不回收，以避免重号。`, '文号作废',
    { type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消' }
  ).then(async () => {
    const res: any = await voidDocNo({ docNo: row.docNo })
    msg.success(res?.message || '已作废')
    await loadNo()
  }).catch(() => undefined)
}

/* ---------- M06 批量生成 ---------- */
const batchList = ref<any[]>([])
const batchTotal = ref(0)
const batchLoading = ref(false)
const batchQ = reactive({ keyword: '', status: '', documentType: '', page: 1, pageSize: 10 })

async function loadBatch() {
  batchLoading.value = true
  try {
    const res: any = await getBatchList(batchQ)
    batchList.value = res?.list || []
    batchTotal.value = res?.total || 0
  } finally { batchLoading.value = false }
}

const batchDrawer = ref(false)
const curBatch = ref<any>(null)
async function openBatch(row: any) {
  batchDrawer.value = true
  curBatch.value = await getBatchDetail(row.batchId)
}

const bcVisible = ref(false)
const bcRunning = ref(false)
const bcForm = reactive({ batchName: '', documentType: '检查通知书', templateId: 'TPL001', taskIds: [] as string[] })
const BATCH_SCENES = [
  { name: '专项检查批量派发（检查通知书）', docType: '检查通知书', tpl: 'TPL001' },
  { name: '同类违规批量整改（整改意见书）', docType: '整改意见书', tpl: 'TPL010' },
  { name: '多线索结果批量告知（结果告知书）', docType: '结果告知书', tpl: 'TPL007' },
  { name: '批量约谈通知（约谈通知书）', docType: '约谈通知书', tpl: 'TPL011' }
]
const bcTaskCount = ref(8)

function openBc() {
  Object.assign(bcForm, { batchName: BATCH_SCENES[0].name, documentType: BATCH_SCENES[0].docType, templateId: BATCH_SCENES[0].tpl })
  bcTaskCount.value = 8
  bcVisible.value = true
}

function onSceneChange(name: string) {
  const s = BATCH_SCENES.find((x) => x.name === name)
  if (s) { bcForm.documentType = s.docType; bcForm.templateId = s.tpl }
}

async function doBatchCreate() {
  bcRunning.value = true
  try {
    const res: any = await createBatch({
      ...bcForm,
      taskIds: Array.from({ length: bcTaskCount.value }, (_, i) => `TASK202608${String(i + 1).padStart(3, '0')}`)
    })
    msg.success(res?.message || '批量生成完成')
    bcVisible.value = false
    await loadBatch()
  } finally { bcRunning.value = false }
}

async function doBatchReview() {
  if (!curBatch.value) return
  const res: any = await batchReview({ batchId: curBatch.value.batchId, documentIds: curBatch.value.generatedDocuments.map((d: any) => d.documentId) })
  msg.success(res?.message || '批量审核完成')
  curBatch.value.reviewedCount = curBatch.value.successCount
}

async function doBatchExport() {
  if (!curBatch.value) return
  const res: any = await batchExport({ batchId: curBatch.value.batchId })
  msg.success(res?.message || '已导出')
}

/* ---------- 产线工位（3.2 生成链路可视化） ---------- */
const pipeStages = computed(() => {
  const by = (n: string) => (st.value?.docByStatus || []).find((s: any) => s.name === n)?.value || 0
  const drafting = by('草稿')
  const proof = by('待校对')
  const proofDone = by('校对完成')
  const sign = by('待签章') + by('签章中')
  const deliver = by('待送达') + by('已送达') + by('已签收')
  const archived = by('已归档')
  return [
    { key: '草稿', name: '数据填充', count: drafting, icon: 'Coin', tone: 'info' as const, note: '5 源自动提取' },
    { key: '待校对', name: 'AI 撰写', count: proof, icon: 'MagicStick', tone: 'purple' as const, note: '五段成文', bottleneck: proof > proofDone * 1.5 },
    { key: '校对完成', name: '智能校对', count: proofDone, icon: 'DocumentChecked', tone: 'primary' as const, note: '四重校验' },
    { key: '待签章', name: '逐级签章', count: sign, icon: 'Stamp', tone: 'warning' as const, note: '四级用印' },
    { key: '已送达', name: '多渠道送达', count: deliver, icon: 'Promotion', tone: 'accent' as const, note: '7 渠道' },
    { key: '已归档', name: '案卷归档', count: archived, icon: 'Box', tone: 'success' as const, note: '9 类目录' }
  ]
})

function pickStage(key: string) {
  q.status = q.status === key ? '' : key
  q.page = 1
  load()
}

/* ---------- 图表 ---------- */
/** AI 渗透率仪表 + 质量分：双环仪表盘 */
const aiGaugeOption = computed(() => {
  const rate = st.value?.aiRate || 0
  const qua = st.value?.avgQuality || 0
  return {
    series: [
      {
        type: 'gauge', startAngle: 210, endAngle: -30,
        center: ['50%', '56%'], radius: '86%',
        min: 0, max: 100, splitNumber: 5,
        progress: { show: true, width: 13, roundCap: true, itemStyle: { color: '#722ed1' } },
        axisLine: { lineStyle: { width: 13, color: [[1, '#efe6fb']] } },
        pointer: { show: false },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '30%'], fontSize: 10, color: '#6b7a90' },
        detail: {
          valueAnimation: true, offsetCenter: [0, '-4%'],
          formatter: '{value}%', fontSize: 26, fontWeight: 800, color: '#722ed1'
        },
        data: [{ value: Number(rate.toFixed?.(1) ?? rate), name: 'AI 撰写渗透率' }]
      },
      {
        type: 'gauge', startAngle: 210, endAngle: -30,
        center: ['50%', '56%'], radius: '64%',
        min: 0, max: 100,
        progress: { show: true, width: 8, roundCap: true, itemStyle: { color: '#12a150' } },
        axisLine: { lineStyle: { width: 8, color: [[1, '#e7f8ee']] } },
        pointer: { show: false }, axisTick: { show: false },
        splitLine: { show: false }, axisLabel: { show: false }, anchor: { show: false },
        title: { show: true, offsetCenter: [0, '62%'], fontSize: 10, color: '#6b7a90' },
        detail: {
          valueAnimation: true, offsetCenter: [0, '44%'],
          formatter: '{value} 分', fontSize: 13, fontWeight: 700, color: '#12a150'
        },
        data: [{ value: Number(qua.toFixed?.(1) ?? qua), name: 'AI 平均质量' }]
      }
    ]
  }
})

/** 文书类型：树图（矩形面积=份数，比饼图承载更多类型） */
const typeOption = computed(() => {
  const d = (st.value?.docByType || []).slice(0, 14)
  const cs = ['#1668dc', '#3c88ff', '#13c2c2', '#12a150', '#4cc38a', '#e8a30c',
    '#f0a92c', '#c8161d', '#e5484d', '#722ed1', '#9254de', '#5a7189', '#8195ad', '#0f8b8b']
  return {
    tooltip: { formatter: (p: any) => `${p.name}<br/>${p.value} 份` },
    series: [{
      type: 'treemap',
      roam: false, nodeClick: false,
      breadcrumb: { show: false },
      width: '100%', height: '100%', top: 2, left: 2, right: 2, bottom: 2,
      itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2, borderRadius: 3 },
      label: {
        show: true, fontSize: 10, color: '#fff', fontWeight: 600,
        formatter: (p: any) => (p.value >= 12 ? `${p.name}\n${p.value}` : ''),
        lineHeight: 13
      },
      data: d.map((i: any, idx: number) => ({
        name: i.name, value: i.value, itemStyle: { color: cs[idx % cs.length] }
      }))
    }]
  }
})

const trendOption = computed(() => {
  const d = st.value?.monthTrend || []
  return {
    color: ['#1668dc', '#e8a30c', '#13c2c2', '#722ed1'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['生成', '签章', '送达', '归档'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 42, bottom: 28, top: 34 },
    xAxis: {
      type: 'category', boundaryGap: false, data: d.map((i: any) => i.month.slice(5) + '月'),
      axisLabel: { fontSize: 10, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    series: ['generated', 'signed', 'delivered', 'archived'].map((k, i) => ({
      name: ['生成', '签章', '送达', '归档'][i],
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
      stack: 'tot', areaStyle: { opacity: .28 },
      emphasis: { focus: 'series' },
      lineStyle: { width: 1.6 },
      data: d.map((x: any) => x[k])
    }))
  }
})

const qualityOption = computed(() => {
  const s = aiData.value?.qualityScore
  if (!s) return {}
  const dims = [
    { name: '完整性', value: s.completeness }, { name: '规范性', value: s.standardization },
    { name: '逻辑性', value: s.logic }, { name: '法律准确性', value: s.legalAccuracy }
  ]
  return {
    tooltip: { trigger: 'item' },
    radar: {
      indicator: dims.map((d) => ({ name: d.name, max: 100 })),
      radius: '64%', center: ['50%', '52%'],
      axisName: { fontSize: 10, color: '#43516b' },
      splitLine: { lineStyle: { color: '#eef1f7' } },
      splitArea: { areaStyle: { color: ['#fff', '#f8fafd'] } },
      axisLine: { lineStyle: { color: '#e2e8f2' } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: dims.map((d) => d.value), name: 'AI 质量',
        areaStyle: { color: 'rgba(114, 46, 209, .18)' },
        lineStyle: { color: '#722ed1', width: 2 },
        itemStyle: { color: '#722ed1' },
        label: { show: true, fontSize: 10, fontWeight: 700 }
      }]
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'docno' && !noStats.value) loadNo()
  else if (v === 'batch' && !batchList.value.length) loadBatch()
})

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="文书智能生成" tag="M26"
      subtitle="数据自动填充 · AI 辅助撰写 · 文号自动生成 · 批量生成">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Files'" @click="activeTab = 'batch'; loadBatch()">批量生成</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openGen">新建文书</el-button>
      </template>
    </PageHeader>

    <!-- ============ 文书产线：传送带式流程 ============ -->
    <div class="section-card section-card--tight line-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">文书生产线实时工位</span>
        <span class="section-title__desc">点击工位可按该状态筛选；红圈呼吸表示该工位积压形成瓶颈</span>
        <span class="section-title__extra">
          <span class="line-sum">
            在制 <b class="num">{{ st?.docTotal || 0 }}</b> 份 ·
            填充完整率 <b class="num">{{ (st?.fillCompleteRate || 0).toFixed(1) }}%</b>
          </span>
        </span>
      </div>
      <DocPipeline :stages="pipeStages" :active="q.status" @pick="pickStage" />
    </div>

    <el-tabs v-model="activeTab" class="dg-tabs">
      <!-- ============ 文书生成工作台（M03/M04） ============ -->
      <el-tab-pane label="文书生成工作台" name="workbench">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">AI 渗透与质量双环</span>
            </div>
            <EChart :option="aiGaugeOption" height="214px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">文书类型矩阵</span>
              <span class="section-title__desc">面积即份数</span>
            </div>
            <EChart :option="typeOption" height="214px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">生成 · 签章 · 送达 · 归档堆叠趋势</span>
            </div>
            <EChart :option="trendOption" height="214px" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">文书查询</span>
            <span class="section-title__desc">支持文书编号 / 文号 / 名称 / 机构 / 案件号检索</span>
          </div>
          <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="q.keyword" placeholder="文书编号/文号/名称/机构" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
            </el-form-item>
            <el-form-item label="文书类型">
              <el-select v-model="q.docType" placeholder="全部类型" clearable filterable>
                <el-option v-for="t in (st?.docByType || [])" :key="t.name" :label="t.name" :value="t.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="文书状态">
              <el-select v-model="q.status" placeholder="全部状态" clearable>
                <el-option v-for="s in (st?.docByStatus || [])" :key="s.name" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="生成方式">
              <el-select v-model="q.aiOnly" placeholder="全部" clearable>
                <el-option label="仅看 AI 撰写" value="true" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
            </div>
          </el-form>
        </div>

        <div class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'Plus'" @click="openGen">新建文书</el-button>
            <span class="text-mini">共 {{ total }} 份文书</span>
            <div class="table-toolbar__right">
              <el-button :icon="'Download'" @click="msg.success('文书台账已导出，正在下载')">导出台账</el-button>
            </div>
          </div>

          <el-table :data="list" size="small" border stripe v-loading="loading">
            <el-table-column prop="docNo" label="文号" width="164">
              <template #default="{ row }">
                <span class="num text-link" @click="openDetail(row)">{{ row.docNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="documentName" label="文书名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="docType" label="文书类型" width="122" align="center">
              <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.docType }}</el-tag></template>
            </el-table-column>
            <el-table-column label="生成方式" width="120" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.aiGenerated" size="small" type="primary" effect="dark">
                  <el-icon :size="10"><MagicStick /></el-icon> AI 撰写
                </el-tag>
                <el-tag v-else size="small" effect="plain">自动填充</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="填充" width="94" align="center">
              <template #default="{ row }">
                <el-tag :type="row.fillValidation.status === '填充完整' ? 'success' : 'danger'" size="small" effect="plain">
                  {{ row.fillValidation.filledFields }}/{{ row.fillValidation.totalFields }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="AI 质量" width="86" align="center">
              <template #default="{ row }">
                <span v-if="row.qualityScore" class="num" :style="{ color: row.qualityScore.overall >= 92 ? 'var(--zh-success)' : 'var(--zh-warning)', fontWeight: 700 }">
                  {{ row.qualityScore.overall }}
                </span>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="校对" width="112" align="center">
              <template #default="{ row }">
                <template v-if="row.proofread">
                  <el-tag v-if="row.proofread.errors" size="small" type="danger" effect="dark">{{ row.proofread.errors }} 错</el-tag>
                  <el-tag v-else-if="row.proofread.warnings" size="small" type="warning" effect="dark">{{ row.proofread.warnings }} 警</el-tag>
                  <el-tag v-else size="small" type="success" effect="dark">通过</el-tag>
                </template>
                <span v-else class="text-muted">未校对</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="92" align="center">
              <template #default="{ row }">
                <el-tag :type="(STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="orgName" label="被检机构" min-width="164" show-overflow-tooltip />
            <el-table-column prop="generateTime" label="生成时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.generateTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openDetail(row)">办理</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无符合条件的文书" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ total }} 条</span>
            <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
              :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 文号管理（M05） ============ -->
      <el-tab-pane label="文号管理" name="docno">
        <div class="section-card" v-loading="noLoading">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">文号号段管理</span>
            <span class="section-title__desc">
              格式：机关代字 + 文书类型代字 +〔年份〕+ 流水号；按「类型 + 年度」独立编号，从 001 起连续不重不漏
            </span>
            <span class="section-title__extra">
              <el-button size="small" type="primary" :icon="'Ticket'" @click="preVisible = true">预占文号</el-button>
            </span>
          </div>

          <el-table :data="noStats?.stats || []" size="small" border stripe max-height="420">
            <el-table-column prop="docType" label="文书类型" min-width="152" />
            <el-table-column prop="docTypeCode" label="代字" width="84" align="center">
              <template #default="{ row }"><el-tag size="small" effect="dark">{{ row.docTypeCode }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="format" label="文号格式" min-width="196">
              <template #default="{ row }"><span class="num text-mini">{{ row.format }}</span></template>
            </el-table-column>
            <el-table-column prop="totalGenerated" label="已生成" width="86" align="right">
              <template #default="{ row }"><span class="num">{{ row.totalGenerated }}</span></template>
            </el-table-column>
            <el-table-column prop="effective" label="已生效" width="86" align="right">
              <template #default="{ row }">
                <span class="num" style="color: var(--zh-success); font-weight: 700">{{ row.effective }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="void" label="已作废" width="86" align="right">
              <template #default="{ row }">
                <span v-if="row.void" class="num" style="color: var(--zh-danger); font-weight: 700">{{ row.void }}</span>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="currentMaxSerialNo" label="当前最大号" width="104" align="center">
              <template #default="{ row }"><span class="num">{{ row.currentMaxSerialNo }}</span></template>
            </el-table-column>
            <el-table-column prop="nextSerialNo" label="下一可用号" width="106" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="primary" effect="plain">{{ row.nextSerialNo }}</el-tag>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无号段数据" height="130px" /></template>
          </el-table>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">作废文号记录</span>
            <span class="section-title__desc">文号生成后即占用，即使文书作废也不回收，避免重号</span>
          </div>
          <el-table :data="noStats?.voidRecords || []" size="small" border stripe max-height="330">
            <el-table-column prop="docNo" label="作废文号" width="176">
              <template #default="{ row }"><span class="num">{{ row.docNo }}</span></template>
            </el-table-column>
            <el-table-column prop="docType" label="文书类型" width="132" align="center" />
            <el-table-column prop="reason" label="作废原因" min-width="230" show-overflow-tooltip />
            <el-table-column prop="operator" label="操作人" width="134" />
            <el-table-column prop="voidTime" label="作废时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.voidTime }}</span></template>
            </el-table-column>
            <template #empty><EmptyState text="暂无作废记录" height="120px" /></template>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ============ 批量生成（M06） ============ -->
      <el-tab-pane label="批量生成" name="batch">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">批量生成任务</span>
            <span class="section-title__desc">
              支持专项检查批量派发、同类违规批量整改、多线索批量告知、批量约谈；数据不完整的案件自动跳过
            </span>
            <span class="section-title__extra">
              <el-button size="small" type="primary" :icon="'Plus'" @click="openBc">新建批量任务</el-button>
            </span>
          </div>

          <el-form class="query-form" :model="batchQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="batchQ.keyword" placeholder="批次编号/名称" clearable :prefix-icon="'Search'"
                @keyup.enter="batchQ.page = 1; loadBatch()" />
            </el-form-item>
            <el-form-item label="批次状态">
              <el-select v-model="batchQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['已完成', '生成中', '部分失败']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="batchQ.page = 1; loadBatch()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(batchQ, { keyword: '', status: '', documentType: '', page: 1 }); loadBatch()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="batchList" size="small" border stripe v-loading="batchLoading">
            <el-table-column prop="batchId" label="批次编号" width="164">
              <template #default="{ row }">
                <span class="num text-link" @click="openBatch(row)">{{ row.batchId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="batchName" label="批次名称" min-width="218" show-overflow-tooltip />
            <el-table-column prop="documentType" label="文书类型" width="124" align="center">
              <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.documentType }}</el-tag></template>
            </el-table-column>
            <el-table-column label="生成结果" width="152">
              <template #default="{ row }">
                <div class="bt-res">
                  <span class="bt-res__ok">成功 <b class="num">{{ row.successCount }}</b></span>
                  <span v-if="row.failCount" class="bt-res__no">失败 <b class="num">{{ row.failCount }}</b></span>
                </div>
                <el-progress :percentage="Math.round((row.successCount / row.totalSelected) * 100)"
                  :stroke-width="6" :show-text="false"
                  :status="row.failCount ? 'warning' : 'success'" />
              </template>
            </el-table-column>
            <el-table-column label="已审核" width="94" align="center">
              <template #default="{ row }">
                <span class="num text-mini">{{ row.reviewedCount }}/{{ row.successCount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="94" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '已完成' ? 'success' : row.status === '部分失败' ? 'warning' : 'primary'" size="small" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="creator" label="创建人" width="132" />
            <el-table-column prop="createTime" label="创建时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.createTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openBatch(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无批量任务" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ batchTotal }} 个批次</span>
            <el-pagination v-model:current-page="batchQ.page" v-model:page-size="batchQ.pageSize" :total="batchTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadBatch" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 文书详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="740px" title="文书生成与 AI 撰写">
      <template v-if="cur">
        <div v-loading="detailLoading">
          <div class="dc-hero">
            <div class="dc-hero__t">
              {{ cur.documentName }}
              <el-tag :type="(STATUS_TONE[cur.status] as any) || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              <el-tag v-if="cur.aiGenerated" size="small" type="primary" effect="light">AI 撰写</el-tag>
            </div>
            <div class="dc-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ cur.docNo }}</span>
              <span><el-icon><Document /></el-icon>{{ cur.documentId }}</span>
              <span><el-icon><Files /></el-icon>{{ cur.templateName }}（{{ cur.templateId }}）</span>
              <span><el-icon><OfficeBuilding /></el-icon>{{ cur.orgName }}</span>
              <span><el-icon><Clock /></el-icon>{{ cur.generateTime }}</span>
            </div>
          </div>

          <el-tabs v-model="docTab" class="dc-tabs">
            <!-- 数据填充 -->
            <el-tab-pane label="数据自动填充" name="fill">
              <div class="fill-bar" :class="cur.fillValidation.status === '填充完整' ? 'is-ok' : 'is-no'">
                <el-icon><component :is="cur.fillValidation.status === '填充完整' ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
                <b>{{ cur.fillValidation.status }}</b>
                <span>已填充 {{ cur.fillValidation.filledFields }} / {{ cur.fillValidation.totalFields }} 个字段</span>
                <el-tag v-if="cur.fillValidation.missingFields.length" size="small" type="danger" effect="dark">
                  缺失 {{ cur.fillValidation.missingFields.length }} 项
                </el-tag>
              </div>

              <div v-if="cur.fillValidation.missingFields.length" class="miss-box">
                <div class="miss-box__t"><el-icon><WarningFilled /></el-icon>缺失字段（需人工补录）</div>
                <div class="miss-box__l">
                  <el-tag v-for="m in cur.fillValidation.missingFields" :key="m" size="small" type="danger" effect="dark" class="mr4">
                    {{ m }}
                  </el-tag>
                </div>
              </div>

              <div class="sub-title">数据来源（5 类自动提取）</div>
              <div class="src-grid">
                <div class="src is-primary">
                  <el-icon class="src__i"><Files /></el-icon>
                  <div class="src__b"><div class="src__n">任务信息</div><div class="src__v">{{ cur.taskId }}</div></div>
                </div>
                <div class="src is-danger">
                  <el-icon class="src__i"><Tickets /></el-icon>
                  <div class="src__b"><div class="src__n">违规确认</div><div class="src__v">{{ cur.caseId }}</div></div>
                </div>
                <div class="src is-warning">
                  <el-icon class="src__i"><Stamp /></el-icon>
                  <div class="src__b"><div class="src__n">处置决定</div><div class="src__v">已关联</div></div>
                </div>
                <div class="src is-accent">
                  <el-icon class="src__i"><OfficeBuilding /></el-icon>
                  <div class="src__b"><div class="src__n">机构信息</div><div class="src__v">{{ cur.orgCode }}</div></div>
                </div>
                <div class="src is-purple">
                  <el-icon class="src__i"><User /></el-icon>
                  <div class="src__b"><div class="src__n">人员信息</div><div class="src__v">已关联</div></div>
                </div>
              </div>

              <div class="sub-title">金额自动核算与大写转换</div>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="违规金额">
                  <span class="num num--money">{{ fmtMoney(cur.amount.violationAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="涉及医保基金">
                  <span class="num num--money">{{ fmtMoney(cur.amount.fundAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="罚款金额">
                  <span class="num num--money">{{ cur.amount.penaltyAmount ? fmtMoney(cur.amount.penaltyAmount) : '—' }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="合计">
                  <span class="num num--money">{{ fmtMoney(cur.amount.totalAmount) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="金额大写（自动转换）" :span="2">
                  <b style="color: var(--zh-danger)">{{ cur.amount.totalAmountInWords }}</b>
                </el-descriptions-item>
              </el-descriptions>

              <div class="tab-actions">
                <el-button type="primary" :icon="'MagicStick'" :loading="aiRunning" @click="doAiWrite">
                  {{ aiRunning ? 'AI 撰写中…' : (cur.aiGenerated ? '重新运行 AI 撰写' : '运行 AI 撰写') }}
                </el-button>
              </div>
            </el-tab-pane>

            <!-- AI 撰写 -->
            <el-tab-pane label="AI 辅助撰写" name="ai">
              <template v-if="aiData">
                <div class="ai-top">
                  <div class="ai-score">
                    <div class="ai-score__v num">{{ aiData.qualityScore.overall }}</div>
                    <div class="ai-score__l">综合质量</div>
                  </div>
                  <div class="ai-radar"><EChart :option="qualityOption" height="176px" /></div>
                </div>
                <div class="ai-meta">
                  <el-icon><MagicStick /></el-icon>
                  模型 {{ aiData.modelVersion }} · 生成时间 <span class="num">{{ aiData.generateTime }}</span>
                </div>

                <div class="sub-title">AI 撰写正文（五段结构：事实 → 证据 → 依据 → 决定 → 权利）</div>
                <div class="para-list">
                  <div v-for="(k, i) in ['violationFactsParagraph', 'evidenceParagraph', 'legalBasisParagraph', 'decisionParagraph', 'rightsParagraph']" :key="k" class="para">
                    <div class="para__h">
                      <span class="para__no num">{{ i + 1 }}</span>
                      {{ ['违规事实描述', '证据列举', '法律适用', '处罚裁量', '权利告知'][i] }}
                    </div>
                    <div class="para__c">{{ aiData.generatedContent[k] }}</div>
                  </div>
                </div>

                <template v-if="aiData.manualReview">
                  <div class="sub-title">人工审核与修改留痕</div>
                  <div class="rv-card">
                    <div class="rv-card__h">
                      <el-icon><UserFilled /></el-icon>
                      <b>{{ aiData.manualReview.reviewer }}</b>
                      <el-tag :type="aiData.manualReview.result.includes('修改') ? 'warning' : 'success'" size="small" effect="dark">
                        {{ aiData.manualReview.result }}
                      </el-tag>
                      <span class="rv-card__t num">{{ aiData.manualReview.reviewTime }}</span>
                    </div>
                    <div class="rv-card__c">{{ aiData.manualReview.comment }}</div>
                  </div>

                  <el-table :data="aiData.manualReview.modifications" size="small" border stripe class="mt8">
                    <el-table-column prop="location" label="修改位置" width="140" />
                    <el-table-column prop="original" label="修改前" min-width="180" show-overflow-tooltip>
                      <template #default="{ row }"><span class="diff-old">{{ row.original }}</span></template>
                    </el-table-column>
                    <el-table-column prop="modified" label="修改后" min-width="200" show-overflow-tooltip>
                      <template #default="{ row }"><span class="diff-new">{{ row.modified }}</span></template>
                    </el-table-column>
                    <el-table-column prop="reason" label="修改原因" min-width="160" show-overflow-tooltip />
                  </el-table>
                </template>

                <div class="tab-actions">
                  <el-button type="success" :icon="'CircleCheck'" :loading="reviewing" @click="doReviewAi('通过')">
                    审核通过
                  </el-button>
                  <el-button type="warning" :icon="'EditPen'" :loading="reviewing" @click="doReviewAi('通过（有修改）')">
                    修改后通过
                  </el-button>
                  <el-button type="danger" :icon="'RefreshLeft'" :loading="reviewing" @click="doReviewAi('退回修改')">
                    退回修改
                  </el-button>
                </div>

                <el-alert type="warning" :closable="false" show-icon class="mt12">
                  <template #title>
                    <span class="text-mini">AI 生成初稿必须经人工审核确认方可进入下一环节；人工修改的优质表述将回流模型持续优化</span>
                  </template>
                </el-alert>
              </template>
              <template v-else>
                <EmptyState text="尚未运行 AI 撰写" height="180px" />
                <div class="tab-actions">
                  <el-button type="primary" :icon="'MagicStick'" :loading="aiRunning" @click="doAiWrite">运行 AI 撰写</el-button>
                </div>
              </template>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 批量详情抽屉 ============ -->
    <el-drawer v-model="batchDrawer" size="660px" title="批量生成详情">
      <template v-if="curBatch">
        <div class="dc-hero">
          <div class="dc-hero__t">
            {{ curBatch.batchName }}
            <el-tag :type="curBatch.status === '已完成' ? 'success' : curBatch.status === '部分失败' ? 'warning' : 'primary'" size="small" effect="dark">
              {{ curBatch.status }}
            </el-tag>
          </div>
          <div class="dc-hero__m">
            <span><el-icon><Files /></el-icon>{{ curBatch.batchId }}</span>
            <span><el-icon><Document /></el-icon>{{ curBatch.documentType }}</span>
            <span><el-icon><User /></el-icon>{{ curBatch.creator }}</span>
            <span><el-icon><Clock /></el-icon>{{ curBatch.createTime }}</span>
          </div>
        </div>

        <div class="bt-kpi">
          <div class="bt-kpi__c"><div class="bt-kpi__v num">{{ curBatch.totalSelected }}</div><div class="bt-kpi__l">选中案件</div></div>
          <div class="bt-kpi__c is-ok"><div class="bt-kpi__v num">{{ curBatch.successCount }}</div><div class="bt-kpi__l">生成成功</div></div>
          <div class="bt-kpi__c is-no"><div class="bt-kpi__v num">{{ curBatch.failCount }}</div><div class="bt-kpi__l">生成失败</div></div>
          <div class="bt-kpi__c"><div class="bt-kpi__v num">{{ curBatch.reviewedCount }}</div><div class="bt-kpi__l">已审核</div></div>
        </div>

        <div class="sub-title">已生成文书（文号连续编号）</div>
        <el-table :data="curBatch.generatedDocuments" size="small" border stripe max-height="240">
          <el-table-column prop="docNo" label="文号" width="176">
            <template #default="{ row }"><span class="num">{{ row.docNo }}</span></template>
          </el-table-column>
          <el-table-column prop="documentId" label="文书编号" width="150">
            <template #default="{ row }"><span class="num text-mini">{{ row.documentId }}</span></template>
          </el-table-column>
          <el-table-column prop="orgName" label="被检机构" min-width="180" show-overflow-tooltip />
          <template #empty><EmptyState text="暂无生成文书" height="100px" /></template>
        </el-table>

        <template v-if="curBatch.failDetails.length">
          <div class="sub-title">失败案件（数据不完整已跳过）</div>
          <div class="fail-list">
            <div v-for="(f, i) in curBatch.failDetails" :key="i" class="fail">
              <div class="fail__h">
                <el-icon><CircleCloseFilled /></el-icon>
                <b>{{ f.orgName }}</b>
                <span class="num text-mini">{{ f.taskId }}</span>
              </div>
              <div class="fail__r">失败原因：{{ f.reason }}</div>
              <div class="fail__s"><el-icon><InfoFilled /></el-icon>{{ f.suggestion }}</div>
            </div>
          </div>
        </template>

        <div class="dr-actions">
          <el-button type="primary" :icon="'CircleCheck'" @click="doBatchReview">批量审核</el-button>
          <el-button :icon="'Download'" @click="doBatchExport">批量导出（{{ curBatch.exportFormat }}）</el-button>
          <el-button :icon="'Printer'" @click="msg.success('已发送至打印队列')">批量打印</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 新建文书 ============ -->
    <el-dialog v-model="genVisible" title="新建文书" width="600px">
      <el-form label-width="94px">
        <el-form-item label="文书模板" required>
          <el-select v-model="genForm.templateId" filterable style="width: 100%">
            <el-option v-for="t in templates" :key="t.templateId"
              :label="`${t.templateName}（${t.templateId} · ${t.docTypeCode}）`" :value="t.templateId">
              <span>{{ t.templateName }}</span>
              <span class="text-mini" style="float: right">{{ t.categoryName }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="关联案件">
          <el-input v-model="genForm.caseId" placeholder="如：CASE202608150003（选填，将自动提取案件数据）" />
        </el-form-item>
        <el-form-item label="被检机构" required>
          <el-input v-model="genForm.orgName" placeholder="如：芜湖市第一人民医院" />
        </el-form-item>
        <el-form-item label="AI 撰写">
          <el-switch v-model="genForm.aiWrite" />
          <span class="text-mini ml8">开启后由 AI 撰写事实、证据、依据、决定、权利五段正文</span>
        </el-form-item>
        <el-form-item label="生成说明">
          <div class="gen-tip">
            <el-icon><InfoFilled /></el-icon>
            系统将自动从任务信息、违规确认、处置决定、机构信息、人员信息 5 类数据源提取字段填充至模板占位符，
            并自动完成金额大写转换、日期格式化与法条引用匹配；填充后自动校验必填项完整性。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genVisible = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="doGen">生成文书</el-button>
      </template>
    </el-dialog>

    <!-- ============ 预占文号 ============ -->
    <el-dialog v-model="preVisible" title="预占文号" width="520px">
      <el-alert type="info" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">文号生成后即预占，审核通过后正式生效，审核不通过将释放；作废文号不回收以避免重号</span>
        </template>
      </el-alert>
      <el-form label-width="94px">
        <el-form-item label="文书类型" required>
          <el-select v-model="preForm.docType" filterable placeholder="请选择文书类型" style="width: 100%">
            <el-option v-for="t in (noStats?.docTypeCodes || [])" :key="t.docType"
              :label="`${t.docType}（代字：${t.code}）`" :value="t.docType" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="preRes" label="预占结果">
          <div class="pre-res">
            <div class="pre-res__no num">{{ preRes.docNo }}</div>
            <el-tag size="small" type="warning" effect="dark">{{ preRes.status }}</el-tag>
            <div class="pre-res__t">预占时间：<span class="num">{{ preRes.preOccupyTime }}</span></div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="preVisible = false">关闭</el-button>
        <el-button type="primary" :icon="'Ticket'" @click="doPreOccupy">预占文号</el-button>
      </template>
    </el-dialog>

    <!-- ============ 新建批量任务 ============ -->
    <el-dialog v-model="bcVisible" title="新建批量生成任务" width="620px">
      <el-form label-width="100px">
        <el-form-item label="批量场景" required>
          <el-select v-model="bcForm.batchName" style="width: 100%" @change="onSceneChange">
            <el-option v-for="s in BATCH_SCENES" :key="s.name" :label="s.name" :value="s.name" />
          </el-select>
        </el-form-item>
        <div class="form-row">
          <el-form-item label="文书类型">
            <el-input v-model="bcForm.documentType" disabled />
          </el-form-item>
          <el-form-item label="使用模板">
            <el-input v-model="bcForm.templateId" disabled />
          </el-form-item>
        </div>
        <el-form-item label="选中案件数" required>
          <el-input-number v-model="bcTaskCount" :min="1" :max="30" :controls="false" style="width: 120px" />
          <span class="text-mini ml8">个案件将逐个自动填充生成，文号按顺序连续编号</span>
        </el-form-item>
        <el-form-item label="批量校验">
          <div class="gen-tip">
            <el-icon><InfoFilled /></el-icon>
            生成前将校验每个案件的数据完整性；数据不完整的案件会被标记并跳过，不影响其他案件生成，生成后汇总成功/失败数量。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bcVisible = false">取消</el-button>
        <el-button type="primary" :loading="bcRunning" @click="doBatchCreate">开始批量生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

/* ---------- 产线卡 ---------- */
.line-card {
  /* 车间地面质感：斜纹 + 顶部渐隐 */
  background:
    linear-gradient(180deg, rgba(22, 104, 220, .04), transparent 70px),
    repeating-linear-gradient(-45deg,
      rgba(226, 232, 242, .32) 0 8px, transparent 8px 16px),
    var(--zh-bg-card);
}

.line-sum {
  font-size: 11px; color: var(--zh-text-secondary);
  b { color: var(--zh-primary); font-size: 13px; font-weight: 800; }
}

.dg-tabs { margin-top: 12px; }

.chart-grid {
  display: grid; grid-template-columns: 240px 1fr 1.25fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1400px) { grid-template-columns: 240px 1fr; }
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

/* ---------- 批量结果 ---------- */
.bt-res {
  display: flex; gap: 9px; font-size: 10px; margin-bottom: 3px;
  &__ok { color: var(--zh-success); b { font-size: 12px; } }
  &__no { color: var(--zh-danger); b { font-size: 12px; } }
}

/* ---------- 详情 ---------- */
.dc-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

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

.dc-tabs { margin-top: 12px; }

/* ---------- 填充 ---------- */
.fill-bar {
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  padding: 9px 12px; border-radius: var(--zh-radius);
  font-size: var(--zh-font-xs);

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); :deep(.el-icon) { color: var(--zh-success); } }
  &.is-no { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); :deep(.el-icon) { color: var(--zh-danger); } }
  b { color: var(--zh-text-primary); }
  span { color: var(--zh-text-secondary); }
}

.miss-box {
  margin-top: 10px; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger);

  &__t {
    display: flex; align-items: center; gap: 5px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-danger);
  }
  &__l { margin-top: 7px; line-height: 2; }
}

.src-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  @media (max-width: 800px) { grid-template-columns: repeat(2, 1fr); }
}

.src {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--sc, var(--zh-primary));

  &.is-primary { --sc: var(--zh-primary); }
  &.is-danger { --sc: var(--zh-danger); }
  &.is-warning { --sc: var(--zh-warning); }
  &.is-accent { --sc: var(--zh-accent); }
  &.is-purple { --sc: var(--zh-purple); }

  &__i { font-size: 15px; color: var(--sc); flex-shrink: 0; }
  &__b { min-width: 0; }
  &__n { font-size: 10px; color: var(--zh-text-secondary); }
  &__v { font-size: 10px; color: var(--zh-text-primary); font-weight: 600; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* ---------- AI ---------- */
.ai-top {
  display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: center;
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-purple-light); border: 1px solid var(--zh-purple);
}

.ai-score {
  text-align: center;
  &__v { font-size: 34px; font-weight: 800; color: var(--zh-purple); line-height: 1.1; }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}

.ai-meta {
  display: flex; align-items: center; gap: 5px; margin-top: 9px;
  font-size: 10px; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-purple); }
}

.para-list { display: flex; flex-direction: column; gap: 9px; }

.para {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--zh-purple);

  &__h {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
  }
  &__no {
    width: 17px; height: 17px; flex-shrink: 0;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--zh-purple); color: #fff; font-size: 9px; font-weight: 700;
  }
  &__c { margin-top: 6px; font-size: 11px; line-height: 1.95; color: var(--zh-text-regular); text-align: justify; }
}

.rv-card {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-warning-light); border: 1px solid var(--zh-warning);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-warning); }
    b { color: var(--zh-text-primary); }
  }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
  &__c { margin-top: 6px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }
}

.diff-old { color: var(--zh-danger); text-decoration: line-through; }
.diff-new { color: var(--zh-success); font-weight: 600; }

.tab-actions {
  display: flex; gap: 8px; margin-top: 15px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 批量 ---------- */
.bt-kpi {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px;

  &__c {
    padding: 9px 6px; text-align: center; border-radius: 6px;
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
    border-top: 2px solid var(--bc, var(--zh-primary));
    &.is-ok { --bc: var(--zh-success); background: var(--zh-success-light); }
    &.is-no { --bc: var(--zh-danger); background: var(--zh-risk-high-bg); }
  }
  &__v { font-size: 18px; font-weight: 800; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}

.fail-list { display: flex; flex-direction: column; gap: 8px; }

.fail {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger);

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-danger); }
    b { color: var(--zh-text-primary); }
  }
  &__r { margin-top: 5px; font-size: 11px; color: var(--zh-text-regular); }
  &__s {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    padding-top: 5px; border-top: 1px dashed var(--zh-risk-high-border);
    font-size: 10px; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
  }
}

.gen-tip {
  display: flex; align-items: flex-start; gap: 5px;
  padding: 8px 10px; border-radius: 5px;
  background: var(--zh-info-light);
  font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
}

.pre-res {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-warning-light); border: 1px solid var(--zh-warning);

  &__no { font-size: 16px; font-weight: 800; color: var(--zh-text-primary); }
  &__t { margin-top: 5px; font-size: 10px; color: var(--zh-text-secondary); }
}
</style>
