<script setup lang="ts">
import {
  getFeedbackStats, getFeedbackList, getFeedbackDetail, runFeedback,
  getOptimizeStats, getOptimizeList, getOptimizeDetail,
  decideSuggestion, grayRelease, fullRelease, rollbackVersion
} from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const activeTab = ref('feedback')
const fbSt = ref<any>(null)
const optSt = ref<any>(null)

const SUG_TONE: Record<string, string> = {
  规则阈值调整: 'cyan', 新增识别规则: 'lime', 模型参数优化: 'violet', 误判规则修正: 'amber'
}
const DEC_TONE: Record<string, string> = { 已采纳: 'lime', 已驳回: 'red', 需修改: 'amber', 待确认: 'cyan' }
const STEP_TONE: Record<string, string> = { 已完成: 'lime', 进行中: 'cyan', 待开始: 'faint' }
const VER_TONE: Record<string, string> = { 当前版本: 'cyan', 灰度中: 'amber', 历史版本: 'faint' }
const SAMPLE_TONE: Record<string, string> = {
  正样本: 'lime', 负样本: 'amber', 误判样本: 'red', 申诉改判样本: 'pink', 复议改判样本: 'red'
}

/* ================= 3.3.1 案例数据回流 ================= */
const fbList = ref<any[]>([])
const fbTotal = ref(0)
const fbLoading = ref(false)
const fbQ = reactive({ keyword: '', status: '', page: 1, pageSize: 8 })

async function loadFbStats() { fbSt.value = await getFeedbackStats() }
async function loadFb() {
  fbLoading.value = true
  try {
    const res: any = await getFeedbackList(fbQ)
    fbList.value = res?.list || []
    fbTotal.value = res?.total || 0
  } finally { fbLoading.value = false }
}

const fbDrawer = ref(false)
const curFb = ref<any>(null)
const fbTab = ref('summary')
async function openFb(row: any) {
  fbDrawer.value = true
  fbTab.value = 'summary'
  curFb.value = await getFeedbackDetail(row.feedbackId)
}

const fbRunVisible = ref(false)
const fbRunning = ref(false)
const fbRes = ref<any>(null)
const fbForm = reactive({ batchNo: 'BATCH-2026-09', mode: '定期批量回流（月度全量）' })

async function doRunFb() {
  fbRunning.value = true
  fbRes.value = null
  try {
    fbRes.value = await runFeedback(fbForm)
    msg.success(fbRes.value.message)
    await Promise.all([loadFbStats(), loadFb()])
  } finally { fbRunning.value = false }
}

/* ================= 3.3.2 模型优化 ================= */
const optList = ref<any[]>([])
const optTotal = ref(0)
const optLoading = ref(false)
const optQ = reactive({ keyword: '', status: '', page: 1, pageSize: 8 })

async function loadOptStats() { optSt.value = await getOptimizeStats() }
async function loadOpt() {
  optLoading.value = true
  try {
    const res: any = await getOptimizeList(optQ)
    optList.value = res?.list || []
    optTotal.value = res?.total || 0
  } finally { optLoading.value = false }
}

const optDrawer = ref(false)
const curOpt = ref<any>(null)
const sugIdx = ref(0)

async function openOpt(row: any) {
  optDrawer.value = true
  sugIdx.value = 0
  curOpt.value = await getOptimizeDetail(row.optimizationId)
}

const deciding = ref(false)
async function doDecide(sug: any, decision: string) {
  await ElMessageBox.confirm(
    decision === '已采纳'
      ? `确认采纳建议「${sug.ruleName}」？采纳后将流转至业务专家确认，并纳入本轮灰度范围。`
      : decision === '已驳回'
        ? `确认驳回建议「${sug.ruleName}」？驳回原因将记录留档，本期不实施。`
        : `确认标记「${sug.ruleName}」需修改？将退回 AI 重新生成建议。`,
    decision === '已采纳' ? '采纳建议' : decision === '已驳回' ? '驳回建议' : '需修改',
    { type: decision === '已采纳' ? 'success' : 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }
  ).then(async () => {
    deciding.value = true
    try {
      const res: any = await decideSuggestion({
        optimizationId: curOpt.value.optimizationId, suggestionId: sug.id, decision
      })
      msg.success(`${res.message}（下一步：${res.nextStep}）`)
      curOpt.value = await getOptimizeDetail(curOpt.value.optimizationId)
      await loadOptStats()
    } finally { deciding.value = false }
  }).catch(() => undefined)
}

/* ---------- 灰度 / 全量 / 回滚 ---------- */
const grayVisible = ref(false)
const graySaving = ref(false)
const grayForm = reactive({ version: 'v2.4.0-gray', trafficRatio: 20 })

async function doGray() {
  graySaving.value = true
  try {
    const res: any = await grayRelease({ optimizationId: curOpt.value?.optimizationId, ...grayForm })
    msg.success(res.message)
    grayVisible.value = false
    await loadOptStats()
  } finally { graySaving.value = false }
}

async function doFull(v: string) {
  await ElMessageBox.confirm(
    `确认将 ${v} 全量生效？生效后所有规则与模型参数按新版本运行，历史版本保留可回滚。`,
    '全量发布', { type: 'warning', confirmButtonText: '确认全量发布', cancelButtonText: '取消' }
  ).then(async () => {
    const res: any = await fullRelease({ version: v })
    msg.success(res.message)
    await loadOptStats()
  }).catch(() => undefined)
}

async function doRollback(v: any) {
  await ElMessageBox.confirm(
    `确认回滚至 ${v.version}（准确率 ${(v.accuracy * 100).toFixed(1)}% / 误报率 ${(v.falsePositiveRate * 100).toFixed(1)}%）？`,
    '版本回滚', { type: 'warning', confirmButtonText: '确认回滚', cancelButtonText: '取消' }
  ).then(async () => {
    const res: any = await rollbackVersion({ version: v.version })
    msg.success(res.message)
    await loadOptStats()
  }).catch(() => undefined)
}

/* ========== 图表 ========== */
const AXIS_DARK = {
  axisLine: { lineStyle: { color: '#cdd7e6' } },
  axisTick: { show: false },
  axisLabel: { color: '#6b7a90', fontSize: 10 },
  splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } }
}
const TT = {
  backgroundColor: '#ffffff', borderColor: '#e2e8f2',
  textStyle: { color: '#1a2230', fontSize: 11 }
}
const TONE_HEX: Record<string, string> = {
  cyan: '#0891b2', blue: '#1668dc', violet: '#722ed1', lime: '#12a150',
  amber: '#d48806', pink: '#d43878', red: '#e5484d'
}

/** 样本流转桑基图 */
const sankeyOption = computed(() => {
  const f = fbSt.value?.sampleFlow
  if (!f) return {}
  return {
    tooltip: { trigger: 'item', ...TT, formatter: (p: any) => p.dataType === 'edge' ? `${p.data.source} → ${p.data.target}<br/>${fmtNum(p.data.value)} 条` : `${p.name}<br/>${fmtNum(p.value || 0)} 条` },
    series: [{
      type: 'sankey',
      left: 4, right: 96, top: 10, bottom: 10,
      nodeWidth: 11, nodeGap: 9,
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'gradient', curveness: 0.5, opacity: .38 },
      label: { color: '#43516b', fontSize: 10, position: 'right' },
      data: f.nodes.map((n: any) => ({
        name: n.name,
        itemStyle: { color: TONE_HEX[n.tone] || '#1668dc', borderColor: 'transparent' }
      })),
      links: f.links
    }]
  }
})

/** 回流批次趋势 */
const fbTrendOption = computed(() => {
  const d = fbSt.value?.monthTrend || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: { data: ['正样本', '负样本', '误判样本'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 42, right: 12, top: 28, bottom: 34 },
    xAxis: { type: 'category', data: d.map((i: any) => i.batchNo.slice(-7)), ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, rotate: 30, fontSize: 9 } },
    yAxis: { type: 'value', name: '条', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    series: [
      { name: '正样本', type: 'bar', stack: 's', barWidth: 16, itemStyle: { color: '#12a150' }, data: d.map((i: any) => i.positive) },
      { name: '负样本', type: 'bar', stack: 's', itemStyle: { color: '#d48806' }, data: d.map((i: any) => i.negative) },
      { name: '误判样本', type: 'bar', stack: 's', itemStyle: { color: '#e5484d', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.misjudgment) }
    ]
  }
})

/** 建议类型分布 */
const sugTypeOption = computed(() => {
  const d = optSt.value?.typeDist || []
  return {
    tooltip: { trigger: 'item', ...TT, formatter: '{b}<br/>{c} 条（{d}%）' },
    legend: { bottom: 0, itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['44%', '68%'], center: ['50%', '44%'],
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 3 },
      label: { show: true, formatter: '{c}', position: 'inside', color: '#1a2230', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => ({
        name: i.name, value: i.value,
        itemStyle: { color: TONE_HEX[SUG_TONE[i.name]] || '#1668dc' }
      }))
    }]
  }
})

/** 版本演进（准确率 vs 误报率） */
const verOption = computed(() => {
  const d = [...(optSt.value?.versionManagement?.historyVersions || [])].reverse()
  return {
    tooltip: { trigger: 'axis', ...TT },
    legend: { data: ['准确率', '误报率'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 44, right: 44, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.version), ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '准确率%', min: 82, max: 94, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '误报率%', min: 3, max: 12, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      {
        name: '准确率', type: 'line', smooth: true, symbolSize: 7,
        lineStyle: { color: '#12a150', width: 2.6, shadowColor: '#12a150', shadowBlur: 12 },
        itemStyle: { color: '#12a150' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(76,245,168,.3)' }, { offset: 1, color: 'rgba(76,245,168,.01)' }] } },
        label: { show: true, formatter: (p: any) => p.value.toFixed(1), color: '#12a150', fontSize: 9.5, fontWeight: 700 },
        data: d.map((i: any) => Number((i.accuracy * 100).toFixed(1)))
      },
      {
        name: '误报率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6,
        lineStyle: { color: '#e5484d', width: 2.2, type: 'dashed' }, itemStyle: { color: '#e5484d' },
        label: { show: true, formatter: (p: any) => p.value.toFixed(1), color: '#ffa8ab', fontSize: 9.5 },
        data: d.map((i: any) => Number((i.falsePositiveRate * 100).toFixed(1)))
      }
    ]
  }
})

watch(activeTab, (v) => {
  if (v === 'optimize' && !optList.value.length) { loadOptStats(); loadOpt() }
})

onMounted(() => { loadFbStats(); loadFb() })
</script>

<template>
  <div class="viz-page">
    <header class="viz-head">
      <div class="viz-head__t">
        模型自学习迭代
        <span class="viz-head__sub">案例数据回流 · AI 优化建议 · 人工确认 → 灰度 → 全量 → 可回滚</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Refresh /></el-icon>回流批次 <b>{{ fbSt?.feedbackTotal || 0 }}</b></span>
        <span><el-icon><Opportunity /></el-icon>待确认建议 <b>{{ optSt?.pendingSuggestions ?? '—' }}</b></span>
        <span><el-icon><Cpu /></el-icon>当前版本 <b>{{ optSt?.versionManagement?.currentVersion || 'v2.3.1' }}</b></span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="loadFbStats(); loadFb(); loadOptStats()">刷新</el-button>
    </header>

    <el-tabs v-model="activeTab" class="viz-tabs">
      <!-- ================= 案例数据回流 ================= -->
      <el-tab-pane label="案例数据回流" name="feedback">
        <div class="viz-grid viz-grid--4 mi-kpi">
          <VizMetric label="本期回流样本" :value="fbSt?.sampleTotal || 0" unit="条" icon="Upload" tone="cyan"
            :desc="`去重清洗后构建训练集 v2.4`" />
          <VizMetric label="正样本" :value="fbSt?.positiveTotal || 0" unit="条" icon="CircleCheck" tone="lime"
            :desc="`已确认违规线索`"
            :progress="fbSt?.sampleTotal ? (fbSt.positiveTotal / fbSt.sampleTotal) * 100 : 0" />
          <VizMetric label="负样本" :value="fbSt?.negativeTotal || 0" unit="条" icon="CircleClose" tone="amber"
            :desc="`含申诉改判 / 复议撤销`"
            :progress="fbSt?.sampleTotal ? (fbSt.negativeTotal / fbSt.sampleTotal) * 100 : 0" />
          <VizMetric label="误判反馈样本" :value="fbSt?.misjudgmentTotal || 0" unit="条" icon="WarnTriangleFilled" tone="red"
            desc="人工复核标注，模型最宝贵负样本" />
        </div>

        <div class="mi-c1">
          <VizPanel title="样本回流链路（数据源 → 处理 → 训练集）" tone="cyan"
            extra="桑基图 · 悬停高亮链路" glow>
            <EChart :option="sankeyOption" height="268px" />
          </VizPanel>
          <VizPanel title="历史批次样本构成" tone="violet" extra="近 8 个批次">
            <EChart :option="fbTrendOption" height="268px" />
          </VizPanel>
        </div>

        <VizPanel title="回流批次台账" tone="lime" :extra="`共 ${fbTotal} 个批次`">
          <el-form class="viz-form mi-q" :model="fbQ" @submit.prevent>
            <el-input v-model="fbQ.keyword" placeholder="回流ID / 批次号" clearable size="small"
              :prefix-icon="'Search'" style="width: 214px" @keyup.enter="fbQ.page = 1; loadFb()" />
            <el-select v-model="fbQ.status" placeholder="全部状态" clearable size="small" style="width: 118px">
              <el-option v-for="s in (fbSt?.statusList || [])" :key="s" :label="s" :value="s" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="fbQ.page = 1; loadFb()">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'"
              @click="Object.assign(fbQ, { keyword: '', status: '', page: 1 }); loadFb()">重　置</el-button>
            <div style="flex: 1" />
            <el-button class="viz-btn is-hot" size="small" :icon="'Upload'"
              @click="fbRes = null; fbRunVisible = true">发起回流</el-button>
          </el-form>

          <el-table class="viz-table" :data="fbList" size="small" border stripe v-loading="fbLoading"
            element-loading-background="rgba(255,255,255,.65)">
            <el-table-column prop="feedbackId" label="回流ID" width="150">
              <template #default="{ row }">
                <span class="viz-link" @click="openFb(row)">{{ row.feedbackId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="batchNo" label="批次号" width="132">
              <template #default="{ row }"><span class="viz-num viz-mini" style="color: var(--viz-cyan)">{{ row.batchNo }}</span></template>
            </el-table-column>
            <el-table-column label="样本构成" width="190">
              <template #default="{ row }">
                <div class="sbar">
                  <span class="sbar__s is-pos" :style="{ width: (row.dataSummary.positiveSamples / row.dataSummary.totalClues) * 100 + '%' }" />
                  <span class="sbar__s is-neg" :style="{ width: (row.dataSummary.negativeSamples / row.dataSummary.totalClues) * 100 + '%' }" />
                </div>
                <div class="sbar__t viz-num">
                  正 {{ fmtNum(row.dataSummary.positiveSamples) }} / 负 {{ fmtNum(row.dataSummary.negativeSamples) }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="误判/改判" width="120" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--red mr4">{{ row.dataSummary.misjudgmentSamples }}</span>
                <span class="viz-tag viz-tag--pink">{{ row.dataSummary.appealChangedSamples }}</span>
              </template>
            </el-table-column>
            <el-table-column label="去重" width="98" align="center">
              <template #default="{ row }">
                <span class="viz-num viz-mini viz-dim">-{{ row.dataProcessing.deduplication.removed }} 条</span>
              </template>
            </el-table-column>
            <el-table-column label="训练集" width="150">
              <template #default="{ row }">
                <span class="viz-num viz-mini" style="color: var(--viz-lime)">{{ row.trainingSet.setId }}</span>
                <div class="viz-num viz-mini viz-faint">
                  {{ row.trainingSet.trainSet }}/{{ row.trainingSet.validationSet }}/{{ row.trainingSet.testSet }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="mode" label="回流方式" min-width="176" show-overflow-tooltip>
              <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.mode }}</span></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="92" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--solid"
                  :class="row.status === '回流完成' ? 'viz-tag--lime' : row.status === '回流失败' ? 'viz-tag--red' : 'viz-tag--cyan'">
                  {{ row.status }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="feedbackTime" label="回流时间" width="146">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.feedbackTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="72" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link :icon="'View'" style="color: var(--viz-cyan)" @click="openFb(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无回流批次</div></template>
          </el-table>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ fbTotal }} 个批次</span>
            <el-pagination v-model:current-page="fbQ.page" v-model:page-size="fbQ.pageSize" :total="fbTotal"
              :page-sizes="[8, 16, 32]" layout="sizes, prev, pager, next" small background @change="loadFb" />
          </div>
        </VizPanel>
      </el-tab-pane>

      <!-- ================= 模型优化建议 ================= -->
      <el-tab-pane label="模型优化建议" name="optimize">
        <div class="viz-grid viz-grid--4 mi-kpi">
          <VizMetric label="优化建议总数" :value="optSt?.suggestionTotal || 0" unit="条" icon="Opportunity" tone="cyan"
            :desc="`已采纳 ${optSt?.adoptedSuggestions || 0} 条`"
            :progress="optSt?.suggestionTotal ? (optSt.adoptedSuggestions / optSt.suggestionTotal) * 100 : 0" />
          <VizMetric label="待人工确认" :value="optSt?.pendingSuggestions || 0" unit="条" icon="Clock" tone="amber"
            desc="需算法工程师 + 业务专家双确认" />
          <VizMetric label="在线模型" :value="optSt?.modelTotal || 0" unit="个" icon="Cpu" tone="violet"
            :desc="`规则 ${optSt?.ruleTotal || 0} 条 · 待优化 ${optSt?.ruleToOptimize || 0} 条`" />
          <VizMetric label="灰度流量" :value="optSt?.versionManagement?.grayTraffic || 0" unit="%" icon="Share" tone="lime"
            :desc="`${optSt?.versionManagement?.grayVersion || '—'} 观察中`"
            :progress="optSt?.versionManagement?.grayTraffic || 0" />
        </div>

        <div class="mi-c2">
          <VizPanel title="建议类型分布" tone="cyan" extra="4 类优化" glow>
            <EChart :option="sugTypeOption" height="222px" />
          </VizPanel>

          <VizPanel title="模型版本演进" tone="lime" extra="准确率↑ 误报率↓" glow>
            <EChart :option="verOption" height="222px" />
          </VizPanel>

          <VizPanel title="版本管理与回滚" tone="amber" extra="支持一键回滚">
            <div class="vers viz-scroll">
              <div v-for="v in (optSt?.versionManagement?.historyVersions || [])" :key="v.version"
                class="ver" :class="`ver--${VER_TONE[v.status]}`">
                <div class="ver__h">
                  <b class="ver__v viz-num">{{ v.version }}</b>
                  <span class="viz-tag" :class="`viz-tag--${VER_TONE[v.status]}`">{{ v.status }}</span>
                  <span v-if="v.trafficRatio" class="viz-tag viz-tag--faint viz-num">{{ v.trafficRatio }}% 流量</span>
                </div>
                <div class="ver__m viz-num">
                  准确率 <b>{{ (v.accuracy * 100).toFixed(1) }}%</b> · 误报率 <b>{{ (v.falsePositiveRate * 100).toFixed(1) }}%</b>
                  · {{ v.date }}
                </div>
                <div class="ver__c">{{ v.changes }}</div>
                <div class="ver__a">
                  <el-button v-if="v.status === '灰度中'" link size="small" :icon="'Promotion'"
                    style="color: var(--viz-lime)" @click="doFull(v.version.replace('-gray', ''))">全量发布</el-button>
                  <el-button v-else-if="v.status === '历史版本'" link size="small" :icon="'RefreshLeft'"
                    style="color: var(--viz-amber)" @click="doRollback(v)">回滚至此</el-button>
                  <el-button v-else link size="small" :icon="'Share'"
                    style="color: var(--viz-cyan)" @click="grayVisible = true">发起灰度</el-button>
                </div>
              </div>
            </div>
          </VizPanel>
        </div>

        <!-- 模型 / 规则清单 -->
        <div class="mi-c3">
          <VizPanel title="在线模型清单" tone="violet" :extra="`${optSt?.modelTotal || 0} 个模型`">
            <el-table class="viz-table" :data="optSt?.models || []" size="small" border stripe max-height="248">
              <el-table-column prop="modelId" label="模型ID" width="168">
                <template #default="{ row }"><span class="viz-num viz-mini" style="color: var(--viz-violet)">{{ row.modelId }}</span></template>
              </el-table-column>
              <el-table-column prop="name" label="模型名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="type" label="类型" width="88" align="center">
                <template #default="{ row }"><span class="viz-tag viz-tag--faint">{{ row.type }}</span></template>
              </el-table-column>
              <el-table-column prop="accuracy" label="准确率" width="98" align="center">
                <template #default="{ row }">
                  <span class="viz-num" :style="{ color: row.accuracy >= 0.9 ? 'var(--viz-lime)' : row.accuracy >= 0.85 ? 'var(--viz-cyan)' : 'var(--viz-amber)', fontWeight: 700 }">
                    {{ (row.accuracy * 100).toFixed(1) }}%
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="version" label="版本" width="118" align="center">
                <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.version }}</span></template>
              </el-table-column>
              <el-table-column prop="role" label="作用" min-width="220" show-overflow-tooltip>
                <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.role }}</span></template>
              </el-table-column>
            </el-table>
          </VizPanel>

          <VizPanel title="规则误报率监测" tone="red" :extra="`待优化 ${optSt?.ruleToOptimize || 0} 条`">
            <div class="rules viz-scroll">
              <div v-for="r in (optSt?.rules || [])" :key="r.ruleId" class="rl"
                :class="r.status === '待优化' ? 'is-warn' : r.status === '待上线' ? 'is-new' : 'is-ok'">
                <div class="rl__h">
                  <span class="rl__id viz-num">{{ r.ruleId }}</span>
                  <span class="viz-tag" :class="r.status === '待优化' ? 'viz-tag--amber' : r.status === '待上线' ? 'viz-tag--cyan' : 'viz-tag--lime'">
                    {{ r.status }}
                  </span>
                </div>
                <div class="rl__n">{{ r.name }}</div>
                <div class="rl__f">
                  <span class="viz-tag viz-tag--faint">{{ r.type }}</span>
                  <span v-if="r.fpr" class="rl__fpr viz-num" :class="{ 'is-over': r.fpr > 0.1 }">
                    误报率 {{ (r.fpr * 100).toFixed(1) }}%
                  </span>
                  <span v-else class="viz-faint viz-mini">未上线</span>
                  <span v-if="r.fpr" class="rl__bar">
                    <span :style="{ width: Math.min(100, r.fpr * 700) + '%' }" />
                  </span>
                </div>
              </div>
            </div>
          </VizPanel>
        </div>

        <VizPanel title="优化建议批次" tone="cyan" :extra="`共 ${optTotal} 批`">
          <el-form class="viz-form mi-q" :model="optQ" @submit.prevent>
            <el-input v-model="optQ.keyword" placeholder="优化批次ID" clearable size="small"
              :prefix-icon="'Search'" style="width: 200px" @keyup.enter="optQ.page = 1; loadOpt()" />
            <el-select v-model="optQ.status" placeholder="全部状态" clearable size="small" style="width: 138px">
              <el-option v-for="s in ['待人工确认', '灰度发布中', '已全量生效']" :key="s" :label="s" :value="s" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="optQ.page = 1; loadOpt()">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'"
              @click="Object.assign(optQ, { keyword: '', status: '', page: 1 }); loadOpt()">重　置</el-button>
          </el-form>

          <el-table class="viz-table" :data="optList" size="small" border stripe v-loading="optLoading"
            element-loading-background="rgba(255,255,255,.65)">
            <el-table-column prop="optimizationId" label="优化批次ID" width="164">
              <template #default="{ row }">
                <span class="viz-link" @click="openOpt(row)">{{ row.optimizationId }}</span>
              </template>
            </el-table-column>
            <el-table-column label="版本变化" width="164" align="center">
              <template #default="{ row }">
                <span class="viz-num viz-mini viz-dim">{{ row.currentVersion }}</span>
                <el-icon :size="10" style="margin: 0 4px; color: var(--viz-cyan)"><Right /></el-icon>
                <span class="viz-num viz-mini" style="color: var(--viz-lime)">{{ row.suggestedVersion }}</span>
              </template>
            </el-table-column>
            <el-table-column label="建议构成" min-width="256">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--cyan mr4">阈值 {{ row.summary.thresholdAdjustment }}</span>
                <span class="viz-tag viz-tag--lime mr4">新规则 {{ row.summary.newRule }}</span>
                <span class="viz-tag viz-tag--violet mr4">参数 {{ row.summary.modelParamOptimization }}</span>
                <span class="viz-tag viz-tag--amber">误判修正 {{ row.summary.ruleFix }}</span>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="112" align="center">
              <template #default="{ row }">
                <span class="viz-num viz-mini">
                  <span style="color: var(--viz-red)">高 {{ row.summary.highPriority }}</span>
                  <span class="viz-faint"> / </span>
                  <span style="color: var(--viz-amber)">中 {{ row.summary.mediumPriority }}</span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="审核进度" width="150">
              <template #default="{ row }">
                <div class="sprog">
                  <span v-for="s in row.reviewProcess.steps" :key="s.step" class="sprog__d"
                    :class="`is-${STEP_TONE[s.status]}`" :title="`${s.name}：${s.status}`" />
                  <span class="sprog__t viz-mini viz-dim">{{ row.reviewProcess.currentStep }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="112" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--solid"
                  :class="row.status === '已全量生效' ? 'viz-tag--lime' : row.status === '灰度发布中' ? 'viz-tag--amber' : 'viz-tag--cyan'">
                  {{ row.status }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="generateTime" label="生成时间" width="146">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.generateTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="72" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link :icon="'View'" style="color: var(--viz-cyan)" @click="openOpt(row)">审核</el-button>
              </template>
            </el-table-column>
            <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无优化建议批次</div></template>
          </el-table>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ optTotal }} 批</span>
            <el-pagination v-model:current-page="optQ.page" v-model:page-size="optQ.pageSize" :total="optTotal"
              :page-sizes="[8, 16, 32]" layout="sizes, prev, pager, next" small background @change="loadOpt" />
          </div>
        </VizPanel>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 回流详情抽屉 ============ -->
    <el-drawer v-model="fbDrawer" size="720px" class="viz-drawer" title="案例数据回流详情">
      <template v-if="curFb">
        <div class="fh">
          <div class="fh__n">{{ curFb.batchNo }}</div>
          <div class="fh__m">
            <span><el-icon><Ticket /></el-icon>{{ curFb.feedbackId }}</span>
            <span><el-icon><Coin /></el-icon>{{ curFb.source }}</span>
            <span><el-icon><Clock /></el-icon>{{ curFb.feedbackTime }}</span>
          </div>
          <div class="fh__tags">
            <span class="viz-tag viz-tag--solid"
              :class="curFb.status === '回流完成' ? 'viz-tag--lime' : 'viz-tag--red'">{{ curFb.status }}</span>
            <span class="viz-tag viz-tag--cyan">{{ curFb.mode }}</span>
          </div>
        </div>

        <el-tabs v-model="fbTab" class="viz-tabs" style="margin-top: 12px">
          <!-- 汇总 -->
          <el-tab-pane label="回流汇总" name="summary">
            <div class="viz-sub">样本汇总<span class="viz-sub__x" /></div>
            <div class="sgrid">
              <div class="sg sg--cyan"><b class="viz-num">{{ fmtNum(curFb.dataSummary.totalClues) }}</b><span>线索总数</span></div>
              <div class="sg sg--lime"><b class="viz-num">{{ fmtNum(curFb.dataSummary.positiveSamples) }}</b><span>正样本</span></div>
              <div class="sg sg--amber"><b class="viz-num">{{ fmtNum(curFb.dataSummary.negativeSamples) }}</b><span>负样本</span></div>
              <div class="sg sg--red"><b class="viz-num">{{ curFb.dataSummary.misjudgmentSamples }}</b><span>误判样本</span></div>
              <div class="sg sg--pink"><b class="viz-num">{{ curFb.dataSummary.appealChangedSamples }}</b><span>申诉改判</span></div>
              <div class="sg sg--violet"><b class="viz-num">{{ curFb.dataSummary.reconsiderationChangedSamples }}</b><span>复议改判</span></div>
            </div>

            <div class="viz-sub">数据处理链路<span class="viz-sub__x" /></div>
            <div class="dproc">
              <div class="dp dp--cyan">
                <div class="dp__n">① 去重</div>
                <div class="dp__v viz-num">{{ fmtNum(curFb.dataProcessing.deduplication.before) }} → {{ fmtNum(curFb.dataProcessing.deduplication.after) }}</div>
                <div class="dp__d">移除重复 {{ curFb.dataProcessing.deduplication.removed }} 条</div>
              </div>
              <div class="dp dp--amber">
                <div class="dp__n">② 清洗</div>
                <div class="dp__v viz-num">-{{ curFb.dataProcessing.cleaning.invalidRecords + curFb.dataProcessing.cleaning.missingFields + curFb.dataProcessing.cleaning.outliers }}</div>
                <div class="dp__d">无效 {{ curFb.dataProcessing.cleaning.invalidRecords }} · 缺字段 {{ curFb.dataProcessing.cleaning.missingFields }} · 离群 {{ curFb.dataProcessing.cleaning.outliers }}</div>
              </div>
              <div class="dp dp--lime">
                <div class="dp__n">③ 标注</div>
                <div class="dp__v viz-num">{{ (curFb.dataProcessing.annotation.annotationRate * 100).toFixed(0) }}%</div>
                <div class="dp__d">自动 {{ fmtNum(curFb.dataProcessing.annotation.autoAnnotated) }} · 人工复核 {{ curFb.dataProcessing.annotation.manualReviewed }}</div>
              </div>
              <div class="dp dp--violet">
                <div class="dp__n">④ 特征提取</div>
                <div class="dp__v viz-num">{{ curFb.dataProcessing.featureExtraction.featuresExtracted }} 维</div>
                <div class="dp__d">{{ curFb.dataProcessing.featureExtraction.featureTypes.join(' / ') }}</div>
              </div>
            </div>

            <div class="viz-sub">训练集划分<span class="viz-sub__x" /></div>
            <div class="tset">
              <div class="tset__bar">
                <span class="tset__s is-train" :style="{ width: (curFb.trainingSet.trainSet / curFb.trainingSet.totalSamples) * 100 + '%' }">训练 {{ curFb.trainingSet.trainSet }}</span>
                <span class="tset__s is-val" :style="{ width: (curFb.trainingSet.validationSet / curFb.trainingSet.totalSamples) * 100 + '%' }">验证</span>
                <span class="tset__s is-test" :style="{ width: (curFb.trainingSet.testSet / curFb.trainingSet.totalSamples) * 100 + '%' }">测试</span>
              </div>
              <el-descriptions class="viz-desc" :column="2" border size="small" style="margin-top: 9px">
                <el-descriptions-item label="训练集编号">
                  <span class="viz-num" style="color: var(--viz-lime)">{{ curFb.trainingSet.setId }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="版本">
                  <span class="viz-num">{{ curFb.trainingSet.version }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="正负样本比">
                  <span class="viz-num">{{ (curFb.trainingSet.positiveRatio * 100).toFixed(1) }}% : {{ (curFb.trainingSet.negativeRatio * 100).toFixed(1) }}%</span>
                </el-descriptions-item>
                <el-descriptions-item label="存储路径">
                  <span class="viz-num viz-mini">{{ curFb.trainingSet.storagePath }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <div class="viz-sub">数据安全<span class="viz-sub__x" /></div>
            <div class="sec">
              <div class="sec__r">
                <el-icon :size="13"><Lock /></el-icon>
                <span>脱敏字段</span>
                <div class="sec__l">
                  <span v-for="f in curFb.dataSecurity.desensitizationFields" :key="f" class="viz-tag viz-tag--cyan">{{ f }}</span>
                </div>
              </div>
              <div class="sec__r">
                <el-icon :size="13"><Key /></el-icon>
                <span>加密算法</span>
                <div class="sec__l"><span class="viz-tag viz-tag--lime">{{ curFb.dataSecurity.encryption }}</span></div>
              </div>
              <div class="sec__r">
                <el-icon :size="13"><User /></el-icon>
                <span>访问授权</span>
                <div class="sec__l">
                  <span v-for="a in curFb.dataSecurity.accessControl" :key="a" class="viz-tag viz-tag--violet">{{ a }}</span>
                </div>
              </div>
            </div>

            <div class="viz-note">
              <el-icon><InfoFilled /></el-icon>
              下一轮训练时间 {{ curFb.modelUpdate.nextTrainingDate }}；预期改进：{{ curFb.modelUpdate.expectedImprovement }}
            </div>
          </el-tab-pane>

          <!-- 样本明细 -->
          <el-tab-pane label="样本明细" name="samples">
            <div class="viz-sub">正样本（已确认违规）<span class="viz-sub__x" /></div>
            <div class="smps">
              <div v-for="s in curFb.positiveSamples" :key="s.clueId" class="smp smp--lime">
                <div class="smp__h">
                  <span class="smp__id viz-num">{{ s.clueId }}</span>
                  <span class="viz-tag" :class="`viz-tag--${SAMPLE_TONE[s.sampleType]}`">{{ s.sampleType }}</span>
                  <span class="viz-tag viz-tag--faint">{{ s.violationType }}</span>
                  <span class="viz-tag viz-tag--faint">{{ s.orgType }}</span>
                  <b class="smp__amt viz-num">{{ s.amount.toFixed(2) }} 元</b>
                </div>
                <div class="smp__f">
                  <span class="smp__fl">特征</span>
                  <span v-for="(v, k) in s.features" :key="k" class="smp__ft">
                    {{ k }}=<b>{{ v }}</b>
                  </span>
                </div>
              </div>
            </div>

            <div class="viz-sub">负样本（误判 / 改判 · 模型最宝贵反馈）<span class="viz-sub__x" /></div>
            <div class="smps">
              <div v-for="s in curFb.negativeSamples" :key="s.clueId" class="smp smp--red">
                <div class="smp__h">
                  <span class="smp__id viz-num">{{ s.clueId }}</span>
                  <span class="viz-tag" :class="`viz-tag--${SAMPLE_TONE[s.sampleType]}`">{{ s.sampleType }}</span>
                  <span class="viz-tag viz-tag--faint">{{ s.violationType }}</span>
                  <span class="viz-tag viz-tag--faint">{{ s.orgType }}</span>
                  <b class="smp__amt viz-num">{{ s.amount.toFixed(2) }} 元</b>
                </div>
                <div class="smp__r">
                  <el-icon :size="10"><WarnTriangleFilled /></el-icon>{{ s.misjudgmentReason }}
                </div>
                <div class="smp__f">
                  <span class="smp__fl">特征</span>
                  <span v-for="(v, k) in s.features" :key="k" class="smp__ft">
                    {{ k }}=<b>{{ v }}</b>
                  </span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- ============ 优化建议审核抽屉 ============ -->
    <el-drawer v-model="optDrawer" size="780px" class="viz-drawer" title="模型优化建议审核">
      <template v-if="curOpt">
        <div class="oh">
          <div class="oh__n">
            {{ curOpt.optimizationId }}
            <span class="oh__ver viz-num">{{ curOpt.currentVersion }} → {{ curOpt.suggestedVersion }}</span>
          </div>
          <div class="oh__m">
            <span><el-icon><Coin /></el-icon>{{ curOpt.source }}</span>
            <span><el-icon><Clock /></el-icon>{{ curOpt.generateTime }}</span>
          </div>
          <div class="oh__tags">
            <span class="viz-tag viz-tag--solid"
              :class="curOpt.status === '已全量生效' ? 'viz-tag--lime' : curOpt.status === '灰度发布中' ? 'viz-tag--amber' : 'viz-tag--cyan'">
              {{ curOpt.status }}
            </span>
            <span class="viz-tag viz-tag--faint">共 {{ curOpt.summary.totalSuggestions }} 条建议</span>
            <span class="viz-tag viz-tag--red">高优先 {{ curOpt.summary.highPriority }}</span>
          </div>
        </div>

        <!-- 五步审核流程 -->
        <div class="viz-sub">人工审核流程<span class="viz-sub__x" /><span class="viz-sub__e">当前：{{ curOpt.reviewProcess.currentStep }}</span></div>
        <div class="rvflow">
          <div v-for="s in curOpt.reviewProcess.steps" :key="s.step" class="rf" :class="`rf--${STEP_TONE[s.status]}`">
            <span class="rf__no">
              <el-icon v-if="s.status === '已完成'" :size="10"><Select /></el-icon>
              <el-icon v-else-if="s.status === '进行中'" :size="10" class="is-spin"><Loading /></el-icon>
              <template v-else>{{ s.step }}</template>
            </span>
            <div class="rf__b">
              <div class="rf__n">{{ s.name }}</div>
              <div class="rf__a">{{ s.assignee }}</div>
              <div class="rf__t viz-num">{{ s.time || (s.deadline ? '限 ' + s.deadline : '') }}</div>
            </div>
          </div>
        </div>

        <!-- 建议导航 -->
        <div class="viz-sub">优化建议明细<span class="viz-sub__x" /></div>
        <div class="snav viz-scroll">
          <button v-for="(s, i) in curOpt.suggestions" :key="s.id" class="snb"
            :class="{ 'is-active': sugIdx === i }" :style="{ '--snc': TONE_HEX[SUG_TONE[s.type]] }"
            @click="sugIdx = i">
            <span class="snb__id">{{ s.id }}</span>
            <span class="snb__t">{{ s.type }}</span>
            <span class="snb__dec viz-tag" :class="`viz-tag--${DEC_TONE[s.decision]}`">{{ s.decision }}</span>
          </button>
        </div>

        <!-- 建议详情 -->
        <template v-if="curOpt.suggestions[sugIdx]">
          <div class="sug" :style="{ '--sgc': TONE_HEX[SUG_TONE[curOpt.suggestions[sugIdx].type]] }">
            <div class="sug__h">
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${SUG_TONE[curOpt.suggestions[sugIdx].type]}`">
                {{ curOpt.suggestions[sugIdx].type }}
              </span>
              <b class="sug__n">{{ curOpt.suggestions[sugIdx].ruleName }}</b>
              <span class="viz-tag" :class="curOpt.suggestions[sugIdx].priority === '高' ? 'viz-tag--red' : 'viz-tag--amber'">
                {{ curOpt.suggestions[sugIdx].priority }}优先
              </span>
            </div>

            <!-- AI 置信度 -->
            <div class="sug__conf">
              <span class="sug__cl">AI 置信度</span>
              <span class="sug__cbar"><span :style="{ width: curOpt.suggestions[sugIdx].aiConfidence + '%' }" /></span>
              <b class="viz-num">{{ curOpt.suggestions[sugIdx].aiConfidence }}%</b>
              <span v-if="curOpt.suggestions[sugIdx].grayRelease" class="viz-tag viz-tag--cyan">需灰度</span>
              <span v-else class="viz-tag viz-tag--lime">可直接生效</span>
            </div>

            <!-- 阈值 / 逻辑 / 参数 前后对比 -->
            <div v-if="curOpt.suggestions[sugIdx].currentThreshold" class="diff">
              <div class="diff__i is-old">
                <span class="diff__l">当前阈值</span>
                <div class="diff__v">{{ curOpt.suggestions[sugIdx].currentThreshold }}</div>
              </div>
              <el-icon class="diff__ar" :size="15"><DArrowRight /></el-icon>
              <div class="diff__i is-new">
                <span class="diff__l">建议阈值</span>
                <div class="diff__v">{{ curOpt.suggestions[sugIdx].suggestedThreshold }}</div>
              </div>
            </div>

            <div v-if="curOpt.suggestions[sugIdx].currentLogic" class="diff diff--v">
              <div class="diff__i is-old">
                <span class="diff__l">当前逻辑</span>
                <div class="diff__v">{{ curOpt.suggestions[sugIdx].currentLogic }}</div>
              </div>
              <el-icon class="diff__ar is-down" :size="15"><Bottom /></el-icon>
              <div class="diff__i is-new">
                <span class="diff__l">建议逻辑</span>
                <div class="diff__v">{{ curOpt.suggestions[sugIdx].suggestedLogic }}</div>
              </div>
            </div>

            <div v-if="curOpt.suggestions[sugIdx].ruleDescription" class="sug__desc">
              <span class="diff__l">规则说明</span>
              <div>{{ curOpt.suggestions[sugIdx].ruleDescription }}</div>
            </div>

            <!-- 模型参数对比 -->
            <template v-if="curOpt.suggestions[sugIdx].currentParams">
              <div class="viz-sub" style="margin-top: 11px">参数调整对比<span class="viz-sub__x" /></div>
              <el-table class="viz-table" size="small" border stripe
                :data="Object.keys(curOpt.suggestions[sugIdx].currentParams).map((k) => ({
                  key: k,
                  cur: typeof curOpt.suggestions[sugIdx].currentParams[k] === 'object'
                    ? JSON.stringify(curOpt.suggestions[sugIdx].currentParams[k])
                    : curOpt.suggestions[sugIdx].currentParams[k],
                  sug: typeof curOpt.suggestions[sugIdx].suggestedParams[k] === 'object'
                    ? JSON.stringify(curOpt.suggestions[sugIdx].suggestedParams[k])
                    : curOpt.suggestions[sugIdx].suggestedParams[k]
                }))">
                <el-table-column prop="key" label="参数" width="126" />
                <el-table-column prop="cur" label="当前值" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }"><span class="viz-num viz-mini viz-faint">{{ row.cur }}</span></template>
                </el-table-column>
                <el-table-column prop="sug" label="建议值" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }"><span class="viz-num viz-mini" style="color: var(--viz-lime)">{{ row.sug }}</span></template>
                </el-table-column>
              </el-table>
              <div class="acc">
                <span>准确率预期</span>
                <b class="viz-num viz-faint">{{ (curOpt.suggestions[sugIdx].currentAccuracy * 100).toFixed(1) }}%</b>
                <el-icon :size="12"><Right /></el-icon>
                <b class="viz-num" style="color: var(--viz-lime)">{{ (curOpt.suggestions[sugIdx].expectedAccuracy * 100).toFixed(1) }}%</b>
              </div>
            </template>

            <!-- 依据数据 -->
            <div class="sug__ev">
              <div v-if="curOpt.suggestions[sugIdx].misjudgmentCount" class="se se--red">
                <b class="viz-num">{{ curOpt.suggestions[sugIdx].misjudgmentCount }}</b>
                <span>误报条数</span>
              </div>
              <div v-if="curOpt.suggestions[sugIdx].misjudgmentRate" class="se se--red">
                <b class="viz-num">{{ (curOpt.suggestions[sugIdx].misjudgmentRate * 100).toFixed(1) }}%</b>
                <span>误报率</span>
              </div>
              <div v-if="curOpt.suggestions[sugIdx].missCount" class="se se--amber">
                <b class="viz-num">{{ curOpt.suggestions[sugIdx].missCount }}</b>
                <span>漏报条数</span>
              </div>
              <div v-if="curOpt.suggestions[sugIdx].missRate" class="se se--amber">
                <b class="viz-num">{{ (curOpt.suggestions[sugIdx].missRate * 100).toFixed(1) }}%</b>
                <span>漏报率</span>
              </div>
              <div v-if="curOpt.suggestions[sugIdx].trendGrowth" class="se se--pink">
                <b class="viz-num">+{{ (curOpt.suggestions[sugIdx].trendGrowth * 100).toFixed(0) }}%</b>
                <span>同比增长</span>
              </div>
              <div v-if="curOpt.suggestions[sugIdx].estimatedClueCount" class="se se--cyan">
                <b class="viz-num">{{ curOpt.suggestions[sugIdx].estimatedClueCount }}</b>
                <span>预计新增线索</span>
              </div>
              <div v-if="curOpt.suggestions[sugIdx].expectedImprovement" class="se se--lime">
                <b>{{ curOpt.suggestions[sugIdx].expectedImprovement }}</b>
                <span>预期改进</span>
              </div>
            </div>

            <!-- 建议理由 -->
            <div class="sug__reason">
              <el-icon :size="12"><Opportunity /></el-icon>
              <div>
                <b>建议依据</b>
                <p>{{ curOpt.suggestions[sugIdx].reason }}</p>
              </div>
            </div>

            <div class="sug__impl">
              <span class="diff__l">实施方式</span>
              <span>{{ curOpt.suggestions[sugIdx].implementation }}</span>
            </div>

            <!-- 人工决策 -->
            <div v-if="curOpt.suggestions[sugIdx].decision !== '待确认'" class="sug__dec">
              <el-icon :size="12"><UserFilled /></el-icon>
              <b>{{ curOpt.suggestions[sugIdx].decisionBy }}</b>
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${DEC_TONE[curOpt.suggestions[sugIdx].decision]}`">
                {{ curOpt.suggestions[sugIdx].decision }}
              </span>
              <span class="viz-num viz-mini viz-faint">{{ curOpt.suggestions[sugIdx].decisionTime }}</span>
              <div class="sug__note">{{ curOpt.suggestions[sugIdx].decisionNote }}</div>
            </div>
            <div v-else class="sug__act">
              <el-button class="viz-btn is-hot" size="small" :icon="'CircleCheck'" :loading="deciding"
                @click="doDecide(curOpt.suggestions[sugIdx], '已采纳')">采纳建议</el-button>
              <el-button class="viz-btn" size="small" :icon="'EditPen'" :loading="deciding"
                @click="doDecide(curOpt.suggestions[sugIdx], '需修改')">需修改</el-button>
              <el-button class="viz-btn" size="small" :icon="'CircleClose'" :loading="deciding"
                @click="doDecide(curOpt.suggestions[sugIdx], '已驳回')">驳回</el-button>
            </div>
          </div>
        </template>

        <div class="dr-act">
          <el-button class="viz-btn" :icon="'ArrowLeft'" :disabled="sugIdx === 0" @click="sugIdx--">上一条</el-button>
          <el-button class="viz-btn" :icon="'ArrowRight'"
            :disabled="sugIdx === curOpt.suggestions.length - 1" @click="sugIdx++">下一条</el-button>
          <el-button class="viz-btn is-hot" :icon="'Share'" @click="grayVisible = true">发起灰度发布</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 发起回流 ============ -->
    <el-dialog v-model="fbRunVisible" title="发起案例数据回流" width="560px" class="viz-dialog">
      <el-form class="viz-form" label-width="94px">
        <el-form-item label="批次号" required>
          <el-input v-model="fbForm.batchNo" placeholder="如 BATCH-2026-09" />
        </el-form-item>
        <el-form-item label="回流方式">
          <el-select v-model="fbForm.mode" style="width: 100%">
            <el-option label="定期批量回流（月度全量）" value="定期批量回流（月度全量）" />
            <el-option label="实时回流（案件办结即回流）" value="实时回流（案件办结即回流）" />
            <el-option label="实时回流 + 定期批量回流" value="实时回流 + 定期批量回流" />
          </el-select>
        </el-form-item>
        <el-form-item label="回流说明">
          <div class="viz-note">
            <el-icon><InfoFilled /></el-icon>
            系统将回流已确认违规线索（正样本）、申诉改判 / 复议撤销线索（负样本）与误判反馈，
            经去重、清洗、自动标注、特征提取后构建训练样本集；敏感字段自动脱敏并加密存储。
          </div>
        </el-form-item>
        <el-form-item v-if="fbRes" label="回流结果">
          <div class="fres">
            <div class="fres__h">
              <el-icon :size="14"><CircleCheckFilled /></el-icon>
              <b>{{ fbRes.status }}</b>
              <span class="viz-tag viz-tag--lime">{{ fbRes.trainingSetVersion }}</span>
            </div>
            <div class="fres__g">
              <div class="fr"><b class="viz-num">{{ fmtNum(fbRes.totalClues) }}</b><span>线索</span></div>
              <div class="fr"><b class="viz-num">{{ fmtNum(fbRes.positiveSamples) }}</b><span>正样本</span></div>
              <div class="fr"><b class="viz-num">{{ fmtNum(fbRes.negativeSamples) }}</b><span>负样本</span></div>
              <div class="fr"><b class="viz-num">-{{ fbRes.removed }}</b><span>去重</span></div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="fbRunVisible = false">关闭</el-button>
        <el-button class="viz-btn is-hot" :loading="fbRunning" :icon="'Upload'" @click="doRunFb">开始回流</el-button>
      </template>
    </el-dialog>

    <!-- ============ 灰度发布 ============ -->
    <el-dialog v-model="grayVisible" title="灰度发布" width="540px" class="viz-dialog">
      <el-alert class="viz-alert" type="warning" :closable="false" show-icon>
        <template #title>
          <span class="viz-mini">灰度期间按比例分流，观察 7 天；指标异常可一键回滚至当前稳定版本</span>
        </template>
      </el-alert>
      <el-form class="viz-form" label-width="94px" style="margin-top: 12px">
        <el-form-item label="灰度版本">
          <el-input v-model="grayForm.version" />
        </el-form-item>
        <el-form-item label="灰度流量">
          <el-slider v-model="grayForm.trafficRatio" :min="5" :max="50" :step="5" show-input
            :marks="{ 5: '5%', 20: '20%', 50: '50%' }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="grayVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="graySaving" :icon="'Share'" @click="doGray">确认灰度发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mr4 { margin-right: 4px; }
.mi-kpi { margin-bottom: 12px; }

.mi-c1 {
  display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.mi-c2 {
  display: grid; grid-template-columns: 1fr 1.3fr 1.15fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.mi-c3 {
  display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.mi-q {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px;
  :deep(.el-button) { margin-left: 0 !important; }
}

.is-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- 样本比例条 ---------- */
.sbar {
  display: flex; height: 6px; border-radius: 3px; overflow: hidden;
  background: var(--zh-border-light);

  &__s {
    height: 100%;
    &.is-pos { background: var(--viz-lime); }
    &.is-neg { background: var(--viz-amber); }
  }
  &__t { margin-top: 3px; font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- 审核进度点 ---------- */
.sprog {
  display: flex; align-items: center; gap: 3px; flex-wrap: wrap;
  &__d {
    width: 7px; height: 7px; border-radius: 2px;
    &.is-lime { background: var(--viz-lime); box-shadow: 0 0 6px var(--viz-lime); }
    &.is-cyan { background: var(--viz-cyan); box-shadow: 0 0 6px var(--viz-cyan); }
    &.is-faint { background: var(--zh-border-strong); }
  }
  &__t { margin-left: 4px; }
}

/* ---------- 版本卡 ---------- */
.vers { display: flex; flex-direction: column; gap: 7px; max-height: 222px; }

.ver {
  padding: 8px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--vc);

  &--cyan { --vc: var(--viz-cyan); background: var(--zh-primary-lighter); }
  &--amber { --vc: var(--viz-amber); background: rgba(255, 184, 56, .07); }
  &--faint { --vc: var(--viz-text-faint); }

  &__h { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  &__v { font-size: 12px; font-weight: 800; color: var(--vc); }
  &__m {
    margin-top: 4px; font-size: 9.5px; color: var(--viz-text-faint);
    b { color: var(--viz-text-dim); }
  }
  &__c { margin-top: 4px; font-size: 10px; line-height: 1.6; color: var(--viz-text-dim); }
  &__a { margin-top: 3px; text-align: right; }
}

/* ---------- 规则监测 ---------- */
.rules { display: flex; flex-direction: column; gap: 6px; max-height: 248px; }

.rl {
  padding: 7px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--rlc);

  &.is-warn { --rlc: var(--viz-amber); }
  &.is-new { --rlc: var(--viz-cyan); }
  &.is-ok { --rlc: var(--viz-lime); }

  &__h { display: flex; align-items: center; gap: 5px; }
  &__id { font-size: 9.5px; font-weight: 700; color: var(--rlc); }
  &__n { margin-top: 3px; font-size: 11px; color: var(--viz-text); }
  &__f {
    display: flex; align-items: center; gap: 7px; margin-top: 4px;
  }
  &__fpr {
    font-size: 9.5px; color: var(--viz-text-dim);
    &.is-over { color: var(--viz-red); font-weight: 700; }
  }
  &__bar {
    flex: 1; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span { display: block; height: 100%; border-radius: 2px; background: var(--rlc); box-shadow: 0 0 6px var(--rlc); }
  }
}

/* ---------- 抽屉头 ---------- */
.fh, .oh {
  padding: 12px 14px; border-radius: 5px;
  background: linear-gradient(130deg, rgba(33, 230, 255, .15), var(--zh-bg-soft));
  border: 1px solid var(--viz-line-strong);

  &__n {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    font-size: 15px; font-weight: 800; color: var(--viz-text);
  }
  &__ver {
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
    color: var(--viz-lime); background: rgba(76, 245, 168, .13);
    border: 1px solid rgba(76, 245, 168, .3);
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 10.5px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--viz-cyan); }
  }
  &__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
}

/* ---------- 样本汇总网格 ---------- */
.sgrid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
}

.sg {
  padding: 9px 6px; text-align: center; border-radius: 4px;
  background: color-mix(in srgb, var(--sgc) 11%, transparent);
  border: 1px solid color-mix(in srgb, var(--sgc) 28%, transparent);

  &--cyan { --sgc: var(--viz-cyan); }
  &--lime { --sgc: var(--viz-lime); }
  &--amber { --sgc: var(--viz-amber); }
  &--red { --sgc: var(--viz-red); }
  &--pink { --sgc: var(--viz-pink); }
  &--violet { --sgc: var(--viz-violet); }

  b { display: block; font-size: 18px; font-weight: 800; color: var(--sgc); }
  span { font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- 数据处理链路 ---------- */
.dproc {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  @media (max-width: 800px) { grid-template-columns: repeat(2, 1fr); }
}

.dp {
  padding: 9px 8px; border-radius: 4px;
  background: color-mix(in srgb, var(--dpc) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--dpc) 26%, transparent);

  &--cyan { --dpc: var(--viz-cyan); }
  &--amber { --dpc: var(--viz-amber); }
  &--lime { --dpc: var(--viz-lime); }
  &--violet { --dpc: var(--viz-violet); }

  &__n { font-size: 10px; font-weight: 700; color: var(--dpc); }
  &__v { margin-top: 4px; font-size: 13px; font-weight: 800; color: var(--viz-text); }
  &__d { margin-top: 3px; font-size: 9px; line-height: 1.55; color: var(--viz-text-faint); }
}

/* ---------- 训练集划分 ---------- */
.tset {
  &__bar {
    display: flex; height: 22px; border-radius: 4px; overflow: hidden;
    background: var(--zh-border-light);
  }
  &__s {
    display: flex; align-items: center; justify-content: center;
    height: 100%; font-size: 9.5px; font-weight: 700; color: #fff;
    white-space: nowrap; overflow: hidden;
    &.is-train { background: var(--viz-lime); }
    &.is-val { background: var(--viz-cyan); }
    &.is-test { background: var(--viz-violet); }
  }
}

/* ---------- 数据安全 ---------- */
.sec { display: flex; flex-direction: column; gap: 7px; }

.sec__r {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 7px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  font-size: 10.5px; color: var(--viz-text-dim);
  :deep(.el-icon) { color: var(--viz-cyan); }
  > span { min-width: 54px; }
}
.sec__l { display: flex; flex-wrap: wrap; gap: 4px; }

/* ---------- 样本明细 ---------- */
.smps { display: flex; flex-direction: column; gap: 7px; }

.smp {
  padding: 8px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--smc);

  &--lime { --smc: var(--viz-lime); }
  &--red { --smc: var(--viz-red); background: rgba(255, 90, 95, .06); }

  &__h { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  &__id { font-size: 10px; font-weight: 700; color: var(--smc); }
  &__amt { margin-left: auto; font-size: 11.5px; font-weight: 800; color: var(--viz-text); }

  &__r {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    font-size: 10.5px; line-height: 1.65; color: var(--viz-amber);
    :deep(.el-icon) { flex-shrink: 0; margin-top: 3px; }
  }

  &__f {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 5px;
    padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
  }
  &__fl { font-size: 9px; color: var(--viz-text-faint); }
  &__ft {
    padding: 1px 6px; border-radius: 3px;
    background: var(--zh-border-light);
    font-size: 9px; color: var(--viz-text-dim);
    font-family: var(--zh-font-mono, monospace);
    b { color: var(--viz-cyan); }
  }
}

/* ---------- 五步审核流程 ---------- */
.rvflow {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
  @media (max-width: 800px) { grid-template-columns: repeat(3, 1fr); }
}

.rf {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px 5px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid color-mix(in srgb, var(--rfc) 26%, transparent);

  &--lime { --rfc: var(--viz-lime); }
  &--cyan { --rfc: var(--viz-cyan); box-shadow: 0 0 16px -7px var(--viz-cyan); }
  &--faint { --rfc: var(--viz-text-faint); }

  &__no {
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800;
    background: var(--rfc); color: #fff;
  }
  &__b { text-align: center; min-width: 0; width: 100%; }
  &__n { font-size: 10px; font-weight: 700; color: var(--viz-text); }
  &__a {
    margin-top: 2px; font-size: 8.5px; color: var(--viz-text-faint);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  &__t { margin-top: 2px; font-size: 8.5px; color: var(--viz-text-faint); }
}

/* ---------- 建议导航 ---------- */
.snav { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 4px; }

.snb {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; cursor: pointer;
  padding: 5px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid color-mix(in srgb, var(--snc) 24%, transparent);
  color: var(--viz-text-dim); font-size: 10.5px;
  transition: all .2s;

  &__id { font-weight: 800; color: var(--snc); }
  &:hover { border-color: var(--snc); }
  &.is-active {
    background: color-mix(in srgb, var(--snc) 15%, transparent);
    border-color: var(--snc); color: var(--viz-text);
    box-shadow: 0 0 14px -5px var(--snc);
  }
}

/* ---------- 建议详情 ---------- */
.sug {
  margin-top: 10px; padding: 12px 14px; border-radius: 5px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--sgc) 11%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--sgc) 30%, transparent);

  &__h { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  &__n { font-size: 13.5px; font-weight: 700; color: var(--viz-text); }

  &__conf {
    display: flex; align-items: center; gap: 8px; margin-top: 10px;
    font-size: 10.5px; color: var(--viz-text-faint);
    b { color: var(--sgc); font-size: 12px; }
  }
  &__cl { flex-shrink: 0; }
  &__cbar {
    flex: 1; max-width: 180px; height: 5px; border-radius: 3px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 3px;
      background: var(--sgc); box-shadow: 0 0 8px var(--sgc);
    }
  }

  &__desc {
    margin-top: 10px; padding: 8px 10px; border-radius: 4px;
    background: var(--zh-bg-soft);
    font-size: 11px; line-height: 1.75; color: var(--viz-text-dim);
  }

  &__ev {
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px;
  }

  &__reason {
    display: flex; align-items: flex-start; gap: 7px; margin-top: 11px;
    padding: 9px 11px; border-radius: 4px;
    background: var(--zh-primary-lighter);
    border: 1px solid var(--zh-primary-light);
    > :deep(.el-icon) { color: var(--viz-cyan); flex-shrink: 0; margin-top: 2px; }
    b { font-size: 11px; color: var(--viz-cyan); }
    p { margin: 5px 0 0; font-size: 11px; line-height: 1.85; color: var(--viz-text-dim); text-align: justify; }
  }

  &__impl {
    display: flex; align-items: center; gap: 8px; margin-top: 9px;
    font-size: 10.5px; color: var(--viz-text-dim);
  }

  &__dec {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 11px;
    padding: 9px 11px; border-radius: 4px;
    background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
    font-size: 11px; color: var(--viz-text);
    :deep(.el-icon) { color: var(--viz-lime); }
  }
  &__note {
    width: 100%; margin-top: 5px; padding-top: 5px;
    border-top: 1px dashed var(--zh-border-light);
    font-size: 10.5px; color: var(--viz-text-dim);
  }

  &__act {
    display: flex; gap: 7px; margin-top: 12px;
    padding-top: 10px; border-top: 1px dashed color-mix(in srgb, var(--sgc) 26%, transparent);
    :deep(.el-button) { flex: 1; margin-left: 0 !important; }
  }
}

.se {
  padding: 7px 12px; border-radius: 4px; text-align: center;
  background: color-mix(in srgb, var(--sec) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--sec) 28%, transparent);

  &--red { --sec: var(--viz-red); }
  &--amber { --sec: var(--viz-amber); }
  &--pink { --sec: var(--viz-pink); }
  &--cyan { --sec: var(--viz-cyan); }
  &--lime { --sec: var(--viz-lime); }

  b { display: block; font-size: 14px; font-weight: 800; color: var(--sec); }
  span { font-size: 9px; color: var(--viz-text-faint); }
}

/* ---------- 前后对比 ---------- */
.diff {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;
  margin-top: 11px;

  &--v {
    grid-template-columns: 1fr;
    .diff__ar { justify-self: center; }
  }

  &__i {
    padding: 8px 10px; border-radius: 4px;
    &.is-old { background: rgba(143, 171, 212, .09); border: 1px solid rgba(143, 171, 212, .24); }
    &.is-new { background: rgba(76, 245, 168, .1); border: 1px solid rgba(76, 245, 168, .3); }
  }
  &__l { display: block; font-size: 9px; color: var(--viz-text-faint); }
  &__v { margin-top: 4px; font-size: 11px; line-height: 1.7; color: var(--viz-text); }
  &__ar { color: var(--viz-cyan) !important; }
}

.acc {
  display: flex; align-items: center; gap: 8px; margin-top: 9px;
  padding: 8px 11px; border-radius: 4px;
  background: rgba(76, 245, 168, .08);
  border: 1px solid rgba(76, 245, 168, .24);
  font-size: 10.5px; color: var(--viz-text-faint);
  b { font-size: 14px; }
  :deep(.el-icon) { color: var(--viz-lime); }
}

.dr-act {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 回流结果 ---------- */
.fres {
  width: 100%; padding: 10px 12px; border-radius: 4px;
  background: rgba(76, 245, 168, .1);
  border: 1px solid rgba(76, 245, 168, .3);

  &__h {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: var(--viz-text);
    :deep(.el-icon) { color: var(--viz-lime); }
    b { color: var(--viz-lime); }
  }
  &__g { display: flex; gap: 18px; margin-top: 9px; flex-wrap: wrap; }
}

.fr {
  text-align: center;
  b { display: block; font-size: 15px; font-weight: 800; color: var(--viz-lime); }
  span { font-size: 9px; color: var(--viz-text-faint); }
}

:deep(.el-slider) {
  --el-slider-main-bg-color: var(--viz-cyan);
  --el-slider-runway-bg-color: var(--zh-border-light);
  --el-slider-stop-bg-color: var(--zh-border-strong);
}
:deep(.el-slider__marks-text) { color: var(--viz-text-faint) !important; font-size: 9.5px; }
:deep(.el-input-number .el-input__inner) { color: var(--viz-text) !important; }
</style>
