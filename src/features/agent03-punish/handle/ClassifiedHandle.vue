<script setup lang="ts">
import {
  getHandleStats, getAgreementHandlings, getPenalties, getTransfers,
  getHandleBasis, createHandling, approveHandling, advancePenaltyStep, submitTransfer,
  getConfirmList
} from '@/api/agent03-punish/punish'
import { fmtMoney, fmtWan, CHART_COLORS, CHART_GRID } from '@/utils/format'
import {
  buildAgreementDoc, buildPenaltyDoc, buildTransferDoc,
  PENALTY_CASE_DOCS, exportCsv, type LegalDoc
} from '@/utils/legalDoc'

const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('agreement')

/* ---------- 三类处置列表 ---------- */
const agList = ref<any[]>([])
const agTotal = ref(0)
const agLoading = ref(false)
const agQ = reactive({ keyword: '', status: '', problemNature: '', page: 1, pageSize: 10 })

const penList = ref<any[]>([])
const penTotal = ref(0)
const penLoading = ref(false)
const penQ = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })

const trList = ref<any[]>([])
const trTotal = ref(0)
const trLoading = ref(false)
const trQ = reactive({ keyword: '', transferType: '', status: '', page: 1, pageSize: 10 })

const NATURE_TONE: Record<string, string> = {
  一般违规: 'info', 较重违规: 'warning', 严重违规: 'danger', 涉嫌欺诈骗保: 'danger'
}
const AG_STATUS_TONE: Record<string, string> = {
  待审批: 'warning', 审批中: 'primary', 已审批: 'primary', 执行中: 'warning', 已执行: 'success'
}
const MEASURE_TONE: Record<string, string> = {
  约谈: 'info', 拒付: 'warning', 基金追回: 'danger', 责令整改: 'warning',
  暂停结算: 'danger', 暂停服务协议: 'danger', 解除服务协议: 'danger'
}
const PENALTY_STEPS = [
  '立案审批', '调查取证', '案件调查终结报告', '事先告知', '听证告知', '陈述申辩/听证',
  '法制审核', '集体讨论', '处罚决定', '送达', '执行', '结案'
]

async function loadStats() { st.value = await getHandleStats() }

async function loadAg() {
  agLoading.value = true
  try {
    const res: any = await getAgreementHandlings(agQ)
    agList.value = res?.list || []
    agTotal.value = res?.total || 0
  } finally { agLoading.value = false }
}

async function loadPen() {
  penLoading.value = true
  try {
    const res: any = await getPenalties(penQ)
    penList.value = res?.list || []
    penTotal.value = res?.total || 0
  } finally { penLoading.value = false }
}

async function loadTr() {
  trLoading.value = true
  try {
    const res: any = await getTransfers(trQ)
    trList.value = res?.list || []
    trTotal.value = res?.total || 0
  } finally { trLoading.value = false }
}

/* ---------- 协议处理详情 ---------- */
const agDrawer = ref(false)
const curAg = ref<any>(null)
function openAg(row: any) { curAg.value = row; agDrawer.value = true }

const approving = ref(false)
async function doApprove() {
  approving.value = true
  try {
    const res: any = await approveHandling({ handlingId: curAg.value.handlingId })
    msg.success(res?.message || '审批通过')
    curAg.value.status = '已审批'
    await loadAg()
  } finally { approving.value = false }
}

/* ---------- 行政处罚详情 ---------- */
const penDrawer = ref(false)
const curPen = ref<any>(null)
function openPen(row: any) { curPen.value = row; penDrawer.value = true }

const advancing = ref(false)
async function doAdvance() {
  advancing.value = true
  try {
    const res: any = await advancePenaltyStep({ penaltyId: curPen.value.penaltyId, stepIndex: curPen.value.stepIndex })
    msg.success(res?.message || '已推进')
    curPen.value.stepIndex = res.stepIndex
    curPen.value.currentStep = res.currentStep
    const rec = curPen.value.procedureRecords?.[res.stepIndex]
    if (rec) Object.assign(rec, { done: true, time: res.time })
    await loadPen()
  } finally { advancing.value = false }
}

/* ---------- 移送详情 ---------- */
const trDrawer = ref(false)
const curTr = ref<any>(null)
function openTr(row: any) { curTr.value = row; trDrawer.value = true }

const transferring = ref(false)
async function doTransfer() {
  await ElMessageBox.confirm(
    '将通过「行政执法与刑事司法衔接信息共享平台」正式移送案件，移送后不可撤回，确认移送？',
    '案件移送',
    { type: 'warning', confirmButtonText: '确认移送', cancelButtonText: '取消' }
  ).then(async () => {
    transferring.value = true
    try {
      const res: any = await submitTransfer({ transferId: curTr.value.transferId })
      msg.success(res?.message || '已移送')
      curTr.value.status = '已移送'
      await loadTr()
    } finally { transferring.value = false }
  }).catch(() => undefined)
}

/* ---------- 处置依据推荐 ---------- */
const basisVisible = ref(false)
const basisLoading = ref(false)
const basis = ref<any>(null)
const confOptions = ref<any[]>([])
const pickedConf = ref('')

async function openBasis() {
  basisVisible.value = true
  if (!confOptions.value.length) {
    const res: any = await getConfirmList({ page: 1, pageSize: 40 })
    confOptions.value = res?.list || []
    if (confOptions.value.length) pickedConf.value = confOptions.value[0].confirmationId
  }
  if (pickedConf.value) await runBasis()
}

async function runBasis() {
  if (!pickedConf.value) return
  basisLoading.value = true
  basis.value = null
  try {
    basis.value = await getHandleBasis(pickedConf.value)
  } finally { basisLoading.value = false }
}

/* ---------- 文书预览 ---------- */
const docVisible = ref(false)
const curDoc = ref<LegalDoc | null>(null)

/** 协议处理：按措施生成对应文书 */
function openMeasureDoc(measure: any) {
  if (!curAg.value) return
  const seq = Number(String(measure.measureId).replace(/\D/g, '').slice(-3)) || 1
  curDoc.value = buildAgreementDoc(curAg.value, measure, seq)
  docVisible.value = true
}

/** 行政处罚决定书 */
function openPenaltyDoc() {
  if (!curPen.value) return
  curDoc.value = buildPenaltyDoc(curPen.value)
  docVisible.value = true
}

/** 案件移送函 */
function openTransferDoc() {
  if (!curTr.value) return
  curDoc.value = buildTransferDoc(curTr.value)
  docVisible.value = true
}

/** 成套案卷清单（导出 CSV） */
function exportCaseFile() {
  if (!curPen.value) return
  const pr = curPen.value.procedureRecords || []
  exportCsv(
    `行政处罚案卷目录_${curPen.value.caseNo.replace(/[〔〕]/g, '')}`,
    ['序号', '文书名称', '对应程序节点', '是否归卷', '归卷时间', '承办人'],
    PENALTY_CASE_DOCS.map((d, i) => [
      i + 1, d, pr[i]?.step || '—', pr[i]?.done ? '已归卷' : '待归卷',
      pr[i]?.time || '—', pr[i]?.operator || '—'
    ])
  )
  msg.success(`成套案卷目录已导出（共 ${PENALTY_CASE_DOCS.length} 份文书）`)
}

/* ---------- 图表 ---------- */
const typeOption = computed(() => {
  const d = st.value?.handleTypeDist || []
  const colors: Record<string, string> = { 协议处理: '#1668dc', 行政处罚: '#e8a30c', 移送处理: '#e5484d' }
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['46%', '70%'], center: ['50%', '43%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] } }))
    }]
  }
})

const measureOption = computed(() => {
  const d = st.value?.measureDist || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 92, right: 24, top: 12, bottom: 22 },
    xAxis: {
      type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8' }
    },
    yAxis: {
      type: 'category', data: d.map((i: any) => i.name).reverse(),
      axisLabel: { fontSize: 11, color: '#43516b' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barWidth: 13,
      itemStyle: {
        borderRadius: [0, 3, 3, 0],
        color: (p: any) => ['#5a7189', '#e8a30c', '#e5484d', '#e8a30c', '#d4380d', '#d4380d', '#e5484d'][p.dataIndex % 7]
      },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.value).reverse()
    }]
  }
})

onMounted(() => { loadStats(); loadAg(); loadPen(); loadTr() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="分类处置" tag="M20"
      subtitle="协议处理 · 行政处罚 · 移送处理 三条路径规范办理，智能匹配处置依据">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); loadAg(); loadPen(); loadTr()">刷新</el-button>
        <el-button type="primary" :icon="'Notebook'" @click="openBasis">处置依据推荐</el-button>
      </template>
    </PageHeader>

    <!-- 指标 + 图表 -->
    <div class="top-grid">
      <div class="kpi-col">
        <StatCard label="协议处理" :value="st?.handlingTotal || 0" unit="件" icon="Tickets" tone="primary" />
        <StatCard label="行政处罚" :value="st?.penaltyTotal || 0" unit="件" icon="Stamp" tone="warning" />
        <StatCard label="移送处理" :value="st?.transferTotal || 0" unit="件" icon="Position" tone="danger" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">处置路径构成</span>
        </div>
        <EChart :option="typeOption" height="196px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">处置措施使用分布</span>
        </div>
        <EChart :option="measureOption" height="196px" />
      </div>
    </div>

    <!-- 三类处置 Tab -->
    <div class="section-card">
      <el-tabs v-model="activeTab">
        <!-- ===== 协议处理 ===== -->
        <el-tab-pane label="协议处理" name="agreement">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">协议处理</span>
            <span class="section-title__desc">
              约谈 / 拒付 / 基金追回 / 责令整改 / 暂停结算 / 暂停服务协议 / 解除服务协议
            </span>
          </div>

          <el-form class="query-form" :model="agQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="agQ.keyword" placeholder="处置编号/机构" clearable :prefix-icon="'Search'"
                @keyup.enter="agQ.page = 1; loadAg()" />
            </el-form-item>
            <el-form-item label="处置状态">
              <el-select v-model="agQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['待审批', '审批中', '已审批', '执行中', '已执行']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item label="问题性质">
              <el-select v-model="agQ.problemNature" placeholder="全部性质" clearable>
                <el-option v-for="n in ['一般违规', '较重违规', '严重违规', '涉嫌欺诈骗保']" :key="n" :label="n" :value="n" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="agQ.page = 1; loadAg()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(agQ, { keyword: '', status: '', problemNature: '', page: 1 }); loadAg()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="agList" size="small" border stripe v-loading="agLoading">
            <el-table-column prop="handlingId" label="处置编号" width="152">
              <template #default="{ row }">
                <span class="num text-link" @click="openAg(row)">{{ row.handlingId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="orgName" label="被处置机构" min-width="170" show-overflow-tooltip />
            <el-table-column prop="problemNature" label="问题性质" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="(NATURE_TONE[row.problemNature] as any)" size="small" effect="dark">{{ row.problemNature }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="处置措施" min-width="200">
              <template #default="{ row }">
                <el-tag v-for="m in row.measures" :key="m.measureId" size="small"
                  :type="(MEASURE_TONE[m.measureType] as any) || 'info'" effect="plain" class="mr4">
                  {{ m.measureType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="totalAmount" label="涉及金额" width="116" align="right">
              <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.totalAmount) }}</span></template>
            </el-table-column>
            <el-table-column label="审批层级" width="118" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.approval.approvalLevel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="88" align="center">
              <template #default="{ row }">
                <el-tag :type="(AG_STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openAg(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无协议处理记录" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ agTotal }} 条</span>
            <el-pagination v-model:current-page="agQ.page" v-model:page-size="agQ.pageSize" :total="agTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadAg" />
          </div>
        </el-tab-pane>

        <!-- ===== 行政处罚 ===== -->
        <el-tab-pane label="行政处罚" name="penalty">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">行政处罚</span>
            <span class="section-title__desc">
              立案 → 调查 → 告知 → 听证 → 法制审核 → 集体讨论 → 决定 → 送达 → 执行 → 结案（12 节点）
            </span>
          </div>

          <el-form class="query-form" :model="penQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="penQ.keyword" placeholder="处罚编号/案号/机构" clearable :prefix-icon="'Search'"
                @keyup.enter="penQ.page = 1; loadPen()" />
            </el-form-item>
            <el-form-item label="办理状态">
              <el-select v-model="penQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['办理中', '已决定', '已送达', '已结案']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="penQ.page = 1; loadPen()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(penQ, { keyword: '', status: '', page: 1 }); loadPen()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="penList" size="small" border stripe v-loading="penLoading">
            <el-table-column prop="caseNo" label="案号" width="168">
              <template #default="{ row }">
                <span class="num text-link" @click="openPen(row)">{{ row.caseNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="orgName" label="被处罚机构" min-width="168" show-overflow-tooltip />
            <el-table-column label="违规行为" width="112" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="danger" effect="plain">{{ row.violationFacts.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="办理进度" min-width="180">
              <template #default="{ row }">
                <div class="step-mini">
                  <el-progress :percentage="Math.round(((row.stepIndex + 1) / 12) * 100)" :stroke-width="9"
                    :text-inside="true" :status="row.stepIndex >= 11 ? 'success' : undefined" />
                  <span class="step-mini__t">{{ row.currentStep }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="责令退回" width="116" align="right">
              <template #default="{ row }">
                <span class="num num--money-mild">{{ fmtMoney(row.violationFacts.insuranceFundAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="罚款金额" width="116" align="right">
              <template #default="{ row }">
                <span class="num num--money">
                  {{ fmtMoney((row.penaltyDecision.measures.find((m: any) => m.type === '罚款') || {}).amount || 0) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="88" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '已结案' ? 'success' : row.status === '已送达' ? 'primary' : 'warning'" size="small" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openPen(row)">办理</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无行政处罚案件" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ penTotal }} 条</span>
            <el-pagination v-model:current-page="penQ.page" v-model:page-size="penQ.pageSize" :total="penTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadPen" />
          </div>
        </el-tab-pane>

        <!-- ===== 移送处理 ===== -->
        <el-tab-pane label="移送处理" name="transfer">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">移送处理</span>
            <span class="section-title__desc">
              涉嫌犯罪移送公安（个人≥5000元 / 单位≥5万元）· 违纪移送纪检 · 移送卫健 · 移送市监
            </span>
          </div>

          <el-form class="query-form" :model="trQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="trQ.keyword" placeholder="移送编号/机构" clearable :prefix-icon="'Search'"
                @keyup.enter="trQ.page = 1; loadTr()" />
            </el-form-item>
            <el-form-item label="移送类型">
              <el-select v-model="trQ.transferType" placeholder="全部类型" clearable>
                <el-option v-for="t in ['涉嫌犯罪移送公安', '违纪移送纪检', '移送卫健', '移送给市监']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="移送状态">
              <el-select v-model="trQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['待审批', '法制审核中', '已审批', '已移送', '已反馈']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="trQ.page = 1; loadTr()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(trQ, { keyword: '', transferType: '', status: '', page: 1 }); loadTr()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="trList" size="small" border stripe v-loading="trLoading">
            <el-table-column prop="transferId" label="移送编号" width="158">
              <template #default="{ row }">
                <span class="num text-link" @click="openTr(row)">{{ row.transferId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="orgName" label="被移送机构" min-width="164" show-overflow-tooltip />
            <el-table-column prop="transferType" label="移送类型" width="152" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.transferType.includes('公安') ? 'danger' : 'warning'" effect="dark">
                  {{ row.transferType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="targetOrg" label="接收单位" min-width="180" show-overflow-tooltip />
            <el-table-column prop="fraudAmount" label="涉案金额" width="120" align="right">
              <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.fraudAmount) }}</span></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="104" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '已反馈' ? 'success' : row.status === '已移送' ? 'primary' : 'warning'" size="small" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openTr(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无移送案件" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ trTotal }} 条</span>
            <el-pagination v-model:current-page="trQ.page" v-model:page-size="trQ.pageSize" :total="trTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadTr" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- ============ 协议处理详情 ============ -->
    <el-drawer v-model="agDrawer" size="640px" title="协议处理详情">
      <template v-if="curAg">
        <div class="hd-hero">
          <div class="hd-hero__t">
            {{ curAg.orgName }}
            <el-tag :type="(NATURE_TONE[curAg.problemNature] as any)" size="small" effect="dark">{{ curAg.problemNature }}</el-tag>
            <el-tag :type="(AG_STATUS_TONE[curAg.status] as any) || 'info'" size="small" effect="light">{{ curAg.status }}</el-tag>
          </div>
          <div class="hd-hero__m">
            <span><el-icon><Tickets /></el-icon>{{ curAg.handlingId }}</span>
            <span><el-icon><Files /></el-icon>{{ curAg.taskId }}</span>
            <span><el-icon><Coin /></el-icon>{{ fmtMoney(curAg.totalAmount) }}</span>
            <span><el-icon><Stamp /></el-icon>{{ curAg.approval.approvalLevel }}</span>
          </div>
        </div>

        <div class="sub-title">处置措施清单</div>
        <div class="ms-list">
          <div v-for="m in curAg.measures" :key="m.measureId" class="ms">
            <div class="ms__h">
              <el-tag :type="(MEASURE_TONE[m.measureType] as any) || 'info'" size="small" effect="dark">{{ m.measureType }}</el-tag>
              <el-tag size="small" effect="plain">{{ m.approval }}</el-tag>
              <el-tag :type="m.status === '已执行' ? 'success' : m.status === '执行中' ? 'warning' : 'info'" size="small" effect="plain">
                {{ m.status }}
              </el-tag>
              <span v-if="m.amount" class="ms__amt num num--money">{{ fmtMoney(m.amount) }}</span>
            </div>
            <div class="ms__c">{{ m.content }}</div>
            <div class="ms__f">
              <span><el-icon :size="11"><Document /></el-icon>{{ m.document.name }}</span>
              <span v-if="m.document.no" class="num">{{ m.document.no }}</span>
              <el-button link type="primary" size="small" :icon="'View'" @click="openMeasureDoc(m)">预览文书</el-button>
              <span class="ms__dl"><el-icon :size="11"><Clock /></el-icon>期限 {{ m.deadline }}</span>
            </div>
          </div>
        </div>

        <div class="sub-title">审批流转</div>
        <el-timeline class="ap-tl">
          <el-timeline-item type="primary" :timestamp="curAg.approval.proposeTime || '待提出'" size="normal">
            <div class="tl__n">承办人提出处理意见</div>
            <div class="tl__d">{{ curAg.approval.proposer }}</div>
          </el-timeline-item>
          <el-timeline-item :type="curAg.approval.reviewTime ? 'primary' : 'info'" :hollow="!curAg.approval.reviewTime"
            :timestamp="curAg.approval.reviewTime || '待复核'" size="normal">
            <div class="tl__n" :class="{ 'is-todo': !curAg.approval.reviewTime }">双人复核</div>
            <div class="tl__d">{{ curAg.approval.reviewer }}</div>
          </el-timeline-item>
          <el-timeline-item :type="curAg.approval.approveTime ? 'success' : 'info'" :hollow="!curAg.approval.approveTime"
            :timestamp="curAg.approval.approveTime || '待审批'" size="normal">
            <div class="tl__n" :class="{ 'is-todo': !curAg.approval.approveTime }">
              {{ curAg.approval.approvalLevel }}
            </div>
            <div class="tl__d">{{ curAg.approval.approver }}</div>
            <div v-if="curAg.approval.approvalOpinion" class="tl__o">{{ curAg.approval.approvalOpinion }}</div>
          </el-timeline-item>
        </el-timeline>

        <div class="dr-actions">
          <el-button v-if="!curAg.approval.approveTime" type="primary" :icon="'Stamp'" :loading="approving" @click="doApprove">
            审批通过
          </el-button>
          <el-button v-else type="success" :icon="'Select'" disabled>已审批</el-button>
          <el-button :icon="'Printer'" @click="curAg.measures?.[0] && openMeasureDoc(curAg.measures[0])">生成文书</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 行政处罚详情 ============ -->
    <el-drawer v-model="penDrawer" size="720px" title="行政处罚办理">
      <template v-if="curPen">
        <div class="hd-hero is-warn">
          <div class="hd-hero__t">
            {{ curPen.orgName }}
            <el-tag size="small" type="danger" effect="dark">{{ curPen.violationFacts.type }}</el-tag>
            <el-tag size="small" effect="light">{{ curPen.status }}</el-tag>
          </div>
          <div class="hd-hero__m">
            <span><el-icon><Stamp /></el-icon>{{ curPen.caseNo }}</span>
            <span><el-icon><Files /></el-icon>{{ curPen.taskId }}</span>
            <span><el-icon><Clock /></el-icon>{{ curPen.createTime }}</span>
          </div>
        </div>

        <div class="sub-title">违规事实与法律依据</div>
        <div class="fact-card">
          <div class="fact-card__c">{{ curPen.violationFacts.description }}</div>
          <div class="fact-card__amt">
            <span>涉案金额 <b class="num num--money">{{ fmtMoney(curPen.violationFacts.fraudAmount) }}</b></span>
            <span>涉及基金 <b class="num num--money">{{ fmtMoney(curPen.violationFacts.insuranceFundAmount) }}</b></span>
          </div>
          <div v-for="(a, i) in curPen.legalBasis.articles" :key="i" class="fact-law">
            <el-icon><Notebook /></el-icon>
            <b>{{ curPen.legalBasis.law }}{{ a.article }}</b>
            <span>{{ a.content }}</span>
          </div>
        </div>

        <div class="sub-title">处罚决定</div>
        <el-table :data="curPen.penaltyDecision.measures" size="small" border stripe>
          <el-table-column prop="type" label="处罚种类" width="112" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.type === '罚款' ? 'danger' : 'warning'" effect="dark">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="content" label="处罚内容" min-width="180" show-overflow-tooltip />
          <el-table-column prop="multiple" label="倍数" width="72" align="center">
            <template #default="{ row }">
              <span v-if="row.multiple" class="num">{{ row.multiple }} 倍</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="118" align="right">
            <template #default="{ row }">
              <span v-if="row.amount" class="num num--money">{{ fmtMoney(row.amount) }}</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="pen-total">
          合计 <b class="num num--money">{{ fmtMoney(curPen.penaltyDecision.totalAmount) }}</b>
          <span class="text-mini">签发人：{{ curPen.penaltyDecision.decisionMaker }}</span>
        </div>

        <div class="sub-title">处罚程序（12 节点）</div>
        <div class="steps-grid">
          <div v-for="(r, i) in curPen.procedureRecords" :key="i" class="pstep"
            :class="{ 'is-done': r.done, 'is-cur': i === curPen.stepIndex }">
            <div class="pstep__no num">{{ i + 1 }}</div>
            <div class="pstep__b">
              <div class="pstep__n">{{ r.step }}</div>
              <div v-if="r.done" class="pstep__m">
                <span class="num">{{ r.time }}</span>
                <span>{{ r.operator }}</span>
              </div>
              <div v-if="r.doc" class="pstep__d"><el-icon :size="10"><Document /></el-icon>{{ r.doc }}</div>
            </div>
            <el-icon v-if="r.done" class="pstep__ck"><CircleCheckFilled /></el-icon>
          </div>
        </div>

        <div class="sub-title">执行情况</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="执行状态">
            <el-tag :type="curPen.execution.status === '执行完毕' ? 'success' : curPen.execution.status === '执行中' ? 'warning' : 'info'" size="small" effect="dark">
              {{ curPen.execution.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="缴款期限"><span class="num">{{ curPen.execution.refundDeadline }}</span></el-descriptions-item>
          <el-descriptions-item label="已退回基金">
            <span class="num num--money">{{ fmtMoney(curPen.execution.refundedAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="已缴罚款">
            <span class="num num--money">{{ fmtMoney(curPen.execution.finePaidAmount) }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="dr-actions">
          <el-button v-if="curPen.stepIndex < 11" type="primary" :icon="'DArrowRight'" :loading="advancing" @click="doAdvance">
            完成「{{ curPen.currentStep }}」进入下一节点
          </el-button>
          <el-button v-else type="success" :icon="'Select'" disabled>案件已结案</el-button>
          <el-button type="danger" :icon="'Document'" @click="openPenaltyDoc">处罚决定书</el-button>
          <el-button :icon="'FolderOpened'" @click="exportCaseFile">导出案卷</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 移送详情 ============ -->
    <el-drawer v-model="trDrawer" size="660px" title="案件移送详情">
      <template v-if="curTr">
        <div class="hd-hero is-danger">
          <div class="hd-hero__t">
            {{ curTr.orgName }}
            <el-tag size="small" type="danger" effect="dark">{{ curTr.transferType }}</el-tag>
            <el-tag size="small" effect="light">{{ curTr.status }}</el-tag>
          </div>
          <div class="hd-hero__m">
            <span><el-icon><Position /></el-icon>{{ curTr.transferId }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ curTr.targetOrg }}</span>
            <span><el-icon><Coin /></el-icon>{{ fmtMoney(curTr.fraudAmount) }}</span>
          </div>
        </div>

        <div class="sub-title">移送理由与法律依据</div>
        <div class="fact-card">
          <div class="fact-card__c">{{ curTr.reason }}</div>
          <div v-for="(l, i) in curTr.legalBasis" :key="i" class="fact-law">
            <el-icon><Notebook /></el-icon><span>{{ l }}</span>
          </div>
        </div>

        <div class="sub-title">涉案人员</div>
        <el-table :data="curTr.suspects" size="small" border stripe>
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="role" label="职务" width="130" />
          <el-table-column prop="type" label="法律地位" min-width="220" show-overflow-tooltip />
        </el-table>

        <div class="sub-title">审批流转</div>
        <el-timeline class="ap-tl">
          <el-timeline-item type="primary" size="normal" timestamp="承办人提出">
            <div class="tl__n">移送建议</div>
            <div class="tl__d">{{ curTr.approval.proposer }}</div>
          </el-timeline-item>
          <el-timeline-item type="primary" size="normal" timestamp="法制审核">
            <div class="tl__n">{{ curTr.approval.legalReviewer }}</div>
            <div class="tl__o">{{ curTr.approval.legalOpinion }}</div>
          </el-timeline-item>
          <el-timeline-item :type="curTr.approval.approveTime ? 'success' : 'info'" :hollow="!curTr.approval.approveTime"
            :timestamp="curTr.approval.approveTime || '待审批'" size="normal">
            <div class="tl__n" :class="{ 'is-todo': !curTr.approval.approveTime }">局领导审批</div>
            <div class="tl__d">{{ curTr.approval.approver }}</div>
          </el-timeline-item>
        </el-timeline>

        <div class="sub-title">移送材料</div>
        <div class="mt-grid">
          <div v-for="(dd, i) in curTr.documents" :key="i" class="mt-doc">
            <el-icon><Document /></el-icon>
            <span class="mt-doc__n">{{ dd.name }}</span>
            <span v-if="dd.no" class="mt-doc__no num">{{ dd.no }}</span>
          </div>
        </div>
        <el-table :data="curTr.evidenceMaterials" size="small" border stripe class="mt8">
          <el-table-column prop="name" label="证据材料" min-width="180" />
          <el-table-column prop="type" label="证据类型" width="100" align="center">
            <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.type }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="pages" label="页数" width="80" align="right">
            <template #default="{ row }"><span class="num">{{ row.pages }}</span></template>
          </el-table-column>
        </el-table>

        <div class="sub-title">跟踪反馈</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="反馈状态">
            <el-tag :type="curTr.followUp.status === '已立案' ? 'success' : 'warning'" size="small" effect="dark">
              {{ curTr.followUp.status }}
            </el-tag>
            <span v-if="curTr.followUp.reminderCount" class="text-mini ml8">已催办 {{ curTr.followUp.reminderCount }} 次</span>
          </el-descriptions-item>
          <el-descriptions-item label="反馈内容">
            <span v-if="curTr.followUp.feedback">{{ curTr.followUp.feedback }}</span>
            <span v-else class="text-muted">暂无反馈，反馈期限 {{ curTr.followUp.feedbackDeadline }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="dr-actions">
          <el-button v-if="curTr.status !== '已移送' && curTr.status !== '已反馈'" type="danger" :icon="'Position'"
            :loading="transferring" @click="doTransfer">通过两法衔接平台移送</el-button>
          <el-button v-else type="success" :icon="'Select'" disabled>已移送</el-button>
          <el-button type="primary" :icon="'Document'" @click="openTransferDoc">案件移送函</el-button>
          <el-button :icon="'BellFilled'" @click="msg.success('已向接收单位发送办理进度催办函')">催办反馈</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 处置依据推荐 ============ -->
    <el-dialog v-model="basisVisible" title="处置依据智能推荐" width="820px" top="6vh">
      <div class="bs-pick">
        <span class="text-mini">选择违规确认书：</span>
        <el-select v-model="pickedConf" filterable style="width: 330px" @change="runBasis">
          <el-option v-for="c in confOptions" :key="c.confirmationId"
            :label="`${c.confirmationId} · ${c.orgName}`" :value="c.confirmationId" />
        </el-select>
        <el-button type="primary" :icon="'MagicStick'" :loading="basisLoading" @click="runBasis">重新推荐</el-button>
      </div>

      <div v-loading="basisLoading" class="bs-body">
        <template v-if="basis">
          <el-alert type="info" :closable="false" show-icon class="mb12">
            <template #title>
              <span class="text-mini">
                违规类型：{{ basis.violationTypes.join('、') }} · 涉及金额
                <b class="num">{{ fmtMoney(basis.violationAmount) }}</b>
                <template v-if="basis.isFraud"> · <b style="color: var(--zh-danger)">涉嫌欺诈骗保</b></template>
              </span>
            </template>
          </el-alert>

          <div class="sub-title">① 定性依据（禁止性条款）</div>
          <div class="bs-list">
            <div v-for="(b, i) in basis.qualitativeBasis" :key="i" class="bs">
              <div class="bs__h">
                <el-tag size="small" :type="b.type === '法规' ? 'primary' : 'success'" effect="dark">{{ b.type }}</el-tag>
                <b>{{ b.name }}</b>
                <el-tag size="small" effect="plain">{{ b.article }}</el-tag>
                <el-tag size="small" type="success" effect="plain">{{ b.effective }}</el-tag>
              </div>
              <div class="bs__c">{{ b.content }}</div>
            </div>
          </div>

          <div class="sub-title">② 处罚依据（法律责任条款）</div>
          <div class="bs-list">
            <div v-for="(b, i) in basis.penaltyBasis" :key="i" class="bs is-pen">
              <div class="bs__h">
                <el-tag size="small" type="danger" effect="dark">处罚依据</el-tag>
                <b>{{ b.name }}</b>
                <el-tag size="small" effect="plain">{{ b.article }}</el-tag>
                <el-tag size="small" type="danger" effect="plain">{{ b.penaltyRange }}</el-tag>
              </div>
              <div class="bs__c">{{ b.content }}</div>
            </div>
          </div>

          <div class="sub-title">③ 裁量基准</div>
          <div class="ds-card">
            <div class="ds-card__h">
              <el-icon><Medal /></el-icon>
              <b>{{ basis.discretionStandard.standardName }}</b>
              <el-tag size="small" type="warning" effect="dark">建议 {{ basis.discretionStandard.suggestedMultiple }} 倍</el-tag>
            </div>
            <div class="ds-row">
              <span class="ds-row__k">适用档次</span>
              <span class="ds-row__v">{{ basis.discretionStandard.violationType }} · {{ basis.discretionStandard.amountRange }}</span>
            </div>
            <div class="ds-row">
              <span class="ds-row__k">从轻情节</span>
              <span class="ds-row__v">
                <el-tag v-for="f in basis.discretionStandard.factors['从轻']" :key="f" size="small" type="success" effect="plain" class="mr4">{{ f }}</el-tag>
              </span>
            </div>
            <div class="ds-row">
              <span class="ds-row__k">从重情节</span>
              <span class="ds-row__v">
                <el-tag v-for="f in basis.discretionStandard.factors['从重']" :key="f" size="small" type="danger" effect="plain" class="mr4">{{ f }}</el-tag>
              </span>
            </div>
            <div class="ds-row">
              <span class="ds-row__k">本案认定</span>
              <span class="ds-row__v">
                <el-tag v-for="f in basis.discretionStandard.caseFactors" :key="f" size="small" type="warning" effect="dark" class="mr4">{{ f }}</el-tag>
              </span>
            </div>
            <div class="ds-result">
              <el-icon><InfoFilled /></el-icon>{{ basis.discretionStandard.suggestedResult }}
            </div>
          </div>

          <div class="sub-title">④ 参考案例</div>
          <el-table :data="basis.referenceCases" size="small" border stripe max-height="220">
            <el-table-column prop="caseName" label="案例名称" min-width="190" show-overflow-tooltip />
            <el-table-column prop="orgType" label="机构类型" width="100" align="center" />
            <el-table-column prop="amount" label="涉案金额" width="112" align="right">
              <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column prop="result" label="处置结果" width="150" show-overflow-tooltip />
            <el-table-column prop="similarity" label="相似度" width="96" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.similarity >= 88 ? 'danger' : row.similarity >= 78 ? 'warning' : 'info'" effect="dark">
                  {{ row.similarity }}%
                </el-tag>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无相似案例" height="90px" /></template>
          </el-table>

          <el-alert v-if="!basis.expiredWarnings.length" type="success" :closable="false" show-icon class="mt12">
            <template #title><span class="text-mini">所引用法规条款均为现行有效，未发现失效条文</span></template>
          </el-alert>
        </template>
        <EmptyState v-else-if="!basisLoading" text="请选择违规确认书获取推荐" height="180px" />
      </div>

      <template #footer>
        <el-button @click="basisVisible = false">关闭</el-button>
        <el-button type="primary" :icon="'DocumentCopy'" @click="msg.success('推荐依据已引用至处置决定')">引用至处置决定</el-button>
      </template>
    </el-dialog>

    <!-- 文书预览 -->
    <DocPreview v-model:visible="docVisible" :doc="curDoc" />
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

.top-grid {
  display: grid; grid-template-columns: 260px 1fr 1.3fr; gap: 12px; align-items: start;
  @media (max-width: 1300px) { grid-template-columns: 1fr; }
}

.kpi-col { display: flex; flex-direction: column; gap: 12px; }

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.step-mini {
  display: flex; align-items: center; gap: 7px;
  :deep(.el-progress) { flex: 1; }
  &__t { flex-shrink: 0; font-size: 10px; color: var(--zh-text-secondary); white-space: nowrap; }
}

/* ---------- 抽屉头部 ---------- */
.hd-hero {
  padding: 11px 13px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &.is-warn { background: linear-gradient(120deg, var(--zh-warning-light), #fff); border-color: var(--zh-warning); }
  &.is-danger { background: linear-gradient(120deg, var(--zh-risk-high-bg), #fff); border-color: var(--zh-risk-high-border); }

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
}

/* ---------- 措施 ---------- */
.ms-list { display: flex; flex-direction: column; gap: 8px; }

.ms {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--zh-primary);

  &__h { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  &__amt { margin-left: auto; font-size: 11px; }
  &__c { margin-top: 6px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }
  &__f {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 6px;
    padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
    font-size: 10px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-accent); }
  }
  &__dl { margin-left: auto; }
}

/* ---------- 审批时间轴 ---------- */
.ap-tl {
  padding-left: 4px;
  :deep(.el-timeline-item) { padding-bottom: 13px; }
  :deep(.el-timeline-item__timestamp) { font-size: 10px; }
}

.tl__n {
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
  &.is-todo { color: var(--zh-text-placeholder); font-weight: 400; }
}
.tl__d { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
.tl__o {
  margin-top: 4px; padding: 5px 8px; border-radius: 4px;
  background: var(--zh-bg-soft); font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary);
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 事实卡 ---------- */
.fact-card {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__c { font-size: 11px; line-height: 1.85; color: var(--zh-text-regular); }
  &__amt {
    display: flex; gap: 18px; flex-wrap: wrap; margin-top: 8px;
    padding-top: 7px; border-top: 1px dashed var(--zh-border-light);
    font-size: 11px; color: var(--zh-text-secondary);
  }
}

.fact-law {
  display: flex; align-items: flex-start; gap: 5px; margin-top: 7px;
  font-size: 10px; line-height: 1.75; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
  b { color: var(--zh-text-primary); flex-shrink: 0; }
}

.pen-total {
  display: flex; align-items: center; gap: 14px; margin-top: 7px;
  font-size: 11px; color: var(--zh-text-secondary); justify-content: flex-end;
  b { font-size: 13px; }
}

/* ---------- 处罚程序 ---------- */
.steps-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.pstep {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 7px 9px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &.is-done { background: var(--zh-success-light); border-color: var(--zh-success); }
  &.is-cur { background: var(--zh-warning-light); border-color: var(--zh-warning); box-shadow: 0 0 0 2px rgba(232, 163, 12, .14); }

  &__no {
    flex-shrink: 0; width: 18px; height: 18px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--zh-border-strong); color: #fff; font-size: 9px; font-weight: 700;
  }
  &.is-done &__no { background: var(--zh-success); }
  &.is-cur &__no { background: var(--zh-warning); }

  &__b { flex: 1; min-width: 0; }
  &__n { font-size: 11px; font-weight: 600; color: var(--zh-text-primary); }
  &__m {
    display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px;
    font-size: 9px; color: var(--zh-text-secondary);
  }
  &__d {
    display: flex; align-items: center; gap: 3px; margin-top: 2px;
    font-size: 9px; color: var(--zh-text-placeholder);
  }
  &__ck { flex-shrink: 0; color: var(--zh-success); font-size: 13px; }
}

/* ---------- 移送材料 ---------- */
.mt-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.mt-doc {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 9px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: 11px;
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; }
  &__n { flex: 1; color: var(--zh-text-primary); }
  &__no { font-size: 9px; color: var(--zh-text-secondary); }
}

/* ---------- 依据推荐 ---------- */
.bs-pick {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding-bottom: 11px; margin-bottom: 11px;
  border-bottom: 1px dashed var(--zh-border-light);
}

.bs-body { max-height: 62vh; overflow-y: auto; padding-right: 4px; }

.bs-list { display: flex; flex-direction: column; gap: 8px; }

.bs {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--zh-primary);

  &.is-pen { border-left-color: var(--zh-danger); background: var(--zh-risk-high-bg); }

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    b { color: var(--zh-text-primary); }
  }
  &__c {
    margin-top: 5px; font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary);
    padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
  }
}

.ds-card {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-warning-light); border: 1px solid var(--zh-warning);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-warning); }
    b { color: var(--zh-text-primary); }
  }
}

.ds-row {
  display: flex; gap: 9px; margin-top: 7px; font-size: 11px; line-height: 1.9;
  &__k { flex-shrink: 0; width: 58px; color: var(--zh-text-secondary); }
  &__v { flex: 1; }
}

.ds-result {
  display: flex; align-items: center; gap: 5px; margin-top: 9px;
  padding: 7px 10px; border-radius: 6px;
  background: #fff; border: 1px solid var(--zh-warning);
  font-size: 11px; font-weight: 600; color: var(--zh-text-primary);
  :deep(.el-icon) { color: var(--zh-warning); }
}
</style>
