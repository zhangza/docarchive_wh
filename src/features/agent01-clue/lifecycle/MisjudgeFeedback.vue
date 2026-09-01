<script setup lang="ts">
import {
  getFeedbackStats, getFeedbackList, getFeedbackDetail,
  submitFeedback, handleFeedback, getFeedbackRules, optimizeRule
} from '@/api/agent01-clue/lifecycle'
import { getClueList } from '@/api/agent01-clue/clue'
import { CHART_COLORS, CHART_GRID } from '@/utils/format'

const FB_TYPES = ['规则误判', '规则覆盖缺口', '数据质量问题', '阈值设置不当', '其他']
const FB_STATUS = ['待确认', '已确认', '优化中', '已优化', '不予采纳']
const CATEGORIES = ['用药类', '诊疗类', '收费类', '行为类', '资质类']

const st = ref<any>(null)
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const expand = ref(false)

const q = reactive({
  keyword: '', feedbackType: '', status: '', category: '',
  rateMin: undefined as any, rateMax: undefined as any,
  dateRange: [] as string[], page: 1, pageSize: 15
})

async function loadStats() { st.value = await getFeedbackStats() }
async function load() {
  loading.value = true
  try {
    const { dateRange, ...rest } = q
    const res: any = await getFeedbackList({
      ...rest, startTime: dateRange?.[0] || '', endTime: dateRange?.[1] || ''
    })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}
function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, {
    keyword: '', feedbackType: '', status: '', category: '',
    rateMin: undefined, rateMax: undefined, dateRange: [], page: 1
  })
  load()
}
function quick(s: string) { doReset(); q.status = s; load() }

/* ===== 规则榜 ===== */
const rules = ref<any[]>([])
const rLoading = ref(false)
async function loadRules() {
  rLoading.value = true
  try {
    const res: any = await getFeedbackRules({ page: 1, pageSize: 10 })
    rules.value = res.list
  } finally { rLoading.value = false }
}

/* ===== 图表 ===== */
const typeOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 条 ({d}%)' },
  legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
  color: CHART_COLORS,
  series: [{
    type: 'pie', radius: ['42%', '68%'], center: ['50%', '42%'], roseType: 'radius',
    itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
    label: { show: false },
    data: (st.value?.typeDist || []).map((i: any) => ({ name: i.name, value: i.value }))
  }]
}))

const accOption = computed(() => {
  const rows: any[] = st.value?.accuracyTrend || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 9, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, bottom: 44 },
    xAxis: { type: 'category', data: rows.map((r) => r.version), axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', name: '准确率%', min: 80, max: 100, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
      { type: 'value', name: '误判率%', min: 0, max: 20, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, splitLine: { show: false } }
    ],
    series: [
      {
        name: '模型准确率', type: 'line', smooth: true, symbolSize: 7,
        itemStyle: { color: '#12a150' }, lineStyle: { width: 2.6 },
        areaStyle: { color: 'rgba(18,161,80,.12)' },
        label: { show: true, fontSize: 10, formatter: '{c}%' },
        data: rows.map((r) => r.accuracy)
      },
      {
        name: '误判率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6,
        itemStyle: { color: '#e5484d' }, lineStyle: { width: 2.2, type: 'dashed' },
        data: rows.map((r) => r.misjudgeRate)
      }
    ]
  }
})

const ruleOption = computed(() => {
  const rows = (st.value?.ruleRank || []).slice(0, 8)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => `${p[0].name}<br/>误判率 ${p[0].value}%` },
    grid: { ...CHART_GRID, left: 118, right: 46 },
    xAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: {
      type: 'category', inverse: true,
      axisLabel: { fontSize: 10, width: 110, overflow: 'truncate' },
      data: rows.map((r: any) => r.ruleName)
    },
    series: [{
      type: 'bar', barWidth: 13,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (p: any) => (p.value >= 10 ? '#e5484d' : p.value >= 6 ? '#e8a30c' : '#12a150')
      },
      label: { show: true, position: 'right', fontSize: 10, formatter: '{c}%' },
      data: rows.map((r: any) => r.misjudgeRate)
    }]
  }
})

/* ===== 提交反馈 ===== */
const subVisible = ref(false)
const submitting = ref(false)
const clueOpts = ref<any[]>([])
const sForm = reactive({
  clueId: '', feedbackType: '规则误判', ruleId: '', reason: '', suggestion: '', negativeSample: true
})
async function openSubmit() {
  subVisible.value = true
  if (!clueOpts.value.length) {
    const res: any = await getClueList({ status: '已驳回', page: 1, pageSize: 30 })
    clueOpts.value = res.list
  }
  if (!rules.value.length) loadRules()
}
function pickClue(id: string) {
  const c = clueOpts.value.find((x) => x.clueId === id)
  if (c?.ruleId) sForm.ruleId = c.ruleId
}
async function doSubmit() {
  if (!sForm.clueId) return ElMessage.warning('请选择关联线索')
  if (!sForm.ruleId) return ElMessage.warning('请选择涉及规则')
  if (sForm.reason.trim().length < 15) return ElMessage.warning('误判原因不少于 15 字')
  submitting.value = true
  try {
    const r: any = await submitFeedback({ ...sForm })
    ElMessage.success(r.message)
    subVisible.value = false
    Object.assign(sForm, { clueId: '', feedbackType: '规则误判', ruleId: '', reason: '', suggestion: '', negativeSample: true })
    loadStats(); load()
  } finally { submitting.value = false }
}

/* ===== 详情 / 优化 ===== */
const drawer = ref(false)
const dLoading = ref(false)
const cur = ref<any>(null)
async function openDetail(row: any) {
  drawer.value = true
  dLoading.value = true
  cur.value = null
  optRes.value = null
  try { cur.value = await getFeedbackDetail({ feedbackId: row.feedbackId }) }
  finally { dLoading.value = false }
}

const handling = ref(false)
async function doHandle(status: string) {
  handling.value = true
  try {
    const r: any = await handleFeedback({ feedbackId: cur.value.feedbackId, status })
    ElMessage.success(r.message)
    cur.value.status = status
    load(); loadStats()
  } finally { handling.value = false }
}

const optimizing = ref(false)
const optRes = ref<any>(null)
const optStep = ref(0)
const OPT_PHASES = ['汇聚误判负样本', '重训练置信度模型', '规则阈值自动调优', '灰度回归验证', '灰度上线发布']
let optTimer: any = null

async function doOptimize() {
  optimizing.value = true
  optRes.value = null
  optStep.value = 0
  optTimer = setInterval(() => {
    if (optStep.value < OPT_PHASES.length - 1) optStep.value++
  }, 520)
  try {
    const r: any = await optimizeRule({ ruleId: cur.value.ruleId, feedbackId: cur.value.feedbackId })
    optRes.value = r
    optStep.value = OPT_PHASES.length
    cur.value.status = '已优化'
    ElMessage.success(r.message)
    load(); loadStats()
  } finally {
    clearInterval(optTimer)
    optimizing.value = false
  }
}
onBeforeUnmount(() => clearInterval(optTimer))

const STATUS_TONE: Record<string, any> = {
  待确认: 'info', 已确认: 'primary', 优化中: 'warning', 已优化: 'success', 不予采纳: 'danger'
}
function rateTone(v: number) { return v >= 10 ? 'danger' : v >= 6 ? 'warning' : 'success' }

onMounted(() => { loadStats(); load(); loadRules() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="误判反馈与模型迭代" tag="M15"
      subtitle="稽核人员误判反馈 · 负样本沉淀 · 规则阈值自动调优 · 模型闭环持续进化">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load(); loadRules()">刷新</el-button>
        <el-button :icon="'Guide'" @click="quick('待确认')">待确认反馈</el-button>
        <el-button type="primary" :icon="'EditPen'" @click="openSubmit">提交误判反馈</el-button>
      </template>
    </PageHeader>

    <!-- 模型进化横幅 -->
    <div class="evo">
      <div class="evo__l">
        <div class="evo__ic"><el-icon :size="24"><MagicStick /></el-icon></div>
        <div>
          <div class="evo__t">
            AI 识别模型持续进化中
            <el-tag type="success" size="small" effect="dark">当前 {{ st?.modelVersion || 'v2.3.2' }}</el-tag>
          </div>
          <div class="evo__d">
            累计沉淀负样本 <b class="num">{{ st?.negativeSamples || 0 }}</b> 条，
            模型准确率由 <b class="num">86.4%</b> 提升至 <b class="num hl">{{ st?.modelAccuracy || 0 }}%</b>，
            平均误判率降至 <b class="num hl">{{ st?.avgMisjudgeRate || 0 }}%</b>
          </div>
        </div>
      </div>
      <div class="evo__r">
        <div class="ev-n"><span>准确率提升</span><b class="num">+{{ st?.accuracyImprove || 0 }}<i>pt</i></b></div>
        <div class="ev-bar">
          <div class="ev-bar__f" :style="{ width: `${st?.modelAccuracy || 0}%` }" />
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="反馈总量" :value="st?.totalFeedback || 0" unit="条" icon="ChatLineSquare" tone="primary" />
      <StatCard label="待确认" :value="st?.pending || 0" unit="条" icon="Clock" tone="warning"
        clickable @click="quick('待确认')" />
      <StatCard label="优化中" :value="st?.optimizing || 0" unit="条" icon="Loading" tone="accent"
        clickable @click="quick('优化中')" />
      <StatCard label="已优化" :value="st?.optimized || 0" unit="条" icon="CircleCheck" tone="success"
        clickable @click="quick('已优化')" />
      <StatCard label="平均误判率" :value="st?.avgMisjudgeRate || 0" unit="%" icon="Warning" tone="danger" :precision="1" />
      <StatCard label="模型准确率" :value="st?.modelAccuracy || 0" unit="%" icon="Aim" tone="success" :precision="1"
        :trend="st?.accuracyImprove || 0" :trend-text="`较上版本 +${st?.accuracyImprove || 0}pt`" />
      <StatCard label="负样本沉淀" :value="st?.negativeSamples || 0" unit="条" icon="Coin" tone="purple"
        desc="用于模型重训练" />
      <StatCard label="规则总数" :value="(st?.ruleRank || []).length" unit="条" icon="Document" tone="primary"
        desc="纳入误判监测的规则" />
    </div>

    <div class="chart-row">
      <SectionCard title="反馈类型分布" desc="按误判成因归类" tight>
        <EChart :option="typeOption" height="238px" />
      </SectionCard>
      <SectionCard title="模型版本准确率演进" desc="每次迭代的准确率与误判率变化" tight>
        <EChart :option="accOption" height="238px" />
      </SectionCard>
      <SectionCard title="高误判率规则 TOP8" desc="优先纳入优化排期" tight>
        <EChart :option="ruleOption" height="238px" />
      </SectionCard>
    </div>

    <!-- 规则健康度 -->
    <SectionCard title="规则健康度榜" desc="命中量、误判量、误判率与规则版本状态" tight>
      <template #extra>
        <span class="text-mini">误判率 ≥10% 建议立即优化</span>
      </template>
      <el-table :data="rules" v-loading="rLoading" size="small" border stripe>
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="ruleId" label="规则编号" width="132">
          <template #default="{ row }"><span class="num">{{ row.ruleId }}</span></template>
        </el-table-column>
        <el-table-column prop="ruleName" label="规则名称" min-width="230" show-overflow-tooltip />
        <el-table-column prop="category" label="所属大类" width="98" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.category }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="hitCount" label="命中量" width="96" align="right">
          <template #default="{ row }"><span class="num">{{ row.hitCount }}</span></template>
        </el-table-column>
        <el-table-column prop="misjudgeCount" label="误判量" width="96" align="right">
          <template #default="{ row }"><span class="num is-red">{{ row.misjudgeCount }}</span></template>
        </el-table-column>
        <el-table-column prop="misjudgeRate" label="误判率" min-width="188" sortable>
          <template #default="{ row }">
            <div class="rr">
              <el-progress :percentage="Math.min(100, row.misjudgeRate * 5)" :stroke-width="8" :show-text="false"
                :color="row.misjudgeRate >= 10 ? '#e5484d' : row.misjudgeRate >= 6 ? '#e8a30c' : '#12a150'" />
              <span class="num" :class="`c-${rateTone(row.misjudgeRate)}`">{{ row.misjudgeRate }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="86" align="center">
          <template #default="{ row }"><span class="num text-mini">{{ row.version }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无规则数据" height="140px" /></template>
      </el-table>
    </SectionCard>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">误判反馈检索</span>
        <span class="section-title__desc">支持反馈编号、线索号、规则名称、原因内容模糊检索</span>
      </div>
      <el-form class="query-form" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="反馈编号 / 线索号 / 规则 / 原因" clearable @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="反馈类型">
          <el-select v-model="q.feedbackType" placeholder="全部" clearable>
            <el-option v-for="t in FB_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="q.status" placeholder="全部" clearable>
            <el-option v-for="s in FB_STATUS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则大类">
          <el-select v-model="q.category" placeholder="全部" clearable>
            <el-option v-for="c in CATEGORIES" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="误判率">
            <div class="amt">
              <el-input-number v-model="q.rateMin" :min="0" :max="100" :controls="false" placeholder="最小%" />
              <span>—</span>
              <el-input-number v-model="q.rateMax" :min="0" :max="100" :controls="false" placeholder="最大%" />
            </div>
          </el-form-item>
          <el-form-item label="提交时间" class="is-wide">
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
        <span>共 <b class="num">{{ total }}</b> 条误判反馈</span>
        <div class="table-toolbar__right">
          <span class="text-mini">双击行进入反馈详情与模型优化</span>
        </div>
      </div>
      <el-table :data="list" v-loading="loading" size="small" border stripe @row-dblclick="openDetail">
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="feedbackId" label="反馈编号" width="146">
          <template #default="{ row }">
            <span class="text-link num" @click="openDetail(row)">{{ row.feedbackId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clueId" label="关联线索" width="146">
          <template #default="{ row }"><span class="num text-mini">{{ row.clueId }}</span></template>
        </el-table-column>
        <el-table-column prop="feedbackType" label="反馈类型" width="118" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.feedbackType }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="ruleId" label="规则编号" width="126">
          <template #default="{ row }"><span class="num text-mini">{{ row.ruleId }}</span></template>
        </el-table-column>
        <el-table-column prop="ruleName" label="规则名称" min-width="196" show-overflow-tooltip />
        <el-table-column prop="category" label="大类" width="86" align="center" />
        <el-table-column label="命中/误判" width="106" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.hitCount }}</span>
            <span class="text-muted"> / </span>
            <span class="num is-red">{{ row.misjudgeCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="misjudgeRate" label="误判率" width="96" align="right" sortable>
          <template #default="{ row }">
            <span class="num" :class="`c-${rateTone(row.misjudgeRate)}`">{{ row.misjudgeRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="误判原因" min-width="240" show-overflow-tooltip />
        <el-table-column prop="submitter" label="反馈人" width="122" show-overflow-tooltip />
        <el-table-column prop="submitTime" label="提交时间" width="152">
          <template #default="{ row }"><span class="num text-mini">{{ row.submitTime }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="92" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优化效果" min-width="164" align="center">
          <template #default="{ row }">
            <template v-if="row.effectAfter">
              <span class="num is-red">{{ row.misjudgeRate }}%</span>
              <el-icon class="ar"><Right /></el-icon>
              <span class="num is-ok">{{ row.effectAfter.misjudgeRate }}%</span>
              <div class="text-mini">准确率 {{ row.effectAfter.accuracy }}% (+{{ row.effectAfter.improve }}pt)</div>
            </template>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="负样本" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.negativeSample" type="success" size="small" effect="plain">已沉淀</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="86" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'MagicStick'" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无误判反馈" desc="稽核人员在研判/复核中发现误判可随时反馈" /></template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @current-change="load" @size-change="q.page = 1; load()" />
      </div>
    </div>

    <!-- 提交反馈 -->
    <el-dialog v-model="subVisible" title="提交误判反馈" width="700px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
        title="稽核人员在研判或复核中发现规则/模型误判的，可在此提交反馈。反馈将作为负样本沉淀至模型训练集，用于规则阈值调优与模型重训练。" />
      <el-form label-width="106px">
        <el-form-item label="关联线索" required>
          <el-select v-model="sForm.clueId" filterable placeholder="选择被误判的线索（默认取已驳回线索）"
            style="width: 100%" @change="pickClue">
            <el-option v-for="c in clueOpts" :key="c.clueId"
              :label="`${c.clueId} · ${c.violationType} · ${c.orgName}`" :value="c.clueId" />
          </el-select>
        </el-form-item>
        <el-form-item label="反馈类型" required>
          <el-radio-group v-model="sForm.feedbackType">
            <el-radio v-for="t in FB_TYPES" :key="t" :value="t" border size="small" class="rd">{{ t }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="涉及规则" required>
          <el-select v-model="sForm.ruleId" filterable placeholder="选择产生误判的规则" style="width: 100%">
            <el-option v-for="r in rules" :key="r.ruleId"
              :label="`${r.ruleId} · ${r.ruleName}（误判率 ${r.misjudgeRate}%）`" :value="r.ruleId" />
          </el-select>
        </el-form-item>
        <el-form-item label="误判原因" required>
          <el-input v-model="sForm.reason" type="textarea" :rows="4" maxlength="500" show-word-limit
            placeholder="请说明为何认定该线索属误判。例如：患者属 2 型糖尿病门诊慢特病，符合长处方政策豁免条件，现行规则未设置特殊病种白名单，导致合理长处方被误判为超量开药。" />
        </el-form-item>
        <el-form-item label="优化建议">
          <el-input v-model="sForm.suggestion" type="textarea" :rows="3" maxlength="300" show-word-limit
            placeholder="例如：建议在规则中增加门诊慢特病白名单豁免逻辑，并按机构等级差异化设置阈值。" />
        </el-form-item>
        <el-form-item label="沉淀负样本">
          <el-switch v-model="sForm.negativeSample" active-text="纳入模型训练集" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="subVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :icon="'Promotion'" @click="doSubmit">提交反馈</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawer" :title="`误判反馈详情 · ${cur?.feedbackId || ''}`" size="900px">
      <div v-loading="dLoading" class="fd">
        <template v-if="cur">
          <div class="fd-hero">
            <div>
              <div class="fd-hero__t">
                {{ cur.ruleName }}
                <el-tag size="small" effect="plain">{{ cur.feedbackType }}</el-tag>
                <el-tag :type="STATUS_TONE[cur.status] || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              </div>
              <div class="fd-hero__m">
                <span><el-icon><Document /></el-icon>{{ cur.ruleId }}</span>
                <span><el-icon><Files /></el-icon>{{ cur.clueId }}</span>
                <span><el-icon><User /></el-icon>{{ cur.submitter }}</span>
                <span><el-icon><Clock /></el-icon>{{ cur.submitTime }}</span>
              </div>
            </div>
            <div class="fd-hero__n">
              <div class="fn"><span>命中量</span><b class="num">{{ cur.hitCount }}</b></div>
              <div class="fn"><span>误判量</span><b class="num is-red">{{ cur.misjudgeCount }}</b></div>
              <div class="fn"><span>误判率</span>
                <b class="num" :class="`c-${rateTone(cur.misjudgeRate)}`">{{ cur.misjudgeRate }}%</b>
              </div>
            </div>
          </div>

          <SectionCard title="误判原因与优化建议" tight>
            <div class="qa">
              <div class="qa__l"><el-icon><WarnTriangleFilled /></el-icon>误判原因</div>
              <div class="qa__c">{{ cur.reason }}</div>
            </div>
            <div class="qa mt10">
              <div class="qa__l is-ok"><el-icon><MagicStick /></el-icon>优化建议</div>
              <div class="qa__c">{{ cur.suggestion }}</div>
            </div>
          </SectionCard>

          <SectionCard title="模型迭代优化" desc="基于误判负样本触发规则阈值调优与模型重训练" tight>
            <template #extra>
              <el-tag v-if="cur.modelVersion" type="success" size="small" effect="dark">{{ cur.modelVersion }}</el-tag>
            </template>

            <!-- 优化进行中 -->
            <div v-if="optimizing" class="opt-run">
              <el-steps :active="optStep" align-center>
                <el-step v-for="(p, i) in OPT_PHASES" :key="i" :title="p" />
              </el-steps>
              <div class="opt-run__t">
                <el-icon class="is-loading" :size="18"><Loading /></el-icon>
                正在执行：{{ OPT_PHASES[Math.min(optStep, OPT_PHASES.length - 1)] }}…
              </div>
            </div>

            <!-- 本次优化结果 -->
            <template v-else-if="optRes">
              <div class="opt-ok">
                <el-icon :size="20"><SuccessFilled /></el-icon>
                <div>
                  <b>优化完成并灰度上线</b>
                  <span>{{ optRes.message }}</span>
                </div>
              </div>
              <div class="cmp">
                <div class="cmp__c is-before">
                  <div class="cmp__v">{{ optRes.oldVersion }}</div>
                  <div class="cmp__n num is-red">{{ optRes.beforeMisjudgeRate }}%</div>
                  <div class="cmp__l">优化前误判率</div>
                </div>
                <div class="cmp__ar"><el-icon :size="22"><DArrowRight /></el-icon></div>
                <div class="cmp__c is-after">
                  <div class="cmp__v">{{ optRes.newVersion }}</div>
                  <div class="cmp__n num is-ok">{{ optRes.afterMisjudgeRate }}%</div>
                  <div class="cmp__l">优化后误判率</div>
                </div>
                <div class="cmp__c is-plain">
                  <div class="cmp__v">模型准确率</div>
                  <div class="cmp__n num is-ok">{{ optRes.accuracy }}%</div>
                  <div class="cmp__l">较上版本 +{{ optRes.improve }}pt</div>
                </div>
                <div class="cmp__c is-plain">
                  <div class="cmp__v">训练样本</div>
                  <div class="cmp__n num">{{ optRes.trainSamples }}</div>
                  <div class="cmp__l">耗时 {{ optRes.costMs }}ms</div>
                </div>
              </div>
            </template>

            <!-- 历史优化效果 -->
            <template v-else-if="cur.effectAfter">
              <div class="cmp">
                <div class="cmp__c is-before">
                  <div class="cmp__v">优化前</div>
                  <div class="cmp__n num is-red">{{ cur.misjudgeRate }}%</div>
                  <div class="cmp__l">误判率</div>
                </div>
                <div class="cmp__ar"><el-icon :size="22"><DArrowRight /></el-icon></div>
                <div class="cmp__c is-after">
                  <div class="cmp__v">优化后</div>
                  <div class="cmp__n num is-ok">{{ cur.effectAfter.misjudgeRate }}%</div>
                  <div class="cmp__l">误判率</div>
                </div>
                <div class="cmp__c is-plain">
                  <div class="cmp__v">模型准确率</div>
                  <div class="cmp__n num is-ok">{{ cur.effectAfter.accuracy }}%</div>
                  <div class="cmp__l">+{{ cur.effectAfter.improve }}pt</div>
                </div>
                <div class="cmp__c is-plain">
                  <div class="cmp__v">处理人</div>
                  <div class="cmp__n sm">{{ cur.handler || '—' }}</div>
                  <div class="cmp__l num">{{ cur.handleTime || '—' }}</div>
                </div>
              </div>
            </template>

            <!-- 待处理操作 -->
            <template v-else>
              <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
                title="该反馈尚未完成模型优化。确认反馈成立后可一键触发规则阈值调优与模型重训练，系统将自动完成灰度回归并发布新版本。" />
              <div class="opt-btns">
                <el-button :loading="handling" :icon="'CircleCheck'" @click="doHandle('已确认')">确认反馈成立</el-button>
                <el-button :loading="handling" :icon="'CircleClose'" @click="doHandle('不予采纳')">不予采纳</el-button>
                <el-button type="primary" :icon="'MagicStick'" @click="doOptimize">一键触发模型优化</el-button>
              </div>
            </template>
          </SectionCard>

          <div class="loop">
            <div class="loop__t"><el-icon><Refresh /></el-icon>闭环进化机制</div>
            <div class="loop__f">
              <div class="lp">误判反馈</div><el-icon><Right /></el-icon>
              <div class="lp">负样本入库</div><el-icon><Right /></el-icon>
              <div class="lp">阈值/规则调优</div><el-icon><Right /></el-icon>
              <div class="lp">模型重训练</div><el-icon><Right /></el-icon>
              <div class="lp">灰度回归</div><el-icon><Right /></el-icon>
              <div class="lp is-end">准确率提升</div>
            </div>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.mt10 { margin-top: 10px; }
.is-red { color: var(--zh-danger); }
.is-ok { color: var(--zh-success); }
.c-danger { color: var(--zh-danger); font-weight: 700; }
.c-warning { color: var(--zh-warning); font-weight: 700; }
.c-success { color: var(--zh-success); font-weight: 700; }
.ar { color: var(--zh-text-placeholder); vertical-align: middle; margin: 0 2px; }
.rd { margin: 0 8px 8px 0 !important; }

.evo {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  padding: 14px 18px; border-radius: var(--zh-radius-lg); color: #fff;
  background: linear-gradient(100deg, #2a1a5e, #722ed1 46%, #1668dc);
  box-shadow: var(--zh-shadow-base);
  &__l { display: flex; align-items: center; gap: 13px; }
  &__ic {
    width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, .17); border: 1px solid rgba(255, 255, 255, .28);
  }
  &__t {
    display: flex; align-items: center; gap: 8px;
    font-size: var(--zh-font-title); font-weight: 700;
  }
  &__d {
    margin-top: 4px; font-size: var(--zh-font-xs); opacity: .9;
    b { font-family: var(--zh-font-num); }
    .hl { color: #95f2c8; font-size: var(--zh-font-md); }
  }
  &__r { flex-shrink: 0; min-width: 180px; }
}
.ev-n {
  display: flex; align-items: baseline; justify-content: space-between;
  span { font-size: 11px; opacity: .84; }
  b {
    font-size: 24px; font-family: var(--zh-font-num); color: #95f2c8;
    i { font-size: 12px; font-style: normal; margin-left: 2px; }
  }
}
.ev-bar {
  margin-top: 6px; height: 7px; border-radius: 4px; overflow: hidden;
  background: rgba(255, 255, 255, .2);
  &__f {
    height: 100%; border-radius: 4px; transition: width .8s ease;
    background: linear-gradient(90deg, #13c2c2, #95f2c8);
  }
}

.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
}
.chart-row {
  display: grid; grid-template-columns: 320px 1fr 1fr; gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 1000px) { grid-template-columns: 1fr; }
}
.rr {
  display: flex; align-items: center; gap: 8px;
  :deep(.el-progress) { flex: 1; }
  span { min-width: 46px; text-align: right; }
}
.amt {
  display: flex; align-items: center; gap: 6px; width: 100%;
  :deep(.el-input-number) { flex: 1; }
  span { color: var(--zh-text-placeholder); }
}

.fd { display: flex; flex-direction: column; gap: 12px; }
.fd-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 16px; border-radius: var(--zh-radius-lg);
  background: var(--zh-purple-light); border: 1px solid var(--zh-border);
  border-left: 4px solid var(--zh-purple);
  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 4px; }
    :deep(.el-icon) { color: var(--zh-text-placeholder); }
  }
  &__n { display: flex; gap: 20px; flex-shrink: 0; }
}
.fn {
  display: flex; flex-direction: column; align-items: flex-end;
  span { font-size: 11px; color: var(--zh-text-secondary); }
  b { font-size: 18px; font-weight: 700; font-family: var(--zh-font-num); color: var(--zh-text-primary); }
}
.qa {
  display: flex; gap: 12px;
  &__l {
    display: flex; align-items: center; gap: 5px; flex-shrink: 0; width: 96px;
    font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-danger);
    :deep(.el-icon) { flex-shrink: 0; }
    &.is-ok { color: var(--zh-success); }
  }
  &__c {
    flex: 1; padding: 10px 12px; border-radius: var(--zh-radius);
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
    font-size: var(--zh-font-sm); line-height: 1.85; color: var(--zh-text-regular);
  }
}

.opt-run {
  padding: 8px 0;
  &__t {
    display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 16px;
    font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-purple);
    :deep(.el-icon) { color: var(--zh-purple); }
  }
}
.opt-ok {
  display: flex; align-items: center; gap: 11px; margin-bottom: 12px;
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: var(--zh-risk-low-bg); border: 1px solid var(--zh-risk-low-border);
  :deep(.el-icon) { color: var(--zh-success); flex-shrink: 0; }
  b { display: block; font-size: var(--zh-font-md); color: var(--zh-text-primary); }
  span { font-size: var(--zh-font-xs); color: var(--zh-text-secondary); }
}
.cmp {
  display: grid; grid-template-columns: 1fr 40px 1fr 1fr 1fr; gap: 10px; align-items: center;
  @media (max-width: 900px) { grid-template-columns: 1fr 1fr; }
  &__ar {
    display: flex; align-items: center; justify-content: center; color: var(--zh-primary);
    @media (max-width: 900px) { display: none; }
  }
  &__c {
    padding: 12px 10px; border-radius: var(--zh-radius); text-align: center;
    border: 1px solid var(--zh-border); background: #fff;
    &.is-before { background: var(--zh-risk-high-bg); border-color: var(--zh-risk-high-border); }
    &.is-after { background: var(--zh-risk-low-bg); border-color: var(--zh-risk-low-border); }
    &.is-plain { background: var(--zh-bg-soft); }
  }
  &__v { font-size: 11px; color: var(--zh-text-secondary); }
  &__n {
    margin: 3px 0; font-size: 26px; font-weight: 700; line-height: 1.15;
    color: var(--zh-text-primary);
    &.sm { font-size: 14px; }
  }
  &__l { font-size: 11px; color: var(--zh-text-secondary); }
}
.opt-btns { display: flex; gap: 8px; flex-wrap: wrap; }

.loop {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px dashed var(--zh-border-strong);
  &__t {
    display: flex; align-items: center; gap: 6px;
    font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-purple); }
  }
  &__f {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px;
    :deep(.el-icon) { color: var(--zh-text-placeholder); font-size: 12px; }
  }
}
.lp {
  padding: 5px 11px; border-radius: 20px;
  background: #fff; border: 1px solid var(--zh-primary-light);
  font-size: var(--zh-font-xs); color: var(--zh-primary);
  &.is-end {
    background: var(--zh-success); border-color: var(--zh-success);
    color: #fff; font-weight: 700;
  }
}
</style>
