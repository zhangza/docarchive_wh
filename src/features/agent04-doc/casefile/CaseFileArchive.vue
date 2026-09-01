<script setup lang="ts">
import {
  getCaseFileStats, getCaseFileList, getCaseFileDetail, assembleCaseFile, archiveCaseFile,
  getBorrowList, applyBorrow, approveBorrow, returnBorrow,
  getScanList, uploadScan
} from '@/api/agent04-doc/docgen'
import { CHART_GRID } from '@/utils/format'
import { exportCsv } from '@/utils/legalDoc'

const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('assemble')

async function loadStats() { st.value = await getCaseFileStats() }

/* ================= 案卷组装 / 档案检索 ================= */
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', status: '', district: '', page: 1, pageSize: 15 })

/** 视图模式：档案书架 / 明细表 */
const viewMode = ref<'shelf' | 'table'>('shelf')

const CF_TONE: Record<string, any> = {
  组装中: 'primary', 待归档: 'warning', 已归档: 'success', 已移交: 'info', 借出中: 'warning'
}

async function load() {
  loading.value = true
  try {
    const res: any = await getCaseFileList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', status: '', district: '', page: 1 })
  load()
}

const drawer = ref(false)
const cur = ref<any>(null)
const cfTab = ref('catalog')
async function openDetail(row: any) {
  drawer.value = true
  cfTab.value = 'catalog'
  cur.value = await getCaseFileDetail(row.caseFileId)
}

/* 案卷组装 */
const asmVisible = ref(false)
const asmRunning = ref(false)
const asmForm = reactive({ caseId: '', caseName: '', orgName: '' })
const asmRes = ref<any>(null)

function openAsm() {
  Object.assign(asmForm, { caseId: '', caseName: '', orgName: '' })
  asmRes.value = null
  asmVisible.value = true
}

async function doAsm() {
  if (!asmForm.caseId.trim()) { msg.warning('请填写案件编号'); return }
  asmRunning.value = true
  try {
    asmRes.value = await assembleCaseFile(asmForm)
    msg.success(`${asmRes.value.message}（${asmRes.value.materialCount} 项材料 / ${asmRes.value.totalPages} 页）`)
    await Promise.all([loadStats(), load()])
  } finally { asmRunning.value = false }
}

const archiving = ref(false)
async function doArchive(row: any) {
  await ElMessageBox.confirm(
    `确认将案卷「${row.caseName}」正式归档？归档后将分配纸质盒号与存放位置，按 ${row.retentionYears} 年保管期限管理。`,
    '案卷归档', { type: 'warning', confirmButtonText: '确认归档', cancelButtonText: '取消' }
  ).then(async () => {
    archiving.value = true
    try {
      const res: any = await archiveCaseFile({ caseFileId: row.caseFileId })
      msg.success(`${res.message}（盒号 ${res.paperBoxNo} · ${res.storageLocation}）`)
      await Promise.all([loadStats(), load()])
      if (drawer.value) cur.value = await getCaseFileDetail(row.caseFileId)
    } finally { archiving.value = false }
  }).catch(() => undefined)
}

function exportCatalog() {
  if (!cur.value) return
  exportCsv(
    `案卷目录_${cur.value.archiveNo}`,
    ['序号', '材料名称', '文号', '起始页', '终止页', '备注'],
    cur.value.catalog.map((c: any) => [c.seq, c.materialName, c.docNo || '—', c.pageFrom, c.pageTo, c.remark || ''])
  )
  msg.success('案卷目录已导出')
}

/* ================= 档案借阅 ================= */
const bList = ref<any[]>([])
const bTotal = ref(0)
const bLoading = ref(false)
const bQ = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })

const B_TONE: Record<string, any> = {
  审批中: 'warning', 已批准: 'primary', 借阅中: 'primary', 已归还: 'success', 已驳回: 'danger', 逾期未还: 'danger'
}

async function loadBorrow() {
  bLoading.value = true
  try {
    const res: any = await getBorrowList(bQ)
    bList.value = res?.list || []
    bTotal.value = res?.total || 0
  } finally { bLoading.value = false }
}

const bVisible = ref(false)
const bSaving = ref(false)
const bForm = reactive({ caseFileId: '', caseName: '', borrower: '', purpose: '', days: 15 })

function openBorrowDlg(row?: any) {
  Object.assign(bForm, {
    caseFileId: row?.caseFileId || '',
    caseName: row?.caseName || '',
    borrower: '', purpose: '', days: 15
  })
  bVisible.value = true
}

async function doBorrowApply() {
  if (!bForm.caseFileId.trim()) { msg.warning('请填写案卷编号'); return }
  if (!bForm.borrower.trim()) { msg.warning('请填写借阅人'); return }
  if (!bForm.purpose.trim()) { msg.warning('请填写借阅用途'); return }
  bSaving.value = true
  try {
    const res: any = await applyBorrow(bForm)
    msg.success(res?.message || '已提交申请')
    bVisible.value = false
    await loadBorrow()
  } finally { bSaving.value = false }
}

async function doApprove(row: any, result: string) {
  await ElMessageBox.confirm(
    result === '已批准'
      ? `确认批准「${row.borrower}」借阅案卷「${row.caseName}」？借阅期限 ${row.borrowDays || 15} 天。`
      : `确认驳回「${row.borrower}」的借阅申请？`,
    result === '已批准' ? '批准借阅' : '驳回申请',
    { type: result === '已批准' ? 'success' : 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }
  ).then(async () => {
    const res: any = await approveBorrow({ borrowId: row.borrowId, result })
    msg.success(res?.message || '已处理')
    await loadBorrow()
  }).catch(() => undefined)
}

async function doReturn(row: any) {
  const res: any = await returnBorrow({ borrowId: row.borrowId })
  msg.success(res?.message || '已归还')
  await loadBorrow()
}

/* ================= 纸质扫码入档 ================= */
const sList = ref<any[]>([])
const sTotal = ref(0)
const sLoading = ref(false)
const sQ = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })

async function loadScan() {
  sLoading.value = true
  try {
    const res: any = await getScanList(sQ)
    sList.value = res?.list || []
    sTotal.value = res?.total || 0
  } finally { sLoading.value = false }
}

const sVisible = ref(false)
const sRunning = ref(false)
const sForm = reactive({ scanId: '', barcodeNo: '', caseName: '' })
const sRes = ref<any>(null)

function openScanDlg(row?: any) {
  Object.assign(sForm, { scanId: row?.scanId || '', barcodeNo: row?.barcodeNo || '', caseName: row?.caseName || '' })
  sRes.value = null
  sVisible.value = true
}

async function doUploadScan() {
  if (!sForm.barcodeNo.trim()) { msg.warning('请扫描或输入条码编号'); return }
  sRunning.value = true
  try {
    sRes.value = await uploadScan(sForm)
    msg.success(`${sRes.value.message}（${sRes.value.scannedPages} 页 · OCR 准确率 ${sRes.value.ocrAccuracy}%）`)
    await Promise.all([loadStats(), loadScan()])
  } finally { sRunning.value = false }
}

/* ---------- 图表 ---------- */
const cfStatusOption = computed(() => {
  const d = st.value?.statusDist || []
  const colors: Record<string, string> = {
    组装中: '#3c88ff', 待归档: '#e8a30c', 已归档: '#12a150', 已移交: '#5a7189', 借出中: '#e8a30c'
  }
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 卷 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['44%', '66%'], center: ['50%', '42%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] || '#1668dc' } }))
    }]
  }
})

const archiveTrendOption = computed(() => {
  const d = st.value?.monthTrend || []
  return {
    color: ['#722ed1', '#12a150'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['归档', '送达'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 40, bottom: 26 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.month.slice(5) + '月'),
      axisLabel: { fontSize: 10, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    series: [
      { name: '归档', type: 'bar', barWidth: 14, itemStyle: { borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.archived) },
      { name: '送达', type: 'line', smooth: true, symbolSize: 5, data: d.map((i: any) => i.delivered) }
    ]
  }
})

const borrowOption = computed(() => {
  const d = st.value?.borrowStatusDist || []
  const colors: Record<string, string> = {
    审批中: '#e8a30c', 已批准: '#3c88ff', 借阅中: '#1668dc', 已归还: '#12a150', 已驳回: '#5a7189', 逾期未还: '#e5484d'
  }
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 74, right: 40, top: 8, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    yAxis: {
      type: 'category', data: d.map((i: any) => i.name).reverse(),
      axisLabel: { fontSize: 10, color: '#43516b' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barWidth: 13,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: (p: any) => colors[p.name] || '#1668dc' },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.value).reverse()
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'borrow' && !bList.value.length) loadBorrow()
  else if (v === 'scan' && !sList.value.length) loadScan()
})

onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="案卷归档" tag="M30"
      subtitle="案卷自动组装 · 档案检索调阅 · 借阅审批归还 · 纸质扫码入档 OCR 识别">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'FolderAdd'" @click="openAsm">案卷组装</el-button>
        <el-button type="primary" :icon="'Camera'" @click="activeTab = 'scan'; loadScan(); openScanDlg()">纸质扫码入档</el-button>
      </template>
    </PageHeader>

    <!-- 指标 -->
    <div class="kpi-grid">
      <StatCard label="案卷总数" :value="st?.caseFileTotal || 0" unit="卷" icon="FolderOpened" tone="primary" />
      <StatCard label="已归档" :value="st?.archivedCount || 0" unit="卷" icon="CircleCheck" tone="success" />
      <StatCard label="档案总页数" :value="st?.totalPages || 0" unit="页" icon="Document" tone="accent" />
      <StatCard label="纸质已扫描" :value="st?.scannedCount || 0" unit="卷" icon="Camera" tone="purple" />
      <StatCard label="借阅中" :value="st?.borrowing || 0" unit="件" icon="Reading" tone="warning" />
      <StatCard label="逾期未还" :value="st?.borrowOverdue || 0" unit="件" icon="Warning" tone="danger" />
    </div>

    <el-tabs v-model="activeTab" class="cf-tabs">
      <!-- ============ 案卷组装 ============ -->
      <el-tab-pane label="案卷组装" name="assemble">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">案卷状态分布</span>
            </div>
            <EChart :option="cfStatusOption" height="212px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">归档趋势</span>
            </div>
            <EChart :option="archiveTrendOption" height="212px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">案卷组装规范</span>
            </div>
            <div class="rule-list">
              <div class="rule">
                <span class="rule__no num">1</span>
                <div>
                  <b>材料顺序</b>
                  <span>按办案流程时序排列：立案 → 调查 → 证据 → 告知 → 决定 → 送达 → 执行 → 结案</span>
                </div>
              </div>
              <div class="rule">
                <span class="rule__no num">2</span>
                <div>
                  <b>目录与页码</b>
                  <span>自动生成案卷目录，逐页连续编号，标注起止页与文号</span>
                </div>
              </div>
              <div class="rule">
                <span class="rule__no num">3</span>
                <div>
                  <b>组装校验</b>
                  <span>校验必备材料是否齐全，缺失材料标记并提示补录后方可归档</span>
                </div>
              </div>
              <div class="rule">
                <span class="rule__no num">4</span>
                <div>
                  <b>保管期限</b>
                  <span>按案件类型确定保管期限（一般 10 年 / 重大 30 年 / 永久）</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">档案检索</span>
            <span class="section-title__desc">支持按案卷号 / 档号 / 案件名称 / 机构名称检索，快速定位调阅</span>
            <span class="section-title__extra">
              <el-radio-group v-model="viewMode" size="small">
                <el-radio-button value="shelf"><el-icon><Box /></el-icon> 档案书架</el-radio-button>
                <el-radio-button value="table"><el-icon><List /></el-icon> 明细表</el-radio-button>
              </el-radio-group>
            </span>
          </div>
          <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="q.keyword" placeholder="案卷号/档号/案件名称/机构" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
            </el-form-item>
            <el-form-item label="案卷状态">
              <el-select v-model="q.status" placeholder="全部状态" clearable>
                <el-option v-for="s in (st?.statusDist || [])" :key="s.name" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="所属区县">
              <el-select v-model="q.district" placeholder="全部区县" clearable>
                <el-option v-for="d in ['镜湖区', '鸠江区', '弋江区', '湾沚区', '繁昌区', '南陵县', '无为市']"
                  :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
            </div>
          </el-form>
        </div>

        <!-- ============ 档案书架 ============ -->
        <div v-if="viewMode === 'shelf'" class="section-card shelf-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">档案实体书架</span>
            <span class="section-title__desc">
              书脊色按状态区分、烫金为档号；侧边纸页厚度即卷内页数，倾斜表示已借出
            </span>
            <span class="section-title__extra">
              <div class="shelf-legend">
                <span><i style="background: var(--doc-box-assembling)" />组装中</span>
                <span><i style="background: var(--doc-box-pending)" />待归档</span>
                <span><i style="background: var(--doc-box-archived)" />已归档</span>
                <span><i style="background: var(--doc-box-borrowed)" />借出中</span>
              </div>
            </span>
          </div>

          <div class="shelf" v-loading="loading">
            <ArchiveBox v-for="c in list" :key="c.caseFileId"
              :archive-no="c.archiveNo" :case-name="c.caseName" :case-file-no="c.caseFileNo"
              :status="c.status" :volume-count="c.volumeCount" :total-pages="c.totalPages"
              :retention-years="c.retentionYears"
              :passed="c.assembleCheck.passed"
              :missing-count="c.assembleCheck.missing.length"
              :ocr="c.ocrRecognized"
              :active="cur?.caseFileId === c.caseFileId"
              @click="openDetail(c)" />
            <EmptyState v-if="!list.length && !loading" text="暂无符合条件的案卷" height="170px" />
          </div>

          <div class="pager">
            <span class="text-mini">共 {{ total }} 卷档案</span>
            <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
              :page-sizes="[12, 15, 24, 36]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
          </div>
        </div>

        <!-- ============ 明细表 ============ -->
        <div v-else class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'FolderAdd'" @click="openAsm">案卷自动组装</el-button>
            <span class="text-mini">共 {{ total }} 卷档案</span>
            <div class="table-toolbar__right">
              <el-button :icon="'Download'" @click="msg.success('档案台账已导出，正在下载')">导出台账</el-button>
            </div>
          </div>

          <el-table :data="list" size="small" border stripe v-loading="loading">
            <el-table-column prop="archiveNo" label="档号" width="150">
              <template #default="{ row }">
                <span class="num text-link" @click="openDetail(row)">{{ row.archiveNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="caseFileNo" label="案卷号" width="164">
              <template #default="{ row }"><span class="num text-mini">{{ row.caseFileNo }}</span></template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="orgName" label="涉及机构" min-width="164" show-overflow-tooltip />
            <el-table-column label="材料 / 页数" width="112" align="center">
              <template #default="{ row }">
                <span class="num text-mini">{{ row.catalog.length }} 项 / {{ row.totalPages }} 页</span>
              </template>
            </el-table-column>
            <el-table-column label="组装校验" width="106" align="center">
              <template #default="{ row }">
                <el-tag :type="row.assembleCheck.passed ? 'success' : 'danger'" size="small" effect="plain">
                  {{ row.assembleCheck.actualCount }}/{{ row.assembleCheck.requiredCount }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="纸质" width="88" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.ocrRecognized" size="small" type="success" effect="dark">已 OCR</el-tag>
                <el-tag v-else-if="row.paperScanned" size="small" type="primary" effect="plain">已扫描</el-tag>
                <span v-else class="text-muted">未扫描</span>
              </template>
            </el-table-column>
            <el-table-column prop="retentionYears" label="保管期限" width="94" align="center">
              <template #default="{ row }">
                <span class="num">{{ row.retentionYears }}</span> 年
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="88" align="center">
              <template #default="{ row }">
                <el-tag :type="CF_TONE[row.status] || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="storageLocation" label="存放位置" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="text-mini">{{ row.storageLocation || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="148" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openDetail(row)">详情</el-button>
                <el-button v-if="row.status === '待归档'" link type="success" :icon="'Box'"
                  :loading="archiving" @click="doArchive(row)">归档</el-button>
                <el-button v-else-if="row.status === '已归档'" link type="warning" :icon="'Reading'"
                  @click="openBorrowDlg(row)">借阅</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无符合条件的案卷" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ total }} 条</span>
            <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
              :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 档案借阅 ============ -->
      <el-tab-pane label="档案借阅" name="borrow">
        <div class="chart-grid chart-grid--2">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">借阅状态分布</span>
            </div>
            <EChart :option="borrowOption" height="200px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">借阅管理要点</span>
            </div>
            <div class="rule-list">
              <div class="rule">
                <span class="rule__no num">1</span>
                <div><b>申请审批</b><span>借阅须填写用途与期限，由档案员审批后方可调阅</span></div>
              </div>
              <div class="rule">
                <span class="rule__no num">2</span>
                <div><b>期限管理</b><span>默认借阅期限 15 天，到期自动提醒，逾期标记并限制再借</span></div>
              </div>
              <div class="rule">
                <span class="rule__no num">3</span>
                <div><b>归还核对</b><span>归还时核对案卷材料完整性与页数，缺失需追责登记</span></div>
              </div>
              <div class="rule">
                <span class="rule__no num">4</span>
                <div><b>全程留痕</b><span>借阅申请、审批、调阅、归还全过程记录，可追溯</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'Plus'" @click="openBorrowDlg()">发起借阅申请</el-button>
            <span class="text-mini">共 {{ bTotal }} 条借阅记录</span>
          </div>

          <el-form class="query-form" :model="bQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="bQ.keyword" placeholder="借阅编号/案件名称/借阅人" clearable :prefix-icon="'Search'"
                @keyup.enter="bQ.page = 1; loadBorrow()" />
            </el-form-item>
            <el-form-item label="借阅状态">
              <el-select v-model="bQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['审批中', '已批准', '借阅中', '已归还', '已驳回', '逾期未还']"
                  :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="bQ.page = 1; loadBorrow()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(bQ, { keyword: '', status: '', page: 1 }); loadBorrow()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="bList" size="small" border stripe v-loading="bLoading">
            <el-table-column prop="borrowId" label="借阅编号" width="140">
              <template #default="{ row }"><span class="num">{{ row.borrowId }}</span></template>
            </el-table-column>
            <el-table-column prop="archiveNo" label="档号" width="146">
              <template #default="{ row }"><span class="num text-mini">{{ row.archiveNo }}</span></template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="196" show-overflow-tooltip />
            <el-table-column prop="borrower" label="借阅人" width="124" />
            <el-table-column prop="borrowerDept" label="借阅部门" width="140" show-overflow-tooltip />
            <el-table-column prop="purpose" label="借阅用途" min-width="164" show-overflow-tooltip />
            <el-table-column prop="borrowDays" label="期限" width="76" align="center">
              <template #default="{ row }"><span class="num">{{ row.borrowDays }}</span> 天</template>
            </el-table-column>
            <el-table-column prop="dueDate" label="应还日期" width="106">
              <template #default="{ row }">
                <span class="num text-mini" :style="row.status === '逾期未还' ? 'color: var(--zh-danger); font-weight: 700' : ''">
                  {{ row.dueDate }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="94" align="center">
              <template #default="{ row }">
                <el-tag :type="B_TONE[row.status] || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="applyTime" label="申请时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.applyTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <template v-if="row.status === '审批中'">
                  <el-button link type="success" :icon="'CircleCheck'" @click="doApprove(row, '已批准')">批准</el-button>
                  <el-button link type="danger" :icon="'CircleClose'" @click="doApprove(row, '已驳回')">驳回</el-button>
                </template>
                <el-button v-else-if="row.status === '借阅中' || row.status === '逾期未还'"
                  link type="primary" :icon="'Finished'" @click="doReturn(row)">登记归还</el-button>
                <span v-else class="text-muted text-mini">—</span>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无借阅记录" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ bTotal }} 条</span>
            <el-pagination v-model:current-page="bQ.page" v-model:page-size="bQ.pageSize" :total="bTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadBorrow" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 纸质扫码入档 ============ -->
      <el-tab-pane label="纸质扫码入档" name="scan">
        <div class="section-card section-card--tight">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">纸质材料电子化流程</span>
            <span class="section-title__desc">条码标识 → 扫描上传 → OCR 识别分类 → 关联电子案卷，实现纸电一体化管理</span>
          </div>
          <div class="step-grid">
            <div class="stp is-primary">
              <div class="stp__no num">1</div>
              <div class="stp__n">条码标识</div>
              <div class="stp__d">案卷组装时生成唯一条码，粘贴于纸质卷盒与卷内材料首页</div>
            </div>
            <div class="stp is-accent">
              <div class="stp__no num">2</div>
              <div class="stp__n">扫描上传</div>
              <div class="stp__d">扫描仪批量扫描，按条码自动归属对应案卷，无需人工分拣</div>
            </div>
            <div class="stp is-purple">
              <div class="stp__no num">3</div>
              <div class="stp__n">OCR 识别</div>
              <div class="stp__d">识别文书标题、文号、日期等关键要素，自动判定材料类别</div>
            </div>
            <div class="stp is-success">
              <div class="stp__no num">4</div>
              <div class="stp__n">关联电子案卷</div>
              <div class="stp__d">扫描件与电子案卷目录逐项对应，纸电互相校验、互为备份</div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'Camera'" @click="openScanDlg()">扫描上传</el-button>
            <span class="text-mini">共 {{ sTotal }} 个扫描任务（已完成 {{ st?.scanDone || 0 }}）</span>
          </div>

          <el-form class="query-form" :model="sQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="sQ.keyword" placeholder="扫描编号/条码/案件名称" clearable :prefix-icon="'Search'"
                @keyup.enter="sQ.page = 1; loadScan()" />
            </el-form-item>
            <el-form-item label="任务状态">
              <el-select v-model="sQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['待扫描', '扫描中', '识别中', '已完成', '识别异常']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="sQ.page = 1; loadScan()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(sQ, { keyword: '', status: '', page: 1 }); loadScan()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="sList" size="small" border stripe v-loading="sLoading">
            <el-table-column prop="scanId" label="扫描编号" width="146">
              <template #default="{ row }"><span class="num">{{ row.scanId }}</span></template>
            </el-table-column>
            <el-table-column prop="barcodeNo" label="条码编号" width="164">
              <template #default="{ row }">
                <span class="num text-mini" style="color: var(--zh-primary)">{{ row.barcodeNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="scannedPages" label="扫描页数" width="94" align="right">
              <template #default="{ row }"><span class="num">{{ row.scannedPages }}</span></template>
            </el-table-column>
            <el-table-column prop="ocrStatus" label="OCR 状态" width="102" align="center">
              <template #default="{ row }">
                <el-tag :type="row.ocrStatus === '识别完成' ? 'success' : row.ocrStatus === '识别异常' ? 'danger' : 'primary'"
                  size="small" effect="dark">{{ row.ocrStatus }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="ocrAccuracy" label="识别准确率" width="118" align="center">
              <template #default="{ row }">
                <el-progress :percentage="row.ocrAccuracy" :stroke-width="12" text-inside
                  :status="row.ocrAccuracy >= 95 ? 'success' : row.ocrAccuracy >= 88 ? undefined : 'warning'" />
              </template>
            </el-table-column>
            <el-table-column label="识别类别" min-width="190">
              <template #default="{ row }">
                <el-tag v-for="c in (row.recognizedCategories || []).slice(0, 2)" :key="c" size="small" effect="plain" class="mr4">
                  {{ c }}
                </el-tag>
                <el-tag v-if="(row.recognizedCategories || []).length > 2" size="small" effect="plain">
                  +{{ row.recognizedCategories.length - 2 }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="关联案卷" width="94" align="center">
              <template #default="{ row }">
                <el-tag :type="row.linkedElectronic ? 'success' : 'warning'" size="small" effect="plain">
                  {{ row.linkedElectronic ? '已关联' : '待关联' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="126" />
            <el-table-column prop="scanTime" label="扫描时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.scanTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="92" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'Upload'" @click="openScanDlg(row)">重新扫描</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无扫描任务" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ sTotal }} 条</span>
            <el-pagination v-model:current-page="sQ.page" v-model:page-size="sQ.pageSize" :total="sTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadScan" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 案卷详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="740px" title="案卷详情">
      <template v-if="cur">
        <div class="cf-hero">
          <div class="cf-hero__t">
            {{ cur.caseName }}
            <el-tag :type="CF_TONE[cur.status] || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
          </div>
          <div class="cf-hero__m">
            <span><el-icon><FolderOpened /></el-icon>{{ cur.archiveNo }}</span>
            <span><el-icon><Ticket /></el-icon>{{ cur.caseFileNo }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ cur.orgName }}</span>
            <span><el-icon><Document /></el-icon>{{ cur.volumeCount }} 册 / {{ cur.totalPages }} 页</span>
            <span><el-icon><Clock /></el-icon>保管 {{ cur.retentionYears }} 年</span>
          </div>
        </div>

        <el-tabs v-model="cfTab" class="cf-dtabs">
          <!-- 案卷目录 -->
          <el-tab-pane label="案卷目录" name="catalog">
            <div class="ck-bar" :class="cur.assembleCheck.passed ? 'is-ok' : 'is-no'">
              <el-icon><component :is="cur.assembleCheck.passed ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
              <b>{{ cur.assembleCheck.passed ? '组装校验通过' : '组装校验未通过' }}</b>
              <span>必备材料 {{ cur.assembleCheck.requiredCount }} 项 · 实际 {{ cur.assembleCheck.actualCount }} 项</span>
              <el-tag v-if="cur.assembleCheck.missing.length" size="small" type="danger" effect="dark">
                缺失 {{ cur.assembleCheck.missing.length }} 项
              </el-tag>
            </div>

            <div v-if="cur.assembleCheck.missing.length" class="miss-box">
              <div class="miss-box__t"><el-icon><WarningFilled /></el-icon>缺失材料（需补录后方可归档）</div>
              <div class="miss-box__l">
                <el-tag v-for="m in cur.assembleCheck.missing" :key="m" size="small" type="danger" effect="dark" class="mr4">
                  {{ m }}
                </el-tag>
              </div>
            </div>

            <div class="sub-title">卷内材料目录（按办案流程时序排列）</div>
            <el-table :data="cur.catalog" size="small" border stripe max-height="400">
              <el-table-column prop="seq" label="序号" width="60" align="center">
                <template #default="{ row }"><span class="num">{{ row.seq }}</span></template>
              </el-table-column>
              <el-table-column prop="materialName" label="材料名称" min-width="196" show-overflow-tooltip />
              <el-table-column prop="docNo" label="文号" width="164">
                <template #default="{ row }">
                  <span v-if="row.docNo" class="num text-mini">{{ row.docNo }}</span>
                  <span v-else class="text-muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="页码" width="98" align="center">
                <template #default="{ row }">
                  <span class="num text-mini">{{ row.pageFrom }}–{{ row.pageTo }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip>
                <template #default="{ row }">
                  <span v-if="row.remark" class="text-mini">{{ row.remark }}</span>
                  <span v-else class="text-muted">—</span>
                </template>
              </el-table-column>
              <template #empty><EmptyState text="暂无卷内材料" height="120px" /></template>
            </el-table>
          </el-tab-pane>

          <!-- 归档信息 -->
          <el-tab-pane label="归档信息" name="archive">
            <div class="sub-title">组装信息</div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="案卷编号">
                <span class="num">{{ cur.caseFileId }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="所属区县">{{ cur.district }}</el-descriptions-item>
              <el-descriptions-item label="组装人">{{ cur.assembler }}</el-descriptions-item>
              <el-descriptions-item label="组装时间">
                <span class="num text-mini">{{ cur.assembleTime }}</span>
              </el-descriptions-item>
            </el-descriptions>

            <div class="sub-title">归档与存放</div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="档号">
                <span class="num" style="font-weight: 700; color: var(--zh-primary)">{{ cur.archiveNo }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="保管期限">
                <span class="num">{{ cur.retentionYears }}</span> 年
              </el-descriptions-item>
              <el-descriptions-item label="纸质盒号">{{ cur.paperBoxNo || '未分配' }}</el-descriptions-item>
              <el-descriptions-item label="存放位置">{{ cur.storageLocation || '未分配' }}</el-descriptions-item>
              <el-descriptions-item label="归档人">{{ cur.archiver || '未归档' }}</el-descriptions-item>
              <el-descriptions-item label="归档时间">
                <span class="num text-mini">{{ cur.archiveTime || '未归档' }}</span>
              </el-descriptions-item>
            </el-descriptions>

            <div class="sub-title">纸电一体化</div>
            <div class="pe-grid">
              <div class="pe" :class="cur.paperScanned ? 'is-ok' : 'is-no'">
                <el-icon class="pe__i"><component :is="cur.paperScanned ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
                <div class="pe__n">纸质扫描</div>
                <div class="pe__d">{{ cur.paperScanned ? '纸质材料已完成扫描并上传' : '纸质材料尚未扫描' }}</div>
              </div>
              <div class="pe" :class="cur.ocrRecognized ? 'is-ok' : 'is-no'">
                <el-icon class="pe__i"><component :is="cur.ocrRecognized ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
                <div class="pe__n">OCR 识别</div>
                <div class="pe__d">{{ cur.ocrRecognized ? '扫描件已 OCR 识别分类并关联电子案卷' : '尚未进行 OCR 识别' }}</div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div class="dr-actions">
          <el-button :icon="'Download'" @click="exportCatalog">导出案卷目录</el-button>
          <el-button v-if="cur.status === '待归档'" type="success" :icon="'Box'"
            :loading="archiving" @click="doArchive(cur)">确认归档</el-button>
          <el-button v-else-if="cur.status === '已归档'" type="warning" :icon="'Reading'"
            @click="openBorrowDlg(cur)">发起借阅</el-button>
          <el-button type="primary" :icon="'Camera'" @click="openScanDlg({ caseName: cur.caseName, barcodeNo: cur.archiveNo })">
            纸质扫码入档
          </el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 案卷组装 ============ -->
    <el-dialog v-model="asmVisible" title="案卷自动组装" width="580px">
      <el-alert type="info" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">
            系统自动收集案件全流程文书与证据材料，按办案时序排列、生成目录、连续编页，
            并校验必备材料齐全性
          </span>
        </template>
      </el-alert>
      <el-form label-width="94px">
        <el-form-item label="案件编号" required>
          <el-input v-model="asmForm.caseId" placeholder="如 CASE202608150003" />
        </el-form-item>
        <el-form-item label="案件名称">
          <el-input v-model="asmForm.caseName" placeholder="选填，未填写时自动读取案件信息" />
        </el-form-item>
        <el-form-item label="涉及机构">
          <el-input v-model="asmForm.orgName" placeholder="选填，未填写时自动读取机构信息" />
        </el-form-item>
        <el-form-item v-if="asmRes" label="组装结果">
          <div class="cr-box">
            <div class="cr-box__t">
              案卷号 <b class="num">{{ asmRes.caseFileNo }}</b>
            </div>
            <div class="cr-box__r">
              档号 <span class="num">{{ asmRes.archiveNo }}</span> ·
              材料 <span class="num">{{ asmRes.materialCount }}</span> 项 ·
              共 <span class="num">{{ asmRes.totalPages }}</span> 页
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="asmVisible = false">关闭</el-button>
        <el-button type="primary" :loading="asmRunning" @click="doAsm">开始组装</el-button>
      </template>
    </el-dialog>

    <!-- ============ 借阅申请 ============ -->
    <el-dialog v-model="bVisible" title="档案借阅申请" width="560px">
      <el-form label-width="94px">
        <el-form-item label="案卷编号" required>
          <el-input v-model="bForm.caseFileId" placeholder="如 CF20260012" />
        </el-form-item>
        <el-form-item label="案件名称">
          <el-input v-model="bForm.caseName" disabled placeholder="自动读取" />
        </el-form-item>
        <el-form-item label="借阅人" required>
          <el-input v-model="bForm.borrower" placeholder="请填写借阅人姓名" />
        </el-form-item>
        <el-form-item label="借阅用途" required>
          <el-input v-model="bForm.purpose" type="textarea" :rows="2"
            placeholder="如：复议应诉举证、执法检查复核、案例分析研究等" />
        </el-form-item>
        <el-form-item label="借阅期限">
          <el-input-number v-model="bForm.days" :min="1" :max="60" :controls="false" style="width: 110px" />
          <span class="text-mini ml8">天（默认 15 天，到期自动提醒，逾期将限制再借）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bVisible = false">取消</el-button>
        <el-button type="primary" :loading="bSaving" @click="doBorrowApply">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- ============ 扫描上传 ============ -->
    <el-dialog v-model="sVisible" title="纸质材料扫码入档" width="600px">
      <el-form label-width="94px">
        <el-form-item label="条码编号" required>
          <el-input v-model="sForm.barcodeNo" placeholder="扫描卷盒条码或手动输入" :prefix-icon="'Aim'" />
        </el-form-item>
        <el-form-item label="案件名称">
          <el-input v-model="sForm.caseName" placeholder="选填，按条码自动关联" />
        </el-form-item>
        <el-form-item label="扫描说明">
          <div class="gen-tip">
            <el-icon><InfoFilled /></el-icon>
            扫描仪批量扫描后，系统按条码自动归属对应案卷；OCR 识别文书标题、文号、日期等关键要素，
            自动判定材料类别并与电子案卷目录逐项对应，实现纸电互校、互为备份。
          </div>
        </el-form-item>

        <template v-if="sRes">
          <el-form-item label="识别结果">
            <div class="tr-box">
              <div class="tr-box__h">
                <el-icon><CircleCheckFilled /></el-icon>
                <b>{{ sRes.ocrStatus }}</b>
                <el-tag size="small" type="success" effect="dark">准确率 {{ sRes.ocrAccuracy }}%</el-tag>
                <el-tag v-if="sRes.linkedElectronic" size="small" type="primary" effect="plain">已关联电子案卷</el-tag>
              </div>
              <div class="tr-box__r">
                扫描 <b class="num">{{ sRes.scannedPages }}</b> 页 · 扫描编号 <span class="num">{{ sRes.scanId }}</span>
              </div>
              <div class="tr-box__l">
                <el-tag v-for="c in sRes.recognizedCategories" :key="c" size="small" effect="plain" class="mr4 mb4">
                  {{ c }}
                </el-tag>
              </div>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="sVisible = false">关闭</el-button>
        <el-button type="primary" :loading="sRunning" :icon="'Upload'" @click="doUploadScan">扫描并识别</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb4 { margin-bottom: 4px; }
.mb12 { margin-bottom: 12px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.cf-tabs { margin-top: 12px; }

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.2fr 1.4fr; gap: 12px; margin-bottom: 12px;
  &--2 { grid-template-columns: 1fr 1.4fr; }
  @media (max-width: 1300px) { grid-template-columns: 1fr; &--2 { grid-template-columns: 1fr; } }
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

/* ---------- 档案书架 ---------- */
.shelf-card {
  /* 木质书架背板 */
  background:
    linear-gradient(180deg, rgba(184, 137, 43, .06), transparent 90px),
    var(--zh-bg-card);
}

.shelf-legend {
  display: flex; gap: 10px; flex-wrap: wrap;
  font-size: 10px; color: var(--zh-text-secondary);
  span { display: inline-flex; align-items: center; gap: 4px; }
  i { width: 8px; height: 12px; border-radius: 2px; flex-shrink: 0; }
}

.shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: 16px 14px;
  padding: 8px 2px 14px;
  position: relative;

  /* 隔板：每行下方一条木纹线 */
  &::after {
    content: ''; position: absolute; inset: auto 0 4px 0; height: 4px;
    border-radius: 2px;
    background: linear-gradient(180deg, #c9a468, #8a6b36);
    box-shadow: 0 2px 6px rgba(90, 70, 30, .28);
  }

  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

/* ---------- 规则列表 ---------- */
.rule-list { display: flex; flex-direction: column; gap: 7px; }

.rule {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 7px 10px; border-radius: 5px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--zh-primary);

  &__no {
    width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 9px; font-weight: 700;
  }
  b { font-size: 11px; color: var(--zh-text-primary); }
  span { display: block; margin-top: 2px; font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); }
}

/* ---------- 扫描流程 ---------- */
.step-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  @media (max-width: 1000px) { grid-template-columns: repeat(2, 1fr); }
}

.stp {
  padding: 11px 12px; border-radius: var(--zh-radius); text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--sc, var(--zh-primary));

  &.is-primary { --sc: var(--zh-primary); }
  &.is-accent { --sc: var(--zh-accent); }
  &.is-purple { --sc: var(--zh-purple); }
  &.is-success { --sc: var(--zh-success); }

  &__no {
    width: 20px; height: 20px; margin: 0 auto 6px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--sc); color: #fff; font-size: 10px; font-weight: 700;
  }
  &__n { font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__d { margin-top: 4px; font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); }
}

/* ---------- 抽屉 ---------- */
.cf-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-purple-light), #fff);
  border: 1px solid var(--zh-purple);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-purple); }
  }
}

.cf-dtabs { margin-top: 12px; }

.ck-bar {
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  padding: 9px 12px; border-radius: var(--zh-radius); font-size: var(--zh-font-xs);

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); :deep(.el-icon) { color: var(--zh-success); } }
  &.is-no { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); :deep(.el-icon) { color: var(--zh-danger); } }
  b { color: var(--zh-text-primary); }
  > span { color: var(--zh-text-secondary); }
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

.pe-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.pe {
  padding: 11px 12px; border-radius: var(--zh-radius); text-align: center;

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); .pe__i { color: var(--zh-success); } }
  &.is-no { background: var(--zh-warning-light); border: 1px solid var(--zh-warning); .pe__i { color: var(--zh-warning); } }

  &__i { font-size: 20px; }
  &__n { margin-top: 4px; font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__d { margin-top: 4px; font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); }
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

.gen-tip {
  display: flex; align-items: flex-start; gap: 5px;
  padding: 8px 10px; border-radius: 5px;
  background: var(--zh-info-light);
  font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
}

.cr-box {
  width: 100%; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__t { font-size: var(--zh-font-xs); color: var(--zh-text-regular); b { font-size: 14px; color: var(--zh-success); } }
  &__r { margin-top: 5px; font-size: 11px; color: var(--zh-text-secondary); }
}

.tr-box {
  width: 100%; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-success); }
  }
  &__r { margin-top: 6px; font-size: 11px; color: var(--zh-text-secondary); b { color: var(--zh-success); font-size: 13px; } }
  &__l { margin-top: 7px; }
}
</style>
